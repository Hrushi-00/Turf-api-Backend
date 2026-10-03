const app = require('./app');
const connectDB = require('./config/db');
const subscriptionService = require('./modules/subscriptions/subscription.service');
const notificationService = require('./modules/notifications/notification.service');
const loyaltyService = require('./modules/loyalty/loyalty.service');

const PORT = process.env.PORT || 5000;
let server;
let shuttingDown = false;

const start = async () => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required');
  await connectDB();
  server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  const subscriptionExpiryTimer = setInterval(() => {
    subscriptionService.expireDueSubscriptions().catch((error) => console.error('Subscription expiry job failed:', error));
  }, 60 * 60 * 1000);
  subscriptionExpiryTimer.unref();
  const notificationOutboxTimer = setInterval(() => {
    notificationService.processOutboxBatch().catch((error) => console.error('Notification outbox job failed:', error));
  }, 2000);
  notificationOutboxTimer.unref();
  const loyaltyAwardTimer = setInterval(() => {
    loyaltyService.awardEligibleBookings().catch((error) => console.error('Loyalty award job failed:', error));
  }, 60 * 1000);
  loyaltyAwardTimer.unref();
};

const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received; shutting down`);
  if (server) await new Promise((resolve) => server.close(resolve));
  const mongoose = require('mongoose');
  await mongoose.disconnect();
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start().catch((error) => {
  console.error(`Startup failed: ${error.message}`);
  process.exit(1);
});
