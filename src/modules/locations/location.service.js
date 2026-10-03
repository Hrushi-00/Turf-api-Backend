const Location = require('./location.model');
const Business = require('../business/business.model');
const Venue = require('../venues/venue.model');

const fail = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const fields = ['name', 'address', 'landmark', 'city', 'state', 'country', 'postalCode', 'coordinates', 'timezone', 'status'];
const dataOnly = (data) => Object.fromEntries(fields.filter((key) => data[key] !== undefined).map((key) => [key, data[key]]));

const ownedBusiness = async (ownerId) => {
  const business = await Business.findOne({ owner: ownerId });
  if (!business) throw fail('Complete the business profile before adding locations', 409);
  return business;
};

const list = async (ownerId) => {
  const business = await ownedBusiness(ownerId);
  return { success: true, data: await Location.find({ business: business._id }).sort({ createdAt: -1 }) };
};

const create = async (ownerId, data) => {
  const business = await ownedBusiness(ownerId);
  return { success: true, data: await Location.create({ ...dataOnly(data), business: business._id }) };
};

const update = async (ownerId, id, data) => {
  const business = await ownedBusiness(ownerId);
  const location = await Location.findOneAndUpdate({ _id: id, business: business._id }, { $set: dataOnly(data) }, { new: true, runValidators: true });
  if (!location) throw fail('Location not found', 404);
  return { success: true, data: location };
};

const remove = async (ownerId, id) => {
  const business = await ownedBusiness(ownerId);
  const location = await Location.findOne({ _id: id, business: business._id });
  if (!location) throw fail('Location not found', 404);
  if (await Venue.exists({ location: location._id })) throw fail('Location has venues and cannot be deleted', 409);
  await location.deleteOne();
  return { success: true, message: 'Location deleted' };
};

module.exports = { list, create, update, remove };
