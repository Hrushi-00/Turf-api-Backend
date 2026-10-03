const mongoose = require('mongoose');

const slotHoldSchema = new mongoose.Schema({
  resourceType: { type: String, enum: ['TURF', 'FACILITY'], required: true },
  resourceId: { type: mongoose.Schema.Types.ObjectId, required: true },
  dateKey: { type: String, required: true },
  bucketStart: { type: Number, required: true, min: 0, max: 1425 },
  reservationId: { type: String, required: true },
  expiresAt: { type: Date, required: true }
}, { timestamps: true });

slotHoldSchema.index({ resourceType: 1, resourceId: 1, dateKey: 1, bucketStart: 1 }, { unique: true });
slotHoldSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
slotHoldSchema.index({ reservationId: 1 });

module.exports = mongoose.model('SlotHold', slotHoldSchema);
