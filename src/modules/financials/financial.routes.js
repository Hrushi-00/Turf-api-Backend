const express = require('express');
const router = express.Router();
const controller = require('./financial.controller');
const { protect } = require('../../middleware/authMiddleware');
const { isAdmin, isBusinessUser } = require('../../middleware/adminMiddleware');
const { validate } = require('../../middleware/validate');
const { body, param, query } = require('express-validator');
const { auditResponse } = require('../../middleware/audit-response.middleware');

router.get('/business/statement', protect, isBusinessUser, [query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1, max: 100 })], validate, controller.statement);
router.get('/business/settlements', protect, isBusinessUser, [query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1, max: 100 })], validate, controller.businessSettlements);
router.get('/business/payouts', protect, isBusinessUser, [query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1, max: 100 })], validate, controller.businessSettlements);
router.get('/admin/rules', protect, isAdmin, controller.rules);
router.patch('/admin/rules', protect, isAdmin, [body('bookingCommissionBps').isInt({ min: 0, max: 10000 })], validate, auditResponse('FINANCIAL_RULE_UPDATED', 'FinancialRule', () => 'platform'), controller.updateRules);
router.get('/admin/ledger', protect, isAdmin, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('businessId').optional().isMongoId(),
  query('entryType').optional().isIn(['BOOKING_CAPTURE', 'BOOKING_REFUND', 'PAYOUT', 'ADJUSTMENT'])
], validate, controller.ledger);
router.get('/admin/payouts', protect, isAdmin, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('businessId').optional().isMongoId()
], validate, controller.payouts);
router.get('/admin/settlements', protect, isAdmin, [
  query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1, max: 100 }),
  query('businessId').optional().isMongoId(), query('status').optional().isIn(['PENDING', 'PROCESSING', 'PROCESSED', 'FAILED', 'HELD'])
], validate, controller.settlements);
router.post('/admin/settlements/:businessId', protect, isAdmin, [param('businessId').isMongoId()], validate, auditResponse('SETTLEMENT_CREATED', 'Settlement', (req) => req.params.businessId), controller.createSettlement);
router.patch('/admin/settlements/:id', protect, isAdmin, [
  param('id').isMongoId(),
  body('status').isIn(['PROCESSING', 'PROCESSED', 'FAILED', 'HELD']),
  body('externalReference').optional().isString().isLength({ max: 160 }),
  body('failureReason').optional().isString().isLength({ max: 1000 })
], validate, auditResponse('SETTLEMENT_UPDATED', 'Settlement'), controller.transitionSettlement);

module.exports = router;
