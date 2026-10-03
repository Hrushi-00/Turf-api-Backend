const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, trim: true, maxlength: 1000, default: '' },
  pricePaise: { type: Number, required: true, min: 0 },
  durationDays: { type: Number, required: true, min: 1, max: 3650 },
  discountBps: { type: Number, default: 0, min: 0, max: 10000 },
  priorityBooking: { type: Boolean, default: false },
  features: [{ type: String, trim: true, maxlength: 100 }],
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Auth', required: true }
}, { timestamps: true, strict: 'throw' });

schema.index({ status: 1, pricePaise: 1 });
module.exports = mongoose.model('MembershipPlan', schema);
