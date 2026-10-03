const mongoose = require('mongoose');

const businessDocumentSchema = new mongoose.Schema({
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
  documentType: {
    type: String,
    enum: ['IDENTITY_PROOF', 'BUSINESS_REGISTRATION', 'TAX_DOCUMENT', 'ADDRESS_PROOF', 'BANK_VERIFICATION', 'AUTHORIZATION'],
    required: true
  },
  storageKey: { type: String, required: true, select: false },
  storageFormat: { type: String, required: true, select: false },
  documentNumberMasked: { type: String, trim: true, maxlength: 40, default: '' },
  status: { type: String, enum: ['PENDING_REVIEW', 'APPROVED', 'REJECTED'], default: 'PENDING_REVIEW', index: true },
  submittedAt: { type: Date, default: Date.now },
  reviewedAt: Date,
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Auth' },
  rejectionReason: { type: String, maxlength: 1000, default: '' },
  expiryDate: Date
}, { timestamps: true, strict: 'throw' });

businessDocumentSchema.index({ business: 1, documentType: 1 }, { unique: true });
module.exports = mongoose.model('BusinessDocument', businessDocumentSchema);
