const Booking = require('./booking.model');
const Turf = require('../turf/turf.model');
const User = require('../user/user.model');
const SlotHold = require('./slot-hold.model');
const Facility = require('../venues/facility.model');
const Venue = require('../venues/venue.model');
const Business = require('../business/business.model');
const Location = require('../locations/location.model');
const facilityRules = require('../venues/facility-rules.service');
const notificationService = require('../notifications/notification.service');
const membershipService = require('../memberships/membership.service');
const loyaltyService = require('../loyalty/loyalty.service');
const { randomUUID } = require('crypto');

const BOOKING_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed'
};

// Booking dates are date-only values interpreted in UTC until each turf has an
// IANA timezone. Never use the API host's local timezone for date matching.
const normalizeDateRange = (date) => {
  const start = new Date(`${new Date(date).toISOString().slice(0, 10)}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
};

const slotMinutes = (slot) => {
  const [from, to] = slot.split('-').map((part) => {
    const [hours, minutes] = part.trim().split(':').map(Number);
    return hours * 60 + minutes;
  });
  return { from, to };
};

const slotBuckets = ({ from, to }) => {
  if (from % 15 !== 0 || to % 15 !== 0) {
    throw httpError('Bookings must start and end on a 15-minute boundary', 400);
  }
  const buckets = [];
  for (let minute = from; minute < to; minute += 15) buckets.push(minute);
  return buckets;
};

const overlaps = (left, right) => {
  const a = slotMinutes(left);
  const b = slotMinutes(right);
  return a.from < b.to && b.from < a.to;
};

const httpError = (message, statusCode) => Object.assign(new Error(message), { statusCode });

const isWeekend = (date) => {
  const day = new Date(date).getUTCDay();
  return day === 0 || day === 6;
};

const toMinutes = (time) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const assertFutureLocalSlot = (dateValue, startMinute, timezone) => {
  let localParts;
  try {
    localParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date());
  } catch (_) {
    throw httpError('Invalid venue timezone configuration', 409);
  }
  const value = Object.fromEntries(localParts.map((part) => [part.type, part.value]));
  const localDate = `${value.year}-${value.month}-${value.day}`;
  if (dateValue < localDate) throw httpError('Booking date is in the past for this venue', 400);
  if (dateValue === localDate && startMinute <= Number(value.hour) * 60 + Number(value.minute)) {
    throw httpError('Selected time has already passed at this venue', 409);
  }
};

const canManageBooking = (booking, user) => {
  if (!user) return false;
  if (user.role === 'Admin' || user.role === 'SuperAdmin') return true;
  if (user.role === 'BusinessUser') return String(booking.admin) === String(user._id);
  return String(booking.user) === String(user._id);
};

const findConflictingBookings = (resourceType, resourceId, start, end) => Booking.find({
  [resourceType === 'TURF' ? 'turf' : 'facility']: resourceId,
  date: { $gte: start, $lt: end },
  $or: [
    { bookingStatus: BOOKING_STATUS.CONFIRMED },
    { bookingStatus: BOOKING_STATUS.PENDING, $or: [{ holdExpiresAt: { $gt: new Date() } }, { holdExpiresAt: { $exists: false } }] }
  ]
}).select('timeSlot');

const reserveSlot = async ({ resourceType, resourceId, bookingDate, timeSlot, requestedSlot, userId, ownerId, price, currency = 'INR', paymentMethod, bookingResource, pricingSnapshot, policySnapshot, idempotencyKey }) => {
  const { start } = normalizeDateRange(bookingDate);
  const reservationId = randomUUID();
  const holdExpiresAt = new Date(Date.now() + (Number(process.env.BOOKING_HOLD_MINUTES) || 10) * 60 * 1000);
  const holds = slotBuckets(requestedSlot).map((bucketStart) => ({
    resourceType, resourceId, dateKey: start.toISOString().slice(0, 10), bucketStart, reservationId, expiresAt: holdExpiresAt
  }));
  try {
    await SlotHold.deleteMany({
      resourceType, resourceId, dateKey: start.toISOString().slice(0, 10),
      bucketStart: { $in: holds.map((hold) => hold.bucketStart) }, expiresAt: { $lte: new Date() }
    });
    await SlotHold.insertMany(holds, { ordered: true });
  } catch (error) {
    await SlotHold.deleteMany({ reservationId });
    if (error.code === 11000) throw httpError('This time slot is already reserved', 409);
    throw error;
  }

  try {
    const [booking] = await Booking.create([{
      user: userId, admin: ownerId, date: bookingDate, timeSlot, price, pricingSnapshot, policySnapshot, idempotencyKey,
      currency,
      paymentMethod: paymentMethod || 'online', holdExpiresAt, reservationId, ...bookingResource
    }]);
    return booking;
  } catch (error) {
    await SlotHold.deleteMany({ reservationId });
    throw error;
  }
};

const createTurfBooking = async (data) => {
  const { userId, turfId, date, timeSlot, paymentMethod, idempotencyKey } = data;

  const turf = await Turf.findById(turfId);
  if (!turf || turf.status !== 'active' || !turf.metaInfo?.isApproved) {
    throw httpError('Turf not found or not available for booking', 404);
  }

  const adminId = turf.ownerDetails?.businessUserId || turf.ownerDetails?.adminId;
  if (!adminId) {
    throw httpError('Turf owner not found, cannot create booking', 409);
  }
  if (turf.ownerDetails?.businessUserId) {
    const business = await Business.findOne({ owner: turf.ownerDetails.businessUserId, approvalStatus: 'APPROVED', subscriptionStatus: 'ACTIVE', operationalStatus: 'ACTIVE' });
    if (!business) throw httpError('Business subscription is not active', 409);
  }

  const bookingDate = new Date(date);
  if (Number.isNaN(bookingDate.getTime())) {
    throw httpError('Invalid date format', 400);
  }

  const { start, end } = normalizeDateRange(bookingDate);
  const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][bookingDate.getUTCDay()];
  const requestedSlot = slotMinutes(timeSlot);
  assertFutureLocalSlot(date, requestedSlot.from, turf.timezone);
  const opening = turf.availability?.openingTime;
  const closing = turf.availability?.closingTime;
  if (turf.availability?.closedDays?.some((day) => day.toLowerCase() === dayName.toLowerCase())) {
    throw httpError('Turf is closed on the selected date', 409);
  }
  if (opening && closing && (requestedSlot.from < toMinutes(opening) || requestedSlot.to > toMinutes(closing))) {
    throw httpError('Selected time is outside turf operating hours', 409);
  }
  if (turf.availability?.customUnavailableDates?.some((blockedDate) => {
    const blocked = normalizeDateRange(blockedDate);
    return blocked.start < end && start < blocked.end;
  })) {
    throw httpError('Turf is unavailable on the selected date', 409);
  }

  const existingBookings = await findConflictingBookings('TURF', turf._id, start, end);

  if (existingBookings.some((booking) => overlaps(booking.timeSlot, timeSlot))) {
    throw httpError('This time slot is already booked for the selected date', 409);
  }

  const price = isWeekend(bookingDate)
    ? turf.pricing.weekendRate
    : turf.pricing.weekdayRate;

  if (!Number.isFinite(price) || price < 0) {
    throw httpError('Turf pricing is not configured', 409);
  }

  const currency = turf.pricing.currency || 'INR';
  const membership = await membershipService.activeForUser(userId);
  const baseAmountPaise = Math.round(price * 100);
  const membershipDiscountPaise = Math.round(baseAmountPaise * (membership?.discountBps || 0) / 10000);
  const roundedPrice = (baseAmountPaise - membershipDiscountPaise) / 100;
  const durationMinutes = requestedSlot.to - requestedSlot.from;
  const booking = await reserveSlot({
    resourceType: 'TURF', resourceId: turf._id, bookingDate, timeSlot, requestedSlot, userId, ownerId: adminId,
    price: roundedPrice, currency, paymentMethod, bookingResource: { turf: turf._id },
    pricingSnapshot: {
      currency, amount: roundedPrice, baseAmount: price, membershipDiscountPaise,
      membershipDiscountBps: membership?.discountBps || 0, membershipId: membership?._id,
      durationMinutes, calculation: 'LEGACY_TURF_DAY_RATE', baseRate: price,
      dayType: isWeekend(bookingDate) ? 'WEEKEND' : 'WEEKDAY'
    },
    idempotencyKey,
    policySnapshot: { cancellationPolicy: turf.pricing.cancellationPolicy || null, version: 'LEGACY_TEXT' }
  });

  const populatedBooking = await Booking.populate(booking, [
    { path: 'user', select: 'name email contactNumber' },
    { path: 'turf', select: 'turfDetails.turfName location pricing' },
    { path: 'admin', select: 'username email role' }
  ]);

  await Promise.all([
    Turf.findByIdAndUpdate(turf._id, {
      $inc: {
        'metaInfo.totalBookings': 1,
        'metaInfo.popularityScore': 1
      }
    }),
    User.findByIdAndUpdate(userId, {
      $addToSet: { bookings: booking._id }
    })
  ]);

  return {
    success: true,
    message: 'Booking created successfully',
    booking: populatedBooking
  };
};

const createFacilityBooking = async ({ userId, facilityId, date, timeSlot, paymentMethod, idempotencyKey }) => {
  const facility = await Facility.findById(facilityId);
  if (!facility || facility.status !== 'ACTIVE') throw httpError('Facility not found or unavailable', 404);
  const venue = await Venue.findOne({ _id: facility.venue, approvalStatus: 'APPROVED', operationalStatus: 'ACTIVE' });
  if (!venue) throw httpError('Venue is not available for booking', 409);
  const [business, location] = await Promise.all([
    Business.findOne({ _id: venue.business, approvalStatus: 'APPROVED', subscriptionStatus: 'ACTIVE', operationalStatus: 'ACTIVE' }),
    Location.findOne({ _id: venue.location, status: 'ACTIVE' })
  ]);
  if (!business || !location) throw httpError('Business or location is not active', 409);

  const bookingDate = new Date(date);
  if (Number.isNaN(bookingDate.getTime())) throw httpError('Invalid date format', 400);
  const { start, end } = normalizeDateRange(bookingDate);
  const requestedSlot = slotMinutes(timeSlot);
  assertFutureLocalSlot(date, requestedSlot.from, location.timezone);
  slotBuckets(requestedSlot);
  const dateValue = date.slice(0, 10);
  const { dayOfWeek, availability, pricingRules } = await facilityRules.getDateRules(facility._id, dateValue);
  const schedule = facilityRules.resolveSchedule(facility, dayOfWeek, availability);
  if (schedule.isClosed) throw httpError('Facility is closed on the selected date', 409);
  if (schedule.openTime && schedule.closeTime && (requestedSlot.from < toMinutes(schedule.openTime) || requestedSlot.to > toMinutes(schedule.closeTime))) {
    throw httpError('Selected time is outside facility operating hours', 409);
  }
  const asTime = (minute) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
  if (availability?.windows.some((window) => facilityRules.overlapsWindow({ start: asTime(requestedSlot.from), end: asTime(requestedSlot.to) }, window))) {
    throw httpError('Facility is under maintenance during the selected time', 409);
  }
  const durationMinutes = requestedSlot.to - requestedSlot.from;
  if (durationMinutes < facility.pricing.minimumBookingMinutes) throw httpError('Selected slot is shorter than the minimum booking duration', 400);
  const conflicts = await findConflictingBookings('FACILITY', facility._id, start, end);
  if (conflicts.some((booking) => overlaps(booking.timeSlot, timeSlot))) throw httpError('This time slot is already booked', 409);

  let totalPrice = 0;
  const rateSegments = [];
  for (let minute = requestedSlot.from; minute < requestedSlot.to; minute += 15) {
    const rate = facilityRules.resolveRateDetails(facility, dateValue, dayOfWeek, minute, pricingRules);
    totalPrice += rate.hourlyRate / 4;
    const lastSegment = rateSegments[rateSegments.length - 1];
    if (lastSegment && lastSegment.hourlyRate === rate.hourlyRate && String(lastSegment.pricingRuleId || '') === String(rate.pricingRuleId || '')) {
      lastSegment.endTime = `${String(Math.floor((minute + 15) / 60)).padStart(2, '0')}:${String((minute + 15) % 60).padStart(2, '0')}`;
    } else {
      rateSegments.push({
        startTime: `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`,
        endTime: `${String(Math.floor((minute + 15) / 60)).padStart(2, '0')}:${String((minute + 15) % 60).padStart(2, '0')}`,
        ...rate
      });
    }
  }
  const membership = await membershipService.activeForUser(userId);
  const baseAmountPaise = Math.round(totalPrice * 100);
  const membershipDiscountPaise = Math.round(baseAmountPaise * (membership?.discountBps || 0) / 10000);
  const price = (baseAmountPaise - membershipDiscountPaise) / 100;
  const currency = facility.pricing.currency || 'INR';
  const booking = await reserveSlot({
    resourceType: 'FACILITY', resourceId: facility._id, bookingDate, timeSlot, requestedSlot,
    userId, ownerId: business.owner, price, currency, paymentMethod, bookingResource: { facility: facility._id },
    pricingSnapshot: {
      currency, amount: price, baseAmount: totalPrice, membershipDiscountPaise,
      membershipDiscountBps: membership?.discountBps || 0, membershipId: membership?._id,
      durationMinutes, calculation: 'TIME_RULES_15_MIN', rateSegments
    },
    idempotencyKey,
    policySnapshot: { cancellationPolicy: null, version: 'UNCONFIGURED' }
  });
  const populatedBooking = await Booking.populate(booking, [
    { path: 'user', select: 'name email contactNumber' },
    { path: 'facility', select: 'name sportSlugs pricing' },
    { path: 'admin', select: 'username email role' }
  ]);
  await User.findByIdAndUpdate(userId, { $addToSet: { bookings: booking._id } });
  return { success: true, message: 'Booking created successfully', booking: populatedBooking };
};

const normalizeSlot = (slot) => slot.split('-').map((part) => {
  const [hours, minutes] = part.trim().split(':').map(Number);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}).join('-');

const bookingMatchesRequest = (booking, data) =>
  String(booking.turf || '') === String(data.turfId || '') &&
  String(booking.facility || '') === String(data.facilityId || '') &&
  booking.date.toISOString().slice(0, 10) === data.date &&
  normalizeSlot(booking.timeSlot) === normalizeSlot(data.timeSlot) &&
  booking.paymentMethod === (data.paymentMethod || 'online');

const createBooking = async (data) => {
  const notifyCreated = async (result) => {
    const booking = result.booking;
    if (booking?._id) await notificationService.enqueue({
      eventKey: `booking-created:${booking._id}`, recipient: data.userId, recipientType: 'USER',
      eventType: 'BookingCreated', title: 'Booking request received', message: 'Your booking is awaiting payment confirmation.',
      data: { bookingId: booking._id, bookingStatus: booking.bookingStatus }
    });
    return result;
  };
  const findReplay = async () => {
    if (!data.idempotencyKey) return null;
    const existing = await Booking.findOne({ user: data.userId, idempotencyKey: data.idempotencyKey }).select('+idempotencyKey');
    if (!existing) return null;
    if (!bookingMatchesRequest(existing, data)) throw httpError('Idempotency-Key was already used for a different booking request', 409);
    const booking = await Booking.populate(existing, [
      { path: 'user', select: 'name email contactNumber' },
      { path: 'turf', select: 'turfDetails.turfName location pricing gallery' },
      { path: 'facility', select: 'name sportSlugs pricing venue' },
      { path: 'admin', select: 'username email role' }
    ]);
    return { success: true, message: 'Booking already created for this idempotency key', booking, idempotentReplay: true };
  };
  const existing = await findReplay();
  if (existing) return notifyCreated(existing);
  try {
    return notifyCreated(data.facilityId ? await createFacilityBooking(data) : await createTurfBooking(data));
  } catch (error) {
    if (error.code === 11000 && data.idempotencyKey) {
      const replay = await findReplay();
      if (replay) return replay;
    }
    throw error;
  }
};

const getAdminBookings = async (user) => {
  const query =
    user.role === 'Admin' || user.role === 'SuperAdmin'
      ? {}
      : { admin: user._id };

  const bookings = await Booking.find(query)
    .populate('user', 'name email contactNumber')
    .populate('turf', 'turfDetails.turfName location pricing')
    .populate('facility', 'name sportSlugs pricing venue')
    .sort({ date: -1, createdAt: -1 });

  return {
    success: true,
    count: bookings.length,
    bookings
  };
};

const getUserBookings = async (userId) => {
  const bookings = await Booking.find({ user: userId })
    .populate('turf', 'turfDetails.turfName location pricing gallery')
    .populate('facility', 'name sportSlugs pricing venue')
    .populate('admin', 'username email role')
    .sort({ date: -1, createdAt: -1 });

  return {
    success: true,
    count: bookings.length,
    bookings
  };
};

const getAllBookings = async () => {
  const bookings = await Booking.find()
    .populate('user', 'name email contactNumber')
    .populate('turf', 'turfDetails.turfName location')
    .populate('facility', 'name sportSlugs venue')
    .populate('admin', 'username email role')
    .sort({ date: -1, createdAt: -1 });

  return {
    success: true,
    count: bookings.length,
    bookings
  };
};

const getBookingById = async (params, user) => {
  const booking = await Booking.findById(params.id)
    .populate('user', 'name email contactNumber')
    .populate('turf', 'turfDetails.turfName location pricing')
    .populate('facility', 'name sportSlugs pricing venue')
    .populate('admin', 'username email role');

  if (!booking) {
    throw httpError('Booking not found', 404);
  }

  if (!canManageBooking(booking, user)) {
    throw httpError('You are not allowed to view this booking', 403);
  }

  return { success: true, booking };
};

const updateBookingStatus = async (params, updates, user) => {
  const { id } = params;
  const { bookingStatus, paymentStatus } = updates;

  const booking = await Booking.findById(id).select('+reservationId');
  if (!booking) throw httpError('Booking not found', 404);
  const isAdmin = user?.role === 'Admin' || user?.role === 'SuperAdmin';
  const isOwner = user?.role === 'BusinessUser' && String(booking.admin) === String(user._id);
  if (!isAdmin && !isOwner) throw httpError('You are not allowed to update this booking', 403);
  if (bookingStatus) {
    const allowedTransitions = {
      [BOOKING_STATUS.PENDING]: [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.CANCELLED],
      [BOOKING_STATUS.CONFIRMED]: [BOOKING_STATUS.COMPLETED, BOOKING_STATUS.CANCELLED]
    };
    if (!allowedTransitions[booking.bookingStatus]?.includes(bookingStatus)) {
      throw httpError(`Cannot change booking from ${booking.bookingStatus} to ${bookingStatus}`, 409);
    }
  }

  // Payment state is controlled by provider verification/webhooks, never a
  // customer or business request body.
  if (paymentStatus !== undefined) throw httpError('Payment status can only be changed by verified payment processing', 403);
  if (bookingStatus === BOOKING_STATUS.CONFIRMED) {
    if (booking.paymentMethod !== 'cash' && booking.paymentStatus !== 'paid') {
      throw httpError('Online payment must be captured before confirming the booking', 409);
    }
    const activeHold = await SlotHold.exists({ reservationId: booking.reservationId, expiresAt: { $gt: new Date() } });
    if (!activeHold) throw httpError('The booking hold expired; create a new booking request', 409);
  }
  if (bookingStatus === BOOKING_STATUS.CANCELLED && booking.paymentStatus === 'paid') {
    throw httpError('A paid booking must be refunded before cancellation', 409);
  }

  const updatedBooking = await Booking.findByIdAndUpdate(
    id,
    {
      $set: {
        ...(bookingStatus ? { bookingStatus } : {}),
        ...(bookingStatus === BOOKING_STATUS.CONFIRMED ? { holdExpiresAt: null } : {}),
        ...(paymentStatus ? { paymentStatus } : {})
      }
    },
    { new: true, runValidators: true }
  )
    .populate('user', 'name email contactNumber')
    .populate('turf', 'turfDetails.turfName location pricing')
    .populate('admin', 'username email role');

  if (!updatedBooking) {
    throw httpError('Booking not found', 404);
  }

  if (bookingStatus === BOOKING_STATUS.CANCELLED && booking.reservationId) {
    await SlotHold.deleteMany({ reservationId: booking.reservationId });
  } else if (bookingStatus === BOOKING_STATUS.CONFIRMED && booking.reservationId) {
    const date = booking.date.toISOString().slice(0, 10);
    const slotEnd = new Date(new Date(`${date}T00:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000);
    await SlotHold.updateMany({ reservationId: booking.reservationId }, { $set: { expiresAt: slotEnd } });
  }
  if (bookingStatus && ['confirmed', 'cancelled', 'completed'].includes(bookingStatus)) await notificationService.enqueue({
    eventKey: `booking-status:${updatedBooking._id}:${bookingStatus}`,
    recipient: updatedBooking.user, recipientType: 'USER',
    eventType: `Booking${bookingStatus[0].toUpperCase()}${bookingStatus.slice(1)}`,
    title: `Booking ${bookingStatus}`, message: `Your booking status is now ${bookingStatus}.`,
    data: { bookingId: updatedBooking._id, status: bookingStatus }
  });
  if (bookingStatus === BOOKING_STATUS.COMPLETED) loyaltyService.awardCompletedBooking(updatedBooking._id)
    .catch((error) => console.error('Loyalty award failed:', error.message));

  return {
    success: true,
    message: 'Booking updated successfully',
    booking: updatedBooking
  };
};

const cancelBooking = async (params, user) => {
  const booking = await Booking.findById(params.id).select('+reservationId');

  if (!booking) {
    throw httpError('Booking not found', 404);
  }

  if (
    String(booking.user) !== String(user._id) &&
    user.role !== 'Admin' &&
    user.role !== 'SuperAdmin' &&
    !(user.role === 'BusinessUser' && String(booking.admin) === String(user._id))
  ) {
    throw httpError('You are not allowed to cancel this booking', 403);
  }

  if (![BOOKING_STATUS.PENDING, BOOKING_STATUS.CONFIRMED].includes(booking.bookingStatus)) {
    throw httpError(`A ${booking.bookingStatus} booking cannot be cancelled`, 409);
  }
  if (booking.paymentStatus === 'paid') {
    throw httpError('A paid booking requires the refund workflow before cancellation', 409);
  }

  booking.bookingStatus = BOOKING_STATUS.CANCELLED;
  await booking.save();
  if (booking.reservationId) await SlotHold.deleteMany({ reservationId: booking.reservationId });
  await notificationService.enqueue({
    eventKey: `booking-cancelled:${booking._id}`, recipient: booking.user, recipientType: 'USER',
    eventType: 'BookingCancelled', title: 'Booking cancelled', message: 'Your booking was cancelled.', data: { bookingId: booking._id }
  });

  return {
    success: true,
    message: 'Booking cancelled successfully',
    booking
  };
};

module.exports = {
  createBooking,
  getAdminBookings,
  getUserBookings,
  getAllBookings,
  getBookingById,
  updateBookingStatus,
  cancelBooking
};
