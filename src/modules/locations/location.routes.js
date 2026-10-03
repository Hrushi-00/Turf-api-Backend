const express = require('express');
const router = express.Router();
const controller = require('./location.controller');
const { validate } = require('../../middleware/validate');
const { protect, isBusinessUser } = require('../../middleware/adminMiddleware');
const { validateLocation, validateLocationId } = require('./location.validation');

router.use(protect, isBusinessUser);
router.get('/', controller.list);
router.post('/', validateLocation, validate, controller.create);
router.put('/:id', validateLocationId, validateLocation, validate, controller.update);
router.delete('/:id', validateLocationId, validate, controller.remove);
module.exports = router;
