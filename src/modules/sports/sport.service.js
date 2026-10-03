const Sport = require('./sport.model');
const fail = (message, statusCode) => Object.assign(new Error(message), { statusCode });

const list = async (includeInactive = false) => ({
  success: true,
  data: await Sport.find(includeInactive ? {} : { status: 'ACTIVE' }).sort({ name: 1 })
});

const create = async (data) => {
  const sport = await Sport.create({ name: data.name, slug: data.slug, description: data.description, iconUrl: data.iconUrl });
  return { success: true, data: sport };
};

const update = async (id, data) => {
  const allowed = ['name', 'slug', 'description', 'iconUrl', 'status'];
  const changes = Object.fromEntries(allowed.filter((key) => data[key] !== undefined).map((key) => [key, data[key]]));
  const sport = await Sport.findByIdAndUpdate(id, { $set: changes }, { new: true, runValidators: true });
  if (!sport) throw fail('Sport not found', 404);
  return { success: true, data: sport };
};
module.exports = { list, create, update };
