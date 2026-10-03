const mongoose = require('mongoose');
const refundSchema = new mongoose.Schema({
  payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', required: true, index: true },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Auth', required: true },
  idempotencyKey: { type: String, required: true },
  providerRefundId: { type: String, unique: true, sparse: true },
  amountPaise: { type: Number, required: true, min: 1 },
  status: { type: String, enum: ['CREATING', 'PENDING', 'PROCESSED', 'FAILED', 'UNKNOWN'], default: 'CREATING', index: true },
  failureCode: { type: String, default: '' },
  processedAt: Date
}, { timestamps: true });
refundSchema.index({ initiatedBy: 1, idempotencyKey: 1 }, { unique: true });
module.exports = mongoose.model('Refund', refundSchema);
