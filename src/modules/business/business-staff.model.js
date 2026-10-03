const mongoose = require('mongoose');

const businessStaffSchema = new mongoose.Schema({
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  role: { type: String, enum: ['MANAGER', 'BOOKING_MANAGER', 'VENUE_MANAGER', 'FINANCE_VIEWER'], required: true },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true }
}, { timestamps: true, strict: 'throw' });

businessStaffSchema.index({ business: 1, email: 1 }, { unique: true });
module.exports = mongoose.model('BusinessStaff', businessStaffSchema);
