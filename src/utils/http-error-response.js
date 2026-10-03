const sendHttpError = (res, error) => {
  const statusCode = error.statusCode || (error.code === 11000 ? 409 : error.name === 'ValidationError' || error.name === 'CastError' ? 400 : 500);
  return res.status(statusCode).json({
    success: false,
    message: statusCode >= 500 ? 'Internal server error' : error.message
  });
};

module.exports = { sendHttpError };
