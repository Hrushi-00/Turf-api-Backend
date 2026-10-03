const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
  plan: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan', required: true },
  status: { type: String, enum: ['PENDING_PAYMENT', 'TRIALING', 'ACTIVE', 'GRACE_PERIOD', 'EXPIRED', 'CANCELLED', 'SUSPENDED'], default: 'PENDING_PAYMENT', index: true },
  billingCycle: { type: String, enum: ['MONTHLY', 'QUARTERLY', 'YEARLY'], required: true },
  amountPaise: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'INR', uppercase: true },
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  cancelAtPeriodEnd: { type: Boolean, default: false },
  cancelledAt: Date,
  latestPayment: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPayment' }
}, { timestamps: true, strict: 'throw' });

schema.index({ business: 1, createdAt: -1 });
module.exports = mongoose.model('BusinessSubscription', schema);
