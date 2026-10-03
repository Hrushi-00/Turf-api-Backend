const { body, param } = require('express-validator');
const ids = [param('venueId').isMongoId(), param('facilityId').optional().isMongoId()];
const validateFacility = [
  body('name').trim().notEmpty().isLength({ max: 120 }),
  body('sportSlugs').isArray({ min: 1, max: 10 }),
  body('sportSlugs.*').trim().matches(/^[a-z0-9-]{2,60}$/),
  body('facilityType').optional().trim().isLength({ max: 100 }),
  body('surfaceType').optional().trim().isLength({ max: 100 }),
  body('capacity').optional().isInt({ min: 1, max: 10000 }),
  body('description').optional().trim().isLength({ max: 1500 }),
  body('amenities').optional().isArray({ max: 100 }),
  body('weeklySchedule').optional().isArray({ max: 7 }),
  body('weeklySchedule.*.dayOfWeek').optional().isInt({ min: 0, max: 6 }),
  body('weeklySchedule.*.isClosed').optional().isBoolean(),
  body('weeklySchedule.*.openTime').optional().matches(/^([01]\d|2[0-3]):[0-5]\d$/),
  body('weeklySchedule.*.closeTime').optional().matches(/^([01]\d|2[0-3]):[0-5]\d$/),
  body('pricing.currency').optional().isLength({ min: 3, max: 3 }).isAlpha(),
  body('pricing.weekdayRate').isFloat({ min: 0 }),
  body('pricing.weekendRate').isFloat({ min: 0 }),
  body('pricing.minimumBookingMinutes').optional().isInt({ min: 15, max: 1440 }),
  body('status').optional().isIn(['ACTIVE', 'INACTIVE', 'MAINTENANCE'])
];
const validateAvailabilityRule = [
  ...ids,
  body('date').isDate({ format: 'YYYY-MM-DD', strictMode: true }),
  body('type').isIn(['CLOSED', 'OVERRIDE', 'MAINTENANCE']),
  body('openTime').if((value, { req }) => req.body.type === 'OVERRIDE').matches(/^([01]\d|2[0-3]):[0-5]\d$/),
  body('closeTime').if((value, { req }) => req.body.type === 'OVERRIDE').matches(/^([01]\d|2[0-3]):[0-5]\d$/),
  body('windows').if((value, { req }) => req.body.type === 'MAINTENANCE').isArray({ min: 1, max: 30 }),
  body('windows').optional().isArray({ max: 30 }),
  body('windows.*.startTime').if((value, { req }) => req.body.type === 'MAINTENANCE' || req.body.type === 'OVERRIDE').matches(/^([01]\d|2[0-3]):[0-5]\d$/),
  body('windows.*.endTime').if((value, { req }) => req.body.type === 'MAINTENANCE' || req.body.type === 'OVERRIDE').matches(/^([01]\d|2[0-3]):[0-5]\d$/),
  body('windows.*.reason').optional().trim().isLength({ max: 200 }),
  body('reason').optional().trim().isLength({ max: 500 })
];
const validatePricingRule = [
  ...ids,
  body('name').trim().notEmpty().isLength({ max: 100 }),
  body('daysOfWeek').optional().isArray({ max: 7 }),
  body('daysOfWeek.*').optional().isInt({ min: 0, max: 6 }),
  body('startTime').matches(/^([01]\d|2[0-3]):[0-5]\d$/),
  body('endTime').matches(/^([01]\d|2[0-3]):[0-5]\d$/),
  body('hourlyRate').isFloat({ min: 0 }),
  body('effectiveFrom').optional({ values: 'falsy' }).isISO8601().toDate(),
  body('effectiveTo').optional({ values: 'falsy' }).isISO8601().toDate(),
  body('priority').optional().isInt({ min: 0, max: 1000 }),
  body('status').optional().isIn(['ACTIVE', 'INACTIVE'])
];
const validateRuleId = [param('venueId').isMongoId(), param('facilityId').isMongoId(), param('ruleId').isMongoId()];
module.exports = { ids, validateFacility, validateAvailabilityRule, validatePricingRule, validateRuleId };
