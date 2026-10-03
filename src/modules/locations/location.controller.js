const service = require('./location.service');
const run = (fn, status = 200) => async (req, res) => {
  try { res.status(status).json(await fn(req)); }
  catch (error) { res.status(error.statusCode || 500).json({ success: false, message: error.message }); }
};

module.exports = {
  list: run((req) => service.list(req.user._id)),
  create: run((req) => service.create(req.user._id, req.body), 201),
  update: run((req) => service.update(req.user._id, req.params.id, req.body)),
  remove: run((req) => service.remove(req.user._id, req.params.id))
};
