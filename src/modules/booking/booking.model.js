const mongoose = require('mongoose');

const rateSegmentSchema = new mongoose.Schema({
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  hourlyRate: { type: Number, required: true, min: 0 },
  pricingRuleId: { type: mongoose.Schema.Types.ObjectId, ref: 'FacilityPricingRule' },
  pricingRuleName: { type: String, default: '' }
}, { _id: false });

const pricingSnapshotSchema = new mongoose.Schema({
  currency: { type: String, uppercase: true, required: true, minlength: 3, maxlength: 3 },
  amount: { type: Number, required: true, min: 0 },
  baseAmount: { type: Number, min: 0 },
  membershipDiscountPaise: { type: Number, min: 0, default: 0 },
  membershipDiscountBps: { type: Number, min: 0, max: 10000, default: 0 },
  membershipId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserMembership' },
  durationMinutes: { type: Number, required: true, min: 1 },
  calculation: { type: String, required: true },
  baseRate: { type: Number, min: 0 },
  dayType: { type: String, enum: ['WEEKDAY', 'WEEKEND'] },
  rateSegments: { type: [rateSegmentSchema], default: [] },
  capturedAt: { type: Date, default: Date.now }
}, { _id: false });

const policySnapshotSchema = new mongoose.Schema({
  cancellationPolicy: { type: String, default: null },
  version: { type: String, required: true },
  capturedAt: { type: Date, default: Date.now }
}, { _id: false });

const bookingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false
    },
    turf: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Turf',
      required: false
    },
    facility: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Facility',
      required: false,
      index: true
    },
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Auth',
      required: true
    },
    date: {
      type: Date,
      required: true
    },
    timeSlot: {
      type: String,
      required: true
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    pricingSnapshot: { type: pricingSnapshotSchema, required: true },
    policySnapshot: { type: policySnapshotSchema, required: true },
    currency: { type: String, uppercase: true, default: 'INR', minlength: 3, maxlength: 3 },
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
    paymentOrderLock: { type: Boolean, default: false, select: false },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded', 'partially_refunded'],
      default: 'pending'
    },
    bookingStatus: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'completed'],
      default: 'pending'
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'online', 'upi', 'card'],
      default: 'online'
    },
    holdExpiresAt: { type: Date, index: true },
    reservationId: { type: String, select: false },
    idempotencyKey: { type: String, trim: true, maxlength: 128, select: false }
  },
  { timestamps: true }
);

bookingSchema.index({ turf: 1, date: 1, bookingStatus: 1 });
bookingSchema.index({ facility: 1, date: 1, bookingStatus: 1 });
bookingSchema.index({ user: 1, date: -1 });
bookingSchema.index({ user: 1, idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } });

bookingSchema.pre('validate', function (next) {
  if (Boolean(this.turf) === Boolean(this.facility)) {
    this.invalidate('facility', 'A booking must reference exactly one bookable resource');
  }
  if (!this.pricingSnapshot && Number.isFinite(this.price)) {
    const parts = this.timeSlot?.split('-').map((part) => part.trim().split(':').map(Number));
    const durationMinutes = parts?.length === 2
      ? (parts[1][0] * 60 + parts[1][1]) - (parts[0][0] * 60 + parts[0][1])
      : 0;
    this.pricingSnapshot = {
      currency: this.currency || 'INR', amount: this.price, durationMinutes: Math.max(durationMinutes, 1),
      calculation: 'LEGACY_UNSNAPSHOTTED', capturedAt: this.createdAt || new Date()
    };
  }
  if (!this.policySnapshot) this.policySnapshot = { cancellationPolicy: null, version: 'LEGACY_UNSNAPSHOTTED', capturedAt: this.createdAt || new Date() };
  next();
});

module.exports = mongoose.model('Booking', bookingSchema);
