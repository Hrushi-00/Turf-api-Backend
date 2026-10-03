const { body, param } = require('express-validator');
const validateLocationId = [param('id').isMongoId()];
const validateLocation = [
  body('name').trim().notEmpty().isLength({ max: 120 }),
  body('address').trim().notEmpty().isLength({ max: 300 }),
  body('landmark').optional().trim().isLength({ max: 150 }),
  body('city').trim().notEmpty().isLength({ max: 100 }),
  body('state').trim().notEmpty().isLength({ max: 100 }),
  body('country').trim().notEmpty().isLength({ max: 100 }),
  body('postalCode').trim().notEmpty().isLength({ max: 20 }),
  body('coordinates.latitude').optional().isFloat({ min: -90, max: 90 }),
  body('coordinates.longitude').optional().isFloat({ min: -180, max: 180 }),
  body('timezone').optional().trim().isLength({ min: 3, max: 80 }).bail().custom((value) => {
    try { new Intl.DateTimeFormat('en-US', { timeZone: value }); return true; }
    catch (_) { return false; }
  }),
  body('status').optional().isIn(['ACTIVE', 'INACTIVE'])
];
module.exports = { validateLocationId, validateLocation };
