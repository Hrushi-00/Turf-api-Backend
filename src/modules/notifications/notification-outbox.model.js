const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  eventKey: { type: String, required: true, unique: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, required: true },
  recipientType: { type: String, enum: ['USER', 'AUTH'], required: true },
  eventType: { type: String, required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  status: { type: String, enum: ['PENDING', 'PROCESSING', 'PROCESSED'], default: 'PENDING', index: true },
  attempts: { type: Number, default: 0 },
  nextAttemptAt: { type: Date, default: Date.now },
  processedAt: Date
}, { timestamps: true, strict: 'throw' });

schema.index({ status: 1, nextAttemptAt: 1, createdAt: 1 });
module.exports = mongoose.model('NotificationOutbox', schema);
