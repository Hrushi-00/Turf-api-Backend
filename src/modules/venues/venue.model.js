const mongoose = require('mongoose');

const venueSchema = new mongoose.Schema({
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
  legacyTurf: { type: mongoose.Schema.Types.ObjectId, ref: 'Turf', unique: true, sparse: true },
  location: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 140 },
  description: { type: String, required: true, trim: true, maxlength: 3000 },
  media: [{ type: String }],
  amenities: [{ type: String, trim: true }],
  contactPhone: { type: String, trim: true, default: '' },
  approvalStatus: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED', 'REQUIRES_ACTION'], default: 'PENDING' },
  operationalStatus: { type: String, enum: ['ACTIVE', 'PAUSED', 'CLOSED', 'SUSPENDED'], default: 'ACTIVE' },
  rejectionReason: { type: String, default: '' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Auth' },
  reviewedAt: Date
}, { timestamps: true });

venueSchema.index({ approvalStatus: 1, operationalStatus: 1, createdAt: -1 });
module.exports = mongoose.model('Venue', venueSchema);
