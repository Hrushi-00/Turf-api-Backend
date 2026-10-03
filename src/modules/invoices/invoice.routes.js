const express = require('express');
const router = express.Router();
const { protectAny } = require('../../middleware/anyAuthMiddleware');
const controller = require('./invoice.controller');

router.get('/me', protectAny, (req, res, next) => {
  if (req.user?.role === 'user' || req.user?.role === 'BusinessUser') return next();
  return res.status(403).json({ success: false, message: 'Invoices are available to customers and business owners only' });
}, controller.listMine);

module.exports = router;
