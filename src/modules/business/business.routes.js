const express = require('express');
const router = express.Router();
const businessController = require('./business.controller');
const { validate } = require('../../middleware/validate');
const { protect, isBusinessUser } = require('../../middleware/adminMiddleware');
const turfValidation = require('../turf/turf.validation');
const bookingValidation = require('../booking/booking.validation');
const reviewController = require('../reviews/review.controller');
const { param, body } = require('express-validator');
const { auditResponse } = require('../../middleware/audit-response.middleware');
const { validateProfile } = require('./business.validation');
const domainValidation = require('./business-domain.validation');

router.use(protect, isBusinessUser);

router.get('/profile', businessController.getBusinessProfile);
router.put('/profile', validateProfile, validate, businessController.saveBusinessProfile);
router.get('/documents', businessController.listMyDocuments);
router.post('/documents', domainValidation.validateDocumentSubmission, validate, businessController.submitDocument);
router.get('/documents/:id/download', domainValidation.validateDocumentId, validate, businessController.getMyDocumentDownloadUrl);
router.get('/staff', businessController.listStaff);
router.post('/staff', domainValidation.validateStaffCreate, validate, businessController.addStaff);
router.patch('/staff/:id', domainValidation.validateStaffUpdate, validate, businessController.updateStaff);
router.delete('/staff/:id', domainValidation.validateStaffId, validate, businessController.removeStaff);
router.get('/turfs', businessController.getTurfs);
router.post('/turfs', turfValidation.normalizeTurfRequest, turfValidation.validateAddTurf, validate, businessController.addTurf);
router.put('/turfs/:id', turfValidation.normalizeTurfRequest, turfValidation.validateUpdateTurf, validate, businessController.updateTurf);
router.delete('/turfs/:id', turfValidation.validateTurfId, validate, businessController.deleteTurf);
router.get('/bookings', businessController.getBookings);
router.get('/booking-stats', businessController.getBookingStats);
router.patch('/bookings/:id', bookingValidation.validateUpdateBookingStatus, validate, businessController.updateBookingStatus);
router.patch('/reviews/:id/response', [param('id').isMongoId(), body('response').trim().notEmpty().isLength({ max: 2000 })], validate, auditResponse('BUSINESS_REVIEW_RESPONSE', 'Review'), reviewController.respond);

module.exports = router;
