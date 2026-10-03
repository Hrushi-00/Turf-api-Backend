const express = require('express');
const router = express.Router();
const userController = require('./user.controller');
const { validate } = require('../../middleware/validate');
const { protectUser } = require('../../middleware/userAuthMiddleware');
const { validateUserSignup, validateUserLogin, validateUpdateProfile, validateChangePassword } = require('./user.validation');

router.post('/signup', validateUserSignup, validate, userController.signup);
router.post('/login', validateUserLogin, validate, userController.login);
router.post('/refresh-token', userController.refresh);
router.post('/logout', protectUser, userController.logout);
router.get('/profile', protectUser, userController.getProfile);
router.put('/profile', protectUser, validateUpdateProfile, validate, userController.updateProfile);
router.patch('/password', protectUser, validateChangePassword, validate, userController.changePassword);
router.delete('/account', protectUser, userController.deleteAccount);

module.exports = router;
