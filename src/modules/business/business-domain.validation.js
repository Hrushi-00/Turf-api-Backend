const { body, param, query } = require('express-validator');

const documentTypes = ['IDENTITY_PROOF', 'BUSINESS_REGISTRATION', 'TAX_DOCUMENT', 'ADDRESS_PROOF', 'BANK_VERIFICATION', 'AUTHORIZATION'];
const staffRoles = ['MANAGER', 'BOOKING_MANAGER', 'VENUE_MANAGER', 'FINANCE_VIEWER'];
const staffStatuses = ['ACTIVE', 'INACTIVE'];

const validateDocumentSubmission = [
  body('documentType').isIn(documentTypes),
  body('documentNumber').optional({ values: 'falsy' }).trim().isLength({ max: 40 }),
  body('expiryDate').optional({ values: 'falsy' }).isISO8601().toDate()
];
const validateDocumentId = [param('id').isMongoId()];
const validateDocumentList = [query('status').optional().isIn(['PENDING_REVIEW', 'APPROVED', 'REJECTED', 'ALL']), query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1, max: 100 })];
const validateDocumentReview = [
  ...validateDocumentId,
  body('status').isIn(['APPROVED', 'REJECTED']),
  body('rejectionReason').if((value, { req }) => req.body.status === 'REJECTED').trim().notEmpty().isLength({ max: 1000 })
];
const validateStaffId = [param('id').isMongoId()];
const validateStaffCreate = [
  body('name').trim().notEmpty().isLength({ max: 120 }),
  body('email').trim().isEmail().normalizeEmail(),
  body('role').isIn(staffRoles)
];
const validateStaffUpdate = [
  ...validateStaffId,
  body('name').optional().trim().notEmpty().isLength({ max: 120 }),
  body('email').optional().trim().isEmail().normalizeEmail(),
  body('role').optional().isIn(staffRoles),
  body('status').optional().isIn(staffStatuses)
];

module.exports = {
  validateDocumentSubmission, validateDocumentId, validateDocumentReview, validateDocumentList,
  validateStaffId, validateStaffCreate, validateStaffUpdate
};
