const express = require('express');
const router = express.Router();
const controller = require('./payment.controller');
const { protectUser } = require('../../middleware/userAuthMiddleware');
const { protect, isAdmin } = require('../../middleware/adminMiddleware');
const { validate } = require('../../middleware/validate');
const { validateCreateOrder, validateVerify, validateRefund, validateRefundList } = require('./payment.validation');
const { auditResponse } = require('../../middleware/audit-response.middleware');

router.post('/webhooks/razorpay', controller.webhook);
router.post('/orders', protectUser, validateCreateOrder, validate, controller.createOrder);
router.post('/verify', protectUser, validateVerify, validate, controller.verifyCheckout);
router.get('/admin/refunds-required', protect, isAdmin, validateRefundList, validate, controller.listRefundRequired);
router.post('/admin/:id/refund', protect, isAdmin, validateRefund, validate, auditResponse('PAYMENT_REFUND_REQUESTED', 'Payment'), controller.refund);
module.exports = router;
