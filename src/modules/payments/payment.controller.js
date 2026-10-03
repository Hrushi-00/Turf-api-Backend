const service = require('./payment.service');

const createOrder = async (req, res) => {
  try {
    const key = req.get('Idempotency-Key');
    if (!key || key.length > 120) return res.status(400).json({ success: false, message: 'A valid Idempotency-Key header is required' });
    res.status(201).json(await service.createOrder(req.user._id, req.body.bookingId, key));
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

const verifyCheckout = async (req, res) => {
  try { res.json(await service.verifyCheckout(req.user._id, req.body)); }
  catch (error) { res.status(error.statusCode || 500).json({ success: false, message: error.message }); }
};

const webhook = async (req, res) => {
  try {
    const result = await service.handleWebhook(
      req.rawBody,
      req.get('x-razorpay-signature'),
      req.get('x-razorpay-event-id')
    );
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

const refund = async (req, res) => {
  try {
    const key = req.get('Idempotency-Key');
    if (!key || key.length > 120) return res.status(400).json({ success: false, message: 'A valid Idempotency-Key header is required' });
    res.status(202).json(await service.issueFullRefund(req.params.id, req.user._id, key));
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

const listRefundRequired = async (req, res) => {
  try { res.json(await service.listRefundRequired(req.query)); }
  catch (error) { res.status(error.statusCode || 500).json({ success: false, message: error.message }); }
};

module.exports = { createOrder, verifyCheckout, webhook, refund, listRefundRequired };
