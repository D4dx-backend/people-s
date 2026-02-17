const express = require('express');
const router = express.Router();
const errorLogController = require('../controllers/errorLogController');
const { authenticate, hasPermission } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/error-logs
 * @desc    Get error logs with filters and pagination
 * @access  Requires error_logs.read permission
 */
router.get('/',
  hasPermission('error_logs.read'),
  errorLogController.getErrorLogs
);

/**
 * @route   GET /api/error-logs/stats
 * @desc    Get error statistics
 * @access  Requires error_logs.read permission
 */
router.get('/stats',
  hasPermission('error_logs.read'),
  errorLogController.getErrorStats
);

/**
 * @route   GET /api/error-logs/grouped
 * @desc    Get grouped errors (unique errors with occurrence counts)
 * @access  Requires error_logs.read permission
 */
router.get('/grouped',
  hasPermission('error_logs.read'),
  errorLogController.getGroupedErrors
);

/**
 * @route   GET /api/error-logs/export
 * @desc    Export error logs (JSON/CSV)
 * @access  Requires error_logs.export permission
 */
router.get('/export',
  hasPermission('error_logs.export'),
  errorLogController.exportErrorLogs
);

/**
 * @route   GET /api/error-logs/:id
 * @desc    Get error log by ID
 * @access  Requires error_logs.read permission
 */
router.get('/:id',
  hasPermission('error_logs.read'),
  errorLogController.getErrorById
);

/**
 * @route   PATCH /api/error-logs/:id/resolve
 * @desc    Mark error as resolved
 * @access  Requires error_logs.manage permission
 */
router.patch('/:id/resolve',
  hasPermission('error_logs.manage'),
  errorLogController.markResolved
);

/**
 * @route   DELETE /api/error-logs/cleanup
 * @desc    Clean old error logs
 * @access  Requires error_logs.delete permission
 */
router.delete('/cleanup',
  hasPermission('error_logs.delete'),
  errorLogController.cleanOldLogs
);

module.exports = router;
