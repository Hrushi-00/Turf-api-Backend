const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, required: true },
  authorRole: { type: String, required: true },
  body: { type: String, required: true, trim: true, maxlength: 5000 },
  createdAt: { type: Date, default: Date.now }
}, { _id: true });

const ticketSchema = new mongoose.Schema({
  ticketNumber: { type: String, required: true, unique: true },
  owner: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  ownerType: { type: String, enum: ['CUSTOMER', 'BUSINESS'], required: true },
  category: { type: String, enum: ['BOOKING', 'PAYMENT', 'REFUND', 'BUSINESS', 'VENUE', 'ACCOUNT', 'TECHNICAL', 'OTHER'], required: true },
  priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], default: 'MEDIUM', index: true },
  status: { type: String, enum: ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER', 'WAITING_FOR_BUSINESS', 'RESOLVED', 'CLOSED'], default: 'OPEN', index: true },
  subject: { type: String, required: true, trim: true, maxlength: 200 },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  messages: { type: [messageSchema], default: [] },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Auth' },
  closedAt: Date
}, { timestamps: true, strict: 'throw' });

ticketSchema.index({ owner: 1, updatedAt: -1 });
ticketSchema.index({ status: 1, priority: -1, createdAt: 1 });
module.exports = mongoose.model('SupportTicket', ticketSchema);
