const https = require('https');
const crypto = require('crypto');

const credentials = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw Object.assign(new Error('Razorpay is not configured'), { statusCode: 503 });
  return { keyId, keySecret };
};

const request = (method, path, data) => new Promise((resolve, reject) => {
  let auth;
  try { auth = Buffer.from(`${credentials().keyId}:${credentials().keySecret}`).toString('base64'); }
  catch (error) { reject(error); return; }
  const body = data ? Buffer.from(JSON.stringify(data)) : undefined;
  const req = https.request({
    hostname: 'api.razorpay.com', path: `/v1${path}`, method,
    headers: {
      Authorization: `Basic ${auth}`,
      ...(body ? { 'Content-Type': 'application/json', 'Content-Length': body.length } : {})
    }, timeout: 15000
  }, (res) => {
    const chunks = [];
    res.on('data', (chunk) => chunks.push(chunk));
    res.on('end', () => {
      let response;
      try { response = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch (_) { reject(Object.assign(new Error('Invalid response from payment provider'), { statusCode: 502 })); return; }
      if (res.statusCode < 200 || res.statusCode >= 300) {
        reject(Object.assign(new Error(response.error?.description || 'Payment provider request failed'), { statusCode: 502 }));
        return;
      }
      resolve(response);
    });
  });
  req.on('timeout', () => req.destroy(Object.assign(new Error('Payment provider timed out'), { statusCode: 504 })));
  req.on('error', reject);
  if (body) req.write(body);
  req.end();
});

const safeEqualHex = (expected, actual) => {
  if (typeof actual !== 'string' || !/^[a-f0-9]+$/i.test(actual) || expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(actual, 'hex'));
};

const createOrder = async ({ amountPaise, currency, receipt, notes }) => {
  const result = await request('POST', '/orders', { amount: amountPaise, currency, receipt, notes });
  return { id: result.id, amount: result.amount, currency: result.currency };
};

const verifyCheckoutSignature = (orderId, paymentId, signature) => {
  const { keySecret } = credentials();
  const expected = crypto.createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex');
  return safeEqualHex(expected, signature);
};

const fetchPayment = async (paymentId) => request('GET', `/payments/${encodeURIComponent(paymentId)}`);

const refundPayment = async ({ paymentId, amountPaise, receipt, notes }) => request(
  'POST',
  `/payments/${encodeURIComponent(paymentId)}/refund`,
  { amount: amountPaise, receipt, notes }
);

const verifyWebhookSignature = (rawBody, signature) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) throw Object.assign(new Error('Razorpay webhook is not configured'), { statusCode: 503 });
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return safeEqualHex(expected, signature);
};

module.exports = { createOrder, verifyCheckoutSignature, fetchPayment, refundPayment, verifyWebhookSignature };
