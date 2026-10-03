const mongoose = require('mongoose');

const windowSchema = new mongoose.Schema({
  startTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  endTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  reason: { type: String, trim: true, maxlength: 200, default: '' }
}, { _id: false });

const availabilitySchema = new mongoose.Schema({
  facility: { type: mongoose.Schema.Types.ObjectId, ref: 'Facility', required: true, index: true },
  date: { type: Date, required: true },
  type: { type: String, enum: ['CLOSED', 'OVERRIDE', 'MAINTENANCE'], required: true },
  openTime: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  closeTime: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  windows: { type: [windowSchema], default: [] },
  reason: { type: String, trim: true, maxlength: 500, default: '' }
}, { timestamps: true, strict: 'throw' });

availabilitySchema.index({ facility: 1, date: 1 }, { unique: true });
module.exports = mongoose.model('FacilityAvailability', availabilitySchema);
