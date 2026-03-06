const express = require('express');
const router = express.Router();
const regionalAdminController = require('../controllers/regionalAdminController');
const { authenticate, crossFranchiseResolver, authorize } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const { body, param, query } = require('express-validator');

// =================================================================
// REGIONAL ADMIN ROUTES (Unit Admin, Area Admin, District Admin)
// =================================================================

// ============ AUTHENTICATION ROUTES (Public) ============
router.post('/auth/send-otp', [
  body('phone')
    .notEmpty()
    .withMessage('Phone number is required')
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Please enter a valid Indian mobile number'),
  validateRequest
], regionalAdminController.sendOTP);

router.post('/auth/verify-otp', [
  body('phone')
    .notEmpty()
    .withMessage('Phone number is required')
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Please enter a valid Indian mobile number'),
  body('otp')
    .notEmpty()
    .withMessage('OTP is required')
    .isLength({ min: 6, max: 6 })
    .withMessage('OTP must be 6 digits'),
  validateRequest
], regionalAdminController.verifyOTP);

// ============ PROFILE ROUTES (Protected) ============
router.get('/auth/profile',
  authenticate, crossFranchiseResolver,
  authorize('unit_admin', 'area_admin', 'district_admin'),
  regionalAdminController.getProfile
);

// ============ APPLICATION MANAGEMENT ROUTES (Protected) ============

// Get applications list (READ ONLY for unit_admin and district_admin)
router.get('/applications',
  authenticate, crossFranchiseResolver,
  authorize('unit_admin', 'area_admin', 'district_admin'),
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('status').optional().isIn(['pending', 'under_review', 'approved', 'rejected', 'completed', 'cancelled']),
    query('sortBy').optional().isIn(['createdAt', 'applicationNumber', 'status', 'requestedAmount']),
    query('sortOrder').optional().isIn(['asc', 'desc']),
    validateRequest
  ],
  regionalAdminController.getApplications
);

// Get single application details
router.get('/applications/:id',
  authenticate, crossFranchiseResolver,
  authorize('unit_admin', 'area_admin', 'district_admin'),
  [
    param('id').isMongoId().withMessage('Invalid application ID'),
    validateRequest
  ],
  regionalAdminController.getApplicationDetails
);

// Update application status (AREA ADMIN ONLY)
router.put('/applications/:id/status',
  authenticate, crossFranchiseResolver,
  authorize('area_admin'), // Only area admin can update status
  [
    param('id').isMongoId().withMessage('Invalid application ID'),
    body('status')
      .notEmpty()
      .withMessage('Status is required')
      .isIn(['under_review', 'approved', 'rejected'])
      .withMessage('Invalid status. Must be: under_review, approved, or rejected'),
    body('comments')
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Comments must not exceed 1000 characters'),
    body('approvedAmount')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Approved amount must be a positive number'),
    validateRequest
  ],
  regionalAdminController.updateApplicationStatus
);

// ============ DASHBOARD ROUTES (Protected) ============

// Get dashboard statistics
router.get('/dashboard/stats',
  authenticate, crossFranchiseResolver,
  authorize('unit_admin', 'area_admin', 'district_admin'),
  regionalAdminController.getDashboardStats
);

module.exports = router;
