const service = require('./invoice.service');

const listMine = async (req, res) => {
  try { res.json(await service.listMine(req.user)); }
  catch (error) { res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Internal server error' }); }
};

module.exports = { listMine };
