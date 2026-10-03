const turfController = require('../turf/turf.controller');
const bookingController = require('../booking/booking.controller');
const businessService = require('./business.service');
const domainService = require('./business-domain.service');
const notificationService = require('../notifications/notification.service');

const getBusinessProfile = async (req, res) => {
  try {
    res.json(await businessService.getProfile(req.user._id));
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

const saveBusinessProfile = async (req, res) => {
  try {
    const result = await businessService.saveProfile(req.user._id, req.body);
    res.status(result.created ? 201 : 200).json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

const reviewBusiness = async (req, res) => {
  try {
    const result = await businessService.reviewBusiness(
      req.params.id, req.user._id, req.body.approvalStatus, req.body.reason
    );
    if (result.data?.owner) await notificationService.enqueue({
      eventKey: `business-review:${result.data._id}:${result.data.reviewedAt.toISOString()}`,
      recipient: result.data.owner, recipientType: 'AUTH',
      eventType: result.data.approvalStatus === 'APPROVED' ? 'BusinessApproved' : 'BusinessRejected',
      title: result.data.approvalStatus === 'APPROVED' ? 'Business approved' : 'Business review updated',
      message: result.data.rejectionReason || 'Your business verification status has been updated.',
      data: { businessId: result.data._id, approvalStatus: result.data.approvalStatus }
    });
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

const listBusinesses = async (req, res) => {
  try {
    res.json(await businessService.listBusinesses(req.query));
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

const getTurfs = async (req, res) => {
  return turfController.getAdminTurfs(req, res);
};

const addTurf = async (req, res) => {
  return turfController.addTurf(req, res);
};

const updateTurf = async (req, res) => {
  return turfController.updateTurf(req, res);
};

const deleteTurf = async (req, res) => {
  return turfController.deleteTurf(req, res);
};

const getBookings = async (req, res) => {
  return bookingController.getAdminBookings(req, res);
};

const getBookingStats = async (req, res) => {
  return turfController.getBookingStats(req, res);
};

const updateBookingStatus = async (req, res) => {
  return bookingController.updateBookingStatus(req, res);
};

const runDomain = (operation, status = 200) => async (req, res) => {
  try {
    res.status(status).json(await operation(req));
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Internal server error' });
  }
};

const submitDocument = runDomain((req) => domainService.submitDocument(req.user._id, req.body, req.files?.document), 201);
const listMyDocuments = runDomain((req) => domainService.listMyDocuments(req.user._id));
const listDocumentsForAdmin = runDomain((req) => domainService.listDocumentsForAdmin(req.query));
const reviewDocument = runDomain((req) => domainService.reviewDocument(req.user._id, req.params.id, req.body.status, req.body.rejectionReason));
const getMyDocumentDownloadUrl = runDomain((req) => domainService.getDocumentDownloadUrl({ ownerId: req.user._id, id: req.params.id }));
const getAdminDocumentDownloadUrl = runDomain((req) => domainService.getDocumentDownloadUrl({ id: req.params.id, admin: true }));
const listStaff = runDomain((req) => domainService.listStaff(req.user._id));
const addStaff = runDomain((req) => domainService.addStaff(req.user._id, req.body), 201);
const updateStaff = runDomain((req) => domainService.updateStaff(req.user._id, req.params.id, req.body));
const removeStaff = runDomain((req) => domainService.removeStaff(req.user._id, req.params.id));

module.exports = {
  getTurfs,
  addTurf,
  updateTurf,
  deleteTurf,
  getBookings,
  getBookingStats,
  updateBookingStatus,
  getBusinessProfile,
  saveBusinessProfile,
  reviewBusiness,
  listBusinesses,
  submitDocument,
  listMyDocuments,
  listDocumentsForAdmin,
  reviewDocument,
  getMyDocumentDownloadUrl,
  getAdminDocumentDownloadUrl,
  listStaff,
  addStaff,
  updateStaff,
  removeStaff
};
