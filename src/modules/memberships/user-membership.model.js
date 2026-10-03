const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  plan: { type: mongoose.Schema.Types.ObjectId, ref: 'MembershipPlan', required: true },
  idempotencyKey: { type: String, required: true, maxlength: 128 },
  status: { type: String, enum: ['PENDING', 'ACTIVE', 'EXPIRED', 'CANCELLED', 'FAILED'], default: 'PENDING', index: true },
  pricePaise: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'INR', enum: ['INR'] },
  discountBps: { type: Number, min: 0, max: 10000, required: true },
  featuresSnapshot: [{ type: String }],
  startsAt: Date,
  expiresAt: Date,
  cancelledAt: Date
}, { timestamps: true, strict: 'throw' });

schema.index({ user: 1, idempotencyKey: 1 }, { unique: true });
schema.index({ user: 1 }, { unique: true, partialFilterExpression: { status: 'ACTIVE' } });
module.exports = mongoose.model('UserMembership', schema);
