const service = require('./membership.service');
const run = (fn, status = 200) => async (req, res) => {
  try { res.status(status).json(await fn(req)); }
  catch (error) { res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Internal server error' }); }
};
module.exports = {
  plans: run(() => service.listPlans()),
  mine: run((req) => service.current(req.user._id)),
  purchase: run((req) => service.purchase(req.user._id, req.body, req.get('Idempotency-Key')), 201),
  adminPlans: run(() => service.listAdminPlans()),
  createPlan: run((req) => service.createPlan(req.user._id, req.body), 201),
  updatePlan: run((req) => service.updatePlan(req.params.id, req.body))
};
