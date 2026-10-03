const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  targetType: { type: String, enum: ['VENUE', 'FACILITY', 'TURF'], required: true },
  target: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, trim: true, maxlength: 2000, default: '' },
  status: { type: String, enum: ['PENDING', 'PUBLISHED', 'HIDDEN'], default: 'PENDING', index: true },
  moderationReason: { type: String, maxlength: 1000, default: '' },
  moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Auth' },
  moderatedAt: Date,
  businessResponse: { type: String, trim: true, maxlength: 2000, default: '' },
  respondedAt: Date
}, { timestamps: true, strict: 'throw' });

reviewSchema.index({ targetType: 1, target: 1, status: 1, createdAt: -1 });
module.exports = mongoose.model('Review', reviewSchema);
