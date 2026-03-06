const ActivityLogService = require('../services/activityLogService');
const { logActivity } = require('../middleware/activityLogger');
const { buildFranchiseReadFilter, buildFranchiseMatchStage, getWriteFranchiseId } = require('../utils/franchiseFilterHelper');

class ActivityLogController {
  /**
   * Get activity logs with filters and pagination
   */
  static async getActivityLogs(req, res) {
    try {
      const {
        page = 1,
        limit = 50,
        sortBy = 'timestamp',
        sortOrder = 'desc',
        userId,
        action,
        resource,
        status,
        severity,
        startDate,
        endDate,
        search,
        ipAddress
      } = req.query;

      // Build filters
      const filters = {};
      if (userId) filters.userId = userId;
      if (action) filters.action = action;
      if (resource) filters.resource = resource;
      if (status) filters.status = status;
      if (severity) filters.severity = severity;
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;
      if (search) filters.search = search;
      if (ipAddress) filters.ipAddress = ipAddress;
      Object.assign(filters, buildFranchiseReadFilter(req));

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sortBy,
        sortOrder,
        populate: true
      };

      const result = await ActivityLogService.getActivityLogs(filters, options);

      // Log this activity
      await logActivity(req, {
        action: 'data_accessed',
        resource: 'activity_log',
        description: `${req.user.name} accessed activity logs`,
        details: { filters, options }
      });

      res.json({
        success: true,
        message: 'Activity logs retrieved successfully',
        data: result
      });

    } catch (error) {
      console.error('❌ Get Activity Logs Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve activity logs',
        error: error.message
      });
    }
  }

  /**
   * Get activity statistics
   */
  static async getActivityStats(req, res) {
    try {
      const {
        startDate,
        endDate,
        userId
      } = req.query;

      const filters = {};
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;
      if (userId) filters.userId = userId;

      const stats = await ActivityLogService.getActivityStats(filters);

      // Log this activity
      await logActivity(req, {
        action: 'report_generated',
        resource: 'activity_log',
        description: `${req.user.name} generated activity statistics`,
        details: { filters }
      });

      res.json({
        success: true,
        message: 'Activity statistics retrieved successfully',
        data: stats
      });

    } catch (error) {
      console.error('❌ Get Activity Stats Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve activity statistics',
        error: error.message
      });
    }
  }

  /**
   * Get user activity summary
   */
  static async getUserActivitySummary(req, res) {
    try {
      const { userId } = req.params;
      const { days = 30 } = req.query;

      const summary = await ActivityLogService.getUserActivitySummary(
        userId, 
        parseInt(days)
      );

      // Log this activity
      await logActivity(req, {
        action: 'report_generated',
        resource: 'user',
        resourceId: userId,
        description: `${req.user.name} generated user activity summary for user ${userId}`,
        details: { days: parseInt(days) }
      });

      res.json({
        success: true,
        message: 'User activity summary retrieved successfully',
        data: summary
      });

    } catch (error) {
      console.error('❌ Get User Activity Summary Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve user activity summary',
        error: error.message
      });
    }
  }

  /**
   * Export activity logs
   */
  static async exportActivityLogs(req, res) {
    try {
      const {
        format = 'json',
        userId,
        action,
        resource,
        status,
        severity,
        startDate,
        endDate,
        search
      } = req.query;

      // Build filters
      const filters = {};
      if (userId) filters.userId = userId;
      if (action) filters.action = action;
      if (resource) filters.resource = resource;
      if (status) filters.status = status;
      if (severity) filters.severity = severity;
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;
      if (search) filters.search = search;

      const data = await ActivityLogService.exportLogs(filters, format);

      // Log this activity
      await logActivity(req, {
        action: 'data_export',
        resource: 'activity_log',
        description: `${req.user.name} exported activity logs in ${format} format`,
        details: { filters, format },
        severity: 'medium'
      });

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=activity_logs.csv');
        res.send(data);
      } else {
        res.json({
          success: true,
          message: 'Activity logs exported successfully',
          data
        });
      }

    } catch (error) {
      console.error('❌ Export Activity Logs Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to export activity logs',
        error: error.message
      });
    }
  }

  /**
   * Get activity log by ID
   */
  static async getActivityLogById(req, res) {
    try {
      const { id } = req.params;

      const log = await ActivityLogService.getActivityLogs(
        { _id: id },
        { limit: 1, populate: true }
      );

      if (!log.logs || log.logs.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Activity log not found'
        });
      }

      // Log this activity
      await logActivity(req, {
        action: 'data_accessed',
        resource: 'activity_log',
        resourceId: id,
        description: `${req.user.name} viewed activity log details`,
        details: { logId: id }
      });

      res.json({
        success: true,
        message: 'Activity log retrieved successfully',
        data: log.logs[0]
      });

    } catch (error) {
      console.error('❌ Get Activity Log By ID Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve activity log',
        error: error.message
      });
    }
  }

  /**
   * Get activity log filters/options
   */
  static async getActivityLogFilters(req, res) {
    try {
      const { ActivityLog } = require('../models');

      // Get distinct values for filters
      const [actions, resources, statuses, severities] = await Promise.all([
        ActivityLog.distinct('action'),
        ActivityLog.distinct('resource'),
        ActivityLog.distinct('status'),
        ActivityLog.distinct('severity')
      ]);

      const filters = {
        actions: actions.sort(),
        resources: resources.sort(),
        statuses: statuses.sort(),
        severities: severities.sort()
      };

      res.json({
        success: true,
        message: 'Activity log filters retrieved successfully',
        data: filters
      });

    } catch (error) {
      console.error('❌ Get Activity Log Filters Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve activity log filters',
        error: error.message
      });
    }
  }

  /**
   * Clean old activity logs (admin only)
   */
  static async cleanOldLogs(req, res) {
    try {
      const { daysToKeep = 365 } = req.body;

      const result = await ActivityLogService.cleanOldLogs(parseInt(daysToKeep));

      // Log this activity
      await logActivity(req, {
        action: 'system_maintenance',
        resource: 'activity_log',
        description: `${req.user.name} cleaned old activity logs (${daysToKeep} days retention)`,
        details: { daysToKeep: parseInt(daysToKeep), deletedCount: result.deletedCount },
        severity: 'high'
      });

      res.json({
        success: true,
        message: 'Old activity logs cleaned successfully',
        data: result
      });

    } catch (error) {
      console.error('❌ Clean Old Logs Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to clean old logs',
        error: error.message
      });
    }
  }

  /**
   * Get recent activity (dashboard widget)
   */
  static async getRecentActivity(req, res) {
    try {
      const { limit = 10 } = req.query;

      const recentActivity = await ActivityLogService.getRecentActivity(
        { isDeleted: false },
        parseInt(limit)
      );

      res.json({
        success: true,
        message: 'Recent activity retrieved successfully',
        data: recentActivity
      });

    } catch (error) {
      console.error('❌ Get Recent Activity Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve recent activity',
        error: error.message
      });
    }
  }

  /**
   * Get activity trends (for charts)
   */
  static async getActivityTrends(req, res) {
    try {
      const {
        period = '7d', // 7d, 30d, 90d, 1y
        groupBy = 'day' // hour, day, week, month
      } = req.query;

      const { ActivityLog } = require('../models');

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      
      switch (period) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
        case '1y':
          startDate.setFullYear(endDate.getFullYear() - 1);
          break;
      }

      // Build aggregation pipeline
      let dateFormat;
      switch (groupBy) {
        case 'hour':
          dateFormat = '%Y-%m-%d %H:00';
          break;
        case 'day':
          dateFormat = '%Y-%m-%d';
          break;
        case 'week':
          dateFormat = '%Y-W%U';
          break;
        case 'month':
          dateFormat = '%Y-%m';
          break;
      }

      const pipeline = [
        {
          $match: {
            timestamp: { $gte: startDate, $lte: endDate },
            isDeleted: false
          }
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: dateFormat,
                date: '$timestamp'
              }
            },
            total: { $sum: 1 },
            success: {
              $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] }
            },
            failed: {
              $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
            },
            actions: { $addToSet: '$action' }
          }
        },
        { $sort: { _id: 1 } }
      ];

      const trends = await ActivityLog.aggregate(pipeline);

      res.json({
        success: true,
        message: 'Activity trends retrieved successfully',
        data: {
          trends,
          period,
          groupBy,
          startDate,
          endDate
        }
      });

    } catch (error) {
      console.error('❌ Get Activity Trends Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve activity trends',
        error: error.message
      });
    }
  }
}

module.exports = ActivityLogController;