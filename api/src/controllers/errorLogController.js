const ErrorLogService = require('../services/errorLogService');
const ResponseHelper = require('../utils/responseHelper');

class ErrorLogController {
  /**
   * Get error logs with filters and pagination
   * GET /api/error-logs
   */
  async getErrorLogs(req, res) {
    try {
      const result = await ErrorLogService.getErrorLogs(req.query);
      return ResponseHelper.success(res, result, 'Error logs retrieved successfully');
    } catch (error) {
      console.error('❌ Get Error Logs Error:', error);
      return ResponseHelper.error(res, 'Failed to retrieve error logs', 500);
    }
  }

  /**
   * Get error statistics
   * GET /api/error-logs/stats
   */
  async getErrorStats(req, res) {
    try {
      const result = await ErrorLogService.getErrorStats(req.query);
      return ResponseHelper.success(res, result, 'Error stats retrieved successfully');
    } catch (error) {
      console.error('❌ Get Error Stats Error:', error);
      return ResponseHelper.error(res, 'Failed to retrieve error stats', 500);
    }
  }

  /**
   * Get grouped errors (unique errors with occurrence counts)
   * GET /api/error-logs/grouped
   */
  async getGroupedErrors(req, res) {
    try {
      const result = await ErrorLogService.getGroupedErrors(req.query);
      return ResponseHelper.success(res, result, 'Grouped errors retrieved successfully');
    } catch (error) {
      console.error('❌ Get Grouped Errors Error:', error);
      return ResponseHelper.error(res, 'Failed to retrieve grouped errors', 500);
    }
  }

  /**
   * Get error by ID
   * GET /api/error-logs/:id
   */
  async getErrorById(req, res) {
    try {
      const errorLog = await ErrorLogService.getErrorById(req.params.id);
      if (!errorLog) {
        return ResponseHelper.error(res, 'Error log not found', 404);
      }
      return ResponseHelper.success(res, errorLog, 'Error log retrieved successfully');
    } catch (error) {
      console.error('❌ Get Error By ID Error:', error);
      return ResponseHelper.error(res, 'Failed to retrieve error log', 500);
    }
  }

  /**
   * Mark error as resolved
   * PATCH /api/error-logs/:id/resolve
   */
  async markResolved(req, res) {
    try {
      const { note = '' } = req.body;
      const result = await ErrorLogService.markResolved(req.params.id, req.user._id, note);
      return ResponseHelper.success(res, result, 'Error marked as resolved');
    } catch (error) {
      console.error('❌ Mark Error Resolved Error:', error);
      return ResponseHelper.error(res, error.message || 'Failed to mark error as resolved', 500);
    }
  }

  /**
   * Export error logs
   * GET /api/error-logs/export
   */
  async exportErrorLogs(req, res) {
    try {
      const { format = 'json', ...filters } = req.query;
      const result = await ErrorLogService.exportLogs({ format, ...filters });

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=error_logs_${new Date().toISOString().split('T')[0]}.csv`);
        return res.send(result);
      }

      return ResponseHelper.success(res, { logs: result }, 'Error logs exported successfully');
    } catch (error) {
      console.error('❌ Export Error Logs Error:', error);
      return ResponseHelper.error(res, 'Failed to export error logs', 500);
    }
  }

  /**
   * Clean old error logs
   * DELETE /api/error-logs/cleanup
   */
  async cleanOldLogs(req, res) {
    try {
      const { daysToKeep = 90 } = req.body;
      const result = await ErrorLogService.cleanOldLogs(parseInt(daysToKeep));
      return ResponseHelper.success(res, result, `Cleaned ${result.deletedCount} old error logs`);
    } catch (error) {
      console.error('❌ Clean Error Logs Error:', error);
      return ResponseHelper.error(res, 'Failed to clean old error logs', 500);
    }
  }
}

module.exports = new ErrorLogController();
