const { body, param, query } = require('express-validator');
const validateCreateOrder = [
  body('bookingId').isMongoId()
];
const validateVerify = [
  body('orderId').trim().notEmpty().isLength({ max: 100 }),
  body('paymentId').trim().notEmpty().isLength({ max: 100 }),
  body('signature').trim().matches(/^[a-f0-9]{64}$/i)
];
const validateRefund = [param('id').isMongoId()];
const validateRefundList = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
];
module.exports = { validateCreateOrder, validateVerify, validateRefund, validateRefundList };
