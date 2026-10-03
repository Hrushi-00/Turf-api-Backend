const audit = require('../modules/audit/audit.service');

const auditResponse = (action, entityType, idFromRequest = (req) => req.params.id) => (req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (payload) => {
    if (res.statusCode < 400 && payload?.success !== false && req.user?._id) {
      audit.record({
        actorId: req.user._id,
        actorRole: req.user.role,
        action,
        entityType,
        entityId: String(idFromRequest(req) || 'platform'),
        oldValue: null,
        newValue: { result: 'succeeded', status: req.body?.status || req.body?.approvalStatus || null },
        reason: req.body?.reason || req.body?.rejectionReason || '',
        requestId: req.id || req.get('x-request-id') || '',
        ipAddress: req.ip || '',
        userAgent: req.get('user-agent') || ''
      }).catch((error) => console.error('Audit log write failed:', error.message));
    }
    return originalJson(payload);
  };
  next();
};

module.exports = { auditResponse };
