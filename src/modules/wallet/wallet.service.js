const Wallet = require('./wallet.model');
const Ledger = require('./wallet-ledger.model');
const User = require('../user/user.model');
const fail = (message, statusCode) => Object.assign(new Error(message), { statusCode });

const getOrCreate = async (userId) => {
  try {
    return await Wallet.findOneAndUpdate({ user: userId }, { $setOnInsert: { user: userId, currency: 'INR', balancePaise: 0 } }, { new: true, upsert: true });
  } catch (error) {
    if (error.code === 11000) return Wallet.findOne({ user: userId });
    throw error;
  }
};

const applyEntry = async ({ userId, eventKey, amountPaise, entryType, sourceType, sourceId = '', reason = '' }) => {
  if (!Number.isSafeInteger(amountPaise) || amountPaise < 1) throw fail('Wallet amount must be a positive integer in paise', 400);
  const existing = await Ledger.findOne({ eventKey });
  if (existing) {
    if (String(existing.user) !== String(userId) || existing.amountPaise !== amountPaise || existing.entryType !== entryType || existing.sourceType !== sourceType || existing.sourceId !== sourceId) {
      throw fail('Idempotency key was already used for a different wallet entry', 409);
    }
    return { success: true, data: existing, idempotentReplay: true };
  }
  const wallet = await getOrCreate(userId);
  const delta = entryType === 'CREDIT' ? amountPaise : -amountPaise;
  const filter = { _id: wallet._id, ...(delta < 0 ? { balancePaise: { $gte: amountPaise } } : {}) };
  const updated = await Wallet.findOneAndUpdate(filter, { $inc: { balancePaise: delta } }, { new: true });
  if (!updated) throw fail('Wallet balance is insufficient', 409);
  try {
    const ledger = await Ledger.create({
      eventKey, wallet: updated._id, user: userId, entryType, sourceType, sourceId,
      amountPaise, balanceAfterPaise: updated.balancePaise, reason
    });
    return { success: true, data: ledger };
  } catch (error) {
    const concurrent = await Ledger.findOne({ eventKey });
    await Wallet.updateOne({ _id: updated._id }, { $inc: { balancePaise: -delta } });
    if (concurrent && error.code === 11000) {
      if (String(concurrent.user) !== String(userId) || concurrent.amountPaise !== amountPaise || concurrent.entryType !== entryType || concurrent.sourceType !== sourceType || concurrent.sourceId !== sourceId) {
        throw fail('Idempotency key was already used for a different wallet entry', 409);
      }
      return { success: true, data: concurrent, idempotentReplay: true };
    }
    throw error;
  }
};

const getMine = async (userId, { page = 1, limit = 50 } = {}) => {
  const wallet = await getOrCreate(userId);
  const p = Math.max(parseInt(page, 10) || 1, 1); const size = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
  const [entries, total] = await Promise.all([
    Ledger.find({ user: userId }).sort({ createdAt: -1 }).skip((p - 1) * size).limit(size),
    Ledger.countDocuments({ user: userId })
  ]);
  return { success: true, data: { wallet, entries, total, page: p, pages: Math.ceil(total / size) } };
};

const adminAdjust = async (adminId, userId, data, idempotencyKey) => {
  if (!await User.exists({ _id: userId })) throw fail('Customer not found', 404);
  return applyEntry({
    userId, eventKey: `admin-adjust:${idempotencyKey}`, amountPaise: data.amountPaise,
    entryType: data.direction, sourceType: 'ADMIN_ADJUSTMENT', sourceId: String(adminId), reason: data.reason
  });
};

module.exports = { getMine, applyEntry, adminAdjust };
