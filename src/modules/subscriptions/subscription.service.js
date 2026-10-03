const Business = require('../business/business.model');
const Plan = require('./subscription-plan.model');
const Subscription = require('./business-subscription.model');
const SubscriptionPayment = require('./subscription-payment.model');
const provider = require('../payments/providers/razorpay.provider');
const invoiceService = require('../invoices/invoice.service');
const notificationService = require('../notifications/notification.service');

const fail = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const prices = { MONTHLY: 'monthlyPricePaise', QUARTERLY: 'quarterlyPricePaise', YEARLY: 'yearlyPricePaise' };

const getBusiness = async (ownerId) => {
  const business = await Business.findOne({ owner: ownerId });
  if (!business) throw fail('Complete your business profile before subscribing', 409);
  return business;
};

const listPlans = async () => ({ success: true, data: await Plan.find({ status: 'ACTIVE' }).sort({ monthlyPricePaise: 1 }) });
const listAdminPlans = async () => ({ success: true, data: await Plan.find().sort({ createdAt: -1 }) });
const createPlan = async (data) => ({ success: true, data: await Plan.create(data) });
const updatePlan = async (id, data) => {
  const plan = await Plan.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  if (!plan) throw fail('Subscription plan not found', 404);
  return { success: true, data: plan };
};

const createCheckout = async (ownerId, { planId, billingCycle }, idempotencyKey) => {
  if (process.env.PAYMENT_PROVIDER && process.env.PAYMENT_PROVIDER !== 'razorpay') throw fail('Configured payment provider is not supported', 503);
  const business = await getBusiness(ownerId);
  const existing = await SubscriptionPayment.findOne({ business: business._id, idempotencyKey });
  if (existing) {
    const oldSubscription = await Subscription.findById(existing.subscription);
    if (String(oldSubscription?.plan) !== String(planId) || oldSubscription?.billingCycle !== billingCycle) throw fail('Idempotency-Key was already used for a different subscription', 409);
    if (existing.status === 'CREATED' || existing.status === 'PAID') return { success: true, data: checkoutData(existing) };
    throw fail('This idempotent subscription payment was already processed; use a new key', 409);
  }
  if (business.approvalStatus !== 'APPROVED') throw fail('Business approval is required before purchasing a subscription', 409);
  const plan = await Plan.findOne({ _id: planId, status: 'ACTIVE' });
  if (!plan) throw fail('Active subscription plan not found', 404);
  const amountPaise = plan[prices[billingCycle]];
  if (!Number.isSafeInteger(amountPaise) || amountPaise < 100) throw fail('Plan price must be at least INR 1', 409);
  const current = await Subscription.findOne({ business: business._id, status: { $in: ['ACTIVE', 'GRACE_PERIOD', 'TRIALING'] }, currentPeriodEnd: { $gt: new Date() } }).sort({ currentPeriodEnd: -1 });

  const subscription = await Subscription.create({
    business: business._id, plan: plan._id, billingCycle, amountPaise,
    currency: plan.currency, status: 'PENDING_PAYMENT'
  });
  let payment;
  try {
    payment = await SubscriptionPayment.create({
      business: business._id, subscription: subscription._id, idempotencyKey,
      amountPaise, currency: plan.currency, status: 'CREATING'
    });
    subscription.latestPayment = payment._id;
    await subscription.save();
    const order = await provider.createOrder({
      amountPaise, currency: plan.currency, receipt: String(payment._id).slice(-40),
      notes: { subscriptionId: String(subscription._id), subscriptionPaymentId: String(payment._id), businessId: String(business._id) }
    });
    if (order.amount !== amountPaise || order.currency !== plan.currency) throw fail('Payment provider returned an order that does not match the plan', 502);
    payment.providerOrderId = order.id;
    payment.status = 'CREATED';
    await payment.save();
    if (!current) {
      business.subscriptionStatus = 'PENDING_PAYMENT';
      await business.save();
    }
    return { success: true, data: checkoutData(payment) };
  } catch (error) {
    if (payment) { payment.status = error.statusCode === 502 || error.statusCode === 504 ? 'CREATING' : 'FAILED'; payment.failureCode = 'ORDER_CREATION_FAILED'; await payment.save(); }
    throw error;
  }
};

const checkoutData = (payment) => ({
  id: payment._id, subscriptionId: payment.subscription, amountPaise: payment.amountPaise,
  currency: payment.currency, status: payment.status, providerOrderId: payment.providerOrderId,
  provider: payment.provider, keyId: process.env.RAZORPAY_KEY_ID
});

const addPeriod = (date, cycle) => {
  const months = { MONTHLY: 1, QUARTERLY: 3, YEARLY: 12 }[cycle];
  const source = new Date(date);
  const originalDay = source.getUTCDate();
  const next = new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth() + months, 1, source.getUTCHours(), source.getUTCMinutes(), source.getUTCSeconds(), source.getUTCMilliseconds()));
  const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(originalDay, lastDay));
  return next;
};

const activateCapturedPayment = async (payment, remote) => {
  if (payment.status === 'PAID') {
    await invoiceService.createSubscriptionInvoice(payment);
    const business = await Business.findById(payment.business).select('owner');
    if (business) await notificationService.enqueue({
      eventKey: `subscription-payment-success:${payment._id}`, recipient: business.owner, recipientType: 'AUTH',
      eventType: 'SubscriptionPaymentSuccess', title: 'Subscription active', message: 'Your business subscription payment was received.',
      data: { subscriptionId: payment.subscription, paymentId: payment._id }
    });
    return { status: 'ACTIVE' };
  }
  if (remote.amount !== payment.amountPaise || remote.currency !== payment.currency || remote.order_id !== payment.providerOrderId) {
    payment.status = 'REFUND_REQUIRED'; payment.providerPaymentId = remote.id; payment.failureCode = 'PAYMENT_DETAILS_MISMATCH'; await payment.save();
    return { status: 'REFUND_REQUIRED' };
  }
  const subscription = await Subscription.findById(payment.subscription);
  const business = await Business.findById(payment.business);
  if (!subscription || !business || business.approvalStatus !== 'APPROVED') {
    payment.status = 'REFUND_REQUIRED'; payment.providerPaymentId = remote.id; payment.failureCode = 'BUSINESS_NOT_APPROVED'; await payment.save();
    if (subscription) { subscription.status = 'SUSPENDED'; await subscription.save(); }
    return { status: 'REFUND_REQUIRED' };
  }
  const now = new Date();
  const previous = await Subscription.findOne({ business: business._id, _id: { $ne: subscription._id }, status: { $in: ['ACTIVE', 'GRACE_PERIOD'] }, currentPeriodEnd: { $gt: now } }).sort({ currentPeriodEnd: -1 });
  const start = previous?.currentPeriodEnd || now;
  subscription.status = 'ACTIVE';
  subscription.currentPeriodStart = start;
  subscription.currentPeriodEnd = addPeriod(start, subscription.billingCycle);
  subscription.latestPayment = payment._id;
  await subscription.save();
  payment.status = 'PAID'; payment.providerPaymentId = remote.id; payment.capturedAt = new Date(); await payment.save();
  await invoiceService.createSubscriptionInvoice(payment);
  await notificationService.enqueue({
    eventKey: `subscription-payment-success:${payment._id}`, recipient: business.owner, recipientType: 'AUTH',
    eventType: 'SubscriptionPaymentSuccess', title: 'Subscription active', message: 'Your business subscription payment was received.',
    data: { subscriptionId: subscription._id, paymentId: payment._id }
  });
  business.subscriptionStatus = 'ACTIVE';
  if (business.approvalStatus === 'APPROVED') business.operationalStatus = 'ACTIVE';
  await business.save();
  return { status: 'ACTIVE' };
};

const verifyCheckout = async (ownerId, input) => {
  const business = await getBusiness(ownerId);
  const payment = await SubscriptionPayment.findOne({ providerOrderId: input.orderId, business: business._id });
  if (!payment) throw fail('Subscription payment order not found', 404);
  if (!provider.verifyCheckoutSignature(input.orderId, input.paymentId, input.signature)) throw fail('Payment signature is invalid', 400);
  const remote = await provider.fetchPayment(input.paymentId);
  if (remote.order_id !== payment.providerOrderId || remote.amount !== payment.amountPaise || remote.currency !== payment.currency) throw fail('Payment details do not match the order', 409);
  if (remote.status === 'failed') {
    payment.status = 'FAILED'; payment.providerPaymentId = remote.id; payment.failureCode = remote.error_code || 'PAYMENT_FAILED'; await payment.save();
    return { success: true, data: { status: 'FAILED' } };
  }
  if (remote.status !== 'captured') throw fail('Payment has not been captured yet', 409);
  const result = await activateCapturedPayment(payment, remote);
  return { success: true, data: { status: result.status, subscriptionId: payment.subscription } };
};

const handleCapturedOrder = async (orderId, remote, eventType) => {
  const payment = await SubscriptionPayment.findOne({ providerOrderId: orderId });
  if (!payment) return false;
  if (eventType === 'payment.captured') await activateCapturedPayment(payment, remote);
  if (eventType === 'payment.failed' && ['CREATED', 'CREATING'].includes(payment.status)) {
    payment.status = 'FAILED'; payment.providerPaymentId = remote.id; payment.failureCode = remote.error_code || 'PAYMENT_FAILED'; await payment.save();
  }
  return true;
};

const getCurrent = async (ownerId) => {
  const business = await getBusiness(ownerId);
  const data = await Subscription.findOne({ business: business._id }).populate('plan').populate('latestPayment').sort({ createdAt: -1 });
  return { success: true, data };
};

const cancelAtPeriodEnd = async (ownerId) => {
  const business = await getBusiness(ownerId);
  const subscription = await Subscription.findOne({ business: business._id, status: { $in: ['ACTIVE', 'GRACE_PERIOD'] } }).sort({ createdAt: -1 });
  if (!subscription) throw fail('Active subscription not found', 404);
  subscription.cancelAtPeriodEnd = true;
  subscription.cancelledAt = new Date();
  await subscription.save();
  return { success: true, data: subscription };
};

const listSubscriptions = async ({ page = 1, limit = 20, status } = {}) => {
  const p = Math.max(parseInt(page, 10) || 1, 1); const size = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const filter = status ? { status } : {};
  const [data, total] = await Promise.all([
    Subscription.find(filter).populate('business', 'displayName legalName owner').populate('plan').sort({ createdAt: -1 }).skip((p - 1) * size).limit(size),
    Subscription.countDocuments(filter)
  ]);
  return { success: true, data, total, page: p, pages: Math.ceil(total / size) };
};

const expireDueSubscriptions = async () => {
  const now = new Date();
  const due = await Subscription.find({ status: { $in: ['ACTIVE', 'GRACE_PERIOD'] }, currentPeriodEnd: { $lte: now } }).select('_id business cancelAtPeriodEnd');
  for (const sub of due) {
    const updated = await Subscription.findOneAndUpdate(
      { _id: sub._id, status: { $in: ['ACTIVE', 'GRACE_PERIOD'] }, currentPeriodEnd: { $lte: now } },
      { $set: { status: sub.cancelAtPeriodEnd ? 'CANCELLED' : 'EXPIRED' } }, { new: true }
    );
    if (!updated) continue;
    const replacement = await Subscription.exists({ business: sub.business, _id: { $ne: sub._id }, status: 'ACTIVE', currentPeriodEnd: { $gt: now } });
    if (!replacement) {
      const business = await Business.findByIdAndUpdate(sub.business, { $set: { subscriptionStatus: updated.status, operationalStatus: 'PAUSED' } }, { new: true }).select('owner');
      if (business) await notificationService.enqueue({
        eventKey: `subscription-expired:${updated._id}`,
        recipient: business.owner, recipientType: 'AUTH', eventType: 'SubscriptionExpired',
        title: 'Business subscription expired', message: 'Renew your subscription to restore public booking access.',
        data: { subscriptionId: updated._id, status: updated.status }
      });
    }
  }
  return due.length;
};

module.exports = { listPlans, listAdminPlans, createPlan, updatePlan, createCheckout, verifyCheckout, handleCapturedOrder, getCurrent, cancelAtPeriodEnd, listSubscriptions, expireDueSubscriptions };
