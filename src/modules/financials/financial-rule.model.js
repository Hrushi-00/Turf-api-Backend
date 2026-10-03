const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  key: { type: String, default: 'platform', unique: true, immutable: true },
  bookingCommissionBps: { type: Number, required: true, min: 0, max: 10000, default: 0 },
  currency: { type: String, enum: ['INR'], default: 'INR' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Auth' }
}, { timestamps: true, strict: 'throw' });

module.exports = mongoose.model('FinancialRule', schema);
