const Business = require('../business/business.model');
const Location = require('../locations/location.model');
const Venue = require('./venue.model');
const Facility = require('./facility.model');

const fail = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const allowed = ['name', 'description', 'media', 'amenities', 'contactPhone', 'operationalStatus'];
const pick = (data) => Object.fromEntries(allowed.filter((key) => data[key] !== undefined).map((key) => [key, data[key]]));

const getBusiness = async (ownerId) => {
  const business = await Business.findOne({ owner: ownerId });
  if (!business) throw fail('Complete the business profile first', 409);
  return business;
};

const listMine = async (ownerId) => {
  const business = await getBusiness(ownerId);
  return { success: true, data: await Venue.find({ business: business._id }).populate('location').sort({ createdAt: -1 }) };
};

const create = async (ownerId, locationId, data) => {
  const business = await getBusiness(ownerId);
  const location = await Location.findOne({ _id: locationId, business: business._id });
  if (!location) throw fail('Location not found', 404);
  const venue = await Venue.create({ ...pick(data), business: business._id, location: location._id });
  return { success: true, data: venue };
};

const update = async (ownerId, venueId, data) => {
  const business = await getBusiness(ownerId);
  const venue = await Venue.findOne({ _id: venueId, business: business._id });
  if (!venue) throw fail('Venue not found', 404);
  venue.set(pick(data));
  if (venue.isModified('name') || venue.isModified('description') || venue.isModified('media')) {
    venue.approvalStatus = 'PENDING';
    venue.reviewedBy = undefined;
    venue.reviewedAt = undefined;
  }
  await venue.save();
  return { success: true, data: venue };
};

const listPublic = async ({ city, sport, page = 1, limit = 20 } = {}) => {
  const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const locationQuery = city ? { city: new RegExp(city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), status: 'ACTIVE' } : { status: 'ACTIVE' };
  const locations = await Location.find(locationQuery).select('_id');
  const activeBusinesses = await Business.find({ approvalStatus: 'APPROVED', subscriptionStatus: 'ACTIVE', operationalStatus: 'ACTIVE' }).select('_id');
  const filter = { approvalStatus: 'APPROVED', operationalStatus: 'ACTIVE', business: { $in: activeBusinesses.map(({ _id }) => _id) }, location: { $in: locations.map(({ _id }) => _id) } };
  if (sport) {
    const facilities = await Facility.find({ sportSlugs: sport.toLowerCase(), status: 'ACTIVE' }).select('venue');
    filter._id = { $in: facilities.map(({ venue }) => venue) };
  }
  const [data, total] = await Promise.all([
    Venue.find(filter).populate('location').sort({ createdAt: -1 }).skip((pageNumber - 1) * pageSize).limit(pageSize),
    Venue.countDocuments(filter)
  ]);
  return { success: true, data, total, page: pageNumber, pages: Math.ceil(total / pageSize) };
};

const listForAdmin = async ({ status = 'PENDING', page = 1, limit = 20 } = {}) => {
  const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const filter = status === 'ALL' ? {} : { approvalStatus: status };
  const [data, total] = await Promise.all([
    Venue.find(filter).populate('business', 'displayName legalName approvalStatus')
      .populate('location').sort({ createdAt: -1 }).skip((pageNumber - 1) * pageSize).limit(pageSize),
    Venue.countDocuments(filter)
  ]);
  return { success: true, data, total, page: pageNumber, pages: Math.ceil(total / pageSize) };
};

const publicDetails = async (venueId) => {
  const venue = await Venue.findOne({ _id: venueId, approvalStatus: 'APPROVED', operationalStatus: 'ACTIVE' })
    .populate({ path: 'location' })
    .populate({ path: 'business', match: { approvalStatus: 'APPROVED', subscriptionStatus: 'ACTIVE', operationalStatus: 'ACTIVE' } });
  if (!venue || !venue.business || venue.location?.status !== 'ACTIVE') throw fail('Venue not found', 404);
  const facilities = await Facility.find({ venue: venue._id, status: 'ACTIVE' });
  return { success: true, data: { venue, facilities } };
};

const review = async (venueId, adminId, approvalStatus, reason = '') => {
  if (!['APPROVED', 'REJECTED', 'REQUIRES_ACTION'].includes(approvalStatus)) throw fail('Invalid approval status', 400);
  const venue = await Venue.findById(venueId);
  if (!venue) throw fail('Venue not found', 404);
  const business = await Business.findById(venue.business);
  if (!business || business.approvalStatus !== 'APPROVED') throw fail('Approve the business before approving its venues', 409);
  venue.approvalStatus = approvalStatus;
  venue.rejectionReason = approvalStatus === 'APPROVED' ? '' : reason;
  venue.reviewedBy = adminId;
  venue.reviewedAt = new Date();
  await venue.save();
  return { success: true, data: venue };
};

module.exports = { listMine, create, update, listPublic, listForAdmin, publicDetails, review };
