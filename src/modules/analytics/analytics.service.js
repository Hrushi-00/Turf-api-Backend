const User = require('../user/user.model');
const Business = require('../business/business.model');
const Booking = require('../booking/booking.model');
const Subscription = require('../subscriptions/business-subscription.model');
const Payment = require('../payments/payment.model');
const SubscriptionPayment = require('../subscriptions/subscription-payment.model');
const Ledger = require('../financials/financial-ledger.model');
const Settlement = require('../financials/settlement.model');
const fail = (message, statusCode) => Object.assign(new Error(message), { statusCode });

const businessDashboard = async (ownerId) => {
  const business = await Business.findOne({ owner: ownerId }).select('_id');
  if (!business) throw fail('Business profile not found', 404);
  const [bookings, ledger, topFacilities] = await Promise.all([
    Booking.aggregate([
      { $match: { admin: ownerId } },
      { $group: { _id: '$bookingStatus', count: { $sum: 1 }, grossBookingValue: { $sum: '$price' } } }
    ]),
    Ledger.aggregate([
      { $match: { business: business._id } },
      { $group: { _id: null, grossPaise: { $sum: '$grossPaise' }, commissionPaise: { $sum: '$commissionPaise' }, netPaise: { $sum: '$businessPayablePaise' } } }
    ]),
    Booking.aggregate([
      { $match: { admin: ownerId, bookingStatus: { $in: ['confirmed', 'completed'] }, facility: { $exists: true } } },
      { $group: { _id: '$facility', bookings: { $sum: 1 } } }, { $sort: { bookings: -1 } }, { $limit: 5 },
      { $lookup: { from: 'facilities', localField: '_id', foreignField: '_id', as: 'facility' } },
      { $unwind: '$facility' }, { $project: { facilityId: '$_id', name: '$facility.name', bookings: 1 } }
    ])
  ]);
  const totals = ledger[0] || { grossPaise: 0, commissionPaise: 0, netPaise: 0 };
  return { success: true, data: { bookings: Object.fromEntries(bookings.map((item) => [item._id, { count: item.count, grossBookingValue: item.grossBookingValue }])), financials: totals, popularFacilities: topFacilities } };
};

const adminDashboard = async () => {
  const [users, businesses, pendingBusinesses, subscriptions, subscriptionRevenue, payments, bookingFinancials, payouts, popularSports] = await Promise.all([
    User.countDocuments(), Business.countDocuments(), Business.countDocuments({ approvalStatus: 'PENDING' }),
    Subscription.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    SubscriptionPayment.aggregate([{ $match: { status: 'PAID' } }, { $group: { _id: null, count: { $sum: 1 }, revenuePaise: { $sum: '$amountPaise' } } }]),
    Payment.aggregate([{ $match: { status: 'PAID' } }, { $group: { _id: null, count: { $sum: 1 }, gmvPaise: { $sum: '$capturedAmountPaise' } } }]),
    Ledger.aggregate([{ $match: { entryType: 'BOOKING_CAPTURE' } }, { $group: { _id: null, bookingGmvPaise: { $sum: '$grossPaise' }, commissionPaise: { $sum: '$commissionPaise' } } }]),
    Settlement.aggregate([{ $match: { status: 'PROCESSED' } }, { $group: { _id: null, count: { $sum: 1 }, paidPaise: { $sum: '$amountPaise' } } }]),
    Booking.aggregate([
      { $match: { facility: { $exists: true } } }, { $lookup: { from: 'facilities', localField: 'facility', foreignField: '_id', as: 'facility' } },
      { $unwind: '$facility' }, { $unwind: '$facility.sportSlugs' },
      { $group: { _id: '$facility.sportSlugs', bookings: { $sum: 1 } } }, { $sort: { bookings: -1 } }, { $limit: 10 }
    ])
  ]);
  return { success: true, data: {
    users, businesses, pendingBusinesses, subscriptions, subscriptionRevenue: subscriptionRevenue[0] || { count: 0, revenuePaise: 0 },
    payments: payments[0] || { count: 0, gmvPaise: 0 },
    bookingFinancials: bookingFinancials[0] || { bookingGmvPaise: 0, commissionPaise: 0 },
    payouts: payouts[0] || { count: 0, paidPaise: 0 }, popularSports
  } };
};
module.exports = { businessDashboard, adminDashboard };
