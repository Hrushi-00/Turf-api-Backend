const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
  amountPaise: { type: Number, required: true, min: 1 },
  currency: { type: String, required: true, uppercase: true, enum: ['INR'] },
  status: { type: String, enum: ['PENDING', 'PROCESSING', 'PROCESSED', 'FAILED', 'HELD'], default: 'PENDING', index: true },
  open: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Auth', required: true },
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Auth' },
  externalReference: { type: String, trim: true, maxlength: 160, default: '' },
  failureReason: { type: String, trim: true, maxlength: 1000, default: '' },
  processedAt: Date
}, { timestamps: true, strict: 'throw' });

schema.index({ business: 1, createdAt: -1 });
schema.index({ business: 1 }, { unique: true, partialFilterExpression: { open: true } });
module.exports = mongoose.model('Settlement', schema);
