const express = require('express');
const router = express.Router();
const turfController = require('./turf.controller');
const { validate } = require('../../middleware/validate');
const { protect, isAdmin, canManageMetaInfo } = require('../../middleware/adminMiddleware');
const { validateAddTurf, validateTurfId, validateUpdateTurf, validateMetaInfo, normalizeTurfRequest } = require('./turf.validation');
const businessController = require('../business/business.controller');
const { validateReview, validateList } = require('../business/business.validation');
const businessDomainValidation = require('../business/business-domain.validation');
const bookingController = require('../booking/booking.controller');
const bookingValidation = require('../booking/booking.validation');
const venueController = require('../venues/venue.controller');
const { validateReview: validateVenueReview, validateAdminQuery: validateVenueAdminQuery } = require('../venues/venue.validation');
const { auditResponse } = require('../../middleware/audit-response.middleware');

router.use(protect, isAdmin);

router.post('/turfs', normalizeTurfRequest, validateAddTurf, validate, turfController.addTurf);
router.get('/turfs', turfController.getAdminTurfs);
router.put('/turfs/:id', normalizeTurfRequest, validateUpdateTurf, validate, turfController.updateTurf);
router.delete('/turfs/:id', validateTurfId, validate, turfController.deleteTurf);
router.patch('/turfs/:id/meta', canManageMetaInfo, validateMetaInfo, validate, turfController.updateTurfMetaInfo);
router.post('/turfs/:id/approve', validateTurfId, validate, turfController.approveTurf);
router.post('/turfs/:id/reject', validateTurfId, validate, turfController.rejectTurf);
router.get('/bookings', bookingController.getAllBookings);
router.patch('/bookings/:id', bookingValidation.validateUpdateBookingStatus, validate, bookingController.updateBookingStatus);
router.get('/booking-stats', turfController.getBookingStats);
router.get('/businesses', validateList, validate, businessController.listBusinesses);
router.patch('/businesses/:id/approval', validateReview, validate, auditResponse('BUSINESS_REVIEWED', 'Business'), businessController.reviewBusiness);
router.get('/business-documents', businessDomainValidation.validateDocumentList, validate, businessController.listDocumentsForAdmin);
router.get('/business-documents/:id/download', businessDomainValidation.validateDocumentId, validate, businessController.getAdminDocumentDownloadUrl);
router.patch('/business-documents/:id/review', businessDomainValidation.validateDocumentReview, validate, auditResponse('BUSINESS_DOCUMENT_REVIEWED', 'BusinessDocument'), businessController.reviewDocument);
router.get('/venues', validateVenueAdminQuery, validate, venueController.listForAdmin);
router.patch('/venues/:id/approval', validateVenueReview, validate, auditResponse('VENUE_REVIEWED', 'Venue'), venueController.review);

module.exports = router;
