const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  points: { type: Number, required: true, min: 0, default: 0 }
}, { timestamps: true, strict: 'throw' });

module.exports = mongoose.model('LoyaltyAccount', schema);
