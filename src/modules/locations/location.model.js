const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
  legacyTurf: { type: mongoose.Schema.Types.ObjectId, ref: 'Turf', unique: true, sparse: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  address: { type: String, required: true, trim: true, maxlength: 300 },
  landmark: { type: String, trim: true, default: '' },
  city: { type: String, required: true, trim: true, maxlength: 100, index: true },
  state: { type: String, required: true, trim: true, maxlength: 100 },
  country: { type: String, required: true, trim: true, maxlength: 100 },
  postalCode: { type: String, required: true, trim: true, maxlength: 20 },
  coordinates: {
    latitude: { type: Number, min: -90, max: 90 },
    longitude: { type: Number, min: -180, max: 180 }
  },
  timezone: { type: String, required: true, default: 'Asia/Kolkata' },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' }
}, { timestamps: true });

locationSchema.index({ business: 1, name: 1 });
module.exports = mongoose.model('Location', locationSchema);
