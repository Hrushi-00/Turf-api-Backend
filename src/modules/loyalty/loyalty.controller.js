const service = require('./loyalty.service');
const mine = async (req, res) => {
  try { res.json(await service.getMine(req.user._id, req.query)); }
  catch (error) { res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Internal server error' }); }
};
module.exports = { mine };
