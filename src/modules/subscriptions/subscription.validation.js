const { body, param } = require('express-validator');

const validatePlan = [
  body('name').trim().notEmpty().isLength({ max: 100 }),
  body('slug').trim().matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).isLength({ max: 100 }),
  body('description').optional().isString().isLength({ max: 1000 }),
  body('monthlyPricePaise').isInt({ min: 100 }),
  body('quarterlyPricePaise').isInt({ min: 100 }),
  body('yearlyPricePaise').isInt({ min: 100 }),
  body('trialDays').optional().isInt({ min: 0, max: 90 }),
  body('status').optional().isIn(['ACTIVE', 'INACTIVE'])
];
const validatePlanId = [param('id').isMongoId()];
const validatePlanUpdate = [
  body('name').optional().trim().notEmpty().isLength({ max: 100 }),
  body('slug').optional().trim().matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).isLength({ max: 100 }),
  body('description').optional().isString().isLength({ max: 1000 }),
  body('monthlyPricePaise').optional().isInt({ min: 100 }),
  body('quarterlyPricePaise').optional().isInt({ min: 100 }),
  body('yearlyPricePaise').optional().isInt({ min: 100 }),
  body('trialDays').optional().isInt({ min: 0, max: 90 }),
  body('status').optional().isIn(['ACTIVE', 'INACTIVE'])
];
const validateCheckout = [body('planId').isMongoId(), body('billingCycle').isIn(['MONTHLY', 'QUARTERLY', 'YEARLY'])];
const validateVerify = [
  body('orderId').trim().notEmpty().isLength({ max: 100 }),
  body('paymentId').trim().notEmpty().isLength({ max: 100 }),
  body('signature').trim().matches(/^[a-f0-9]{64}$/i)
];
module.exports = { validatePlan, validatePlanUpdate, validatePlanId, validateCheckout, validateVerify };
