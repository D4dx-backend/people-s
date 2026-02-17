const express = require('express');
const router = express.Router();
const loginLogController = require('../controllers/loginLogController');
const { authenticate, hasPermission } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/login-logs
 * @desc    Get login logs with filters and pagination
 * @access  Requires login_logs.read permission
 */
router.get('/',
  hasPermission('login_logs.read'),
  loginLogController.getLoginLogs
);

/**
 * @route   GET /api/login-logs/stats
 * @desc    Get login statistics
 * @access  Requires login_logs.read permission
 */
router.get('/stats',
  hasPermission('login_logs.read'),
  loginLogController.getLoginStats
);

/**
 * @route   GET /api/login-logs/suspicious
 * @desc    Get suspicious login activity
 * @access  Requires login_logs.read permission
 */
router.get('/suspicious',
  hasPermission('login_logs.read'),
  loginLogController.getSuspiciousActivity
);

/**
 * @route   GET /api/login-logs/devices
 * @desc    Get device breakdown
 * @access  Requires login_logs.read permission
 */
router.get('/devices',
  hasPermission('login_logs.read'),
  loginLogController.getDeviceBreakdown
);

/**
 * @route   GET /api/login-logs/locations
 * @desc    Get location breakdown
 * @access  Requires login_logs.read permission
 */
router.get('/locations',
  hasPermission('login_logs.read'),
  loginLogController.getLocationBreakdown
);

/**
 * @route   GET /api/login-logs/otp-stats
 * @desc    Get OTP statistics
 * @access  Requires login_logs.read permission
 */
router.get('/otp-stats',
  hasPermission('login_logs.read'),
  loginLogController.getOTPStats
);

/**
 * @route   GET /api/login-logs/export
 * @desc    Export login logs (JSON/CSV)
 * @access  Requires login_logs.export permission
 */
router.get('/export',
  hasPermission('login_logs.export'),
  loginLogController.exportLoginLogs
);

/**
 * @route   GET /api/login-logs/users/:userId/history
 * @desc    Get login history for a specific user
 * @access  Requires login_logs.read permission
 */
router.get('/users/:userId/history',
  hasPermission('login_logs.read'),
  loginLogController.getUserLoginHistory
);

/**
 * @route   DELETE /api/login-logs/cleanup
 * @desc    Clean old login logs
 * @access  Requires login_logs.delete permission
 */
router.delete('/cleanup',
  hasPermission('login_logs.delete'),
  loginLogController.cleanOldLogs
);

module.exports = router;
