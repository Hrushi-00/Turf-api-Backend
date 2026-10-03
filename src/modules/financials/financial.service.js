const Business = require('../business/business.model');
const Booking = require('../booking/booking.model');
const Ledger = require('./financial-ledger.model');
const Rule = require('./financial-rule.model');
const Settlement = require('./settlement.model');
const Allocation = require('./settlement-allocation.model');
const ensurePayoutLedger = async (settlement) => {
  try {
    await Ledger.create({
      eventKey: `payout:${settlement._id}`, entryType: 'PAYOUT', business: settlement.business,
      settlement: settlement._id, currency: settlement.currency, grossPaise: 0, commissionPaise: 0,
      businessPayablePaise: -settlement.amountPaise, commissionBps: 0, sourceEventAt: settlement.processedAt || new Date()
    });
  } catch (error) { if (error.code !== 11000) throw error; }
};

const fail = (message, statusCode) => Object.assign(new Error(message), { statusCode });

const getRules = async () => {
  const rules = await Rule.findOneAndUpdate({ key: 'platform' }, { $setOnInsert: { bookingCommissionBps: 0, currency: 'INR' } }, { new: true, upsert: true });
  return { success: true, data: rules };
};

const updateRules = async (adminId, bookingCommissionBps) => {
  const rules = await Rule.findOneAndUpdate(
    { key: 'platform' },
    { $set: { bookingCommissionBps, updatedBy: adminId, currency: 'INR' } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
  return { success: true, data: rules };
};

const addCapture = async (payment) => {
  if (payment.status !== 'PAID') return false;
  const booking = await Booking.findById(payment.booking).select('admin price currency createdAt');
  if (!booking) return false;
  const business = await Business.findOne({ owner: booking.admin }).select('_id');
  if (!business) return false;
  const rules = await Rule.findOne({ key: 'platform' });
  const commissionBps = rules?.bookingCommissionBps || 0;
  const grossPaise = payment.capturedAmountPaise || payment.amountPaise;
  const commissionPaise = Math.min(grossPaise, Math.round((grossPaise * commissionBps) / 10000));
  try {
    await Ledger.create({
      eventKey: `capture:${payment._id}`, entryType: 'BOOKING_CAPTURE', business: business._id,
      booking: booking._id, payment: payment._id, currency: payment.currency,
      grossPaise, commissionPaise, businessPayablePaise: grossPaise - commissionPaise,
      commissionBps, sourceEventAt: payment.capturedAt || new Date()
    });
  } catch (error) { if (error.code !== 11000) throw error; }
  return true;
};

const addRefund = async (refund, payment) => {
  const original = await Ledger.findOne({ payment: payment._id, entryType: 'BOOKING_CAPTURE' });
  if (!original) return false;
  const grossRefund = Math.min(refund.amountPaise, Math.abs(original.grossPaise));
  const commissionRefund = original.grossPaise ? Math.round(Math.abs(original.commissionPaise) * grossRefund / Math.abs(original.grossPaise)) : 0;
  try {
    await Ledger.create({
      eventKey: `refund:${refund._id}`, entryType: 'BOOKING_REFUND', business: original.business,
      booking: original.booking, payment: payment._id, refund: refund._id, currency: original.currency,
      grossPaise: -grossRefund, commissionPaise: -commissionRefund,
      businessPayablePaise: -(grossRefund - commissionRefund), commissionBps: original.commissionBps,
      sourceEventAt: refund.processedAt || new Date()
    });
  } catch (error) { if (error.code !== 11000) throw error; }
  const allocation = await Allocation.findOne({ ledgerEntry: original._id });
  if (allocation) {
    await Settlement.updateOne(
      { _id: allocation.settlement, open: true, status: { $in: ['PENDING', 'PROCESSING'] } },
      { $set: { status: 'HELD', failureReason: 'A refund changed this settlement balance; review and recreate the batch before payout' } }
    );
  }
  return true;
};

const getBusinessStatement = async (ownerId, { page = 1, limit = 50 } = {}) => {
  const business = await Business.findOne({ owner: ownerId }).select('_id');
  if (!business) throw fail('Business profile not found', 404);
  const p = Math.max(parseInt(page, 10) || 1, 1);
  const size = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
  const filter = { business: business._id };
  const [entries, totals, count, openSettlements] = await Promise.all([
    Ledger.find(filter).populate('booking', 'date timeSlot').populate('payment', 'status').populate('refund', 'status').sort({ createdAt: -1 }).skip((p - 1) * size).limit(size),
    Ledger.aggregate([{ $match: { business: business._id } }, { $group: {
      _id: '$currency', grossPaise: { $sum: '$grossPaise' }, commissionPaise: { $sum: '$commissionPaise' }, payablePaise: { $sum: '$businessPayablePaise' }
    } }]),
    Ledger.countDocuments(filter),
    Settlement.aggregate([{ $match: { business: business._id, open: true } }, { $group: { _id: null, amountPaise: { $sum: '$amountPaise' } } }])
  ]);
  const account = totals[0] || { _id: 'INR', grossPaise: 0, commissionPaise: 0, payablePaise: 0 };
  account.reservedPaise = openSettlements[0]?.amountPaise || 0;
  account.availablePaise = account.payablePaise - account.reservedPaise;
  return { success: true, data: { entries, totals: account, page: p, pages: Math.ceil(count / size), totalEntries: count } };
};

const listLedger = async ({ page = 1, limit = 50, businessId, entryType } = {}) => {
  const p = Math.max(parseInt(page, 10) || 1, 1);
  const size = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
  const filter = {};
  if (businessId) filter.business = businessId;
  if (entryType) filter.entryType = entryType;
  const [entries, total] = await Promise.all([
    Ledger.find(filter).populate('business', 'displayName legalName').populate('booking', 'date timeSlot').populate('payment').populate('refund').populate('settlement')
      .sort({ createdAt: -1 }).skip((p - 1) * size).limit(size),
    Ledger.countDocuments(filter)
  ]);
  return { success: true, data: entries, total, page: p, pages: Math.ceil(total / size) };
};

const createSettlement = async (businessId, adminId) => {
  const business = await Business.findById(businessId).select('_id');
  if (!business) throw fail('Business not found', 404);
  const existing = await Settlement.findOne({ business: businessId, open: true });
  if (existing) throw fail('This business already has an open settlement', 409);
  const allocated = await Allocation.find({ business: businessId }).distinct('ledgerEntry');
  const entries = await Ledger.find({ business: businessId, _id: { $nin: allocated } }).select('_id businessPayablePaise currency');
  const amountPaise = entries.reduce((total, entry) => total + entry.businessPayablePaise, 0);
  if (amountPaise <= 0) throw fail('There is no positive available balance to settle', 409);

  let settlement;
  try {
    settlement = await Settlement.create({ business: businessId, amountPaise, currency: 'INR', createdBy: adminId });
    await Allocation.insertMany(entries.map((entry) => ({
      settlement: settlement._id, ledgerEntry: entry._id, business: businessId,
      allocatedPaise: entry.businessPayablePaise
    })));
  } catch (error) {
    if (settlement) {
      await Allocation.deleteMany({ settlement: settlement._id });
      await Settlement.deleteOne({ _id: settlement._id });
    }
    if (error.code === 11000) throw fail('The balance was just allocated by another settlement', 409);
    throw error;
  }
  return { success: true, data: settlement };
};

const transitionSettlement = async (id, adminId, { status, externalReference = '', failureReason = '' }) => {
  const settlement = await Settlement.findById(id);
  if (!settlement) throw fail('Settlement not found', 404);
  const transitions = {
    PENDING: ['PROCESSING', 'HELD', 'FAILED'],
    PROCESSING: ['PROCESSED', 'HELD', 'FAILED'],
    HELD: ['FAILED'],
    PROCESSED: [], FAILED: []
  };
  if (settlement.status === status) {
    if (status === 'PROCESSED') await ensurePayoutLedger(settlement);
    return { success: true, data: settlement };
  }
  if (!transitions[settlement.status]?.includes(status)) throw fail(`Cannot change settlement from ${settlement.status} to ${status}`, 409);
  if (status === 'PROCESSED' && !externalReference.trim()) throw fail('External bank or payout reference is required to mark a settlement processed', 400);
  if (['FAILED', 'HELD'].includes(status) && !failureReason.trim()) throw fail('A reason is required for failed or held settlements', 400);

  const updated = await Settlement.findOneAndUpdate(
    { _id: id, status: settlement.status },
    { $set: {
      status, processedBy: adminId,
      ...(externalReference ? { externalReference: externalReference.trim() } : {}),
      ...(failureReason ? { failureReason: failureReason.trim() } : {}),
      ...(status === 'PROCESSED' ? { processedAt: new Date(), open: false } : {}),
      ...(status === 'FAILED' ? { open: false } : {})
    } }, { new: true, runValidators: true }
  );
  if (!updated) throw fail('Settlement was updated by another request; reload and retry', 409);
  if (status === 'FAILED') await Allocation.deleteMany({ settlement: updated._id });
  if (status === 'PROCESSED') await ensurePayoutLedger(updated);
  return { success: true, data: updated };
};

const listSettlements = async ({ page = 1, limit = 50, businessId, status } = {}) => {
  const p = Math.max(parseInt(page, 10) || 1, 1);
  const size = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
  const filter = {};
  if (businessId) filter.business = businessId;
  if (status) filter.status = status;
  const [data, total] = await Promise.all([
    Settlement.find(filter).populate('business', 'displayName legalName').populate('createdBy', 'username email').populate('processedBy', 'username email')
      .sort({ createdAt: -1 }).skip((p - 1) * size).limit(size),
    Settlement.countDocuments(filter)
  ]);
  return { success: true, data, total, page: p, pages: Math.ceil(total / size) };
};

const getBusinessSettlements = async (ownerId, pagination = {}) => {
  const business = await Business.findOne({ owner: ownerId }).select('_id');
  if (!business) throw fail('Business profile not found', 404);
  return listSettlements({ ...pagination, businessId: business._id });
};

module.exports = { getRules, updateRules, addCapture, addRefund, getBusinessStatement, listLedger, createSettlement, transitionSettlement, listSettlements, getBusinessSettlements };
