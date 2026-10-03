const service = require('./sport.service');
const run = (fn, status = 200) => async (req, res) => {
  try { res.status(status).json(await fn(req)); }
  catch (error) { res.status(error.statusCode || (error.code === 11000 ? 409 : 500)).json({ success: false, message: error.code === 11000 ? 'Sport slug already exists' : error.message }); }
};
module.exports = {
  list: run(() => service.list()),
  listAll: run(() => service.list(true)),
  create: run((req) => service.create(req.body), 201),
  update: run((req) => service.update(req.params.id, req.body))
};
