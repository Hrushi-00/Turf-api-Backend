const service = require('./notification.service');
const run = (fn) => async (req, res) => {
  try { res.json(await fn(req)); }
  catch (error) { res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Internal server error' }); }
};
module.exports = {
  mine: run((req) => service.listMine(req.user, req.query)),
  markRead: run((req) => service.markRead(req.user, req.params.id)),
  preference: run((req) => service.getPreference(req.user)),
  updatePreference: run((req) => service.updatePreference(req.user, req.body))
};
