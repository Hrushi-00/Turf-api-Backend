const express = require('express');
const cors = require('cors');
const os = require('os');
require('dotenv').config();
const fileUpload = require('express-fileupload');
const routes = require('./routes');
const mongoose = require('mongoose');

const app = express();

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('Referrer-Policy', 'no-referrer');
  next();
});

app.use(cors({
  // Reflect the requesting origin so browser clients from any domain can call the API.
  // Credentials remain disabled; clients must continue sending auth tokens explicitly.
  origin: true
}));
app.use(express.json({
  limit: process.env.JSON_BODY_LIMIT || '1mb',
  verify(req, res, buffer) { req.rawBody = Buffer.from(buffer); }
}));
app.use(express.urlencoded({ extended: true, limit: process.env.JSON_BODY_LIMIT || '1mb' }));
app.use(fileUpload({
  useTempFiles: true,
  tempFileDir: process.env.UPLOAD_TMP_DIR || os.tmpdir(),
  limits: { fileSize: Number(process.env.MAX_UPLOAD_BYTES) || 5 * 1024 * 1024, files: 10 },
  abortOnLimit: true,
  safeFileNames: true
}));

app.use('/api', routes);
app.get('/health/live', (req, res) => res.status(200).json({ success: true, status: 'alive' }));
app.get('/health/ready', (req, res) => {
  const ready = mongoose.connection.readyState === 1;
  return res.status(ready ? 200 : 503).json({ success: ready, status: ready ? 'ready' : 'not_ready' });
});

app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const status = error.statusCode || (error.type === 'entity.too.large' ? 413 : 500);
  if (status >= 500) console.error(error);
  return res.status(status).json({
    success: false,
    message: status >= 500 ? 'Internal server error' : error.message
  });
});

module.exports = app;
