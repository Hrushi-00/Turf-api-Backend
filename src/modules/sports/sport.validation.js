const { body, param } = require('express-validator');
const validateSport = [
  body('name').trim().notEmpty().isLength({ max: 80 }),
  body('slug').trim().toLowerCase().matches(/^[a-z0-9-]{2,60}$/),
  body('description').optional().trim().isLength({ max: 500 }),
  body('iconUrl').optional({ values: 'falsy' }).isURL({ require_protocol: true })
];
const validateSportUpdate = [
  param('id').isMongoId(),
  body('name').optional().trim().notEmpty().isLength({ max: 80 }),
  body('slug').optional().trim().toLowerCase().matches(/^[a-z0-9-]{2,60}$/),
  body('description').optional().trim().isLength({ max: 500 }),
  body('iconUrl').optional({ values: 'falsy' }).isURL({ require_protocol: true }),
  body('status').optional().isIn(['ACTIVE', 'INACTIVE'])
];
module.exports = { validateSport, validateSportUpdate };
