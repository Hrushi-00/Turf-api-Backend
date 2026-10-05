const turfService = require('./turf.service');
const sendError = (res, error, fallback = 500) => res.status(error.statusCode || fallback).json({ success: false, message: error.message });

const addTurf = async (req, res) => {
  try {
    const turfData = JSON.parse(JSON.stringify(req.body));
    const result = await turfService.addTurf({
      turfData,
      files: req.files,
      user: req.user
    });
    res.status(201).json(result);
  } catch (error) {
    sendError(res, error, 400);
  }
};

const getAllTurfs = async (req, res) => {
  try {
    const result = await turfService.getAllTurfs(req.query);
    res.status(200).json(result);
  } catch (error) {
    sendError(res, error);
  }
};

const getNearbyTurfs = async (req, res) => {
  try {
    const result = await turfService.getNearbyTurfs(req.query);
    res.status(200).json(result);
  } catch (error) {
    sendError(res, error);
  }
};

const getAdminTurfs = async (req, res) => {
  try {
    const result = await turfService.getAdminTurfs(req.user);
    res.status(200).json(result);
  } catch (error) {
    sendError(res, error);
  }
};

const getTurf = async (req, res) => {
  try {
    const result = await turfService.getTurf({ id: req.params.id }, req.user);
    res.status(200).json(result);
  } catch (error) {
    sendError(res, error);
  }
};

const updateTurf = async (req, res) => {
  try {
    const turfData = JSON.parse(JSON.stringify(req.body));
    const result = await turfService.updateTurf(
      { id: req.params.id, turfData, files: req.files },
      req.user
    );
    res.status(200).json(result);
  } catch (error) {
    sendError(res, error, 400);
  }
};

const updateTurfMetaInfo = async (req, res) => {
  try {
    const result = await turfService.updateTurfMetaInfo(
      { id: req.params.id },
      req.body
    );
    res.status(200).json(result);
  } catch (error) {
    sendError(res, error, 400);
  }
};

const deleteTurf = async (req, res) => {
  try {
    const result = await turfService.deleteTurf({ id: req.params.id }, req.user);
    res.status(200).json(result);
  } catch (error) {
    sendError(res, error);
  }
};

const getBookingStats = async (req, res) => {
  try {
    const result = await turfService.getBookingStats(req.user);
    res.status(200).json(result);
  } catch (error) {
    sendError(res, error);
  }
};

const approveTurf = async (req, res) => {
  try {
    const result = await turfService.approveTurf(req.params.id);
    res.status(200).json(result);
  } catch (error) {
    sendError(res, error);
  }
};

const rejectTurf = async (req, res) => {
  try {
    const result = await turfService.rejectTurf(req.params.id);
    res.status(200).json(result);
  } catch (error) {
    sendError(res, error);
  }
};

const getFeaturedTurfs = async (req, res) => {
  try {
    const result = await turfService.getFeaturedTurfs();
    res.status(200).json(result);
  } catch (error) {
    sendError(res, error);
  }
};

const getTrendingTurfs = async (req, res) => {
  try {
    const result = await turfService.getTrendingTurfs();
    res.status(200).json(result);
  } catch (error) {
    sendError(res, error);
  }
};

const getApprovedTurfs = async (req, res) => {
  try {
    const result = await turfService.getApprovedTurfs();
    res.status(200).json(result);
  } catch (error) {
    sendError(res, error);
  }
};

const getTurfAvailability = async (req, res) => {
  try {
    const result = await turfService.getTurfAvailability({
      id: req.params.id,
      date: req.query.date
    }, req.user);
    res.status(200).json(result);
  } catch (error) {
    sendError(res, error);
  }
};

module.exports = {
  addTurf,
  getAllTurfs,
  getNearbyTurfs,
  getAdminTurfs,
  getTurf,
  updateTurf,
  updateTurfMetaInfo,
  deleteTurf,
  getBookingStats,
  approveTurf,
  rejectTurf,
  getFeaturedTurfs,
  getTrendingTurfs,
  getApprovedTurfs,
  getTurfAvailability
};
