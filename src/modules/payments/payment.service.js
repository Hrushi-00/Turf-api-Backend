const Payment = require('./payment.model');
const WebhookEvent = require('./webhook-event.model');
const Refund = require('./refund.model');
const Booking = require('../booking/booking.model');
const SlotHold = require('../booking/slot-hold.model');
const provider = require('./providers/razorpay.provider');
const subscriptionService = require('../subscriptions/subscription.service');
const financialService = require('../financials/financial.service');
const invoiceService = require('../invoices/invoice.service');
const notificationService = require('../notifications/notification.service');

const fail = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const notifyPaymentSuccess = async (payment) => {
  await Promise.all([
    notificationService.enqueue({
      eventKey: `payment-success:${payment._id}`, recipient: payment.user, recipientType: 'USER',
      eventType: 'PaymentSuccess', title: 'Payment successful', message: 'Your booking payment was received.',
      data: { bookingId: payment.booking, paymentId: payment._id }
    }),
    notificationService.enqueue({
      eventKey: `booking-confirmed:${payment.booking}`, recipient: payment.user, recipientType: 'USER',
      eventType: 'BookingConfirmed', title: 'Booking confirmed', message: 'Payment completed and your booking is confirmed.',
      data: { bookingId: payment.booking, paymentId: payment._id }
    })
  ]);
};
const notifyPaymentFailed = (payment) => notificationService.enqueue({
  eventKey: `payment-failed:${payment._id}`, recipient: payment.user, recipientType: 'USER',
  eventType: 'PaymentFailed', title: 'Payment failed', message: 'Your booking payment could not be completed.',
  data: { bookingId: payment.booking, paymentId: payment._id }
});

const publicPayment = (payment) => ({
  id: payment._id,
  bookingId: payment.booking,
  amountPaise: payment.amountPaise,
  currency: payment.currency,
  status: payment.status,
  providerOrderId: payment.providerOrderId,
  provider: payment.provider,
  keyId: process.env.RAZORPAY_KEY_ID
});

const createOrder = async (userId, bookingId, idempotencyKey) => {
  if (process.env.PAYMENT_PROVIDER && process.env.PAYMENT_PROVIDER !== 'razorpay') {
    throw fail('Configured payment provider is not supported', 503);
  }
  const existing = await Payment.findOne({ user: userId, idempotencyKey });
  if (existing) {
    if (String(existing.booking) !== String(bookingId)) throw fail('Idempotency-Key was already used for another booking', 409);
    if (existing.status === 'PAID') return { success: true, data: publicPayment(existing) };
    if (existing.status === 'CREATED') {
      const existingBooking = await Booking.findOne({ _id: existing.booking, user: userId });
      if (existingBooking?.bookingStatus === 'pending' && existingBooking.holdExpiresAt > new Date()) {
        return { success: true, data: publicPayment(existing) };
      }
      throw fail('This booking hold expired; create a new booking request', 409);
    }
    throw fail('This idempotent payment request has already been processed; use a new key to retry', 409);
  }

  const booking = await Booking.findOne({ _id: bookingId, user: userId }).select('+reservationId');
  if (!booking) throw fail('Booking not found', 404);
  if (booking.bookingStatus !== 'pending' || !['pending', 'failed'].includes(booking.paymentStatus)) throw fail('Booking is not awaiting payment', 409);
  if (!booking.holdExpiresAt || booking.holdExpiresAt <= new Date()) throw fail('Booking hold expired', 409);
  const holdExists = await SlotHold.exists({ reservationId: booking.reservationId, expiresAt: { $gt: new Date() } });
  if (!holdExists) throw fail('Booking hold expired', 409);
  const existingOrder = await Payment.findOne({ booking: booking._id, status: 'CREATED' });
  if (existingOrder) return { success: true, data: publicPayment(existingOrder) };
  const amountPaise = Math.round(booking.price * 100);
  if ((booking.currency || 'INR') !== 'INR') throw fail('Razorpay payments are currently configured for INR bookings only', 409);
  if (!Number.isSafeInteger(amountPaise) || amountPaise < 100) throw fail('Booking amount is not valid for payment', 409);

  let payment;
  let lockClaimed = false;
  try {
    const lockedBooking = await Booking.findOneAndUpdate({
      _id: booking._id,
      bookingStatus: 'pending',
      paymentOrderLock: { $ne: true },
      holdExpiresAt: { $gt: new Date() }
    }, { $set: { paymentOrderLock: true } }, { new: true });
    if (!lockedBooking) throw fail('A payment order is already being created for this booking', 409);
    lockClaimed = true;
    payment = await Payment.create({
      booking: booking._id, user: userId, provider: 'razorpay', idempotencyKey,
      amountPaise, currency: booking.currency || 'INR', status: 'CREATING'
    });
  } catch (error) {
    if (lockClaimed) await Booking.updateOne({ _id: booking._id }, { $set: { paymentOrderLock: false } });
    if (error.code === 11000) {
      await Booking.updateOne({ _id: booking._id }, { $set: { paymentOrderLock: false } });
      const concurrent = await Payment.findOne({ user: userId, idempotencyKey });
      if (concurrent?.status === 'CREATED') return { success: true, data: publicPayment(concurrent) };
      throw fail('Payment order creation is already in progress', 409);
    }
    throw error;
  }

  try {
    const order = await provider.createOrder({
      amountPaise,
      currency: payment.currency,
      receipt: String(payment._id).slice(-40),
      notes: { bookingId: String(booking._id), paymentRecordId: String(payment._id) }
    });
    if (order.amount !== amountPaise || order.currency !== payment.currency) {
      throw fail('Payment provider returned an order that does not match the booking', 502);
    }
    payment.providerOrderId = order.id;
    payment.status = 'CREATED';
    await payment.save();
    await Booking.updateOne({ _id: booking._id }, { $set: { paymentStatus: 'pending', paymentOrderLock: false } });
    return { success: true, data: publicPayment(payment) };
  } catch (error) {
    payment.status = 'FAILED';
    payment.failureCode = 'ORDER_CREATION_FAILED';
    await payment.save();
    await Booking.updateOne({ _id: booking._id }, { $set: { paymentOrderLock: false } });
    throw error;
  }
};

const finishRefund = async (refund, providerRefund, payment) => {
  refund.providerRefundId = providerRefund.id;
  refund.status = providerRefund.status === 'processed' ? 'PROCESSED' : 'PENDING';
  if (refund.status === 'PROCESSED') refund.processedAt = new Date();
  await refund.save();
  payment.status = refund.status === 'PROCESSED' ? 'REFUNDED' : 'REFUND_PENDING';
  payment.refundLock = false;
  await payment.save();
  if (refund.status === 'PROCESSED') {
    const booking = await Booking.findById(refund.booking).select('+reservationId');
    if (booking) {
      booking.paymentStatus = 'refunded';
      if (['pending', 'confirmed'].includes(booking.bookingStatus)) {
        booking.bookingStatus = 'cancelled';
        booking.holdExpiresAt = null;
      }
      await booking.save();
    }
    if (booking?.reservationId) await SlotHold.deleteMany({ reservationId: booking.reservationId });
    await financialService.addRefund(refund, payment);
    await notificationService.enqueue({
      eventKey: `refund-processed:${refund._id}`, recipient: payment.user, recipientType: 'USER',
      eventType: 'RefundProcessed', title: 'Refund processed', message: 'Your payment refund has been processed.',
      data: { bookingId: refund.booking, paymentId: payment._id, refundId: refund._id }
    });
  }
  return refund;
};

const issueFullRefund = async (paymentId, adminId, idempotencyKey) => {
  if (process.env.PAYMENT_PROVIDER && process.env.PAYMENT_PROVIDER !== 'razorpay') {
    throw fail('Configured payment provider is not supported', 503);
  }
  const existingRequest = await Refund.findOne({ initiatedBy: adminId, idempotencyKey });
  if (existingRequest) {
    if (String(existingRequest.payment) !== String(paymentId)) throw fail('Idempotency-Key was already used for another refund', 409);
    return { success: true, data: existingRequest };
  }
  const payment = await Payment.findById(paymentId);
  if (!payment) throw fail('Payment not found', 404);
  if (!['PAID', 'REFUND_REQUIRED'].includes(payment.status) || !payment.providerPaymentId) {
    throw fail('Payment is not eligible for a refund', 409);
  }
  const activeRefund = await Refund.findOne({ payment: payment._id, status: { $in: ['CREATING', 'PENDING', 'UNKNOWN', 'PROCESSED'] } });
  if (activeRefund) throw fail('This payment already has a refund request', 409);
  const lockedPayment = await Payment.findOneAndUpdate({
    _id: payment._id,
    status: { $in: ['PAID', 'REFUND_REQUIRED'] },
    refundLock: { $ne: true }
  }, { $set: { refundLock: true } }, { new: true });
  if (!lockedPayment) throw fail('A refund request is already being processed', 409);
  let refund;
  try {
    refund = await Refund.create({
      payment: payment._id, booking: payment.booking, initiatedBy: adminId,
      idempotencyKey, amountPaise: payment.capturedAmountPaise || payment.amountPaise, status: 'CREATING'
    });
  } catch (error) {
    await Payment.updateOne({ _id: payment._id }, { $set: { refundLock: false } });
    if (error.code === 11000) {
      const duplicate = await Refund.findOne({ initiatedBy: adminId, idempotencyKey });
      if (duplicate && String(duplicate.payment) === String(paymentId)) return { success: true, data: duplicate };
    }
    throw error;
  }
  try {
    const result = await provider.refundPayment({
      paymentId: payment.providerPaymentId,
      amountPaise: refund.amountPaise,
      receipt: String(refund._id).slice(-40),
      notes: { refundRecordId: String(refund._id), bookingId: String(refund.booking) }
    });
    await finishRefund(refund, result, payment);
    return { success: true, data: refund };
  } catch (error) {
    refund.status = error.statusCode === 502 || error.statusCode === 504 ? 'UNKNOWN' : 'FAILED';
    refund.failureCode = error.statusCode === 502 || error.statusCode === 504 ? 'PROVIDER_RESULT_UNKNOWN' : 'PROVIDER_REFUND_FAILED';
    await refund.save();
    await Payment.updateOne({ _id: payment._id }, {
      $set: {
        refundLock: false,
        ...(refund.status === 'UNKNOWN' ? { status: 'REFUND_PENDING' } : {})
      }
    });
    throw error;
  }
};

const listRefundRequired = async ({ page = 1, limit = 20 } = {}) => {
  const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const filter = { status: { $in: ['REFUND_REQUIRED', 'REFUND_PENDING'] } };
  const [data, total] = await Promise.all([
    Payment.find(filter).populate('booking').populate('user', 'name email').sort({ createdAt: 1 })
      .skip((pageNumber - 1) * pageSize).limit(pageSize),
    Payment.countDocuments(filter)
  ]);
  return { success: true, data, total, page: pageNumber, pages: Math.ceil(total / pageSize) };
};

const settleCapturedPayment = async (payment, providerPayment) => {
  if (payment.amountPaise !== providerPayment.amount || payment.currency !== providerPayment.currency || payment.providerOrderId !== providerPayment.order_id) {
    payment.status = 'REFUND_REQUIRED';
    payment.providerPaymentId = providerPayment.id;
    payment.capturedAmountPaise = providerPayment.amount;
    payment.failureCode = 'PAYMENT_DETAILS_MISMATCH';
    await payment.save();
    return { refundRequired: true };
  }
  if (payment.status === 'PAID') {
    await financialService.addCapture(payment);
    await invoiceService.createBookingInvoice(payment);
    await notifyPaymentSuccess(payment);
    return { refundRequired: false };
  }

  const booking = await Booking.findById(payment.booking).select('+reservationId');
  if (!booking) {
    payment.status = 'REFUND_REQUIRED';
    payment.providerPaymentId = providerPayment.id;
    payment.capturedAmountPaise = providerPayment.amount;
    payment.failureCode = 'BOOKING_MISSING';
    await payment.save();
    return { refundRequired: true };
  }
  if (String(booking.paymentId || '') === String(payment._id) && booking.bookingStatus === 'confirmed') {
    payment.status = 'PAID';
    payment.providerPaymentId = providerPayment.id;
    payment.capturedAmountPaise = providerPayment.amount;
    payment.capturedAt = payment.capturedAt || new Date();
    await payment.save();
    await financialService.addCapture(payment);
    await invoiceService.createBookingInvoice(payment);
    await notifyPaymentSuccess(payment);
    return { refundRequired: false };
  }

  const activeHold = booking.reservationId && await SlotHold.exists({
    reservationId: booking.reservationId,
    expiresAt: { $gt: new Date() }
  });
  if (booking.bookingStatus !== 'pending' || !activeHold || !booking.holdExpiresAt || booking.holdExpiresAt <= new Date()) {
    payment.status = 'REFUND_REQUIRED';
    payment.providerPaymentId = providerPayment.id;
    payment.capturedAmountPaise = providerPayment.amount;
    payment.failureCode = 'BOOKING_HOLD_EXPIRED_AFTER_CAPTURE';
    await payment.save();
    await Booking.updateOne({ _id: booking._id, bookingStatus: 'pending' }, { $set: { paymentStatus: 'paid' } });
    return { refundRequired: true };
  }

  const confirmed = await Booking.findOneAndUpdate(
    { _id: booking._id, bookingStatus: 'pending', paymentStatus: { $in: ['pending', 'failed'] }, holdExpiresAt: { $gt: new Date() } },
    { $set: { bookingStatus: 'confirmed', paymentStatus: 'paid', paymentId: payment._id, holdExpiresAt: null, paymentOrderLock: false } },
    { new: true }
  );
  if (!confirmed) {
    payment.status = 'REFUND_REQUIRED';
    payment.providerPaymentId = providerPayment.id;
    payment.capturedAmountPaise = providerPayment.amount;
    payment.failureCode = 'BOOKING_CONFIRMATION_CONFLICT';
    await payment.save();
    return { refundRequired: true };
  }

  const dayEnd = new Date(new Date(`${booking.date.toISOString().slice(0, 10)}T00:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000);
  await SlotHold.updateMany({ reservationId: booking.reservationId }, { $set: { expiresAt: dayEnd } });
  payment.status = 'PAID';
  payment.providerPaymentId = providerPayment.id;
  payment.capturedAmountPaise = providerPayment.amount;
  payment.capturedAt = new Date();
  await payment.save();
  await financialService.addCapture(payment);
  await invoiceService.createBookingInvoice(payment);
  await notifyPaymentSuccess(payment);
  return { refundRequired: false };
};

const verifyCheckout = async (userId, input) => {
  const payment = await Payment.findOne({ providerOrderId: input.orderId, user: userId });
  if (!payment) throw fail('Payment order not found', 404);
  if (!provider.verifyCheckoutSignature(input.orderId, input.paymentId, input.signature)) {
    throw fail('Payment signature is invalid', 400);
  }
  const remote = await provider.fetchPayment(input.paymentId);
  if (remote.order_id !== payment.providerOrderId || remote.amount !== payment.amountPaise || remote.currency !== payment.currency) {
    throw fail('Payment details do not match the order', 409);
  }
  if (remote.status !== 'captured') {
    if (remote.status === 'failed') {
      payment.status = 'FAILED';
      payment.providerPaymentId = remote.id;
      payment.failureCode = remote.error_code || 'PAYMENT_FAILED';
      await payment.save();
      await Booking.updateOne({ _id: payment.booking, paymentStatus: 'pending' }, { $set: { paymentStatus: 'failed' } });
      await notifyPaymentFailed(payment);
      return { success: true, data: { status: 'FAILED' } };
    }
    throw fail('Payment has not been captured yet', 409);
  }
  const outcome = await settleCapturedPayment(payment, remote);
  return { success: true, data: { status: outcome.refundRequired ? 'REFUND_REQUIRED' : 'PAID', bookingId: payment.booking } };
};

const handleWebhook = async (rawBody, signature, eventId) => {
  if (!rawBody || !Buffer.isBuffer(rawBody)) throw fail('Webhook body is required', 400);
  if (!provider.verifyWebhookSignature(rawBody, signature)) throw fail('Webhook signature is invalid', 400);
  if (!eventId || eventId.length > 200) throw fail('Webhook event ID is required', 400);
  let body;
  try { body = JSON.parse(rawBody.toString('utf8')); }
  catch (_) { throw fail('Webhook payload is invalid', 400); }

  let event;
  try {
    event = await WebhookEvent.create({ provider: 'razorpay', eventId, eventType: body.event || 'unknown' });
  } catch (error) {
    if (error.code !== 11000) throw error;
    event = await WebhookEvent.findOne({ provider: 'razorpay', eventId });
    if (event?.processedAt) return { success: true, duplicate: true };
  }

  const entity = body.payload?.payment?.entity;
  if (entity?.order_id && ['payment.captured', 'payment.failed'].includes(body.event)) {
    const payment = await Payment.findOne({ providerOrderId: entity.order_id });
    if (payment && body.event === 'payment.captured') await settleCapturedPayment(payment, entity);
    if (payment && body.event === 'payment.failed' && ['CREATED', 'CREATING'].includes(payment.status)) {
      payment.status = 'FAILED';
      payment.providerPaymentId = entity.id;
      payment.failureCode = entity.error_code || 'PAYMENT_FAILED';
      await payment.save();
      await Booking.updateOne({ _id: payment.booking, paymentStatus: 'pending' }, { $set: { paymentStatus: 'failed' } });
      await notifyPaymentFailed(payment);
    }
    if (!payment) await subscriptionService.handleCapturedOrder(entity.order_id, entity, body.event);
  }
  const refundEntity = body.payload?.refund?.entity;
  if (refundEntity && ['refund.processed', 'refund.failed'].includes(body.event)) {
    const refundSelectors = [];
    if (refundEntity.id) refundSelectors.push({ providerRefundId: refundEntity.id });
    if (/^[a-f\d]{24}$/i.test(refundEntity.notes?.refundRecordId || '')) {
      refundSelectors.push({ _id: refundEntity.notes.refundRecordId });
    }
    const refund = refundSelectors.length ? await Refund.findOne({ $or: refundSelectors }) : null;
    if (refund) {
      const payment = await Payment.findById(refund.payment);
      if (payment && body.event === 'refund.processed') await finishRefund(refund, refundEntity, payment);
      if (payment && body.event === 'refund.failed') {
        refund.providerRefundId = refundEntity.id;
        refund.status = 'FAILED';
        refund.failureCode = refundEntity.error_code || 'REFUND_FAILED';
        await refund.save();
        payment.status = payment.failureCode ? 'REFUND_REQUIRED' : 'PAID';
        payment.refundLock = false;
        await payment.save();
      }
    }
  }
  event.processedAt = new Date();
  await event.save();
  return { success: true, received: true };
};

module.exports = { createOrder, verifyCheckout, handleWebhook, issueFullRefund, listRefundRequired };
