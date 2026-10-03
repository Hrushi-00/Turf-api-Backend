const service = require('./financial.service');

const rules = async (req, res) => {
  try { res.json(await service.getRules()); }
  catch (error) { res.status(error.statusCode || 500).json({ success: false, message: error.message }); }
};
const updateRules = async (req, res) => {
  try { res.json(await service.updateRules(req.user._id, req.body.bookingCommissionBps)); }
  catch (error) { res.status(error.statusCode || 500).json({ success: false, message: error.message }); }
};
const statement = async (req, res) => {
  try { res.json(await service.getBusinessStatement(req.user._id, req.query)); }
  catch (error) { res.status(error.statusCode || 500).json({ success: false, message: error.message }); }
};
const ledger = async (req, res) => {
  try { res.json(await service.listLedger(req.query)); }
  catch (error) { res.status(error.statusCode || 500).json({ success: false, message: error.message }); }
};
const payouts = async (req, res) => {
  try { res.json(await service.listLedger({ ...req.query, entryType: 'PAYOUT' })); }
  catch (error) { res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Internal server error' }); }
};
const businessSettlements = async (req, res) => {
  try { res.json(await service.getBusinessSettlements(req.user._id, req.query)); }
  catch (error) { res.status(error.statusCode || 500).json({ success: false, message: error.message }); }
};
const settlements = async (req, res) => {
  try { res.json(await service.listSettlements(req.query)); }
  catch (error) { res.status(error.statusCode || 500).json({ success: false, message: error.message }); }
};
const createSettlement = async (req, res) => {
  try { res.status(201).json(await service.createSettlement(req.params.businessId, req.user._id)); }
  catch (error) { res.status(error.statusCode || 500).json({ success: false, message: error.message }); }
};
const transitionSettlement = async (req, res) => {
  try { res.json(await service.transitionSettlement(req.params.id, req.user._id, req.body)); }
  catch (error) { res.status(error.statusCode || 500).json({ success: false, message: error.message }); }
};

module.exports = { rules, updateRules, statement, ledger, payouts, businessSettlements, settlements, createSettlement, transitionSettlement };
