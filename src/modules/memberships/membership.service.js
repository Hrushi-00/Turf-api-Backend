const Plan = require('./membership-plan.model');
const Membership = require('./user-membership.model');
const User = require('../user/user.model');
const walletService = require('../wallet/wallet.service');
const fail = (message, statusCode) => Object.assign(new Error(message), { statusCode });

const listPlans = async () => ({ success: true, data: await Plan.find({ status: 'ACTIVE' }).sort({ pricePaise: 1 }) });
const listAdminPlans = async () => ({ success: true, data: await Plan.find().sort({ createdAt: -1 }) });
const createPlan = async (adminId, data) => ({ success: true, data: await Plan.create({ ...data, createdBy: adminId }) });
const updatePlan = async (id, data) => {
  const allowed = ['name', 'description', 'pricePaise', 'durationDays', 'discountBps', 'priorityBooking', 'features', 'status'];
  const changes = Object.fromEntries(allowed.filter((key) => data[key] !== undefined).map((key) => [key, data[key]]));
  const plan = await Plan.findByIdAndUpdate(id, { $set: changes }, { new: true, runValidators: true });
  if (!plan) throw fail('Membership plan not found', 404);
  return { success: true, data: plan };
};

const current = async (userId) => {
  const membership = await Membership.findOne({ user: userId, status: 'ACTIVE' }).populate('plan');
  if (membership && membership.expiresAt <= new Date()) {
    membership.status = 'EXPIRED';
    await membership.save();
    return { success: true, data: null };
  }
  return { success: true, data: membership };
};

const purchase = async (userId, { planId }, idempotencyKey) => {
  let membership = await Membership.findOne({ user: userId, idempotencyKey }).populate('plan');
  if (membership?.status === 'ACTIVE') return { success: true, data: membership, idempotentReplay: true };
  if (membership && membership.status !== 'PENDING') throw fail('This membership request was already closed; use a new idempotency key', 409);
  const plan = membership?.plan || await Plan.findOne({ _id: planId, status: 'ACTIVE' });
  if (!plan) throw fail('Active membership plan not found', 404);
  if (membership && String(membership.plan._id) !== String(planId)) throw fail('Idempotency-Key was already used for another membership plan', 409);
  if (!membership) {
    await Membership.updateMany({ user: userId, status: 'ACTIVE', expiresAt: { $lte: new Date() } }, { $set: { status: 'EXPIRED' } });
    if (await Membership.exists({ user: userId, status: 'ACTIVE', expiresAt: { $gt: new Date() } })) throw fail('An active membership already exists', 409);
    try {
      membership = await Membership.create({
        user: userId, plan: plan._id, idempotencyKey, status: 'PENDING', pricePaise: plan.pricePaise,
        discountBps: plan.discountBps, featuresSnapshot: plan.features
      });
    } catch (error) {
      if (error.code === 11000) {
        const concurrent = await Membership.findOne({ user: userId, idempotencyKey }).populate('plan');
        if (concurrent) membership = concurrent;
        else throw error;
      } else {
        throw error;
      }
    }
  }

  if (membership.pricePaise > 0) await walletService.applyEntry({
    userId, eventKey: `membership-purchase:${userId}:${idempotencyKey}`, amountPaise: membership.pricePaise,
    entryType: 'DEBIT', sourceType: 'MEMBERSHIP_PURCHASE', sourceId: String(membership._id), reason: `Membership plan ${plan.name}`
  });

  const now = new Date();
  try {
    membership.status = 'ACTIVE';
    membership.startsAt = membership.startsAt || now;
    membership.expiresAt = membership.expiresAt || new Date(now.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);
    await membership.save();
  } catch (error) {
    if (membership.pricePaise > 0) await walletService.applyEntry({
      userId, eventKey: `membership-compensation:${membership._id}`, amountPaise: membership.pricePaise,
      entryType: 'CREDIT', sourceType: 'MEMBERSHIP_COMPENSATION', sourceId: String(membership._id), reason: 'Membership activation compensation'
    });
    membership.status = 'FAILED'; await membership.save();
    throw error;
  }
  return { success: true, data: membership };
};

const activeForUser = async (userId) => Membership.findOne({ user: userId, status: 'ACTIVE', expiresAt: { $gt: new Date() } }).select('_id discountBps expiresAt');

module.exports = { listPlans, listAdminPlans, createPlan, updatePlan, current, purchase, activeForUser };
