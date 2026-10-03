const AuditLog = require('./audit-log.model');

const record = async (entry) => AuditLog.create(entry);
const list = async ({ page = 1, limit = 50, actorId, action, entityType, entityId } = {}) => {
  const p = Math.max(parseInt(page, 10) || 1, 1); const size = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
  const filter = Object.fromEntries(Object.entries({ actorId, action, entityType, entityId }).filter(([, value]) => value));
  const [data, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip((p - 1) * size).limit(size), AuditLog.countDocuments(filter)
  ]);
  return { success: true, data, total, page: p, pages: Math.ceil(total / size) };
};
module.exports = { record, list };
