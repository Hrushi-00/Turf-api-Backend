const mongoose = require('mongoose');

const businessSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'Auth', required: true, unique: true, index: true },
  legalName: { type: String, required: true, trim: true, maxlength: 160 },
  displayName: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 2000, default: '' },
  businessType: { type: String, enum: ['individual', 'partnership', 'private_limited', 'llp', 'other'], default: 'individual' },
  contactEmail: { type: String, required: true, trim: true, lowercase: true },
  contactPhone: { type: String, required: true, trim: true },
  website: { type: String, trim: true, default: '' },
  registrationNumber: { type: String, trim: true, default: '' },
  taxIdMasked: { type: String, trim: true, default: '' },
  address: {
    line1: { type: String, required: true, trim: true },
    line2: { type: String, trim: true, default: '' },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true },
    postalCode: { type: String, required: true, trim: true }
  },
  timezone: { type: String, required: true, default: 'Asia/Kolkata' },
  approvalStatus: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED', 'REQUIRES_ACTION'], default: 'PENDING' },
  subscriptionStatus: { type: String, enum: ['NOT_STARTED', 'PENDING_PAYMENT', 'ACTIVE', 'GRACE_PERIOD', 'EXPIRED', 'CANCELLED', 'SUSPENDED'], default: 'NOT_STARTED', index: true },
  operationalStatus: { type: String, enum: ['ACTIVE', 'PAUSED', 'SUSPENDED', 'CLOSED'], default: 'PAUSED', index: true },
  rejectionReason: { type: String, default: '', maxlength: 1000 },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Auth' },
  reviewedAt: Date
}, { timestamps: true, strict: 'throw' });

businessSchema.index({ approvalStatus: 1, createdAt: -1 });

module.exports = mongoose.model('Business', businessSchema);
