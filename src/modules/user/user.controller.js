const userService = require('./user.service');
const { sendHttpError } = require('../../utils/http-error-response');

const signup = async (req, res) => {
  try {
    const { name, email, password, contactNumber, address, profileImage } = req.body;

    if (!name || !email || !password || !contactNumber) {
      return res.status(400).json({
        success: false,
        message: 'name, email, password, and contactNumber are required'
      });
    }

    const result = await userService.signup({ name, email, password, contactNumber, address, profileImage });
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

    const result = await userService.login({ email, password });
    res.status(200).json(result);
  } catch (error) {
    sendHttpError(res, error);
  }
};

const refresh = async (req, res) => {
  try {
    const result = await userService.refresh(req.body.refreshToken);
    res.status(200).json(result);
  } catch (error) {
    sendHttpError(res, error);
  }
};

const logout = async (req, res) => {
  try {
    const result = await userService.logout(req.userId || req.user?._id);
    res.status(200).json(result);
  } catch (error) {
    sendHttpError(res, error);
  }
};

const getProfile = async (req, res) => {
  try {
    const userId = req.userId || req.user?._id;
    const result = await userService.getProfile(userId);
    res.json(result);
  } catch (error) {
    sendHttpError(res, error);
  }
};

const updateProfile = async (req, res) => {
  try {
    const userId = req.userId || req.user?._id;
    const { name, email, contactNumber, address, profileImage } = req.body;
    const result = await userService.updateProfile(userId, { name, email, contactNumber, address, profileImage });
    res.status(200).json(result);
  } catch (error) {
    sendHttpError(res, error);
  }
};

const changePassword = async (req, res) => {
  try {
    const userId = req.userId || req.user?._id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'currentPassword and newPassword are required'
      });
    }

    const result = await userService.changePassword(userId, { currentPassword, newPassword });
    res.status(200).json(result);
  } catch (error) {
    sendHttpError(res, error);
  }
};

const deleteAccount = async (req, res) => {
  try {
    const userId = req.userId || req.user?._id;
    const result = await userService.deleteAccount(userId);
    res.status(200).json(result);
  } catch (error) {
    sendHttpError(res, error);
  }
};

module.exports = {
  signup,
  login,
  refresh,
  logout,
  getProfile,
  updateProfile,
  changePassword,
  deleteAccount
};
