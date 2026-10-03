const mongoose = require('mongoose');
const Ticket = require('./support-ticket.model');
const Booking = require('../booking/booking.model');
const notificationService = require('../notifications/notification.service');
const fail = (message, statusCode) => Object.assign(new Error(message), { statusCode });

const ownerInfo = (user) => ({ owner: user._id, ownerType: user.role === 'BusinessUser' ? 'BUSINESS' : 'CUSTOMER' });
const create = async (user, data) => {
  const identity = ownerInfo(user);
  if (data.bookingId) {
    const bookingOwner = identity.ownerType === 'BUSINESS' ? { admin: user._id } : { user: user._id };
    if (!await Booking.exists({ _id: data.bookingId, ...bookingOwner })) throw fail('Booking not found for this account', 404);
  }
  const id = new mongoose.Types.ObjectId();
  const ticketNumber = `SUP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${id.toString().toUpperCase()}`;
  return { success: true, data: await Ticket.create({
    _id: id, ticketNumber, ...identity, category: data.category, priority: data.priority || 'MEDIUM',
    subject: data.subject, booking: data.bookingId,
    messages: [{ author: user._id, authorRole: user.role, body: data.message }]
  }) };
};
const listMine = async (user) => ({ success: true, data: await Ticket.find(ownerInfo(user)).sort({ updatedAt: -1 }).limit(100) });
const getOne = async (user, id, admin = false) => {
  const filter = admin ? { _id: id } : { _id: id, ...ownerInfo(user) };
  const ticket = await Ticket.findOne(filter);
  if (!ticket) throw fail('Support ticket not found', 404);
  return { success: true, data: ticket };
};
const reply = async (user, id, body, admin = false) => {
  const filter = admin ? { _id: id, status: { $nin: ['RESOLVED', 'CLOSED'] } } : { _id: id, ...ownerInfo(user), status: { $nin: ['RESOLVED', 'CLOSED'] } };
  const ticket = await Ticket.findOneAndUpdate(filter, { $push: { messages: { author: user._id, authorRole: user.role, body } } }, { new: true, runValidators: true });
  if (!ticket) throw fail('Open support ticket not found', 404);
  if (admin) await notificationService.enqueue({
    eventKey: `support-update:${ticket._id}:${ticket.messages.at(-1)._id}`,
    recipient: ticket.owner, recipientType: ticket.ownerType === 'CUSTOMER' ? 'USER' : 'AUTH',
    eventType: 'SupportUpdate', title: 'Support ticket updated', message: `There is a new reply on ${ticket.ticketNumber}`,
    data: { ticketId: ticket._id, ticketNumber: ticket.ticketNumber }
  });
  return { success: true, data: ticket };
};
const listAdmin = async ({ status, priority, page = 1, limit = 20 }) => {
  const p = Math.max(parseInt(page, 10) || 1, 1); const size = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const filter = { ...(status ? { status } : {}), ...(priority ? { priority } : {}) };
  const [data, total] = await Promise.all([Ticket.find(filter).sort({ priority: -1, createdAt: 1 }).skip((p - 1) * size).limit(size), Ticket.countDocuments(filter)]);
  return { success: true, data, total, page: p, pages: Math.ceil(total / size) };
};
const updateAdmin = async (id, changes) => {
  const ticket = await Ticket.findByIdAndUpdate(id, { $set: { ...changes, ...(changes.status === 'CLOSED' || changes.status === 'RESOLVED' ? { closedAt: new Date() } : {}) } }, { new: true, runValidators: true });
  if (!ticket) throw fail('Support ticket not found', 404);
  if (changes.status) await notificationService.enqueue({
    eventKey: `support-status:${ticket._id}:${ticket.status}:${ticket.updatedAt.toISOString()}`,
    recipient: ticket.owner, recipientType: ticket.ownerType === 'CUSTOMER' ? 'USER' : 'AUTH',
    eventType: 'SupportUpdate', title: 'Support ticket status changed', message: `Your ticket ${ticket.ticketNumber} is now ${ticket.status}.`,
    data: { ticketId: ticket._id, ticketNumber: ticket.ticketNumber, status: ticket.status }
  });
  return { success: true, data: ticket };
};
module.exports = { create, listMine, getOne, reply, listAdmin, updateAdmin };
