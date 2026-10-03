# Sports Venue Booking Platform
## Production Architecture & Technical Specification
### Senior Developer / Production-Grade Reference

**Document status:** Production Architecture Baseline  
**Target:** User + Business + Admin multi-tenant sports venue marketplace  
**Backend:** Node.js + Express.js  
**Database:** MongoDB  
**Frontend:** Next.js App Router  
**Cache / Locks:** Redis  
**Storage:** Object Storage / CDN  
**Payments:** Payment Gateway + Webhooks  
**Async Processing:** Background Workers / Queue  

---

# 1. Executive Summary

This platform is a multi-tenant sports venue marketplace and business management system.

The platform allows:

- Customers to discover sports venues.
- Customers to check real-time availability.
- Customers to reserve slots.
- Customers to pay online.
- Customers to cancel/reschedule according to policy.
- Customers to receive invoices, notifications and refunds.
- Businesses to register and submit their facilities.
- Businesses to manage locations, venues, facilities, sports, schedules, pricing and bookings.
- Businesses to pay a platform subscription / business fee.
- Businesses to receive booking settlements/payouts.
- Administrators to verify businesses, approve venues, control subscription plans, manage financial rules, moderate content, resolve disputes and operate the platform.

The production architecture must treat these as separate domains:

```text
Identity
Business
Location
Venue
Facility
Sport
Availability
Pricing
Booking
Slot Hold
Payment
Subscription
Commission
Settlement
Refund
Notification
Review
Support
Analytics
Audit
Security
```

The existing project currently uses a Turf-centric model and registered routes such as `/api/turfs`, `/api/business`, `/api/admin`, `/api/bookings`, etc. The current source explicitly documents the registered router tree and identifies several production gaps. The target architecture below preserves the current system terminology while defining the migration path toward a generic `Business -> Location -> Venue -> Facility -> Sport -> Booking` domain. fileciteturn0file0L3-L31

---

# 2. Product Roles

## 2.1 Customer / User

Can:

- register/login
- manage profile
- search venues
- filter by sport/location/price/availability
- view venue details
- check availability
- hold a slot
- create booking
- pay
- receive invoice
- cancel/reschedule
- request refund
- check in using QR
- review venue/facility
- save favorites
- use wallet/credits
- manage notifications
- raise support tickets
- view booking history

---

## 2.2 Business Owner

Can:

- register business
- complete business profile
- submit verification documents
- manage business locations
- create venues
- create bookable facilities
- configure sports
- configure schedules
- configure pricing
- configure cancellation rules
- manage staff
- manage bookings
- manage customers
- create offers/coupons
- view revenue
- view analytics
- view subscription
- renew subscription
- view invoices
- view payouts/settlements
- respond to reviews
- raise support tickets

Business cannot:

- approve itself
- change Admin-controlled approval fields
- change platform commission
- modify platform subscription rules
- access another business's resources
- change financial ledger records

---

## 2.3 Platform Admin

Can:

- manage users
- manage businesses
- verify documents
- approve/reject businesses
- approve/reject venues
- control subscription plans
- control platform fees
- control commission
- manage payouts
- manage refunds/disputes
- manage bookings
- manage coupons
- moderate reviews
- manage CMS
- manage notifications
- view analytics
- suspend/reactivate resources
- configure platform settings
- view audit logs
- manage admin roles

---

# 3. High-Level Production Architecture

```text
                         INTERNET
                            |
                    CDN / WAF / HTTPS
                            |
                    Load Balancer / Proxy
                            |
              +-------------+-------------+
              |                           |
          Next.js                    Node/Express API
          Frontend                         |
                                            |
       +----------------+-------------------+------------------+
       |                |                   |                  |
       v                v                   v                  v
    MongoDB           Redis            Object Storage      Queue/Worker
       |                |                   |                  |
       |                |                   |                  |
       +----------------+-------------------+------------------+
                                |
                    +-----------+-----------+
                    |                       |
              Payment Gateway        Notification Providers
                    |                  Email/SMS/Push
                    |
                 Webhooks
```

---

# 4. Target Domain Architecture

```text
Business
   |
   +---- Location
           |
           +---- Venue
                   |
                   +---- Facility
                           |
                           +---- Sport
                           |
                           +---- Availability
                           |
                           +---- Pricing
                           |
                           +---- Maintenance
                           |
                           +---- Bookings
```

Financial domain:

```text
Customer
   |
   v
Booking Payment
   |
   v
Payment Ledger
   |
   +---- Tax
   +---- Platform Commission
   +---- Discount
   +---- Business Payable
                |
                v
            Settlement
                |
                v
          Business Payout
```

Business subscription is separate:

```text
Business
   |
   v
Subscription Plan
   |
   v
Subscription Payment
   |
   v
Subscription Ledger
   |
   v
Business Active / Grace / Expired
```

---

# 5. Business Activation Model

## Critical Rule

```text
Business Verification
        +
Admin Approval
        +
Valid Subscription
        +
Operational Status ACTIVE
        =
Business Active
```

Do not use one generic `status` field for all lifecycle concerns.

Recommended:

```text
approvalStatus:
PENDING
APPROVED
REJECTED
REQUIRES_ACTION

subscriptionStatus:
NOT_STARTED
PENDING_PAYMENT
ACTIVE
GRACE_PERIOD
EXPIRED
CANCELLED
SUSPENDED

operationalStatus:
ACTIVE
PAUSED
SUSPENDED
CLOSED
```

Public/bookable state is derived from these conditions.

---

# 6. Business Onboarding Flow

```text
Business Signup
      |
      v
Email/Mobile Verification
      |
      v
Business Profile
      |
      v
KYC / Documents
      |
      v
Create Location
      |
      v
Create Venue
      |
      v
Create Facilities
      |
      v
Select Sports
      |
      v
Configure Availability
      |
      v
Configure Pricing
      |
      v
Submit for Admin Review
      |
      +---- Rejected ---> Fix ---> Resubmit
      |
      v
Approved
      |
      v
Select Subscription
      |
      v
Payment
      |
      +---- Failed ---> Retry
      |
      v
Subscription Active
      |
      v
Business Live
```

---

# 7. Business Profile Module

Fields:

```text
businessId
legalName
displayName
description
businessType
ownerId
contactEmail
contactPhone
website
registrationNumber
tax/GST details
address
city
state
country
postalCode
timezone
status
createdAt
updatedAt
```

Rules:

- Owner must be authenticated.
- Email/mobile verification should be supported.
- Sensitive documents should not be stored as plain public URLs.
- Business ownership must be enforced server-side.
- Changes to critical legal fields should be auditable.

---

# 8. Business Verification / KYC

Document types may include:

- identity proof
- business registration
- tax/GST document
- address proof
- bank verification
- authorization document

Lifecycle:

```text
NOT_SUBMITTED
     |
     v
PENDING_REVIEW
     |
 +---+---+
 |       |
 v       v
APPROVED REJECTED
            |
            v
      RESUBMISSION
```

Store:

```text
BusinessDocument
- businessId
- documentType
- storageKey
- documentNumberMasked
- status
- submittedAt
- reviewedAt
- reviewedBy
- rejectionReason
- expiryDate
```

Never expose private document storage keys to customers.

---

# 9. Location Module

A business can have multiple locations.

```text
Business
|
+-- Pune
|   +-- Venue A
|   +-- Venue B
|
+-- Mumbai
    +-- Venue C
```

Location fields:

```text
name
address
landmark
city
state
country
postalCode
latitude
longitude
timezone
mapUrl
status
```

Use coordinates for nearby search.

---

# 10. Venue Module

A Venue is a customer-facing sports destination.

Examples:

- Sports Arena
- City Sports Club
- Indoor Sports Center

Fields:

```text
venueId
businessId
locationId
name
description
media
amenities
contactInfo
approvalStatus
operationalStatus
publishedAt
createdAt
updatedAt
```

Separate:

```text
approvalStatus
```

from:

```text
operationalStatus
```

A venue can be approved but temporarily closed.

---

# 11. Facility / Bookable Resource

This is the actual resource that can be booked.

Examples:

```text
Football Ground A
Football Ground B
Cricket Pitch 1
Badminton Court 1
Badminton Court 2
Tennis Court 1
```

Fields:

```text
facilityId
venueId
sportIds
name
description
capacity
facilityType
surfaceType
dimensions
media
amenities
status
```

A facility should have independent:

- availability
- pricing
- maintenance
- booking rules

---

# 12. Sports Master

Do not hard-code sports everywhere.

```text
Sport
- cricket
- football
- badminton
- tennis
- basketball
- volleyball
- swimming
- other
```

Admin controls:

- create sport
- activate/deactivate
- icon
- display name
- slug
- metadata

---

# 13. Media Module

Use object storage/CDN.

Do not store large image binaries in MongoDB.

```text
Upload
   |
   v
Object Storage
   |
   v
CDN URL
   |
   v
Media Record
```

Validate:

- MIME type
- file size
- dimensions
- file extension
- upload authorization

Generate thumbnails where required.

---

# 14. Amenities

Examples:

```text
Parking
Washroom
Changing Room
Drinking Water
Flood Lights
Cafeteria
Equipment Rental
AC
Wi-Fi
First Aid
```

Amenities should be master data where practical.

---

# 15. Availability Engine

Availability must not be represented only by opening/closing time.

Final availability:

```text
Weekly Schedule
      +
Holiday / Exception
      +
Maintenance Blocks
      +
Existing Bookings
      +
Temporary Holds
      +
Business Operational Status
      =
Available Slots
```

---

# 16. Scheduling

Support:

- weekly recurring schedule
- holidays
- custom unavailable dates
- maintenance windows
- facility closure
- special event blocks

Example:

```text
Monday
06:00 - 23:00

Tuesday
06:00 - 23:00

Wednesday
06:00 - 23:00

Maintenance
Wednesday
14:00 - 16:00
```

---

# 17. Timezone Rule

Store timestamps consistently.

Recommended:

```text
Database:
UTC timestamps

Business:
IANA timezone
Asia/Kolkata

UI:
Business/user local representation
```

Never compare dates using raw string equality.

Booking date should be interpreted in the facility/business timezone.

The existing project currently has an exact-date matching risk because booking dates are normalized while frontend ISO dates can be interpreted as UTC midnight. This must be fixed before production. fileciteturn0file0L117-L138

---

# 18. Pricing Engine

Pricing must be calculated by backend.

Possible rules:

```text
Base Price
+ Peak Price
+ Weekend Price
+ Holiday Price
+ Seasonal Price
+ Add-ons
- Coupon
- Membership Discount
+ Tax
=
Final Amount
```

Never trust:

```text
finalAmount
```

from frontend.

The backend must calculate the authoritative amount.

---

# 19. Pricing Rules

Support:

- weekday
- weekend
- peak hour
- off-peak
- holiday
- seasonal
- special event
- facility-specific pricing
- minimum duration
- maximum duration

Example:

```text
06:00-10:00   ₹500
10:00-17:00   ₹400
17:00-22:00   ₹900
Weekend       ₹1000
```

---

# 20. Subscription / Business Fee Module

Business activation requires an active subscription/fee arrangement where configured by the platform.

Admin controls:

- plans
- price
- billing cycle
- trial
- grace period
- feature limits
- active/inactive state

Example:

```text
Basic       ₹999/month
Pro         ₹2499/month
Premium     ₹4999/month
```

---

# 21. Subscription Plan

```text
SubscriptionPlan

_id
name
description
currency

monthlyPrice
quarterlyPrice
yearlyPrice

trialDays
gracePeriodDays

limits
features

status
createdBy
createdAt
updatedAt
```

Feature limits may include:

```text
maxLocations
maxVenues
maxFacilities
maxStaff
analyticsLevel
featuredListing
promotionalTools
```

---

# 22. Business Subscription

```text
BusinessSubscription

_id
businessId
planId

status
billingCycle

startDate
currentPeriodStart
currentPeriodEnd

amount
currency

trialStart
trialEnd
gracePeriodStart
gracePeriodEnd

autoRenew

latestPaymentId

cancelledAt
cancelReason

createdAt
updatedAt
```

---

# 23. Subscription Lifecycle

```text
PENDING_PAYMENT
      |
      v
ACTIVE
      |
      v
RENEWAL_PENDING
      |
      +---- Success ---> ACTIVE
      |
      v
GRACE_PERIOD
      |
      +---- Payment ---> ACTIVE
      |
      v
EXPIRED
      |
      v
RESTRICTED
```

Recommended:

### ACTIVE
- public listing
- new bookings allowed

### GRACE_PERIOD
- renewal warnings
- policy-configurable booking access

### EXPIRED
- new bookings normally blocked
- existing confirmed bookings preserved

### SUSPENDED
- immediate Admin restriction

---

# 24. Subscription Payment Flow

```text
Business
   |
Select Plan
   |
Backend creates order
   |
Payment Gateway
   |
Customer pays
   |
Gateway response
   |
Backend verification
   |
Webhook
   |
Signature verification
   |
Payment Ledger
   |
Subscription ACTIVE
   |
Invoice
   |
Notification
```

Never activate a subscription solely from frontend payment response.

---

# 25. Platform Commission

The platform may use:

### Subscription only

```text
Business -> Subscription Fee -> Platform
```

### Commission only

```text
Customer -> Booking Payment
             |
             +-> Platform Commission
             +-> Business Amount
```

### Hybrid

```text
Subscription
+
Booking Commission
```

All rules should be configurable.

---

# 26. Financial Ledger

Separate financial domains.

```text
Subscription Ledger
Booking Payment Ledger
Refund Ledger
Commission Ledger
Settlement Ledger
Payout Ledger
Wallet Ledger
```

Do not overwrite historical financial records.

Use immutable transaction records and compensating transactions for corrections.

---

# 27. Business Settlement / Payout

```text
Customer Payment
      |
      v
Gross Booking Amount
      |
      +-- Discount
      +-- Tax
      +-- Platform Commission
      |
      v
Business Payable
      |
      v
Settlement Batch
      |
      v
Business Payout
```

Business dashboard:

- pending payout
- processed payout
- failed payout
- settlement statement
- payout history

---

# 28. Invoice Module

Customer invoice:

```text
Booking
Payment
Tax
Discount
Final Amount
```

Business statement:

```text
Gross Revenue
- Commission
- Refunds
- Adjustments
= Net Settlement
```

Invoices/statements should be reproducible and tied to immutable transaction data.

---

# 29. Wallet

Optional but recommended.

```text
Wallet
|
+-- Cashback
+-- Refund Credit
+-- Promotional Credit
+-- Adjustments
```

Every wallet movement must create a ledger entry.

Never simply update:

```text
balance += amount
```

without a transaction record.

---

# 30. Booking Domain

Booking should be its own domain.

Recommended states:

```text
INITIATED
HOLD
PAYMENT_PENDING
CONFIRMED
CHECKED_IN
COMPLETED
CANCELLED
REFUNDED
RESCHEDULED
NO_SHOW
PAYMENT_FAILED
```

---

# 31. Production Booking Flow

```text
Search
  |
Select Sport
  |
Select Venue
  |
Select Facility
  |
Select Date
  |
Get Availability
  |
Select Slot
  |
Create Slot Hold
  |
Calculate Price
  |
Create Payment Order
  |
Payment
  |
Webhook / Verification
  |
Confirm Booking
  |
Invoice
  |
Notification
```

---

# 32. Slot Hold / Concurrency

This is a production-critical feature.

```text
User A                 User B
   |                      |
Select 7 PM              Select 7 PM
   |                      |
   +-----> HOLD <---------+
             |
       Atomic lock
             |
      User A owns slot
             |
       Payment window
             |
      +------+------+
      |             |
   Success       Timeout
      |             |
 CONFIRMED       RELEASE
```

Use:

- MongoDB transaction
- atomic conditional operations
- unique indexes where possible
- Redis distributed lock if multiple API instances require it
- expiration timestamps
- background cleanup

Never rely only on frontend disabling a button.

---

# 33. Idempotency

For financial/booking operations support:

```text
Idempotency-Key
```

Examples:

```text
POST /bookings
POST /payments/order
POST /subscriptions/checkout
POST /refunds
```

If the same request is retried, it must not create duplicate financial records.

---

# 34. Booking Data Model

Recommended:

```text
Booking

_id
bookingNumber

userId
businessId
locationId
venueId
facilityId
sportId

bookingDate
startAt
endAt
timezone

status

pricingSnapshot
policySnapshot

subtotal
discount
tax
platformFee
totalAmount
currency

paymentStatus
paymentId

couponId
membershipId

checkInStatus
checkedInAt
completedAt

cancelledAt
cancelledBy
cancellationReason

createdAt
updatedAt
```

Do not depend on current pricing/policy after booking.

Store snapshots.

---

# 35. Payment Module

Payment states:

```text
CREATED
PENDING
AUTHORIZED
PAID
FAILED
CANCELLED
REFUND_PENDING
PARTIALLY_REFUNDED
REFUNDED
```

Store:

```text
provider
orderId
paymentId
amount
currency
status
signatureVerified
metadata
createdAt
updatedAt
```

---

# 36. Refund Module

Refund should be a separate workflow.

```text
Cancellation
   |
Policy Engine
   |
Refund Amount
   |
Refund Request
   |
Payment Gateway
   |
Webhook
   |
Refund Ledger
   |
User Notification
```

Refund must be idempotent.

---

# 37. Cancellation Policy

Business/Admin configurable.

Example:

```text
24+ hours     100%
12-24 hours    50%
<12 hours       0%
```

The exact policy must be stored in the booking snapshot.

---

# 38. Reschedule

```text
Existing Booking
       |
Check policy
       |
Select new slot
       |
Availability check
       |
Price difference
       |
Payment/refund adjustment
       |
Confirm new slot
```

Never release the old booking before the new slot is safely reserved when the business rule requires atomic rescheduling.

---

# 39. QR Check-In

```text
Confirmed Booking
      |
Generate signed QR
      |
User arrives
      |
Business scans
      |
Validate:
- booking
- facility
- date/time
- status
- signature
      |
CHECKED_IN
```

Do not put sensitive personal data directly into QR payload.

---

# 40. Team / Group Booking

```text
Team
 |
 +-- Captain
 +-- Players
 |
 +-- Booking
```

Useful for:

- football
- cricket
- basketball
- volleyball

Future support:

- player invitations
- split payment
- team history
- recurring team bookings

---

# 41. Waitlist

```text
Slot Full
   |
Join Waitlist
   |
Cancellation
   |
Find next eligible user
   |
Temporary Offer
   |
User accepts
   |
Slot Hold
   |
Payment
   |
Booking
```

Use expiration for waitlist offers.

---

# 42. Recurring Booking

Support:

```text
Every Monday
Every Saturday
Every weekday
Monthly
```

Generate occurrences carefully.

Do not create unlimited future bookings without limits.

---

# 43. Equipment / Add-ons

Example:

```text
Ground       ₹800
Football     ₹100
Bib Set      ₹50
Water        ₹20
```

Booking:

```text
Booking
 |
 +-- Facility
 +-- Equipment
 +-- Add-ons
```

Inventory should be tracked if equipment is limited.

---

# 44. Coach / Trainer

Future module:

```text
Coach
- profile
- sports
- certifications
- availability
- pricing
- businessId
```

Customer can book coach + facility.

---

# 45. Tournament

Future module:

```text
Tournament
 |
 +-- Registration
 +-- Teams
 +-- Entry Fee
 +-- Fixtures
 +-- Matches
 +-- Results
 +-- Leaderboard
```

Keep this separate from normal booking.

---

# 46. Reviews and Ratings

Eligibility:

```text
Booking
= COMPLETED
```

Then:

```text
User
 |
Review
 |
Rating
 |
Moderation
```

Prevent:

- multiple reviews for same booking
- reviews for uncompleted bookings
- spam
- abusive content

---

# 47. Favorites

User can save:

- business
- venue
- facility

Use unique constraint:

```text
userId + entityId
```

---

# 48. Search & Discovery

Search filters:

```text
sport
city
location
distance
price
rating
availability
amenities
facilityType
indoorOutdoor
```

Sort:

```text
relevance
distance
price
rating
popularity
newest
```

For scale, MongoDB indexes may be enough initially; dedicated search infrastructure can be introduced when query complexity/traffic requires it.

---

# 49. Recommendation Engine

Future:

```text
User History
+
Location
+
Sport Preference
+
Budget
+
Availability
+
Popularity
=
Recommendations
```

This should not affect core booking correctness.

---

# 50. User Wallet / Membership / Loyalty

Optional growth layer:

```text
Membership
 |
 +-- discounts
 +-- priority booking
 +-- cashback
 +-- exclusive slots
```

Loyalty:

```text
Booking
 |
Earn Points
 |
Redeem
```

Use a ledger, not mutable balance-only logic.

---

# 51. Notifications

Channels:

```text
In-App
Email
SMS
Push
WhatsApp (optional)
```

Events:

```text
BusinessApproved
BusinessRejected
SubscriptionExpiring
SubscriptionExpired
PaymentSuccess
PaymentFailed
BookingCreated
BookingConfirmed
BookingCancelled
RefundProcessed
BookingReminder
VenueClosure
SupportUpdate
```

Notifications should run asynchronously.

---

# 52. Notification Preference Center

User:

```text
Booking
Payment
Reminder
Marketing
Offers
Security
```

Business:

```text
New Booking
Cancellation
Payment
Payout
Subscription
Verification
```

Transactional/security notifications should remain distinct from marketing preferences.

---

# 53. Business Staff & RBAC

Roles:

```text
OWNER
MANAGER
BOOKING_MANAGER
RECEPTIONIST
ACCOUNTANT
```

Permissions:

```text
VENUE_READ
VENUE_WRITE
BOOKING_READ
BOOKING_UPDATE
PAYMENT_READ
PAYOUT_READ
REPORT_READ
STAFF_MANAGE
```

Authorization must check:

```text
role
+
permission
+
tenant/business ownership
+
resource ownership
```

---

# 54. Multi-Tenant Security

Every business-owned resource must have a tenant/business boundary.

Example:

```text
Business A
 |
 +-- Venue A
 +-- Facility A
 +-- Booking A

Business B
 |
 +-- Venue B
 +-- Facility B
 +-- Booking B
```

Business A must never access Business B data.

Never rely only on:

```text
role === BusinessUser
```

Always check:

```text
resource.businessId === authenticatedUser.businessId
```

---

# 55. Admin Role Hierarchy

Recommended:

```text
SUPER_ADMIN
 |
 +-- OPERATIONS_ADMIN
 +-- FINANCE_ADMIN
 +-- VERIFICATION_ADMIN
 +-- SUPPORT_ADMIN
 +-- CONTENT_ADMIN
 +-- MARKETING_ADMIN
```

Permission-based access is preferable to scattered role checks.

---

# 56. Support / Ticket System

Ticket types:

```text
BOOKING
PAYMENT
REFUND
BUSINESS
VENUE
ACCOUNT
TECHNICAL
OTHER
```

Priority:

```text
LOW
MEDIUM
HIGH
URGENT
```

Lifecycle:

```text
OPEN
IN_PROGRESS
WAITING_FOR_USER
WAITING_FOR_BUSINESS
RESOLVED
CLOSED
```

---

# 57. Dispute Management

Separate dispute from normal support.

Example:

```text
Payment deducted
but booking failed
```

Flow:

```text
Dispute
 |
Payment verification
 |
Booking verification
 |
Business response if needed
 |
Admin decision
 |
Refund / adjustment / reject
```

Every decision must be audited.

---

# 58. CMS

Admin-controlled:

```text
Homepage
Banners
FAQ
Terms
Privacy
Cancellation Policy
About
Contact
Promotions
Help content
```

Content changes should be versioned/audited where appropriate.

---

# 59. Coupon System

Support:

```text
WELCOME100
WEEKEND20
SPORT10
```

Rules:

- start/end date
- usage limit
- per-user limit
- minimum order
- maximum discount
- business restriction
- facility restriction
- sport restriction
- membership restriction

Coupon redemption must be atomic to prevent overuse.

---

# 60. Business CRM

Business can see customer history:

```text
Customer
 |
 +-- Total Bookings
 +-- Total Spend
 +-- Last Visit
 +-- Favorite Sport
 +-- Cancellation History
```

Respect privacy and data-minimization requirements.

---

# 61. Business Analytics

Metrics:

```text
Revenue
Bookings
Occupancy
Average Booking Value
Repeat Customers
Cancellation Rate
No-Show Rate
Popular Sports
Popular Facilities
Peak Hours
```

---

# 62. Admin Analytics

Metrics:

```text
Total Users
Active Users
Total Businesses
Active Businesses
Pending Verification
Active Subscriptions
Expired Subscriptions
Subscription Revenue
Booking GMV
Platform Commission
Refunds
Payouts
Top Sports
Top Locations
```

---

# 63. Business Health / Risk

Internal Admin indicator:

```text
Verification Status
Subscription Status
Cancellation Rate
Complaint Count
Rating
Payment Issues
Operational Issues
```

This is an internal operational signal, not a public ranking.

---

# 64. Emergency Closure

If a venue becomes unavailable:

```text
Emergency Closure
       |
Block future slots
       |
Find affected bookings
       |
Notify users
       |
Offer:
  - Reschedule
  - Refund
  - Credit
```

Do not silently cancel bookings.

---

# 65. Audit Log

Audit all sensitive actions:

```text
Admin approved business
Admin rejected business
Admin changed subscription price
Admin suspended business
Admin extended subscription
Admin refunded booking
Business changed pricing
Business changed cancellation policy
Staff changed booking
```

Record:

```text
actorId
actorRole
action
entityType
entityId
oldValue
newValue
reason
requestId
ipAddress
userAgent
createdAt
```

Do not store unnecessary secrets or sensitive raw data.

---

# 66. Security Architecture

Required:

- HTTPS
- secure cookies where applicable
- short-lived access tokens
- refresh token rotation
- password hashing
- MFA for admins
- rate limiting
- brute-force protection
- input validation
- authorization middleware
- tenant isolation
- ownership checks
- webhook signature verification
- idempotency
- security headers
- CORS allowlist
- secrets management
- encrypted sensitive data where required
- secure file upload
- dependency scanning

Never expose:

```text
JWT secrets
DB credentials
payment secrets
private storage credentials
```

to frontend.

---

# 67. Authentication Architecture

Current project uses separate `User` and `Auth` collections/middleware for user vs admin/business authentication. The target architecture should keep role/tenant identity explicit and avoid token confusion. The current source confirms that user tokens and admin/business tokens are resolved against different collections. fileciteturn0file0L94-L107

Recommended production identity:

```text
Identity
 |
 +-- User
 +-- Business Staff
 +-- Admin
```

Token/session should contain only necessary identity claims.

Example:

```json
{
  "sub": "userId",
  "role": "BUSINESS_OWNER",
  "businessId": "businessId",
  "sessionId": "sessionId"
}
```

Do not put sensitive profile data in JWT.

---

# 68. API Architecture

Use:

```text
/api/v1
```

Suggested:

```text
/api/v1/auth
/api/v1/users
/api/v1/businesses
/api/v1/locations
/api/v1/venues
/api/v1/facilities
/api/v1/sports
/api/v1/availability
/api/v1/pricing
/api/v1/bookings
/api/v1/slot-holds
/api/v1/payments
/api/v1/refunds
/api/v1/subscriptions
/api/v1/payouts
/api/v1/reviews
/api/v1/coupons
/api/v1/notifications
/api/v1/support
/api/v1/admin
```

The current backend uses `/api` and routes including `/api/turfs`, `/api/admin`, `/api/business`, `/api/user/bookings`, and `/api/bookings`; migration to `/api/v1` should be planned rather than done as a breaking change without versioning. fileciteturn0file0L3-L31

---

# 69. API Response Standard

Success:

```json
{
  "success": true,
  "data": {},
  "message": "Success",
  "requestId": "req_xxx"
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "BOOKING_SLOT_UNAVAILABLE",
    "message": "Selected slot is no longer available"
  },
  "requestId": "req_xxx"
}
```

Do not expose internal stack traces in production.

---

# 70. Error Code Strategy

Examples:

```text
AUTH_INVALID_CREDENTIALS
AUTH_UNAUTHORIZED
AUTH_FORBIDDEN

BUSINESS_NOT_FOUND
BUSINESS_NOT_APPROVED
BUSINESS_SUBSCRIPTION_EXPIRED

VENUE_NOT_FOUND
FACILITY_NOT_FOUND

SLOT_UNAVAILABLE
SLOT_HOLD_EXPIRED
BOOKING_NOT_FOUND
BOOKING_ALREADY_CANCELLED

PAYMENT_FAILED
PAYMENT_VERIFICATION_FAILED
PAYMENT_ALREADY_PROCESSED

REFUND_NOT_ALLOWED
REFUND_FAILED

TENANT_ACCESS_DENIED
IDEMPOTENCY_CONFLICT
VALIDATION_ERROR
RATE_LIMITED
```

---

# 71. Validation

Validate at:

```text
Request
 ↓
Schema Validation
 ↓
Authorization
 ↓
Business Rules
 ↓
Database
```

Never depend only on frontend validation.

Use strict schemas for:

- body
- query
- params
- files

---

# 72. Database Collections

Core:

```text
users
businesses
businessStaff
businessDocuments

locations
venues
facilities
sports
amenities
media

availabilityRules
availabilityExceptions
maintenanceBlocks
slotHolds

pricingRules
bookings
bookingItems
bookingPolicies

payments
paymentLedger
refunds

subscriptionPlans
businessSubscriptions
subscriptionPayments
invoices

commissions
settlements
payouts

wallets
walletTransactions

coupons
couponUsages

reviews
favorites

notifications
notificationTemplates
notificationPreferences

supportTickets
disputes

teams
teamMembers
recurringBookings
waitlistEntries

coaches
equipment
equipmentInventory
tournaments

auditLogs
platformSettings
cmsPages
featureFlags
```

---

# 73. Important Database Indexes

Examples:

```text
users:
email unique

businesses:
ownerId
status
city

venues:
businessId
locationId
approvalStatus

facilities:
venueId
sportId
status

bookings:
userId + createdAt
businessId + createdAt
facilityId + bookingDate
facilityId + startAt
status

slotHolds:
facilityId + startAt
expiresAt

subscriptions:
businessId
status
currentPeriodEnd

payments:
providerOrderId unique
providerPaymentId unique

coupons:
code unique
```

Indexes must be validated against real query patterns.

---

# 74. Soft Delete

For important entities prefer:

```text
deletedAt
deletedBy
deleteReason
```

instead of immediate physical deletion.

Financial and audit records should generally remain immutable.

---

# 75. Background Jobs

Workers should handle:

```text
Subscription expiry
Subscription reminders
Slot hold expiry
Booking reminders
Payment reconciliation
Webhook retries
Invoice generation
Refund reconciliation
Payout processing
Notification delivery
Analytics aggregation
Cleanup jobs
```

Example:

```text
API
 |
Create Hold
 |
Return immediately
 |
Worker
 |
Expire Hold after timeout
```

---

# 76. Event-Driven Internal Architecture

Example:

```text
BookingConfirmed
      |
      +--> Notification
      +--> Invoice
      +--> Analytics
      +--> Business Stats
      +--> Loyalty
```

Other events:

```text
BusinessApproved
SubscriptionActivated
SubscriptionExpired
BookingCancelled
PaymentCaptured
RefundCompleted
VenueClosed
ReviewCreated
```

Events should be idempotent.

---

# 77. Outbox Pattern

For critical events:

```text
Business Transaction
      |
MongoDB Transaction
      |
Business Record
+
Outbox Event
      |
Worker
      |
Notification / Analytics / External API
```

This avoids losing events after a successful DB transaction.

---

# 78. Observability

Production must have:

### Logs
- structured JSON
- requestId
- userId
- businessId
- endpoint
- duration
- status

### Metrics
- request latency
- error rate
- booking success rate
- payment failure rate
- slot conflict rate
- webhook failures
- queue backlog
- DB latency

### Tracing
Use distributed tracing when multiple services/workers exist.

---

# 79. Health Checks

Provide:

```text
GET /health
GET /health/live
GET /health/ready
```

Readiness should verify critical dependencies where appropriate.

Example:

```text
API
MongoDB
Redis
Queue
Payment configuration
```

Do not expose secrets in health responses.

---

# 80. Rate Limiting

Different limits:

```text
Login
Signup
OTP
Password reset
Search
Booking
Payment
Coupon
Admin APIs
```

Payment/webhook endpoints need special idempotency and abuse protection.

---

# 81. Caching

Cache suitable read-heavy data:

```text
Sports
Amenities
Public venue details
Featured venues
Platform configuration
```

Do not cache highly volatile availability without a correct invalidation strategy.

Never treat cache as source of truth for booking availability.

---

# 82. File Upload Security

Validate:

```text
MIME
size
extension
image dimensions
virus/malware scanning where appropriate
ownership
```

Use randomized storage keys.

Do not trust original filenames.

---

# 83. Testing Strategy

## Unit Tests

- pricing
- cancellation
- refund
- permissions
- subscription state
- coupon
- availability

## Integration Tests

- auth
- booking
- payment
- subscription
- payout
- refund

## Concurrency Tests

Critical:

```text
100 users
same facility
same slot
```

Expected:

```text
Only allowed capacity/bookings succeed.
No double booking.
```

## E2E

### User

```text
Signup
Search
Slot
Payment
Booking
Cancel
Refund
Review
```

### Business

```text
Signup
Verification
Venue
Subscription
Approval
Booking
Payout
```

### Admin

```text
Login
Verify
Approve
Subscription
Finance
Suspend
Refund
Audit
```

---

# 84. CI/CD

Pipeline:

```text
Git Push
   |
Lint
   |
Type Check
   |
Unit Tests
   |
Integration Tests
   |
Security Scan
   |
Build
   |
Deploy Staging
   |
Smoke Tests
   |
Approval
   |
Production
```

Use separate:

```text
development
staging
production
```

Never test production payment behavior with real credentials.

---

# 85. Deployment Architecture

Recommended production:

```text
Cloud DNS
   |
CDN/WAF
   |
Load Balancer
   |
Next.js instances
   |
API instances
   |
MongoDB
Redis
Worker
Object Storage
Monitoring
```

API should be stateless where possible so multiple instances can scale horizontally.

---

# 86. Secrets Management

Use environment/secrets manager:

```text
DATABASE_URL
JWT_SECRET
REFRESH_SECRET
PAYMENT_SECRET
PAYMENT_WEBHOOK_SECRET
STORAGE_SECRET
EMAIL_SECRET
SMS_SECRET
```

Never commit secrets to Git.

---

# 87. Backup / Disaster Recovery

Define:

```text
RPO
RTO
```

Maintain:

- automated DB backups
- point-in-time recovery where supported
- backup encryption
- retention policy
- restore testing
- disaster recovery runbook

A backup that has never been restored/tested should not be considered reliable.

---

# 88. Data Retention

Define retention for:

- bookings
- payments
- invoices
- audit logs
- support tickets
- notifications
- deleted accounts
- documents

Financial and legal retention requirements should be reviewed for the actual operating jurisdiction.

---

# 89. Production Edge Cases

Must handle:

### User

- duplicate signup
- expired session
- payment succeeded but API timed out
- payment failed after hold
- user closes browser during payment
- network retry
- double click booking
- slot expires during checkout

### Business

- subscription expires while bookings exist
- venue rejected after submission
- business suspended with future bookings
- facility maintenance during booked slot
- payout failure
- document expires

### Admin

- concurrent approval actions
- duplicate refund
- incorrect manual adjustment
- accidental suspension
- plan price change
- commission rule change

---

# 90. Important Financial Edge Case

Never do:

```text
if paymentSuccess:
    booking.status = confirmed
```

Instead:

```text
Payment Order
      |
Gateway
      |
Server Verification
      |
Webhook
      |
Idempotent Payment Record
      |
Transaction / Reservation Validation
      |
Booking Confirmation
```

Payment and booking must be reconciled if either side succeeds while the other times out.

---

# 91. Business Suspension with Existing Bookings

If subscription expires:

```text
Business
   |
Expired
   |
Stop NEW bookings
```

But:

```text
Existing CONFIRMED bookings
```

must remain consistent.

Possible policies:

```text
Allow existing bookings
or
Offer affected users reschedule/refund
```

Never silently delete bookings.

---

# 92. Admin Financial Controls

Admin should be able to:

```text
Create Plan
Edit Plan
Activate Plan
Deactivate Plan

View Subscription
Extend Subscription
Grant Trial
Suspend Subscription

View Payment
Retry Payment where supported
Refund
Adjust
View Invoice

Configure Commission
View Settlement
Release/hold payout
```

Sensitive actions require:

- permission
- reason
- audit log
- idempotency where applicable

---

# 93. Platform Configuration

Admin-configurable:

```text
Commission
Subscription Fee
Grace Period
Booking Hold Time
Cancellation Policy Defaults
Refund Rules
Tax configuration
Maximum booking duration
Minimum booking duration
Feature flags
Notification rules
Supported sports
Supported payment methods
```

Changes should be versioned/audited.

---

# 94. Feature Flags

Useful for controlled rollout:

```text
ENABLE_WALLET
ENABLE_MEMBERSHIP
ENABLE_TEAM_BOOKING
ENABLE_TOURNAMENT
ENABLE_COACH
ENABLE_WHATSAPP
ENABLE_NEW_SEARCH
```

Allow gradual release.

---

# 95. Current Project: Production Gaps to Fix First

The existing source identifies these concrete issues:

1. `businessUserId` is assigned by service code but missing from the Turf schema, so Mongoose can drop it and business-owned turf booking can fail.
2. Booking status update lacks the required ownership authorization.
3. Admin registration is publicly accessible.
4. Admin meta approval does not synchronize the Turf `status`.
5. Admin turf list/approve/reject/delete routes are missing even though controller/service methods exist.
6. Business turf list/delete and booking/stats routes are missing.
7. Admin booking router is missing.
8. Business auth response uses `businessUser`, while frontend reads `user`.
9. Admin response uses `admin`, while frontend reads `user`.
10. Business login is not fully handled by the frontend role login helper.
11. Frontend sends price filters that the backend does not currently support.
12. Turf media/creation has a multipart/schema contract mismatch.
13. Availability has a timezone/date normalization risk.
14. Several frontend dashboard actions are currently dead/hardcoded.

These are documented in the current source and should be treated as the first migration backlog rather than silently ignored. fileciteturn0file0L474-L510

---

# 96. Current Turf -> Target Domain Migration

Current:

```text
BusinessUser
     |
     v
Turf
     |
     v
Booking
```

Target:

```text
Business
   |
   +-- Location
          |
          +-- Venue
                 |
                 +-- Facility
                        |
                        +-- Sport
                        |
                        +-- Availability
                        |
                        +-- Pricing
                        |
                        +-- Booking
```

Migration should be incremental.

Do not rewrite the entire application in one deployment.

---

# 97. Recommended Migration Strategy

## Phase 0 — Stabilize Current System

Fix:

- ownership
- missing routes
- auth contracts
- admin registration
- timezone
- booking authorization
- multipart contract

## Phase 1 — Business Domain

Introduce:

```text
Business
BusinessDocuments
BusinessStaff
Location
```

Keep Turf temporarily as a legacy resource.

## Phase 2 — Generic Venue Domain

Introduce:

```text
Venue
Facility
Sport
Availability
Pricing
```

Map existing Turf records.

## Phase 3 — Booking Engine

Introduce:

```text
SlotHold
Booking
PricingSnapshot
PolicySnapshot
```

## Phase 4 — Finance

Introduce:

```text
Payment
Subscription
Commission
Settlement
Payout
Refund
Invoice
```

## Phase 5 — Operations

Introduce:

```text
Notifications
Support
Reviews
Analytics
Audit
```

## Phase 6 — Growth

Introduce:

```text
Membership
Wallet
Loyalty
Referral
Team
Recurring
Tournament
Coach
Equipment
```

---

# 98. Recommended API Ownership

## Public

```text
GET /venues
GET /venues/:id
GET /facilities/:id/availability
GET /sports
GET /amenities
```

## User

```text
POST /bookings
GET /bookings
GET /bookings/:id
POST /bookings/:id/cancel
POST /bookings/:id/reschedule
GET /payments
GET /refunds
POST /reviews
GET /notifications
```

## Business

```text
GET /business/profile
PATCH /business/profile

GET /business/locations
POST /business/locations

GET /business/venues
POST /business/venues
PATCH /business/venues/:id

GET /business/facilities
POST /business/facilities
PATCH /business/facilities/:id

GET /business/bookings
PATCH /business/bookings/:id

GET /business/subscription
POST /business/subscription/checkout

GET /business/payouts
GET /business/reports
```

## Admin

```text
GET /admin/users
GET /admin/businesses
PATCH /admin/businesses/:id/approve
PATCH /admin/businesses/:id/reject
PATCH /admin/businesses/:id/suspend

GET /admin/venues
PATCH /admin/venues/:id/approve
PATCH /admin/venues/:id/reject

GET /admin/bookings
PATCH /admin/bookings/:id

GET /admin/subscription-plans
POST /admin/subscription-plans
PATCH /admin/subscription-plans/:id

GET /admin/payments
GET /admin/refunds
GET /admin/payouts
GET /admin/settlements

GET /admin/audit-logs
GET /admin/reports
```

---

# 99. Frontend Application Structure

Recommended:

```text
src/
|
+-- app/
|   +-- (public)/
|   +-- (auth)/
|   +-- (user)/
|   +-- (business)/
|   +-- (admin)/
|
+-- components/
|   +-- ui/
|   +-- forms/
|   +-- booking/
|   +-- venue/
|   +-- business/
|   +-- admin/
|
+-- services/
|   +-- api/
|   +-- auth/
|   +-- booking/
|   +-- payment/
|
+-- hooks/
+-- lib/
+-- types/
+-- utils/
+-- constants/
```

Avoid putting business logic into page components.

---

# 100. Backend Structure

Recommended:

```text
src/
|
+-- config/
+-- routes/
+-- controllers/
+-- services/
+-- repositories/
+-- models/
+-- validators/
+-- middleware/
+-- policies/
+-- events/
+-- workers/
+-- jobs/
+-- utils/
+-- integrations/
|    +-- payment/
|    +-- storage/
|    +-- notification/
|
+-- modules/
     +-- auth/
     +-- users/
     +-- businesses/
     +-- venues/
     +-- facilities/
     +-- availability/
     +-- bookings/
     +-- payments/
     +-- subscriptions/
     +-- payouts/
     +-- reviews/
     +-- support/
```

For a growing production application, domain-oriented modules are preferable to one huge controller/service folder.

---

# 101. Service Layer Rules

Controllers should:

- validate request
- authorize
- call service
- format response

Services should:

- execute business rules
- coordinate repositories
- create transactions
- emit domain events

Repositories should:

- query/update database
- not contain HTTP concerns

---

# 102. Transaction Boundaries

Use database transactions for operations that must succeed/fail together.

Examples:

```text
Booking confirmation
Payment ledger update
Subscription activation
Wallet credit
Refund record
Settlement creation
```

Do not create long-running transactions around external APIs.

Use state machines + reconciliation for external payment systems.

---

# 103. External Integration Rules

For payment/email/SMS/storage:

```text
Internal Record
      |
External API
      |
Webhook/Callback
      |
Internal State Update
```

External provider response must not be treated as the only source of truth when webhook/reconciliation is available.

---

# 104. Senior-Level Non-Negotiables

Before production launch:

```text
[ ] Tenant isolation
[ ] Resource authorization
[ ] Admin MFA
[ ] Secure authentication
[ ] Idempotency
[ ] Slot locking
[ ] Transaction boundaries
[ ] Payment webhook verification
[ ] Payment reconciliation
[ ] Subscription lifecycle
[ ] Settlement/payout lifecycle
[ ] Refund lifecycle
[ ] Audit logs
[ ] Structured logs
[ ] Monitoring
[ ] Alerting
[ ] Rate limiting
[ ] Backup
[ ] Restore test
[ ] CI/CD
[ ] Staging environment
[ ] Error handling
[ ] API versioning
[ ] OpenAPI documentation
[ ] Unit tests
[ ] Integration tests
[ ] Concurrency tests
[ ] E2E tests
[ ] Security testing
[ ] Load testing
[ ] Disaster recovery plan
```

---

# 105. Final End-to-End Flow

```text
                         ADMIN
                           |
                Platform Configuration
                           |
          +----------------+----------------+
          |                                 |
   Subscription Plans                 Platform Rules
          |                                 |
          +----------------+----------------+
                           |
                           v
                     BUSINESS
                           |
                    Registration
                           |
                    Verification
                           |
                      Documents
                           |
                     Location
                           |
                       Venue
                           |
                      Facility
                           |
                       Sports
                           |
                  Availability
                           |
                      Pricing
                           |
                   Admin Review
                           |
                +----------+----------+
                |                     |
             REJECTED              APPROVED
                |                     |
             Resubmit                 |
                                      v
                              Subscription
                                      |
                                   Payment
                                      |
                               Subscription
                                  ACTIVE
                                      |
                               Business LIVE
                                      |
                                      v
                                    USER
                                      |
                                  Search
                                      |
                                  Filter
                                      |
                                  Venue
                                      |
                                 Facility
                                      |
                                   Date
                                      |
                                   Slot
                                      |
                                Availability
                                      |
                                  Slot Hold
                                      |
                                  Pricing
                                      |
                                 Payment
                                      |
                              Verification
                                      |
                              BOOKING CONFIRMED
                                      |
                         +------------+------------+
                         |                         |
                      Check-in                 Cancellation
                         |                         |
                      Complete                Refund Policy
                         |                         |
                       Review                 Refund
                         |
                      Analytics

                    FINANCIAL FLOW
                         |
                         v
                    Payment Ledger
                         |
              +----------+----------+
              |                     |
        Platform Commission    Business Payable
                                    |
                                Settlement
                                    |
                                 Payout
```

---

# 106. Final Recommended Product Modules

## User

```text
Authentication
Profile
Security
Search
Discovery
Favorites
Venue Details
Availability
Slot Hold
Booking
Payment
Invoice
Cancellation
Reschedule
Refund
Wallet
Membership
Loyalty
QR Check-in
Reviews
Notifications
Support
Disputes
Booking History
```

## Business

```text
Authentication
Business Profile
Verification
KYC
Locations
Venues
Facilities
Sports
Media
Amenities
Availability
Maintenance
Pricing
Coupons
Bookings
Customers
Staff
RBAC
Subscription
Subscription Payments
Invoices
Commission
Settlements
Payouts
Reviews
Analytics
Reports
Notifications
Support
```

## Admin

```text
Dashboard
Users
Businesses
Verification
Venues
Facilities
Sports
Subscription Plans
Subscriptions
Payments
Commission
Settlements
Payouts
Refunds
Bookings
Reviews
Coupons
Notifications
Support
Disputes
CMS
Reports
Analytics
Audit Logs
Security
Platform Settings
Feature Flags
```

---

# 107. Product Maturity Roadmap

## Phase 1 — Core Production

```text
Auth
Business
Verification
Venue
Facility
Sport
Availability
Booking
Slot Lock
Payment
Subscription
Admin
```

## Phase 2 — Financial + Operations

```text
Refund
Invoice
Commission
Settlement
Payout
Notifications
Reviews
Support
Analytics
Audit
```

## Phase 3 — Customer Growth

```text
Wallet
Membership
Loyalty
Coupons
Favorites
Team Booking
Recurring Booking
Waitlist
```

## Phase 4 — Advanced Marketplace

```text
Coach
Equipment
Tournament
Corporate Booking
Referral
Recommendations
Demand Analytics
```

---

# 108. Definition of Done — Production

A module is not production-ready merely because its API returns `200`.

A module is considered production-ready only when:

```text
Requirement
    |
Validation
    |
Authorization
    |
Business Rules
    |
Database Integrity
    |
Concurrency Handling
    |
Error Handling
    |
Idempotency where required
    |
Audit where required
    |
Logs/Metrics
    |
Tests
    |
Documentation
    |
Deployment
```

This is the standard to apply to every major module.

---

# 109. Final Architecture Principle

The platform should be designed around these boundaries:

```text
IDENTITY
   |
TENANT / BUSINESS
   |
RESOURCE
   |
AVAILABILITY
   |
BOOKING
   |
PAYMENT
   |
FINANCIAL LEDGER
   |
SETTLEMENT
   |
NOTIFICATION
   |
ANALYTICS
   |
AUDIT
```

The most important principle is:

> **Business approval, subscription status, operational status, booking status and payment status must remain separate state machines.**

The system should never infer one state from an unrelated field.

---

# 110. Final Senior Developer Checklist

Before calling the platform production-ready:

```text
ARCHITECTURE
[ ] Domain boundaries defined
[ ] Multi-tenant model defined
[ ] API versioning
[ ] Module ownership defined

AUTH
[ ] User auth
[ ] Business auth
[ ] Admin auth
[ ] MFA
[ ] Session management
[ ] Refresh token strategy

AUTHORIZATION
[ ] RBAC
[ ] Permission checks
[ ] Resource ownership
[ ] Tenant isolation

BUSINESS
[ ] Business onboarding
[ ] KYC
[ ] Verification
[ ] Multiple locations
[ ] Staff

VENUE
[ ] Venue
[ ] Facility
[ ] Sport
[ ] Media
[ ] Amenities
[ ] Maintenance

BOOKING
[ ] Availability
[ ] Slot hold
[ ] Concurrency protection
[ ] Idempotency
[ ] Cancellation
[ ] Reschedule
[ ] Check-in
[ ] No-show

FINANCE
[ ] Payment
[ ] Webhook
[ ] Reconciliation
[ ] Subscription
[ ] Commission
[ ] Refund
[ ] Invoice
[ ] Settlement
[ ] Payout
[ ] Ledger

CUSTOMER
[ ] Search
[ ] Favorites
[ ] Reviews
[ ] Notifications
[ ] Wallet
[ ] Membership
[ ] Support

ADMIN
[ ] Business approval
[ ] Venue approval
[ ] Subscription control
[ ] Financial control
[ ] Dispute management
[ ] CMS
[ ] Reports
[ ] Audit

OPERATIONS
[ ] Queue
[ ] Workers
[ ] Monitoring
[ ] Alerts
[ ] Logs
[ ] Health checks
[ ] Backups
[ ] Disaster recovery

QUALITY
[ ] Unit tests
[ ] Integration tests
[ ] E2E tests
[ ] Concurrency tests
[ ] Load tests
[ ] Security tests
[ ] Staging
[ ] CI/CD
```

---

## Conclusion

The target platform is not just a Turf booking application.

It should be treated as a:

**Multi-tenant Sports Venue Marketplace + Booking Engine + Business Management Platform + Financial Platform + Admin Operations System.**

The existing Turf implementation can be stabilized first and then migrated incrementally toward:

```text
Business
   ↓
Location
   ↓
Venue
   ↓
Facility
   ↓
Sport
   ↓
Availability
   ↓
Slot Hold
   ↓
Booking
   ↓
Payment
   ↓
Ledger
   ↓
Settlement
   ↓
Payout

with

Admin
   ↓
Verification
Subscription
Financial Controls
Moderation
Security
Audit
Analytics
```

This structure keeps the core booking engine reliable while allowing future modules such as memberships, teams, tournaments, coaches, equipment and recommendations without redesigning the foundation.


---

# Backend Module-Level Folder Convention

This is the standard structure to be followed for backend domain modules. Every applicable business module should use the same separation of responsibilities.

## Standard Module Structure

```text
<module>/
├── <module>.model.js
├── <module>.repository.js
├── <module>.service.js
├── <module>.controller.js
├── <module>.routes.js
├── <module>.validation.js
├── <module>.policy.js
├── <module>.constants.js
├── <module>.mapper.js
└── index.js
```

### Example: Booking Module

```text
src/
└── modules/
    └── bookings/
        ├── booking.model.js
        ├── booking.repository.js
        ├── booking.service.js
        ├── booking.controller.js
        ├── booking.routes.js
        ├── booking.validation.js
        ├── booking.policy.js
        ├── booking.constants.js
        ├── booking.mapper.js
        └── index.js
```

## Responsibility of Each File

| File | Responsibility |
|---|---|
| `model.js` | MongoDB/Mongoose schema, indexes, persistence-level constraints |
| `repository.js` | Database queries and persistence operations only |
| `service.js` | Core business logic, workflows, transactions, domain rules |
| `controller.js` | HTTP request/response handling; should remain thin |
| `routes.js` | Endpoint definitions and middleware composition |
| `validation.js` | Request params/query/body validation |
| `policy.js` | Authorization and resource ownership rules |
| `constants.js` | Statuses, enums, event names, fixed domain values |
| `mapper.js` | Convert DB/domain objects into safe API response shapes |
| `index.js` | Module exports / module wiring |

## Request Flow

```text
HTTP Request
     ↓
routes.js
     ↓
validation.js
     ↓
authentication middleware
     ↓
policy.js / authorization
     ↓
controller.js
     ↓
service.js
     ↓
repository.js
     ↓
MongoDB
```

For workflows involving external systems:

```text
Controller
   ↓
Service
   ├── Repository → MongoDB
   ├── Redis / Lock
   ├── Payment Provider
   ├── Storage Provider
   └── Event / Queue
```

## Example Booking Module Responsibilities

### `booking.model.js`
Contains booking persistence structure such as:

```text
bookingId
userId
businessId
locationId
venueId
facilityId
sportId
slotId
bookingDate
startTime
endTime
status
pricingSnapshot
cancellationSnapshot
paymentId
createdAt
updatedAt
```

### `booking.repository.js`

Only persistence/data-access operations:

```text
create()
findById()
findByUser()
findByBusiness()
findByFacility()
findByDate()
updateStatus()
updatePaymentStatus()
exists()
count()
```

The repository should not contain booking business decisions.

### `booking.service.js`

Contains booking workflows:

```text
createBooking()
holdSlot()
confirmBooking()
cancelBooking()
rescheduleBooking()
completeBooking()
validateBookingWindow()
calculateBookingAmount()
createBookingPayment()
releaseExpiredHold()
```

The service is responsible for coordinating repositories, slot locks, payments, events, and transactions.

### `booking.controller.js`

Thin HTTP layer:

```text
createBooking
getBooking
listBookings
cancelBooking
rescheduleBooking
getBookingStatus
```

The controller should parse the request, call the service, and return the API response. Business rules should not be implemented here.

### `booking.routes.js`

Example:

```text
POST   /bookings
GET    /bookings/:id
GET    /bookings
POST   /bookings/:id/cancel
POST   /bookings/:id/reschedule
GET    /bookings/:id/status
```

Routes should compose:

```text
route
 → authentication
 → validation
 → policy
 → controller
```

### `booking.validation.js`

Examples:

```text
createBookingSchema
bookingIdParamSchema
listBookingQuerySchema
cancelBookingSchema
rescheduleBookingSchema
```

Validation must reject malformed or unsafe input before business logic executes.

### `booking.policy.js`

Examples:

```text
canViewBooking()
canCancelBooking()
canRescheduleBooking()
canManageBusinessBooking()
canAdminManageBooking()
```

This is especially important for preventing cross-business and cross-user access.

### `booking.constants.js`

Examples:

```text
BOOKING_STATUS
PAYMENT_STATUS
CANCELLATION_REASON
BOOKING_SOURCE
```

Avoid scattering string literals throughout services and controllers.

### `booking.mapper.js`

Responsible for safe response transformation:

```text
toBookingResponse()
toBookingSummary()
toAdminBookingResponse()
toBusinessBookingResponse()
```

Sensitive internal fields must not be exposed accidentally.

---

# Modules That Should Follow This Convention

The following backend modules should use the standard structure wherever applicable:

```text
auth/
users/
businesses/
locations/
venues/
facilities/
sports/
availability/
pricing/
bookings/
slot-holds/
payments/
refunds/
subscriptions/
commissions/
settlements/
payouts/
invoices/
wallets/
coupons/
reviews/
favorites/
notifications/
support/
disputes/
staff/
teams/
recurring-bookings/
waitlist/
equipment/
coaches/
tournaments/
analytics/
reports/
cms/
audit-logs/
admin/
```

Example:

```text
src/modules/
├── auth/
│   ├── auth.model.js
│   ├── auth.repository.js
│   ├── auth.service.js
│   ├── auth.controller.js
│   ├── auth.routes.js
│   ├── auth.validation.js
│   ├── auth.policy.js
│   ├── auth.constants.js
│   └── index.js
│
├── businesses/
│   ├── business.model.js
│   ├── business.repository.js
│   ├── business.service.js
│   ├── business.controller.js
│   ├── business.routes.js
│   ├── business.validation.js
│   ├── business.policy.js
│   ├── business.constants.js
│   ├── business.mapper.js
│   └── index.js
│
├── venues/
│   ├── venue.model.js
│   ├── venue.repository.js
│   ├── venue.service.js
│   ├── venue.controller.js
│   ├── venue.routes.js
│   ├── venue.validation.js
│   ├── venue.policy.js
│   ├── venue.constants.js
│   ├── venue.mapper.js
│   └── index.js
│
├── facilities/
│   ├── facility.model.js
│   ├── facility.repository.js
│   ├── facility.service.js
│   ├── facility.controller.js
│   ├── facility.routes.js
│   ├── facility.validation.js
│   ├── facility.policy.js
│   ├── facility.constants.js
│   └── index.js
│
├── payments/
│   ├── payment.model.js
│   ├── payment.repository.js
│   ├── payment.service.js
│   ├── payment.controller.js
│   ├── payment.routes.js
│   ├── payment.validation.js
│   ├── payment.policy.js
│   ├── payment.constants.js
│   ├── payment.mapper.js
│   ├── providers/
│   │   ├── razorpay.provider.js
│   │   └── stripe.provider.js
│   ├── payment.webhook.js
│   └── index.js
│
└── subscriptions/
    ├── subscription.model.js
    ├── subscription.repository.js
    ├── subscription.service.js
    ├── subscription.controller.js
    ├── subscription.routes.js
    ├── subscription.validation.js
    ├── subscription.policy.js
    ├── subscription.constants.js
    ├── subscription.mapper.js
    └── index.js
```

# Special-Case Modules

Not every module should be forced into exactly the same file set. Complex domains can add specialized files while retaining the core separation.

## Availability

```text
availability/
├── availability.model.js
├── availability.repository.js
├── availability.service.js
├── availability.engine.js
├── availability.controller.js
├── availability.routes.js
├── availability.validation.js
├── availability.policy.js
├── availability.constants.js
└── index.js
```

`availability.engine.js` handles slot generation, recurring schedules, blackout dates, timezone-aware availability, and conflict detection.

## Pricing

```text
pricing/
├── pricing.model.js
├── pricing.repository.js
├── pricing.service.js
├── pricing.engine.js
├── pricing.controller.js
├── pricing.routes.js
├── pricing.validation.js
├── pricing.policy.js
├── pricing.constants.js
└── index.js
```

`pricing.engine.js` handles base price, peak/off-peak pricing, sport/facility pricing, discounts, taxes, platform fees, and price snapshots.

## Payments

Payments require provider adapters, webhook processing, reconciliation, and idempotency:

```text
payments/
├── payment.model.js
├── payment.repository.js
├── payment.service.js
├── payment.controller.js
├── payment.routes.js
├── payment.validation.js
├── payment.policy.js
├── payment.constants.js
├── payment.mapper.js
├── payment.webhook.js
├── payment.reconciliation.js
├── providers/
│   ├── payment-provider.interface.js
│   ├── razorpay.provider.js
│   └── stripe.provider.js
└── index.js
```

Payment status must be confirmed by the backend/provider webhook rather than trusted solely from the frontend.

## Notifications

```text
notifications/
├── notification.model.js
├── notification.repository.js
├── notification.service.js
├── notification.controller.js
├── notification.routes.js
├── notification.validation.js
├── notification.policy.js
├── notification.constants.js
├── providers/
│   ├── email.provider.js
│   ├── sms.provider.js
│   ├── push.provider.js
│   └── whatsapp.provider.js
└── index.js
```

## Admin

Admin should be domain-oriented rather than one giant controller:

```text
admin/
├── admin.controller.js
├── admin.routes.js
├── admin.validation.js
├── admin.policy.js
├── admin.constants.js
├── dashboard/
├── businesses/
├── venues/
├── bookings/
├── users/
├── subscriptions/
├── payments/
├── refunds/
├── reports/
├── audit/
└── index.js
```

Admin authorization must be based on explicit admin roles and permissions.

---

# Backend Infrastructure Outside Modules

Cross-cutting infrastructure should not be duplicated inside every module.

```text
src/
├── config/
│   ├── env.js
│   ├── database.js
│   ├── redis.js
│   ├── storage.js
│   ├── payment.js
│   └── mail.js
│
├── middleware/
│   ├── auth.middleware.js
│   ├── authorize.middleware.js
│   ├── tenant.middleware.js
│   ├── validate.middleware.js
│   ├── rate-limit.middleware.js
│   ├── request-id.middleware.js
│   ├── upload.middleware.js
│   ├── not-found.middleware.js
│   └── error-handler.middleware.js
│
├── common/
│   ├── errors/
│   ├── responses/
│   ├── logger/
│   ├── pagination/
│   ├── database/
│   ├── security/
│   └── utils/
│
├── events/
│   ├── event-bus.js
│   ├── event-types.js
│   └── outbox/
│
├── integrations/
│   ├── maps/
│   ├── storage/
│   ├── payments/
│   ├── email/
│   ├── sms/
│   └── push/
│
├── workers/
│   ├── booking.worker.js
│   ├── payment.worker.js
│   ├── subscription.worker.js
│   ├── notification.worker.js
│   └── cleanup.worker.js
│
├── routes/
│   └── index.js
│
├── app.js
└── server.js
```

## Architectural Rule

The dependency direction should remain:

```text
Routes
  ↓
Controller
  ↓
Service
  ↓
Repository
  ↓
Database
```

With supporting concerns:

```text
Routes
  ├── Validation
  ├── Authentication
  └── Policy
          ↓
      Controller
          ↓
       Service
      ↙   ↓   ↘
Repository Redis External Providers
      ↓
   Database
```

### Rules

1. Controllers must not contain complex business logic.
2. Repositories must not contain business decisions.
3. Services must not directly parse HTTP request/response objects.
4. Routes must not implement domain logic.
5. Validation must happen before the service layer.
6. Authorization/ownership checks must happen through policy/service rules.
7. Constants should be centralized inside the relevant module.
8. External providers should be accessed through adapters/integration layers.
9. Database transactions belong to the service/use-case boundary.
10. Sensitive response shaping should happen through mappers/DTOs.
11. Modules should communicate through service contracts/events rather than importing another module's repository directly.
12. Cross-cutting utilities belong in `common/`, not duplicated inside modules.

This convention is the default backend implementation standard for the Sports Venue Booking Platform.
