const mongoose = require('mongoose');

const pricingRuleSchema = new mongoose.Schema({
  facility: { type: mongoose.Schema.Types.ObjectId, ref: 'Facility', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  daysOfWeek: [{ type: Number, min: 0, max: 6 }],
  startTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  endTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  hourlyRate: { type: Number, required: true, min: 0 },
  effectiveFrom: Date,
  effectiveTo: Date,
  priority: { type: Number, default: 0, min: 0, max: 1000 },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true }
}, { timestamps: true, strict: 'throw' });

pricingRuleSchema.index({ facility: 1, status: 1, priority: -1 });
module.exports = mongoose.model('FacilityPricingRule', pricingRuleSchema);
