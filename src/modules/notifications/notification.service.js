const Notification = require('./notification.model');
const Preference = require('./notification-preference.model');
const Outbox = require('./notification-outbox.model');

const enqueue = async ({ eventKey, recipient, recipientType, eventType, title, message, data = {} }) => {
  try { return await Outbox.create({ eventKey, recipient, recipientType, eventType, title, message, data }); }
  catch (error) { if (error.code === 11000) return Outbox.findOne({ eventKey }); throw error; }
};
const listMine = async (user, { page = 1, limit = 30 } = {}) => {
  const p = Math.max(parseInt(page, 10) || 1, 1); const size = Math.min(Math.max(parseInt(limit, 10) || 30, 1), 100);
  const recipientType = user.role === 'user' ? 'USER' : 'AUTH';
  const filter = { recipient: user._id, recipientType };
  const [data, total, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip((p - 1) * size).limit(size),
    Notification.countDocuments(filter), Notification.countDocuments({ ...filter, readAt: { $exists: false } })
  ]);
  return { success: true, data, total, unread, page: p, pages: Math.ceil(total / size) };
};
const markRead = async (user, id) => {
  const recipientType = user.role === 'user' ? 'USER' : 'AUTH';
  const notification = await Notification.findOneAndUpdate({ _id: id, recipient: user._id, recipientType }, { $set: { readAt: new Date() } }, { new: true });
  if (!notification) throw Object.assign(new Error('Notification not found'), { statusCode: 404 });
  return { success: true, data: notification };
};
const getPreference = async (user) => {
  const recipientType = user.role === 'user' ? 'USER' : 'AUTH';
  const data = await Preference.findOneAndUpdate({ recipient: user._id, recipientType }, { $setOnInsert: { recipient: user._id, recipientType } }, { new: true, upsert: true });
  return { success: true, data };
};
const updatePreference = async (user, input) => {
  const recipientType = user.role === 'user' ? 'USER' : 'AUTH';
  const allowed = ['booking', 'payment', 'reminder', 'marketing', 'offers', 'security'];
  const changes = Object.fromEntries(allowed.filter((key) => input[key] !== undefined).map((key) => [key, input[key]]));
  const data = await Preference.findOneAndUpdate({ recipient: user._id, recipientType }, { $set: changes, $setOnInsert: { recipient: user._id, recipientType } }, { new: true, upsert: true, runValidators: true });
  return { success: true, data };
};
const processOutboxBatch = async (limit = 50) => {
  let processed = 0;
  for (let i = 0; i < limit; i += 1) {
    const now = new Date();
    const event = await Outbox.findOneAndUpdate({ $or: [
      { status: 'PENDING', nextAttemptAt: { $lte: now } },
      { status: 'PROCESSING', updatedAt: { $lt: new Date(now.getTime() - 2 * 60 * 1000) } }
    ] }, { $set: { status: 'PROCESSING' }, $inc: { attempts: 1 } }, { new: true, sort: { createdAt: 1 } });
    if (!event) break;
    try {
      const preference = await Preference.findOne({ recipient: event.recipient, recipientType: event.recipientType });
      const preferenceKey = event.eventType.startsWith('Booking') ? 'booking'
        : event.eventType.startsWith('Payment') ? 'payment'
          : event.eventType.startsWith('Subscription') ? 'payment'
            : event.eventType.startsWith('Security') ? 'security'
              : event.eventType.startsWith('Support') ? 'booking' : null;
      if (preferenceKey && preference?.[preferenceKey] === false) {
        event.status = 'PROCESSED'; event.processedAt = new Date(); await event.save(); processed += 1;
        continue;
      }
      await Notification.updateOne({ eventKey: event.eventKey }, { $setOnInsert: {
        eventKey: event.eventKey, recipient: event.recipient, recipientType: event.recipientType,
        eventType: event.eventType, title: event.title, message: event.message, data: event.data
      } }, { upsert: true });
      event.status = 'PROCESSED'; event.processedAt = new Date(); await event.save(); processed += 1;
    } catch (error) {
      event.status = 'PENDING'; event.nextAttemptAt = new Date(Date.now() + Math.min(60, 2 ** event.attempts) * 1000); await event.save();
      console.error('Notification outbox delivery failed:', error.message);
    }
  }
  return processed;
};
module.exports = { enqueue, listMine, markRead, getPreference, updatePreference, processOutboxBatch };
