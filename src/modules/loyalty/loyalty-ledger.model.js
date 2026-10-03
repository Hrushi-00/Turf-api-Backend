const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  eventKey: { type: String, required: true, unique: true, immutable: true },
  account: { type: mongoose.Schema.Types.ObjectId, ref: 'LoyaltyAccount', required: true, index: true, immutable: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true, immutable: true },
  entryType: { type: String, enum: ['EARN', 'REDEEM', 'ADJUSTMENT', 'EXPIRY'], required: true, immutable: true },
  points: { type: Number, required: true, validate: Number.isInteger, immutable: true },
  balanceAfter: { type: Number, required: true, min: 0, immutable: true },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', immutable: true },
  reason: { type: String, maxlength: 500, default: '', immutable: true }
}, { timestamps: true, strict: 'throw' });

schema.index({ user: 1, createdAt: -1 });
module.exports = mongoose.model('LoyaltyLedger', schema);
