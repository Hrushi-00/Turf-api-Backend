const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  settlement: { type: mongoose.Schema.Types.ObjectId, ref: 'Settlement', required: true, index: true },
  ledgerEntry: { type: mongoose.Schema.Types.ObjectId, ref: 'FinancialLedger', required: true },
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
  allocatedPaise: { type: Number, required: true }
}, { timestamps: true, strict: 'throw' });

schema.index({ ledgerEntry: 1 }, { unique: true });
schema.index({ settlement: 1, business: 1 });
module.exports = mongoose.model('SettlementAllocation', schema);
