const service = require('./audit.service');
const list = async (req, res) => {
  try { res.json(await service.list(req.query)); }
  catch (error) { res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Internal server error' }); }
};
module.exports = { list };
