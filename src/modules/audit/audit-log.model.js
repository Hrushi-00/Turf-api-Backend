const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  actorRole: { type: String, required: true },
  action: { type: String, required: true, maxlength: 120, index: true },
  entityType: { type: String, required: true, maxlength: 80 },
  entityId: { type: String, required: true, maxlength: 80 },
  oldValue: { type: mongoose.Schema.Types.Mixed, default: null },
  newValue: { type: mongoose.Schema.Types.Mixed, default: null },
  reason: { type: String, maxlength: 1000, default: '' },
  requestId: { type: String, maxlength: 120, default: '' },
  ipAddress: { type: String, maxlength: 80, default: '' },
  userAgent: { type: String, maxlength: 500, default: '' }
}, { timestamps: true, strict: 'throw', versionKey: false });

schema.index({ entityType: 1, entityId: 1, createdAt: -1 });
module.exports = mongoose.model('AuditLog', schema);
