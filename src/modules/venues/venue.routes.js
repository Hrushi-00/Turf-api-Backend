const express = require('express');
const router = express.Router();
const controller = require('./venue.controller');
const facilityController = require('./facility.controller');
const { validate } = require('../../middleware/validate');
const { param, query } = require('express-validator');
const { venueId, validatePublicQuery } = require('./venue.validation');

router.get('/facilities/:id/availability', [param('id').isMongoId(), query('date').isDate({ format: 'YYYY-MM-DD', strictMode: true })], validate, facilityController.publicAvailability);
router.get('/', validatePublicQuery, validate, controller.publicList);
router.get('/:id', venueId, validate, controller.publicDetails);
module.exports = router;
