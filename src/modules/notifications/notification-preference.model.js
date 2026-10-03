const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, required: true },
  recipientType: { type: String, enum: ['USER', 'AUTH'], required: true },
  booking: { type: Boolean, default: true },
  payment: { type: Boolean, default: true },
  reminder: { type: Boolean, default: true },
  marketing: { type: Boolean, default: false },
  offers: { type: Boolean, default: false },
  security: { type: Boolean, default: true }
}, { timestamps: true, strict: 'throw' });

schema.index({ recipient: 1, recipientType: 1 }, { unique: true });
module.exports = mongoose.model('NotificationPreference', schema);
