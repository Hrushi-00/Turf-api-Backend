const service = require('./venue.service');
const run = (fn, status = 200) => async (req, res) => {
  try { res.status(status).json(await fn(req)); }
  catch (error) { res.status(error.statusCode || 500).json({ success: false, message: error.message }); }
};
module.exports = {
  publicList: run((req) => service.listPublic(req.query)),
  listForAdmin: run((req) => service.listForAdmin(req.query)),
  publicDetails: run((req) => service.publicDetails(req.params.id)),
  listMine: run((req) => service.listMine(req.user._id)),
  create: run((req) => service.create(req.user._id, req.body.locationId, req.body), 201),
  update: run((req) => service.update(req.user._id, req.params.id, req.body)),
  review: run((req) => service.review(req.params.id, req.user._id, req.body.approvalStatus, req.body.reason))
};
