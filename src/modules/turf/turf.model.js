const mongoose = require('mongoose');

const turfSchema = new mongoose.Schema({
  ownerDetails: {
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Auth' },
    businessUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'Auth', index: true },
    name: { type: String, required: true },
    contactNumber: { type: String, required: true },
    email: { type: String, required: true }
  },
  turfDetails: {
    turfName: { type: String, required: true },
    description: { type: String, required: true },
    sportsAvailable: [{ type: String }],
    surfaceType: { type: String, required: true },
    dimensions: {
      length: { type: Number, required: true },
      width: { type: Number, required: true },
      unit: { type: String, required: true }
    },
    capacity: { type: Number, required: true }
  },
  location: {
    address: { type: String, required: true },
    landmark: String,
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    googleMapLink: String,
    coordinates: {
      type: { type: String, enum: ['Point'] },
      coordinates: {
        type: [Number],
        validate: {
          validator: (value) => !value || value.length === 2,
          message: 'Coordinates must contain longitude and latitude'
        }
      }
    }
  },
  timezone: { type: String, default: 'Asia/Kolkata' },
  pricing: {
    weekdayRate: { type: Number, required: true },
    weekendRate: { type: Number, required: true },
    seasonalRate: {
      summer: Number,
      monsoon: Number,
      winter: Number
    },
    currency: { type: String, default: 'INR' },
    minimumBookingHours: { type: Number, default: 1 },
    cancellationPolicy: String
  },
  availability: {
    openingTime: { type: String, required: true },
    closingTime: { type: String, required: true },
    closedDays: [{ type: String }],
    customUnavailableDates: [{ type: Date }]
  },
  amenities: [{ type: String }],
  gallery: {
    mainImage: { type: String, required: true },
    thumbnailImages: [{ type: String }]
  },
  metaInfo: {
    isApproved: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },
    isTrending: { type: Boolean, default: false },
    totalBookings: { type: Number, default: 0 },
    viewsCount: { type: Number, default: 0 },
    popularityScore: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
  },
  status: { type: String, enum: ['pending', 'rejected', 'active'], default: 'pending' }
});

turfSchema.index({ 'location.coordinates': '2dsphere' });

module.exports = mongoose.model('Turf', turfSchema);
