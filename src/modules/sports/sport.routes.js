const express = require('express');
const router = express.Router();
const controller = require('./sport.controller');
const { validate } = require('../../middleware/validate');
const { protect, isAdmin } = require('../../middleware/adminMiddleware');
const { validateSport, validateSportUpdate } = require('./sport.validation');

router.get('/', controller.list);
router.use('/admin', protect, isAdmin);
router.get('/admin', controller.listAll);
router.post('/admin', validateSport, validate, controller.create);
router.patch('/admin/:id', validateSportUpdate, validate, controller.update);
module.exports = router;
