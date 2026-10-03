const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const { protectAny } = require('../../middleware/anyAuthMiddleware');
const { protect } = require('../../middleware/authMiddleware');
const { isAdmin } = require('../../middleware/adminMiddleware');
const { validate } = require('../../middleware/validate');
const { auditResponse } = require('../../middleware/audit-response.middleware');
const controller = require('./support.controller');
const ticketId = param('id').isMongoId();
const message = body('message').trim().notEmpty().isLength({ max: 5000 });
const customerOrBusiness = (req, res, next) => {
  if (req.user?.role === 'user' || req.user?.role === 'BusinessUser') return next();
  return res.status(403).json({ success: false, message: 'This support route is for customers and business owners' });
};

router.get('/admin', protect, isAdmin, [query('status').optional().isIn(['OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER', 'WAITING_FOR_BUSINESS', 'RESOLVED', 'CLOSED']), query('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT']), query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1, max: 100 })], validate, controller.adminList);
router.get('/admin/:id', protect, isAdmin, [ticketId], validate, controller.adminGet);
router.post('/admin/:id/replies', protect, isAdmin, [ticketId, message], validate, controller.adminReply);
router.patch('/admin/:id', protect, isAdmin, [ticketId, body('status').optional().isIn(['IN_PROGRESS', 'WAITING_FOR_USER', 'WAITING_FOR_BUSINESS', 'RESOLVED', 'CLOSED']), body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT']), body().custom((value) => value?.status !== undefined || value?.priority !== undefined)], validate, auditResponse('SUPPORT_TICKET_UPDATED', 'SupportTicket'), controller.adminUpdate);
router.get('/', protectAny, customerOrBusiness, controller.mine);
router.post('/', protectAny, customerOrBusiness, [body('category').isIn(['BOOKING', 'PAYMENT', 'REFUND', 'BUSINESS', 'VENUE', 'ACCOUNT', 'TECHNICAL', 'OTHER']), body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT']), body('subject').trim().notEmpty().isLength({ max: 200 }), body('bookingId').optional().isMongoId(), message], validate, controller.create);
router.get('/:id', protectAny, customerOrBusiness, [ticketId], validate, controller.getMine);
router.post('/:id/replies', protectAny, customerOrBusiness, [ticketId, message], validate, controller.reply);
module.exports = router;
