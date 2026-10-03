const service = require('./analytics.service');
const run = (fn) => async (req, res) => {
  try { res.json(await fn(req)); }
  catch (error) { res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Internal server error' }); }
};
module.exports = {
  business: run((req) => service.businessDashboard(req.user._id)),
  admin: run(() => service.adminDashboard())
};
