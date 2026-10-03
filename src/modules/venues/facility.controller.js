const service = require('./facility.service');
const run = (fn, status = 200) => async (req, res) => {
  try { res.status(status).json(await fn(req)); }
  catch (error) { res.status(error.statusCode || 500).json({ success: false, message: error.message }); }
};
module.exports = {
  list: run((req) => service.list(req.user._id, req.params.venueId)),
  create: run((req) => service.create(req.user._id, req.params.venueId, req.body), 201),
  update: run((req) => service.update(req.user._id, req.params.venueId, req.params.facilityId, req.body)),
  publicAvailability: run((req) => service.publicAvailability(req.params.id, req.query.date)),
  listAvailabilityRules: run((req) => service.listAvailabilityRules(req.user._id, req.params.venueId, req.params.facilityId)),
  upsertAvailabilityRule: run((req) => service.upsertAvailabilityRule(req.user._id, req.params.venueId, req.params.facilityId, req.body), 201),
  deleteAvailabilityRule: run((req) => service.deleteAvailabilityRule(req.user._id, req.params.venueId, req.params.facilityId, req.params.ruleId)),
  listPricingRules: run((req) => service.listPricingRules(req.user._id, req.params.venueId, req.params.facilityId)),
  createPricingRule: run((req) => service.savePricingRule(req.user._id, req.params.venueId, req.params.facilityId, req.body), 201),
  updatePricingRule: run((req) => service.savePricingRule(req.user._id, req.params.venueId, req.params.facilityId, req.body, req.params.ruleId)),
  deletePricingRule: run((req) => service.deletePricingRule(req.user._id, req.params.venueId, req.params.facilityId, req.params.ruleId))
};
