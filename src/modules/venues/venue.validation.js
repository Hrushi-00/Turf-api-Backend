const { body, param, query } = require('express-validator');

const venueId = [param('id').isMongoId()];
const validateCreate = [
  body('locationId').isMongoId(),
  body('name').trim().notEmpty().isLength({ max: 140 }),
  body('description').trim().notEmpty().isLength({ max: 3000 }),
  body('media').optional().isArray({ max: 20 }),
  body('media.*').optional().isURL({ require_protocol: true }),
  body('amenities').optional().isArray({ max: 100 }),
  body('contactPhone').optional().trim().matches(/^\+?[0-9]{10,15}$/)
];
const validateUpdate = [
  ...venueId,
  body('name').optional().trim().notEmpty().isLength({ max: 140 }),
  body('description').optional().trim().notEmpty().isLength({ max: 3000 }),
  body('media').optional().isArray({ max: 20 }),
  body('media.*').optional().isURL({ require_protocol: true }),
  body('amenities').optional().isArray({ max: 100 }),
  body('contactPhone').optional().trim().matches(/^\+?[0-9]{10,15}$/),
  body('operationalStatus').optional().isIn(['ACTIVE', 'PAUSED', 'CLOSED', 'SUSPENDED'])
];
const validateReview = [
  ...venueId,
  body('approvalStatus').isIn(['APPROVED', 'REJECTED', 'REQUIRES_ACTION']),
  body('reason').if((value, { req }) => req.body.approvalStatus !== 'APPROVED').trim().notEmpty().isLength({ max: 1000 })
];
const validatePublicQuery = [
  query('city').optional().trim().isLength({ max: 100 }),
  query('sport').optional().trim().isLength({ max: 60 }),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
];
const validateAdminQuery = [
  query('status').optional().isIn(['PENDING', 'APPROVED', 'REJECTED', 'REQUIRES_ACTION', 'ALL']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
];
module.exports = { venueId, validateCreate, validateUpdate, validateReview, validatePublicQuery, validateAdminQuery };
