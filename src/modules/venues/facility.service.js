const Business = require('../business/business.model');
const Venue = require('./venue.model');
const Facility = require('./facility.model');
const Sport = require('../sports/sport.model');
const Booking = require('../booking/booking.model');
const Location = require('../locations/location.model');
const FacilityAvailability = require('./facility-availability.model');
const FacilityPricingRule = require('./facility-pricing-rule.model');
const facilityRules = require('./facility-rules.service');

const fail = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const fields = ['name', 'sportSlugs', 'facilityType', 'surfaceType', 'capacity', 'description', 'amenities', 'weeklySchedule', 'pricing', 'status'];
const pick = (data) => Object.fromEntries(fields.filter((key) => data[key] !== undefined).map((key) => [key, data[key]]));

const ownedVenue = async (ownerId, venueId) => {
  const business = await Business.findOne({ owner: ownerId });
  const venue = business && await Venue.findOne({ _id: venueId, business: business._id });
  if (!venue) throw fail('Venue not found', 404);
  return venue;
};

const validateSports = async (slugs) => {
  const normalized = [...new Set(slugs.map((slug) => slug.toLowerCase()))];
  const count = await Sport.countDocuments({ slug: { $in: normalized }, status: 'ACTIVE' });
  if (count !== normalized.length) throw fail('One or more sports are inactive or unknown', 400);
  return normalized;
};

const list = async (ownerId, venueId) => {
  const venue = await ownedVenue(ownerId, venueId);
  return { success: true, data: await Facility.find({ venue: venue._id }).sort({ createdAt: -1 }) };
};

const publicAvailability = async (facilityId, dateValue) => {
  const facility = await Facility.findOne({ _id: facilityId, status: 'ACTIVE' });
  if (!facility) throw fail('Facility not found', 404);
  const venue = await Venue.findOne({ _id: facility.venue, approvalStatus: 'APPROVED', operationalStatus: 'ACTIVE' });
  if (!venue) throw fail('Venue not found', 404);
  const [business, location] = await Promise.all([
    Business.findOne({ _id: venue.business, approvalStatus: 'APPROVED', subscriptionStatus: 'ACTIVE', operationalStatus: 'ACTIVE' }),
    Location.findOne({ _id: venue.location, status: 'ACTIVE' })
  ]);
  if (!business || !location) throw fail('Facility is not available', 404);
  const date = new Date(`${dateValue}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw fail('Date must use YYYY-MM-DD format', 400);
  const { dayOfWeek, availability, pricingRules } = await facilityRules.getDateRules(facility._id, dateValue);
  const schedule = facilityRules.resolveSchedule(facility, dayOfWeek, availability);
  const nextDate = new Date(date.getTime() + 24 * 60 * 60 * 1000);
  const bookings = await Booking.find({
    facility: facility._id,
    date: { $gte: date, $lt: nextDate },
    $or: [
      { bookingStatus: 'confirmed' },
      { bookingStatus: 'pending', $or: [{ holdExpiresAt: { $gt: new Date() } }, { holdExpiresAt: { $exists: false } }] }
    ]
  }).select('timeSlot bookingStatus');
  const SlotHold = require('../booking/slot-hold.model');
  const holds = await SlotHold.find({ resourceType: 'FACILITY', resourceId: facility._id, dateKey: dateValue, expiresAt: { $gt: new Date() } }).select('bucketStart').lean();
  const activeMaintenance = availability?.windows || [];
  const bookedTimeSlots = bookings.map(({ timeSlot }) => timeSlot);
  const heldBuckets = holds.map(({ bucketStart }) => bucketStart);
  const rateRules = pricingRules.map(({ name, daysOfWeek, startTime, endTime, hourlyRate, priority }) => ({ name, daysOfWeek, startTime, endTime, hourlyRate, priority }));
  return {
    success: true,
    data: {
      date: dateValue,
      timezone: location.timezone,
      isClosed: schedule.isClosed,
      openTime: schedule.openTime,
      closeTime: schedule.closeTime,
      minimumBookingMinutes: facility.pricing.minimumBookingMinutes,
      pricing: facility.pricing,
      pricingRules: rateRules,
      exception: availability ? { type: availability.type, reason: availability.reason, windows: availability.windows } : null,
      bookedSlots: bookedTimeSlots,
      heldBuckets,
      maintenanceWindows: activeMaintenance
    }
  };
};

const ownedFacility = async (ownerId, venueId, facilityId) => {
  const venue = await ownedVenue(ownerId, venueId);
  const facility = await Facility.findOne({ _id: facilityId, venue: venue._id });
  if (!facility) throw fail('Facility not found', 404);
  return facility;
};

const listAvailabilityRules = async (ownerId, venueId, facilityId) => {
  const facility = await ownedFacility(ownerId, venueId, facilityId);
  return { success: true, data: await FacilityAvailability.find({ facility: facility._id }).sort({ date: 1 }) };
};

const upsertAvailabilityRule = async (ownerId, venueId, facilityId, data) => {
  const facility = await ownedFacility(ownerId, venueId, facilityId);
  if (data.type === 'OVERRIDE' && data.openTime >= data.closeTime) throw fail('Override closeTime must be after openTime', 400);
  if ((data.windows || []).some((window) => window.startTime >= window.endTime)) throw fail('Availability window endTime must be after startTime', 400);
  const date = new Date(`${data.date}T00:00:00.000Z`);
  const rule = await FacilityAvailability.findOneAndUpdate(
    { facility: facility._id, date },
    { $set: { type: data.type, openTime: data.openTime, closeTime: data.closeTime, windows: data.windows || [], reason: data.reason || '' } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
  return { success: true, data: rule };
};

const deleteAvailabilityRule = async (ownerId, venueId, facilityId, ruleId) => {
  const facility = await ownedFacility(ownerId, venueId, facilityId);
  const rule = await FacilityAvailability.findOneAndDelete({ _id: ruleId, facility: facility._id });
  if (!rule) throw fail('Availability rule not found', 404);
  return { success: true, message: 'Availability rule deleted' };
};

const listPricingRules = async (ownerId, venueId, facilityId) => {
  const facility = await ownedFacility(ownerId, venueId, facilityId);
  return { success: true, data: await FacilityPricingRule.find({ facility: facility._id }).sort({ priority: -1, createdAt: -1 }) };
};

const savePricingRule = async (ownerId, venueId, facilityId, data, ruleId) => {
  const facility = await ownedFacility(ownerId, venueId, facilityId);
  const changes = Object.fromEntries(['name', 'daysOfWeek', 'startTime', 'endTime', 'hourlyRate', 'effectiveFrom', 'effectiveTo', 'priority', 'status']
    .filter((key) => data[key] !== undefined).map((key) => [key, data[key]]));
  if (changes.startTime && changes.endTime && changes.startTime >= changes.endTime) throw fail('Pricing rule endTime must be after startTime', 400);
  const effectiveFrom = changes.effectiveFrom && new Date(changes.effectiveFrom);
  const effectiveTo = changes.effectiveTo && new Date(changes.effectiveTo);
  if (effectiveFrom && effectiveTo && effectiveFrom > effectiveTo) throw fail('Pricing rule effectiveTo must be on or after effectiveFrom', 400);
  const rule = ruleId
    ? await FacilityPricingRule.findOneAndUpdate({ _id: ruleId, facility: facility._id }, { $set: changes }, { new: true, runValidators: true })
    : await FacilityPricingRule.create({ ...changes, facility: facility._id });
  if (!rule) throw fail('Pricing rule not found', 404);
  return { success: true, data: rule };
};

const deletePricingRule = async (ownerId, venueId, facilityId, ruleId) => {
  const facility = await ownedFacility(ownerId, venueId, facilityId);
  const rule = await FacilityPricingRule.findOneAndDelete({ _id: ruleId, facility: facility._id });
  if (!rule) throw fail('Pricing rule not found', 404);
  return { success: true, message: 'Pricing rule deleted' };
};

const create = async (ownerId, venueId, data) => {
  const venue = await ownedVenue(ownerId, venueId);
  const values = pick(data);
  values.sportSlugs = await validateSports(values.sportSlugs);
  return { success: true, data: await Facility.create({ ...values, venue: venue._id }) };
};

const update = async (ownerId, venueId, facilityId, data) => {
  const venue = await ownedVenue(ownerId, venueId);
  const changes = pick(data);
  if (changes.sportSlugs) changes.sportSlugs = await validateSports(changes.sportSlugs);
  const facility = await Facility.findOneAndUpdate({ _id: facilityId, venue: venue._id }, { $set: changes }, { new: true, runValidators: true });
  if (!facility) throw fail('Facility not found', 404);
  return { success: true, data: facility };
};

module.exports = { list, create, update, publicAvailability, listAvailabilityRules, upsertAvailabilityRule, deleteAvailabilityRule, listPricingRules, savePricingRule, deletePricingRule };
