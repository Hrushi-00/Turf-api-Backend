const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  eventKey: { type: String, required: true, unique: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  recipientType: { type: String, enum: ['USER', 'AUTH'], required: true },
  eventType: { type: String, required: true, maxlength: 80 },
  title: { type: String, required: true, maxlength: 160 },
  message: { type: String, required: true, maxlength: 1000 },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  readAt: Date
}, { timestamps: true, strict: 'throw' });

notificationSchema.index({ recipient: 1, recipientType: 1, readAt: 1, createdAt: -1 });
module.exports = mongoose.model('Notification', notificationSchema);
