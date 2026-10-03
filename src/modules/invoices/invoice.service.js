const mongoose = require('mongoose');
const Invoice = require('./invoice.model');
const Booking = require('../booking/booking.model');
const Business = require('../business/business.model');
const Subscription = require('../subscriptions/business-subscription.model');

const invoiceNumberFor = (id, date = new Date()) => `INV-${date.toISOString().slice(0, 10).replace(/-/g, '')}-${id.toString().toUpperCase()}`;
const platformSeller = () => ({
  name: process.env.INVOICE_SELLER_NAME || 'Sports Venue Platform',
  email: process.env.INVOICE_SELLER_EMAIL || '',
  address: process.env.INVOICE_SELLER_ADDRESS || null
});

const createBookingInvoice = async (payment) => {
  if (payment.status !== 'PAID') return null;
  const existing = await Invoice.findOne({ payment: payment._id });
  if (existing) return existing;
  const booking = await Booking.findById(payment.booking)
    .populate('user', 'name email address')
    .populate('turf', 'turfDetails.turfName ownerDetails')
    .populate({ path: 'facility', select: 'name venue', populate: { path: 'venue', select: 'business', populate: { path: 'business', select: 'displayName legalName contactEmail address' } } });
  if (!booking?.user) return null;
  const business = booking.facility?.venue?.business || await Business.findOne({ owner: booking.admin }).select('displayName legalName contactEmail address');
  const venueLabel = booking.facility?.name || booking.turf?.turfDetails?.turfName || 'Sports venue booking';
  const seller = business
    ? { name: business.displayName || business.legalName, email: business.contactEmail, address: business.address }
    : { name: booking.turf?.ownerDetails?.name || 'Sports venue', email: booking.turf?.ownerDetails?.email || '', address: null };
  const amountPaise = payment.capturedAmountPaise || payment.amountPaise;
  const id = new mongoose.Types.ObjectId();
  try {
    return await Invoice.create({
      _id: id,
      invoiceNumber: invoiceNumberFor(id, payment.capturedAt || new Date()),
      invoiceType: 'BOOKING', customer: booking.user._id, business: business?._id,
      booking: booking._id, payment: payment._id,
      buyer: { name: booking.user.name, email: booking.user.email, address: booking.user.address || null },
      seller,
      lineItems: [{ description: `Sports venue booking: ${venueLabel}`, quantity: 1, unitAmountPaise: amountPaise, totalAmountPaise: amountPaise }],
      subtotalPaise: amountPaise, taxPaise: 0, totalPaise: amountPaise, currency: payment.currency,
      issuedAt: payment.capturedAt || new Date()
    });
  } catch (error) {
    if (error.code === 11000) return Invoice.findOne({ payment: payment._id });
    throw error;
  }
};

const createSubscriptionInvoice = async (payment) => {
  if (payment.status !== 'PAID') return null;
  const existing = await Invoice.findOne({ subscriptionPayment: payment._id });
  if (existing) return existing;
  const [business, subscription] = await Promise.all([
    Business.findById(payment.business).select('legalName displayName contactEmail address'),
    Subscription.findById(payment.subscription).populate('plan', 'name')
  ]);
  if (!business || !subscription) return null;
  const amountPaise = payment.amountPaise;
  const id = new mongoose.Types.ObjectId();
  try {
    return await Invoice.create({
      _id: id,
      invoiceNumber: invoiceNumberFor(id, payment.capturedAt || new Date()),
      invoiceType: 'SUBSCRIPTION', business: business._id, subscriptionPayment: payment._id,
      buyer: { name: business.legalName || business.displayName, email: business.contactEmail, address: business.address },
      seller: platformSeller(),
      lineItems: [{ description: `Business subscription: ${subscription.plan?.name || subscription.billingCycle}`, quantity: 1, unitAmountPaise: amountPaise, totalAmountPaise: amountPaise }],
      subtotalPaise: amountPaise, taxPaise: 0, totalPaise: amountPaise, currency: payment.currency,
      issuedAt: payment.capturedAt || new Date()
    });
  } catch (error) {
    if (error.code === 11000) return Invoice.findOne({ subscriptionPayment: payment._id });
    throw error;
  }
};

const listMine = async (user) => {
  const filter = user.role === 'BusinessUser'
    ? { business: (await Business.findOne({ owner: user._id }).select('_id'))?._id }
    : { customer: user._id };
  if (!filter.business && user.role === 'BusinessUser') return { success: true, data: [] };
  return { success: true, data: await Invoice.find(filter).sort({ issuedAt: -1 }).limit(100) };
};

module.exports = { createBookingInvoice, createSubscriptionInvoice, listMine };
