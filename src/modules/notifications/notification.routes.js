const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const { protectAny } = require('../../middleware/anyAuthMiddleware');
const { validate } = require('../../middleware/validate');
const controller = require('./notification.controller');

router.use(protectAny);
router.get('/', [query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1, max: 100 })], validate, controller.mine);
router.patch('/:id/read', [param('id').isMongoId()], validate, controller.markRead);
router.get('/preferences', controller.preference);
router.patch('/preferences', [
  body('booking').optional().isBoolean(), body('payment').optional().isBoolean(), body('reminder').optional().isBoolean(),
  body('marketing').optional().isBoolean(), body('offers').optional().isBoolean(), body('security').optional().isBoolean(),
  body().custom((value) => ['booking', 'payment', 'reminder', 'marketing', 'offers', 'security'].some((key) => value?.[key] !== undefined))
], validate, controller.updatePreference);
module.exports = router;
