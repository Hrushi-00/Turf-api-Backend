const Review = require('./review.model');
const Booking = require('../booking/booking.model');
const Facility = require('../venues/facility.model');
const Venue = require('../venues/venue.model');
const Business = require('../business/business.model');
const Turf = require('../turf/turf.model');
const fail = (message, statusCode) => Object.assign(new Error(message), { statusCode });

const create = async (userId, { bookingId, targetType: requestedType, rating, comment = '' }) => {
  const booking = await Booking.findOne({ _id: bookingId, user: userId, bookingStatus: 'completed' }).select('turf facility');
  if (!booking) throw fail('A review can only be submitted for your completed booking', 409);
  let targetType = booking.facility ? 'FACILITY' : 'TURF';
  let target = booking.facility || booking.turf;
  if (requestedType === 'VENUE' && booking.facility) {
    const facility = await Facility.findById(booking.facility).select('venue');
    if (!facility) throw fail('Booking facility was not found', 409);
    targetType = 'VENUE';
    target = facility.venue;
  } else if (requestedType && requestedType !== targetType) {
    throw fail('Review target must belong to the completed booking', 400);
  }
  if (!target) throw fail('Booking resource was not found', 409);
  try {
    return { success: true, data: await Review.create({ booking: booking._id, customer: userId, targetType, target, rating, comment, status: 'PENDING' }) };
  } catch (error) {
    if (error.code === 11000) throw fail('This booking already has a review', 409);
    throw error;
  }
};

const listMine = async (userId) => ({ success: true, data: await Review.find({ customer: userId }).populate('booking', 'date timeSlot').sort({ createdAt: -1 }) });
const listPublic = async ({ targetType, targetId, page = 1, limit = 20 }) => {
  const p = Math.max(parseInt(page, 10) || 1, 1); const size = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const filter = { status: 'PUBLISHED' };
  if (targetType) filter.targetType = targetType;
  if (targetId) filter.target = targetId;
  const [data, total] = await Promise.all([
    Review.find(filter).populate('customer', 'name').sort({ createdAt: -1 }).skip((p - 1) * size).limit(size),
    Review.countDocuments(filter)
  ]);
  return { success: true, data, total, page: p, pages: Math.ceil(total / size) };
};
const listAdmin = async ({ status = 'PENDING', page = 1, limit = 20 }) => {
  const p = Math.max(parseInt(page, 10) || 1, 1); const size = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const filter = status === 'ALL' ? {} : { status };
  const [data, total] = await Promise.all([
    Review.find(filter).populate('customer', 'name email').populate('booking', 'date timeSlot').sort({ createdAt: 1 }).skip((p - 1) * size).limit(size),
    Review.countDocuments(filter)
  ]);
  return { success: true, data, total, page: p, pages: Math.ceil(total / size) };
};
const moderate = async (adminId, id, status, reason = '') => {
  const review = await Review.findByIdAndUpdate(id, {
    $set: { status, moderationReason: status === 'HIDDEN' ? reason : '', moderatedBy: adminId, moderatedAt: new Date() }
  }, { new: true, runValidators: true });
  if (!review) throw fail('Review not found', 404);
  return { success: true, data: review };
};
const respond = async (ownerId, id, response) => {
  const review = await Review.findById(id);
  if (!review) throw fail('Review not found', 404);
  if (review.status !== 'PUBLISHED') throw fail('Only published reviews can receive a business response', 409);
  let ownsTarget = false;
  if (review.targetType === 'FACILITY') {
    const facility = await Facility.findById(review.target).select('venue');
    const business = await Business.findOne({ owner: ownerId }).select('_id');
    const venue = facility && business && await Venue.findOne({ _id: facility.venue, business: business._id });
    ownsTarget = !!venue;
  } else if (review.targetType === 'VENUE') {
    ownsTarget = !!(await Venue.exists({ _id: review.target, business: (await Business.findOne({ owner: ownerId }).select('_id'))?._id }));
  } else if (review.targetType === 'TURF') {
    ownsTarget = !!(await Turf.exists({ _id: review.target, 'ownerDetails.businessUserId': ownerId }));
  }
  if (!ownsTarget) throw fail('You do not own the reviewed resource', 403);
  review.businessResponse = response;
  review.respondedAt = new Date();
  await review.save();
  return { success: true, data: review };
};
module.exports = { create, listMine, listPublic, listAdmin, moderate, respond };
