const service = require('./subscription.service');

const run = (handler, status = 200) => async (req, res) => {
  try { const result = await handler(req); res.status(status).json(result); }
  catch (error) { res.status(error.statusCode || 500).json({ success: false, message: error.message }); }
};

const listPlans = run(() => service.listPlans());
const adminPlans = run(() => service.listAdminPlans());
const createPlan = run((req) => service.createPlan(req.body), 201);
const updatePlan = run((req) => service.updatePlan(req.params.id, req.body));
const checkout = run(async (req) => {
  const key = req.get('Idempotency-Key');
  if (!key || key.length > 120) throw Object.assign(new Error('A valid Idempotency-Key header is required'), { statusCode: 400 });
  return service.createCheckout(req.user._id, req.body, key);
}, 201);
const verify = run((req) => service.verifyCheckout(req.user._id, req.body));
const current = run((req) => service.getCurrent(req.user._id));
const cancel = run((req) => service.cancelAtPeriodEnd(req.user._id));
const listSubscriptions = run((req) => service.listSubscriptions(req.query));

module.exports = { listPlans, adminPlans, createPlan, updatePlan, checkout, verify, current, cancel, listSubscriptions };
