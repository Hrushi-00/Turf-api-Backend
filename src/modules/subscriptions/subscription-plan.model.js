const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  slug: { type: String, required: true, trim: true, lowercase: true, unique: true },
  description: { type: String, trim: true, maxlength: 1000, default: '' },
  currency: { type: String, uppercase: true, default: 'INR', enum: ['INR'] },
  monthlyPricePaise: { type: Number, required: true, min: 100 },
  quarterlyPricePaise: { type: Number, required: true, min: 100 },
  yearlyPricePaise: { type: Number, required: true, min: 100 },
  trialDays: { type: Number, default: 0, min: 0, max: 90 },
  limits: { maxVenues: { type: Number, default: 1, min: 1 }, maxFacilitiesPerVenue: { type: Number, default: 5, min: 1 } },
  features: [{ type: String, trim: true, maxlength: 100 }],
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true }
}, { timestamps: true, strict: 'throw' });

module.exports = mongoose.model('SubscriptionPlan', schema);
