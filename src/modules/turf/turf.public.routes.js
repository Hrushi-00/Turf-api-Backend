const express = require('express');
const router = express.Router();
const { query, param } = require('express-validator');
const { validate } = require('../../middleware/validate');
const turfController = require('./turf.controller');

const validateTurfFilters = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('city')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('City name must not exceed 50 characters'),
  query('sport')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('Sport name must not exceed 50 characters'),
  query('featured')
    .optional()
    .isBoolean().withMessage('Featured must be a boolean'),
  query('trending')
    .optional()
    .isBoolean().withMessage('Trending must be a boolean'),
  query('minPrice').optional().isFloat({ min: 0 }).withMessage('Minimum price must be non-negative'),
  query('maxPrice').optional().isFloat({ min: 0 }).withMessage('Maximum price must be non-negative')
    .bail().custom((value, { req }) => req.query.minPrice === undefined || Number(req.query.minPrice) <= Number(value))
    .withMessage('Minimum price must not exceed maximum price'),
  query('q').optional().trim().isLength({ max: 100 }).withMessage('Search query must not exceed 100 characters')
];

const validateTurfParam = [param('id').isMongoId().withMessage('Invalid turf ID format')];
const validateAvailabilityQuery = [
  ...validateTurfParam,
  query('date').optional().isDate({ format: 'YYYY-MM-DD', strictMode: true }).withMessage('Date must use YYYY-MM-DD format')
];

router.get('/', validateTurfFilters, validate, turfController.getAllTurfs);
router.get('/approved/list', turfController.getApprovedTurfs);
router.get('/featured', turfController.getFeaturedTurfs);
router.get('/trending', turfController.getTrendingTurfs);
router.get('/:id/availability', validateAvailabilityQuery, validate, turfController.getTurfAvailability);
router.get('/:id', validateTurfParam, validate, turfController.getTurf);

module.exports = router;
