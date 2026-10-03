const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  currency: { type: String, default: 'INR', enum: ['INR'], immutable: true },
  balancePaise: { type: Number, default: 0, min: 0, required: true }
}, { timestamps: true, strict: 'throw' });

module.exports = mongoose.model('Wallet', schema);
