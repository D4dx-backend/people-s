const LoginLogService = require('../services/loginLogService');
const ResponseHelper = require('../utils/responseHelper');

class LoginLogController {
  /**
   * Get login logs with filters and pagination
   * GET /api/login-logs
   */
  async getLoginLogs(req, res) {
    try {
      const result = await LoginLogService.getLoginLogs(req.query);
      return ResponseHelper.success(res, result, 'Login logs retrieved successfully');
    } catch (error) {
      console.error('❌ Get Login Logs Error:', error);
      return ResponseHelper.error(res, 'Failed to retrieve login logs', 500);
    }
  }

  /**
   * Get login statistics
   * GET /api/login-logs/stats
   */
  async getLoginStats(req, res) {
    try {
      const result = await LoginLogService.getLoginStats(req.query);
      return ResponseHelper.success(res, result, 'Login stats retrieved successfully');
    } catch (error) {
      console.error('❌ Get Login Stats Error:', error);
      return ResponseHelper.error(res, 'Failed to retrieve login stats', 500);
    }
  }

  /**
   * Get suspicious login activity
   * GET /api/login-logs/suspicious
   */
  async getSuspiciousActivity(req, res) {
    try {
      const { hours = 24, failThreshold = 5 } = req.query;
      const result = await LoginLogService.getSuspiciousActivity({
        hours: parseInt(hours),
        failThreshold: parseInt(failThreshold)
      });
      return ResponseHelper.success(res, result, 'Suspicious activity retrieved successfully');
    } catch (error) {
      console.error('❌ Get Suspicious Activity Error:', error);
      return ResponseHelper.error(res, 'Failed to retrieve suspicious activity', 500);
    }
  }

  /**
   * Get device breakdown
   * GET /api/login-logs/devices
   */
  async getDeviceBreakdown(req, res) {
    try {
      const result = await LoginLogService.getDeviceBreakdown(req.query);
      return ResponseHelper.success(res, result, 'Device breakdown retrieved successfully');
    } catch (error) {
      console.error('❌ Get Device Breakdown Error:', error);
      return ResponseHelper.error(res, 'Failed to retrieve device breakdown', 500);
    }
  }

  /**
   * Get location breakdown
   * GET /api/login-logs/locations
   */
  async getLocationBreakdown(req, res) {
    try {
      const result = await LoginLogService.getLocationBreakdown(req.query);
      return ResponseHelper.success(res, result, 'Location breakdown retrieved successfully');
    } catch (error) {
      console.error('❌ Get Location Breakdown Error:', error);
      return ResponseHelper.error(res, 'Failed to retrieve location breakdown', 500);
    }
  }

  /**
   * Get OTP statistics
   * GET /api/login-logs/otp-stats
   */
  async getOTPStats(req, res) {
    try {
      const result = await LoginLogService.getOTPStats(req.query);
      return ResponseHelper.success(res, result, 'OTP stats retrieved successfully');
    } catch (error) {
      console.error('❌ Get OTP Stats Error:', error);
      return ResponseHelper.error(res, 'Failed to retrieve OTP stats', 500);
    }
  }

  /**
   * Get user login history
   * GET /api/login-logs/users/:userId/history
   */
  async getUserLoginHistory(req, res) {
    try {
      const { userId } = req.params;
      const result = await LoginLogService.getUserLoginHistory(userId, req.query);
      return ResponseHelper.success(res, result, 'User login history retrieved successfully');
    } catch (error) {
      console.error('❌ Get User Login History Error:', error);
      return ResponseHelper.error(res, 'Failed to retrieve user login history', 500);
    }
  }

  /**
   * Export login logs
   * GET /api/login-logs/export
   */
  async exportLoginLogs(req, res) {
    try {
      const { format = 'json', ...filters } = req.query;
      const result = await LoginLogService.exportLogs({ format, ...filters });

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=login_logs_${new Date().toISOString().split('T')[0]}.csv`);
        return res.send(result);
      }

      return ResponseHelper.success(res, { logs: result }, 'Login logs exported successfully');
    } catch (error) {
      console.error('❌ Export Login Logs Error:', error);
      return ResponseHelper.error(res, 'Failed to export login logs', 500);
    }
  }

  /**
   * Clean old login logs
   * DELETE /api/login-logs/cleanup
   */
  async cleanOldLogs(req, res) {
    try {
      const { daysToKeep = 365 } = req.body;
      const result = await LoginLogService.cleanOldLogs(parseInt(daysToKeep));
      return ResponseHelper.success(res, result, `Cleaned ${result.deletedCount} old login logs`);
    } catch (error) {
      console.error('❌ Clean Login Logs Error:', error);
      return ResponseHelper.error(res, 'Failed to clean old login logs', 500);
    }
  }
}

module.exports = new LoginLogController();
