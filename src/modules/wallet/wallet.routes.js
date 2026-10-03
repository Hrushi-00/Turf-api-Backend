const express = require('express');
const router = express.Router();
const { body, header, param, query } = require('express-validator');
const { protectUser } = require('../../middleware/userAuthMiddleware');
const { protect } = require('../../middleware/authMiddleware');
const { isAdmin } = require('../../middleware/adminMiddleware');
const { validate } = require('../../middleware/validate');
const { auditResponse } = require('../../middleware/audit-response.middleware');
const controller = require('./wallet.controller');

router.get('/me', protectUser, [query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1, max: 100 })], validate, controller.mine);
router.post('/admin/users/:userId/adjust', protect, isAdmin, [
  param('userId').isMongoId(), header('Idempotency-Key').trim().isLength({ min: 8, max: 128 }),
  body('direction').isIn(['CREDIT', 'DEBIT']), body('amountPaise').toInt().isInt({ min: 1, max: Number.MAX_SAFE_INTEGER }),
  body('reason').trim().notEmpty().isLength({ max: 500 })
], validate, auditResponse('WALLET_ADJUSTED', 'Wallet', (req) => req.params.userId), controller.adjust);
module.exports = router;
