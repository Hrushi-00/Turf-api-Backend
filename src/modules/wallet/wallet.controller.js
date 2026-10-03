const service = require('./wallet.service');
const run = (fn, status = 200) => async (req, res) => {
  try { res.status(status).json(await fn(req)); }
  catch (error) { res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Internal server error' }); }
};
module.exports = {
  mine: run((req) => service.getMine(req.user._id, req.query)),
  adjust: run((req) => service.adminAdjust(req.user._id, req.params.userId, req.body, req.get('Idempotency-Key')), 201)
};
