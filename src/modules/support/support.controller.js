const service = require('./support.service');
const run = (fn, status = 200) => async (req, res) => {
  try { res.status(status).json(await fn(req)); }
  catch (error) { res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Internal server error' }); }
};
module.exports = {
  create: run((req) => service.create(req.user, req.body), 201),
  mine: run((req) => service.listMine(req.user)),
  getMine: run((req) => service.getOne(req.user, req.params.id)),
  reply: run((req) => service.reply(req.user, req.params.id, req.body.message)),
  adminList: run((req) => service.listAdmin(req.query)),
  adminGet: run((req) => service.getOne(req.user, req.params.id, true)),
  adminReply: run((req) => service.reply(req.user, req.params.id, req.body.message, true)),
  adminUpdate: run((req) => service.updateAdmin(req.params.id, req.body))
};
