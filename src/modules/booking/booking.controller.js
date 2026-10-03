const bookingService = require('./booking.service');
const respondWithError = (res, error, fallbackStatus = 500) => res.status(error.statusCode || fallbackStatus).json({
  success: false,
  message: error.message
});

const getAdminBookings = async (req, res) => {
  try {
    const result = await bookingService.getAdminBookings(req.user);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching admin bookings:', error);
    respondWithError(res, error);
  }
};

const getAllBookings = async (req, res) => {
  try {
    const result = await bookingService.getAllBookings();
    res.status(200).json(result);
  } catch (error) {
    respondWithError(res, error);
  }
};

const createBooking = async (req, res) => {
  try {
    const result = await bookingService.createBooking({
      userId: req.user._id,
      turfId: req.body.turfId,
      facilityId: req.body.facilityId,
      date: req.body.date,
      timeSlot: req.body.timeSlot,
      paymentMethod: req.body.paymentMethod,
      idempotencyKey: req.get('Idempotency-Key')
    });
    res.status(201).json(result);
  } catch (error) {
    respondWithError(res, error);
  }
};

const getUserBookings = async (req, res) => {
  try {
    const result = await bookingService.getUserBookings(req.user._id);
    res.status(200).json(result);
  } catch (error) {
    respondWithError(res, error);
  }
};

const getBookingById = async (req, res) => {
  try {
    const result = await bookingService.getBookingById({ id: req.params.id }, req.user);
    res.status(200).json(result);
  } catch (error) {
    respondWithError(res, error);
  }
};

const updateBookingStatus = async (req, res) => {
  try {
    const result = await bookingService.updateBookingStatus(
      { id: req.params.id },
      {
        bookingStatus: req.body.bookingStatus,
        paymentStatus: req.body.paymentStatus
      },
      req.user
    );
    res.status(200).json(result);
  } catch (error) {
    respondWithError(res, error);
  }
};

const cancelBooking = async (req, res) => {
  try {
    const result = await bookingService.cancelBooking({ id: req.params.id }, req.user);
    res.status(200).json(result);
  } catch (error) {
    respondWithError(res, error);
  }
};

module.exports = {
  createBooking,
  getAdminBookings,
  getUserBookings,
  getAllBookings,
  getBookingById,
  updateBookingStatus,
  cancelBooking
};
