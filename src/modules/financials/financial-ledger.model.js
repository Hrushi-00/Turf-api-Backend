const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  eventKey: { type: String, required: true, unique: true },
  entryType: { type: String, enum: ['BOOKING_CAPTURE', 'BOOKING_REFUND', 'PAYOUT', 'ADJUSTMENT'], required: true, index: true },
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', index: true },
  payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', index: true },
  refund: { type: mongoose.Schema.Types.ObjectId, ref: 'Refund' },
  settlement: { type: mongoose.Schema.Types.ObjectId, ref: 'Settlement' },
  currency: { type: String, required: true, uppercase: true, enum: ['INR'] },
  grossPaise: { type: Number, required: true },
  commissionPaise: { type: Number, required: true },
  businessPayablePaise: { type: Number, required: true },
  commissionBps: { type: Number, required: true, min: 0, max: 10000 },
  sourceEventAt: { type: Date, required: true }
}, { timestamps: true, strict: 'throw' });

schema.index({ business: 1, createdAt: -1 });
schema.index({ payment: 1, entryType: 1 });
module.exports = mongoose.model('FinancialLedger', schema);
