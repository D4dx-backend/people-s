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
 * @swagger
 * /api/auth/send-otp:
 *   post:
 *     tags:
 *       - Admin Authentication
 *     summary: Send OTP for Super Admin/State Admin login
 *     description: Sends OTP to phone number for admin authentication. Static OTP 123456 available in dev mode.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *             properties:
 *               phone:
 *                 type: string
 *                 pattern: '^[6-9]\\d{9}$'
 *                 example: '9999999999'
 *                 description: 10-digit Indian mobile number
 *               purpose:
 *                 type: string
 *                 enum: [login, registration, phone_verification]
 *                 default: login
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 'OTP sent successfully'
 *                 data:
 *                   type: object
 *                   properties:
 *                     phone:
 *                       type: string
 *                       example: '9999999999'
 *                     expiresIn:
 *                       type: number
 *                       example: 10
 *                     staticOTP:
 *                       type: string
 *                       example: '123456'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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
 * @swagger
 * /api/auth/verify-otp:
 *   post:
 *     tags:
 *       - Admin Authentication
 *     summary: Verify OTP and receive JWT token
 *     description: Verifies OTP for admin authentication and returns JWT access/refresh tokens
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - otp
 *             properties:
 *               phone:
 *                 type: string
 *                 example: '9999999999'
 *               otp:
 *                 type: string
 *                 minLength: 6
 *                 maxLength: 6
 *                 example: '123456'
 *               purpose:
 *                 type: string
 *                 enum: [login, registration, phone_verification]
 *                 default: login
 *     responses:
 *       200:
 *         description: OTP verified, user authenticated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 'Login successful'
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                       example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
 *                     refreshToken:
 *                       type: string
 *                       example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       400:
 *         description: Invalid OTP or validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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
 * @swagger
 * /api/auth/complete-registration:
 *   post:
 *     tags:
 *       - Admin Authentication
 *     summary: Complete user registration
 *     description: Complete registration with user details after initial OTP verification
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tempUserId
 *               - name
 *             properties:
 *               tempUserId:
 *                 type: string
 *                 example: '507f1f77bcf86cd799439011'
 *               name:
 *                 type: string
 *                 example: 'Mohammed Ali'
 *               email:
 *                 type: string
 *                 example: 'ali@example.com'
 *               profile:
 *                 type: object
 *                 properties:
 *                   dateOfBirth:
 *                     type: string
 *                     format: date
 *                     example: '1990-01-15'
 *                   gender:
 *                     type: string
 *                     enum: [male, female, other]
 *                     example: 'male'
 *     responses:
 *       200:
 *         description: Registration completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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
 * @swagger
 * /api/auth/refresh-token:
 *   post:
 *     tags:
 *       - Admin Authentication
 *     summary: Refresh JWT access token
 *     description: Get a new access token using refresh token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
 *     responses:
 *       200:
 *         description: New access token issued
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                       example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
 *       401:
 *         description: Invalid or expired refresh token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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
 * @swagger
 * /api/auth/logout:
 *   post:
 *     tags:
 *       - Admin Authentication
 *     summary: Logout user
 *     description: Logout and invalidate tokens
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', authenticate, authController.logout);

/**
 * @swagger
 * /api/auth/profile:
 *   get:
 *     tags:
 *       - Admin Authentication
 *     summary: Get current user profile
 *     description: Retrieve authenticated user's profile information
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
/**
 * @route   GET /api/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', authenticate, authController.getProfile);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     tags:
 *       - Admin Authentication
 *     summary: Get current user profile (alias)
 *     description: Alias for /profile - retrieve authenticated user's profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile (alias for /profile)
 * @access  Private
 */
router.get('/me', authenticate, authController.getProfile);

/**
 * @swagger
 * /api/auth/profile:
 *   put:
 *     tags:
 *       - Admin Authentication
 *     summary: Update user profile
 *     description: Update authenticated user's profile information
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: 'Mohammed Ali'
 *               email:
 *                 type: string
 *                 example: 'ali@example.com'
 *               profile:
 *                 type: object
 *                 properties:
 *                   dateOfBirth:
 *                     type: string
 *                     format: date
 *                     example: '1990-01-15'
 *                   gender:
 *                     type: string
 *                     enum: [male, female, other]
 *                     example: 'male'
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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
 * @swagger
 * /api/auth/change-password:
 *   post:
 *     tags:
 *       - Admin Authentication
 *     summary: Change password
 *     description: Change own password (self-service for all roles)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 example: 'oldpass123'
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *                 example: 'newpass123'
 *     responses:
 *       200:
 *         description: Password changed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         description: Validation error or incorrect current password
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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
 * @swagger
 * /api/auth/change-phone:
 *   post:
 *     tags:
 *       - Admin Authentication
 *     summary: Change phone number
 *     description: Change phone number (requires OTP verification on new number)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newPhone
 *               - otp
 *             properties:
 *               newPhone:
 *                 type: string
 *                 pattern: '^[6-9]\d{9}$'
 *                 example: '9876543210'
 *               otp:
 *                 type: string
 *                 minLength: 6
 *                 maxLength: 6
 *                 example: '123456'
 *     responses:
 *       200:
 *         description: Phone number changed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         description: Validation error or invalid OTP
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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
 * @swagger
 * /api/auth/register-device:
 *   post:
 *     tags:
 *       - Admin Authentication
 *     summary: Register device for push notifications
 *     description: Register device token for Firebase push notifications
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - deviceId
 *               - platform
 *             properties:
 *               deviceId:
 *                 type: string
 *                 example: 'abc123xyz'
 *               platform:
 *                 type: string
 *                 enum: [android, ios, web]
 *                 example: 'android'
 *               fcmToken:
 *                 type: string
 *                 example: 'f1Vh2...FCM_TOKEN_HERE'
 *     responses:
 *       200:
 *         description: Device registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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
 * @swagger
 * /api/auth/status:
 *   get:
 *     tags:
 *       - Admin Authentication
 *     summary: Check authentication status
 *     description: Verify if JWT token is valid and get auth status
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Authentication status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     authenticated:
 *                       type: boolean
 *                       example: true
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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