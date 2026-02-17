const express = require('express');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { validationResult } = require('express-validator');

// Simple validation middleware for express-validator
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};
const { body } = require('express-validator');

const router = express.Router();

/**
 * @route   POST /api/auth/send-otp
 * @desc    Send OTP for login or registration
 * @access  Public
 */
router.post('/send-otp', [
  body('phone')
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Please enter a valid 10-digit Indian mobile number'),
  body('purpose')
    .optional()
    .isIn(['login', 'registration', 'phone_verification'])
    .withMessage('Invalid OTP purpose'),
  validateRequest
], authController.sendOTP);

/**
 * @route   POST /api/auth/verify-otp
 * @desc    Verify OTP and login (OTP-only authentication)
 * @access  Public
 */
router.post('/verify-otp', [
  body('phone')
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Please enter a valid 10-digit Indian mobile number'),
  body('otp')
    .isLength({ min: 6, max: 6 })
    .withMessage('OTP must be 6 digits'),
  body('purpose')
    .optional()
    .isIn(['login', 'registration', 'phone_verification'])
    .withMessage('Invalid OTP purpose'),
  validateRequest
], authController.verifyOTP);

/**
 * @route   POST /api/auth/complete-registration
 * @desc    Complete registration after OTP verification
 * @access  Public
 */
router.post('/complete-registration', [
  body('tempUserId')
    .isMongoId()
    .withMessage('Invalid temporary user ID'),
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please enter a valid email address'),
  body('profile.dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Please enter a valid date of birth'),
  body('profile.gender')
    .optional()
    .isIn(['male', 'female', 'other'])
    .withMessage('Invalid gender'),
  validateRequest
], authController.completeRegistration);

/**
 * @route   POST /api/auth/refresh-token
 * @desc    Refresh access token
 * @access  Public
 */
router.post('/refresh-token', [
  body('refreshToken')
    .notEmpty()
    .withMessage('Refresh token is required'),
  validateRequest
], authController.refreshToken);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', authenticate, authController.logout);

/**
 * @route   GET /api/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', authenticate, authController.getProfile);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile (alias for /profile)
 * @access  Private
 */
router.get('/me', authenticate, authController.getProfile);

/**
 * @route   PUT /api/auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile', authenticate, [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please enter a valid email address'),
  body('profile.dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Please enter a valid date of birth'),
  body('profile.gender')
    .optional()
    .isIn(['male', 'female', 'other'])
    .withMessage('Invalid gender'),
  validateRequest
], authController.updateProfile);

/**
 * @route   POST /api/auth/change-password
 * @desc    Change own password (self-service for all roles)
 * @access  Private
 */
router.post('/change-password', authenticate, [
  body('currentPassword')
    .optional(),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters'),
  validateRequest
], authController.changePassword);

/**
 * @route   POST /api/auth/change-phone
 * @desc    Change phone number (requires OTP verification)
 * @access  Private
 */
router.post('/change-phone', authenticate, [
  body('newPhone')
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Please enter a valid 10-digit Indian mobile number'),
  body('otp')
    .isLength({ min: 6, max: 6 })
    .withMessage('OTP must be 6 digits'),
  validateRequest
], authController.changePhone);

/**
 * @route   POST /api/auth/register-device
 * @desc    Register device for push notifications
 * @access  Private
 */
router.post('/register-device', authenticate, [
  body('deviceId')
    .notEmpty()
    .withMessage('Device ID is required'),
  body('platform')
    .isIn(['android', 'ios', 'web'])
    .withMessage('Invalid platform'),
  body('fcmToken')
    .optional()
    .notEmpty()
    .withMessage('FCM token cannot be empty if provided'),
  validateRequest
], authController.registerDevice);

/**
 * @route   GET /api/auth/status
 * @desc    Check authentication status
 * @access  Private
 */
router.get('/status', authenticate, authController.checkAuthStatus);

/**
 * @route   GET /api/auth/test-sms
 * @desc    Test DXing SMS service connection (Admin only)
 * @access  Private (Super Admin, State Admin)
 */
router.get('/test-sms', authenticate, authController.testSMSService);

module.exports = router;