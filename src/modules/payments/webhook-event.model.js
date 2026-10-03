const mongoose = require('mongoose');
const eventSchema = new mongoose.Schema({
  provider: { type: String, enum: ['razorpay'], required: true },
  eventId: { type: String, required: true },
  eventType: { type: String, required: true },
  processedAt: Date
}, { timestamps: true });
eventSchema.index({ provider: 1, eventId: 1 }, { unique: true });
module.exports = mongoose.model('PaymentWebhookEvent', eventSchema);
