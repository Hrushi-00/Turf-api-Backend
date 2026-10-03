const Account = require('./loyalty-account.model');
const Ledger = require('./loyalty-ledger.model');
const Booking = require('../booking/booking.model');
const fail = (message, statusCode) => Object.assign(new Error(message), { statusCode });

const getOrCreate = async (userId) => {
  try { return await Account.findOneAndUpdate({ user: userId }, { $setOnInsert: { user: userId, points: 0 } }, { new: true, upsert: true }); }
  catch (error) { if (error.code === 11000) return Account.findOne({ user: userId }); throw error; }
};

const applyPoints = async ({ userId, eventKey, points, entryType, booking, reason = '' }) => {
  if (!Number.isSafeInteger(points) || points === 0) throw fail('Loyalty points must be a non-zero integer', 400);
  const existing = await Ledger.findOne({ eventKey });
  if (existing) {
    if (String(existing.user) !== String(userId) || existing.points !== points || existing.entryType !== entryType || String(existing.booking || '') !== String(booking || '')) {
      throw fail('Idempotency key was already used for a different loyalty entry', 409);
    }
    return { success: true, data: existing, idempotentReplay: true };
  }
  const account = await getOrCreate(userId);
  const updated = await Account.findOneAndUpdate({ _id: account._id, ...(points < 0 ? { points: { $gte: Math.abs(points) } } : {}) }, { $inc: { points } }, { new: true });
  if (!updated) throw fail('Loyalty balance is insufficient', 409);
  try {
    return { success: true, data: await Ledger.create({ eventKey, account: account._id, user: userId, entryType, points, balanceAfter: updated.points, booking, reason }) };
  } catch (error) {
    const concurrent = await Ledger.findOne({ eventKey });
    await Account.updateOne({ _id: account._id }, { $inc: { points: -points } });
    if (concurrent && error.code === 11000) {
      if (String(concurrent.user) !== String(userId) || concurrent.points !== points || concurrent.entryType !== entryType || String(concurrent.booking || '') !== String(booking || '')) {
        throw fail('Idempotency key was already used for a different loyalty entry', 409);
      }
      return { success: true, data: concurrent, idempotentReplay: true };
    }
    throw error;
  }
};

const getMine = async (userId, { page = 1, limit = 50 } = {}) => {
  const account = await getOrCreate(userId);
  const p = Math.max(parseInt(page, 10) || 1, 1); const size = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
  const [entries, total] = await Promise.all([Ledger.find({ user: userId }).sort({ createdAt: -1 }).skip((p - 1) * size).limit(size), Ledger.countDocuments({ user: userId })]);
  return { success: true, data: { account, entries, total, page: p, pages: Math.ceil(total / size) } };
};

const awardCompletedBooking = async (bookingId) => {
  const booking = await Booking.findById(bookingId).select('user price paymentStatus bookingStatus');
  if (!booking || booking.bookingStatus !== 'completed' || booking.paymentStatus !== 'paid' || !booking.user) return false;
  const paisePerPoint = Math.max(Number(process.env.LOYALTY_PAISE_PER_POINT) || 10000, 1);
  const points = Math.floor(Math.round(booking.price * 100) / paisePerPoint);
  if (points < 1) return false;
  await applyPoints({ userId: booking.user, eventKey: `booking-completed:${booking._id}`, points, entryType: 'EARN', booking: booking._id, reason: 'Points earned for completed booking' });
  return true;
};

const awardEligibleBookings = async (limit = 100) => {
  const completed = await Booking.find({ bookingStatus: 'completed', paymentStatus: 'paid', user: { $exists: true } })
    .sort({ updatedAt: 1 }).limit(limit).select('_id');
  let awarded = 0;
  for (const booking of completed) {
    if (await Ledger.exists({ eventKey: `booking-completed:${booking._id}` })) continue;
    if (await awardCompletedBooking(booking._id)) awarded += 1;
  }
  return awarded;
};

module.exports = { getMine, applyPoints, awardCompletedBooking, awardEligibleBookings };
