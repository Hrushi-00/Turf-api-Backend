const authService = require('./auth.service');
const crypto = require('crypto');
const { sendHttpError } = require('../../utils/http-error-response');

const canRegisterAdmin = (providedKey) => {
  const expectedKey = process.env.ADMIN_REGISTRATION_KEY;
  if (!expectedKey || typeof providedKey !== 'string') return false;
  const expected = Buffer.from(expectedKey);
  const provided = Buffer.from(providedKey);
  return expected.length === provided.length && crypto.timingSafeEqual(expected, provided);
};

const register = async (req, res) => {
  if (!canRegisterAdmin(req.get('x-admin-registration-key'))) {
    return res.status(403).json({ success: false, message: 'Admin registration is disabled or unauthorized' });
  }
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'username, email, and password are required'
      });
    }

    const result = await authService.register({ username, email, password });
    res.status(201).json(result);
  } catch (error) {
    sendHttpError(res, error);
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'email and password are required'
      });
    }

    const result = await authService.login({ email, password });
    res.status(200).json(result);
  } catch (error) {
    sendHttpError(res, error);
  }
};

const getProfile = async (req, res) => {
  try {
    const adminId = req.userId || req.user?._id;
    const result = await authService.getProfile(adminId);
    res.status(200).json(result);
  } catch (error) {
    sendHttpError(res, error);
  }
};

const updateProfile = async (req, res) => {
  try {
    const adminId = req.userId || req.user?._id;
    const { username, email } = req.body;
    const result = await authService.updateProfile(adminId, { username, email });
    res.status(200).json(result);
  } catch (error) {
    sendHttpError(res, error);
  }
};

const changePassword = async (req, res) => {
  try {
    const adminId = req.userId || req.user?._id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'currentPassword and newPassword are required'
      });
    }

    const result = await authService.changePassword(adminId, { currentPassword, newPassword });
    res.status(200).json(result);
  } catch (error) {
    sendHttpError(res, error);
  }
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword
};
