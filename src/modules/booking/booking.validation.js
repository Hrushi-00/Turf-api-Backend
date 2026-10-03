const { body, param, header } = require('express-validator');

const validateCreateBooking = [
  header('Idempotency-Key').optional().trim().isLength({ min: 8, max: 128 }).withMessage('Idempotency-Key must be 8 to 128 characters'),
  body('turfId').optional().isMongoId().withMessage('Invalid turf ID format'),
  body('facilityId').optional().isMongoId().withMessage('Invalid facility ID format'),
  body().custom((value) => Boolean(value?.turfId) !== Boolean(value?.facilityId))
    .withMessage('Provide exactly one of turfId or facilityId'),
  body('date')
    .notEmpty().withMessage('Date is required')
    .isDate({ format: 'YYYY-MM-DD', strictMode: true }).withMessage('Date must use YYYY-MM-DD format'),
  body('timeSlot')
    .trim()
    .notEmpty().withMessage('Time slot is required')
    .matches(/^([01]?\d|2[0-3]):[0-5]\d\s*-\s*([01]?\d|2[0-3]):[0-5]\d$/).withMessage('Time slot must use HH:MM-HH:MM format')
    .custom((value) => {
      const [start, end] = value.split('-').map((time) => time.trim().split(':').reduce((h, m) => Number(h) * 60 + Number(m)));
      return end > start && start % 15 === 0 && end % 15 === 0;
    }).withMessage('Time slot end must be after start'),
  body('paymentMethod')
    .optional()
    .trim()
    .isIn(['cash', 'online', 'upi', 'card']).withMessage('Invalid payment method')
];

const validateBookingId = [
  param('id')
    .notEmpty().withMessage('Booking ID is required')
    .isMongoId().withMessage('Invalid booking ID format')
];

const validateUpdateBookingStatus = [
  param('id')
    .notEmpty().withMessage('Booking ID is required')
    .isMongoId().withMessage('Invalid booking ID format'),
  body('bookingStatus')
    .optional()
    .trim()
    .isIn(['pending', 'confirmed', 'cancelled', 'completed']).withMessage('Invalid booking status'),
  body().custom((value) => ['bookingStatus'].some((key) => value?.[key] !== undefined))
    .withMessage('Booking status is required')
];

module.exports = {
  validateCreateBooking,
  validateBookingId,
  validateUpdateBookingStatus
};
