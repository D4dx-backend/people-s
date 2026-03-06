const express = require('express');
const router = express.Router();
const ActivityLogController = require('../controllers/activityLogController');
const { authenticate, crossFranchiseResolver, hasPermission } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);
router.use(crossFranchiseResolver);

/**
 * @route   GET /api/activity-logs
 * @desc    Get activity logs with filters and pagination
 * @access  Super Admin only
 */
router.get('/', 
  hasPermission('activity_logs.read'),
  ActivityLogController.getActivityLogs
);

/**
 * @route   GET /api/activity-logs/stats
 * @desc    Get activity statistics
 * @access  Super Admin only
 */
router.get('/stats',
  hasPermission('activity_logs.read'),
  ActivityLogController.getActivityStats
);

/**
 * @route   GET /api/activity-logs/trends
 * @desc    Get activity trends for charts
 * @access  Super Admin only
 */
router.get('/trends',
  hasPermission('activity_logs.read'),
  ActivityLogController.getActivityTrends
);

/**
 * @route   GET /api/activity-logs/recent
 * @desc    Get recent activity (dashboard widget)
 * @access  Super Admin only
 */
router.get('/recent',
  hasPermission('activity_logs.read'),
  ActivityLogController.getRecentActivity
);

/**
 * @route   GET /api/activity-logs/filters
 * @desc    Get available filter options
 * @access  Super Admin only
 */
router.get('/filters',
  hasPermission('activity_logs.read'),
  ActivityLogController.getActivityLogFilters
);

/**
 * @route   GET /api/activity-logs/export
 * @desc    Export activity logs
 * @access  Super Admin only
 */
router.get('/export',
  hasPermission('activity_logs.export'),
  ActivityLogController.exportActivityLogs
);

/**
 * @route   GET /api/activity-logs/users/:userId/summary
 * @desc    Get user activity summary
 * @access  Super Admin only
 */
router.get('/users/:userId/summary',
  hasPermission('activity_logs.read'),
  ActivityLogController.getUserActivitySummary
);

/**
 * @route   GET /api/activity-logs/:id
 * @desc    Get activity log by ID
 * @access  Super Admin only
 */
router.get('/:id',
  hasPermission('activity_logs.read'),
  ActivityLogController.getActivityLogById
);

/**
 * @route   DELETE /api/activity-logs/cleanup
 * @desc    Clean old activity logs
 * @access  Super Admin only
 */
router.delete('/cleanup',
  hasPermission('activity_logs.delete'),
  ActivityLogController.cleanOldLogs
);

module.exports = router;