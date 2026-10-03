const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
  subscription: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessSubscription', required: true, index: true },
  provider: { type: String, enum: ['razorpay'], default: 'razorpay' },
  providerOrderId: { type: String, unique: true, sparse: true },
  providerPaymentId: { type: String, unique: true, sparse: true },
  idempotencyKey: { type: String, required: true },
  amountPaise: { type: Number, required: true, min: 100 },
  currency: { type: String, required: true, uppercase: true, minlength: 3, maxlength: 3 },
  status: { type: String, enum: ['CREATING', 'CREATED', 'PAID', 'FAILED', 'REFUND_REQUIRED'], default: 'CREATING', index: true },
  failureCode: { type: String, default: '' },
  capturedAt: Date
}, { timestamps: true, strict: 'throw' });

schema.index({ business: 1, idempotencyKey: 1 }, { unique: true });
module.exports = mongoose.model('SubscriptionPayment', schema);
