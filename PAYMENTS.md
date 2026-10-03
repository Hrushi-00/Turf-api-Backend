# Payments setup

The booking API calculates the amount and creates a short slot hold. Razorpay orders are created only for the authenticated booking owner. A booking becomes confirmed after a captured payment is verified by the server or received in a signed webhook.

## Configuration

Copy `.env.example` to `.env` and configure:

```env
PAYMENT_PROVIDER=razorpay
RAZORPAY_KEY_ID=your_key_id
RAZORPAY_KEY_SECRET=your_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
```

Use Razorpay test credentials during development. Configure a webhook to call:

```text
POST /api/payments/webhooks/razorpay
```

Subscribe to `payment.captured`, `payment.failed`, `refund.processed`, and `refund.failed`. The webhook signing secret must match `RAZORPAY_WEBHOOK_SECRET`.

## Checkout flow

1. Create a booking with `POST /api/bookings`, using either `turfId` or `facilityId`.
2. Create a payment order with `POST /api/payments/orders` and body `{ "bookingId": "..." }`. Send a unique `Idempotency-Key` header.
3. Open Razorpay Checkout using the returned `keyId`, `providerOrderId`, `amountPaise`, and `currency`.
4. Send Razorpay's checkout response to `POST /api/payments/verify`:

```json
{
  "orderId": "order_...",
  "paymentId": "pay_...",
  "signature": "..."
}
```

The verify endpoint checks the signature and fetches the payment from Razorpay before confirming the booking. The webhook uses the raw request body and Razorpay signature; event IDs are deduplicated.

## Refunds

Captured payments that cannot be matched to a live booking hold are listed at `GET /api/payments/admin/refunds-required`. An admin can issue a full refund with `POST /api/payments/admin/:paymentId/refund` and a unique `Idempotency-Key`. Refunds remain pending until Razorpay reports `refund.processed`.

## Business subscriptions

An admin creates plans with `POST /api/subscriptions/admin/plans`; list active plans with `GET /api/subscriptions/plans`. Business owners must complete their profile and receive business approval before checkout.

1. Create a checkout with `POST /api/subscriptions/checkout`, sending `{ "planId": "...", "billingCycle": "MONTHLY" }` and a unique `Idempotency-Key`.
2. Open Razorpay Checkout using the returned key, order ID, amount, and currency.
3. Send Razorpay's checkout response to `POST /api/subscriptions/verify`. A verified captured payment activates the subscription and business operations. The same signed payment webhook also handles subscription orders.
4. Read the current state from `GET /api/subscriptions/me`. Set cancellation for the end of the paid period with `POST /api/subscriptions/cancel`.

Admins can review all subscriptions at `GET /api/subscriptions/admin/subscriptions`. Subscription expiry is processed hourly by the API process. The job uses conditional database updates so multiple API instances can process due records safely.

## Booking financial ledger

The append-only booking ledger writes one capture entry after a business-owned booking payment is verified, and a compensating negative entry after a refund is processed. Each entry snapshots the commission rate so later rule changes do not alter past statements.

- Business statement: `GET /api/financials/business/statement`
- Admin ledger: `GET /api/financials/admin/ledger`
- Read commission rule: `GET /api/financials/admin/rules`
- Set commission in basis points (100 bps = 1%): `PATCH /api/financials/admin/rules` with `{ "bookingCommissionBps": 500 }`

The initial commission defaults to zero until configured. Statement totals are signed ledger totals in paise; available balance excludes open settlement reservations. Booking refunds are full refunds today. Automated bank payout execution, partial refunds, payment reconciliation, and subscription refunds remain future work.

Admins can create one open settlement per business with `POST /api/financials/admin/settlements/:businessId`. This reserves the currently unallocated ledger entries. Review them at `GET /api/financials/admin/settlements`, then transition the batch with `PATCH /api/financials/admin/settlements/:id` and status `PROCESSING`, `HELD`, `FAILED`, or `PROCESSED`. A processed status requires an `externalReference`; failures and holds require a reason. Processing remains a manual bank transfer; no bank payout integration is configured. Failed batches release their entries for a later batch. If a refund changes an open batch, the backend automatically holds it; fail that batch and create a fresh one after review.

Businesses can view their statement balances and payout history at `GET /api/financials/business/statement` and `GET /api/financials/business/payouts`.

The payment adapter supports Razorpay and INR only.
