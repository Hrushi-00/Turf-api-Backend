const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  provider: { type: String, enum: ['razorpay'], required: true },
  providerOrderId: { type: String, unique: true, sparse: true },
  providerPaymentId: { type: String, unique: true, sparse: true },
  idempotencyKey: { type: String, required: true },
  amountPaise: { type: Number, required: true, min: 1 },
  capturedAmountPaise: { type: Number, min: 1 },
  currency: { type: String, required: true, uppercase: true, minlength: 3, maxlength: 3 },
  status: { type: String, enum: ['CREATING', 'CREATED', 'PAID', 'FAILED', 'REFUND_REQUIRED', 'REFUND_PENDING', 'REFUNDED'], default: 'CREATING', index: true },
  failureCode: { type: String, default: '' },
  refundLock: { type: Boolean, default: false, select: false },
  capturedAt: Date
}, { timestamps: true });

paymentSchema.index({ user: 1, idempotencyKey: 1 }, { unique: true });
paymentSchema.index({ booking: 1, createdAt: -1 });
module.exports = mongoose.model('Payment', paymentSchema);
