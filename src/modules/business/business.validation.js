const { body, param, query } = require('express-validator');

const validateProfile = [
  body('legalName').trim().notEmpty().isLength({ max: 160 }),
  body('displayName').trim().notEmpty().isLength({ max: 120 }),
  body('description').optional().trim().isLength({ max: 2000 }),
  body('businessType').optional().isIn(['individual', 'partnership', 'private_limited', 'llp', 'other']),
  body('contactEmail').trim().isEmail().normalizeEmail(),
  body('contactPhone').trim().matches(/^\+?[0-9]{10,15}$/),
  body('website').optional({ values: 'falsy' }).trim().isURL({ require_protocol: true }),
  body('registrationNumber').optional().trim().isLength({ max: 100 }),
  body('taxIdMasked').optional().trim().isLength({ max: 40 }),
  body('timezone').optional().trim().isLength({ min: 3, max: 80 }).bail().custom((value) => {
    try { new Intl.DateTimeFormat('en-US', { timeZone: value }); return true; }
    catch (_) { return false; }
  }),
  body('address.line1').trim().notEmpty().isLength({ max: 200 }),
  body('address.line2').optional().trim().isLength({ max: 200 }),
  body('address.city').trim().notEmpty().isLength({ max: 100 }),
  body('address.state').trim().notEmpty().isLength({ max: 100 }),
  body('address.country').trim().notEmpty().isLength({ max: 100 }),
  body('address.postalCode').trim().notEmpty().isLength({ max: 20 })
];

const validateReview = [
  param('id').isMongoId(),
  body('approvalStatus').isIn(['APPROVED', 'REJECTED', 'REQUIRES_ACTION']),
  body('reason').if((value, { req }) => req.body.approvalStatus !== 'APPROVED').trim().notEmpty().isLength({ max: 1000 })
];

const validateList = [
  query('status').optional().isIn(['PENDING', 'APPROVED', 'REJECTED', 'REQUIRES_ACTION', 'ALL']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
];

module.exports = { validateProfile, validateReview, validateList };
