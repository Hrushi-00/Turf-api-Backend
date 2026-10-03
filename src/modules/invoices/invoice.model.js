const mongoose = require('mongoose');

const partySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, trim: true, lowercase: true, default: '' },
  address: { type: mongoose.Schema.Types.Mixed, default: null }
}, { _id: false, strict: 'throw' });

const lineItemSchema = new mongoose.Schema({
  description: { type: String, required: true, trim: true, maxlength: 300 },
  quantity: { type: Number, required: true, min: 1 },
  unitAmountPaise: { type: Number, required: true, min: 0 },
  totalAmountPaise: { type: Number, required: true, min: 0 }
}, { _id: false, strict: 'throw' });

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: { type: String, required: true, unique: true, immutable: true },
  invoiceType: { type: String, enum: ['BOOKING', 'SUBSCRIPTION'], required: true, immutable: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', immutable: true },
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', immutable: true },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', immutable: true },
  payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', immutable: true },
  subscriptionPayment: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPayment', immutable: true },
  buyer: { type: partySchema, required: true, immutable: true },
  seller: { type: partySchema, required: true, immutable: true },
  lineItems: { type: [lineItemSchema], required: true, immutable: true },
  subtotalPaise: { type: Number, required: true, min: 0, immutable: true },
  taxPaise: { type: Number, required: true, min: 0, default: 0, immutable: true },
  totalPaise: { type: Number, required: true, min: 0, immutable: true },
  currency: { type: String, required: true, uppercase: true, minlength: 3, maxlength: 3, immutable: true },
  issuedAt: { type: Date, required: true, default: Date.now, immutable: true }
}, { timestamps: true, strict: 'throw' });

invoiceSchema.index({ payment: 1 }, { unique: true, partialFilterExpression: { payment: { $type: 'objectId' } } });
invoiceSchema.index({ subscriptionPayment: 1 }, { unique: true, partialFilterExpression: { subscriptionPayment: { $type: 'objectId' } } });
invoiceSchema.index({ customer: 1, issuedAt: -1 });
invoiceSchema.index({ business: 1, issuedAt: -1 });

module.exports = mongoose.model('Invoice', invoiceSchema);
