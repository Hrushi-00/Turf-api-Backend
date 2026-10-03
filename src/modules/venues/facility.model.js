const mongoose = require('mongoose');

const weeklyScheduleSchema = new mongoose.Schema({
  dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
  isClosed: { type: Boolean, default: false },
  openTime: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  closeTime: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ }
}, { _id: false });

const facilitySchema = new mongoose.Schema({
  venue: { type: mongoose.Schema.Types.ObjectId, ref: 'Venue', required: true, index: true },
  legacyTurf: { type: mongoose.Schema.Types.ObjectId, ref: 'Turf', unique: true, sparse: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  sportSlugs: [{ type: String, required: true, trim: true, lowercase: true }],
  facilityType: { type: String, trim: true, default: '' },
  surfaceType: { type: String, trim: true, default: '' },
  capacity: { type: Number, min: 1, default: 1 },
  description: { type: String, trim: true, maxlength: 1500, default: '' },
  amenities: [{ type: String, trim: true }],
  weeklySchedule: [weeklyScheduleSchema],
  pricing: {
    currency: { type: String, uppercase: true, default: 'INR', minlength: 3, maxlength: 3 },
    weekdayRate: { type: Number, min: 0, required: true },
    weekendRate: { type: Number, min: 0, required: true },
    minimumBookingMinutes: { type: Number, min: 15, default: 60 }
  },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'MAINTENANCE'], default: 'ACTIVE' }
}, { timestamps: true });

facilitySchema.index({ venue: 1, status: 1 });
module.exports = mongoose.model('Facility', facilitySchema);
