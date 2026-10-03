const service = require('./review.service');
const run = (fn, status = 200) => async (req, res) => {
  try { res.status(status).json(await fn(req)); }
  catch (error) { res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Internal server error' }); }
};
module.exports = {
  create: run((req) => service.create(req.user._id, req.body), 201),
  mine: run((req) => service.listMine(req.user._id)),
  publicList: run((req) => service.listPublic(req.query)),
  adminList: run((req) => service.listAdmin(req.query)),
  moderate: run((req) => service.moderate(req.user._id, req.params.id, req.body.status, req.body.reason)),
  respond: run((req) => service.respond(req.user._id, req.params.id, req.body.response))
};
