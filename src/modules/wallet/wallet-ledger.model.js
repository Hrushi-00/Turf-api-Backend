const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  eventKey: { type: String, required: true, unique: true, immutable: true },
  wallet: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet', required: true, index: true, immutable: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true, immutable: true },
  entryType: { type: String, enum: ['CREDIT', 'DEBIT'], required: true, immutable: true },
  sourceType: { type: String, enum: ['ADMIN_ADJUSTMENT', 'MEMBERSHIP_PURCHASE', 'MEMBERSHIP_COMPENSATION', 'REFUND_CREDIT', 'PROMOTION', 'CASHBACK'], required: true, immutable: true },
  sourceId: { type: String, maxlength: 100, default: '', immutable: true },
  amountPaise: { type: Number, required: true, min: 1, immutable: true },
  balanceAfterPaise: { type: Number, required: true, min: 0, immutable: true },
  reason: { type: String, trim: true, maxlength: 500, default: '', immutable: true }
}, { timestamps: true, strict: 'throw' });

schema.index({ user: 1, createdAt: -1 });
module.exports = mongoose.model('WalletLedger', schema);
