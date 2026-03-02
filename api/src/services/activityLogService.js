const { ActivityLog } = require('../models');
const geoip = require('geoip-lite');

class ActivityLogService {
  /**
   * Log an activity
   */
  static async logActivity({
    userId,
    action,
    resource,
    resourceId = null,
    description,
    details = {},
    req = null,
    status = 'success',
    severity = 'low',
    /** Explicit franchise override. If omitted, auto-extracted from req.franchiseId */
    franchise = undefined
  }) {
    try {
      const logData = {
        userId,
        action,
        resource,
        resourceId,
        description,
        details,
        status,
        severity,
        timestamp: new Date()
      };

      // Extract request information if available
      if (req) {
        logData.ipAddress = this.getClientIP(req);
        logData.userAgent = req.get('User-Agent') || '';

        // Auto-inject franchise from request context (multi-tenant)
        logData.franchise = franchise !== undefined ? franchise : (req.franchiseId || null);
        
        // Get geographic location from IP
        const geo = geoip.lookup(logData.ipAddress);
        if (geo) {
          logData.location = {
            country: geo.country,
            region: geo.region,
            city: geo.city
          };
        }

        // Add metadata
        logData.metadata = {
          endpoint: req.originalUrl || req.url,
          method: req.method,
          sessionId: req.sessionID,
          requestId: req.id || req.headers['x-request-id']
        };
      } else {
        // Default values when no request object
        logData.ipAddress = '127.0.0.1';
        logData.userAgent = 'System';
        logData.franchise = franchise || null;
      }

      const log = await ActivityLog.logActivity(logData);
      return log;
    } catch (error) {
      console.error('Activity logging failed:', error);
      return null;
    }
  }

  /**
   * Get client IP address from request
   */
  static getClientIP(req) {
    return req.ip || 
           req.connection?.remoteAddress || 
           req.socket?.remoteAddress ||
           req.headers['x-forwarded-for']?.split(',')[0] ||
           req.headers['x-real-ip'] ||
           '127.0.0.1';
  }

  /**
   * Get activity logs with filters and pagination
   */
  static async getActivityLogs(filters = {}, options = {}) {
    try {
      const {
        page = 1,
        limit = 50,
        sortBy = 'timestamp',
        sortOrder = 'desc',
        populate = true
      } = options;

      const skip = (page - 1) * limit;
      const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

      // Build query filters
      const query = { isDeleted: false };

      if (filters.userId) {
        query.userId = filters.userId;
      }

      if (filters.action) {
        if (Array.isArray(filters.action)) {
          query.action = { $in: filters.action };
        } else {
          query.action = filters.action;
        }
      }

      if (filters.resource) {
        if (Array.isArray(filters.resource)) {
          query.resource = { $in: filters.resource };
        } else {
          query.resource = filters.resource;
        }
      }

      if (filters.status) {
        if (Array.isArray(filters.status)) {
          query.status = { $in: filters.status };
        } else {
          query.status = filters.status;
        }
      }

      if (filters.severity) {
        if (Array.isArray(filters.severity)) {
          query.severity = { $in: filters.severity };
        } else {
          query.severity = filters.severity;
        }
      }

      if (filters.startDate || filters.endDate) {
        query.timestamp = {};
        if (filters.startDate) {
          query.timestamp.$gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
          query.timestamp.$lte = new Date(filters.endDate);
        }
      }

      if (filters.ipAddress) {
        query.ipAddress = filters.ipAddress;
      }

      if (filters.franchise) {
        query.franchise = filters.franchise;
      }

      if (filters.search) {
        query.$or = [
          { description: { $regex: filters.search, $options: 'i' } },
          { action: { $regex: filters.search, $options: 'i' } },
          { resource: { $regex: filters.search, $options: 'i' } }
        ];
      }

      // Execute query
      let queryBuilder = ActivityLog.find(query)
        .sort(sort)
        .limit(limit)
        .skip(skip);

      if (populate) {
        queryBuilder = queryBuilder.populate('userId', 'name email phone role');
      }

      const [logs, total] = await Promise.all([
        queryBuilder.exec(),
        ActivityLog.countDocuments(query)
      ]);

      return {
        logs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      };
    } catch (error) {
      console.error('Failed to get activity logs:', error);
      throw error;
    }
  }

  /**
   * Get activity statistics
   */
  static async getActivityStats(filters = {}) {
    try {
      const query = { isDeleted: false };

      if (filters.startDate || filters.endDate) {
        query.timestamp = {};
        if (filters.startDate) {
          query.timestamp.$gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
          query.timestamp.$lte = new Date(filters.endDate);
        }
      }

      if (filters.userId) {
        query.userId = filters.userId;
      }

      const [
        totalLogs,
        actionStats,
        resourceStats,
        statusStats,
        severityStats,
        recentActivity
      ] = await Promise.all([
        ActivityLog.countDocuments(query),
        this.getActionStats(query),
        this.getResourceStats(query),
        this.getStatusStats(query),
        this.getSeverityStats(query),
        this.getRecentActivity(query, 10)
      ]);

      return {
        totalLogs,
        actionStats,
        resourceStats,
        statusStats,
        severityStats,
        recentActivity
      };
    } catch (error) {
      console.error('Failed to get activity stats:', error);
      throw error;
    }
  }

  /**
   * Get action statistics
   */
  static async getActionStats(baseQuery = {}) {
    return await ActivityLog.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 },
          lastActivity: { $max: '$timestamp' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]);
  }

  /**
   * Get resource statistics
   */
  static async getResourceStats(baseQuery = {}) {
    return await ActivityLog.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: '$resource',
          count: { $sum: 1 },
          lastActivity: { $max: '$timestamp' }
        }
      },
      { $sort: { count: -1 } }
    ]);
  }

  /**
   * Get status statistics
   */
  static async getStatusStats(baseQuery = {}) {
    return await ActivityLog.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
  }

  /**
   * Get severity statistics
   */
  static async getSeverityStats(baseQuery = {}) {
    return await ActivityLog.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: '$severity',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
  }

  /**
   * Get recent activity
   */
  static async getRecentActivity(baseQuery = {}, limit = 10) {
    return await ActivityLog.find(baseQuery)
      .populate('userId', 'name email phone role')
      .sort({ timestamp: -1 })
      .limit(limit);
  }

  /**
   * Get user activity summary
   */
  static async getUserActivitySummary(userId, days = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const pipeline = [
        {
          $match: {
            userId: userId,
            timestamp: { $gte: startDate },
            isDeleted: false
          }
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$timestamp'
              }
            },
            count: { $sum: 1 },
            actions: { $addToSet: '$action' },
            resources: { $addToSet: '$resource' }
          }
        },
        { $sort: { _id: 1 } }
      ];

      const dailyActivity = await ActivityLog.aggregate(pipeline);

      const totalActivity = await ActivityLog.countDocuments({
        userId,
        timestamp: { $gte: startDate },
        isDeleted: false
      });

      return {
        dailyActivity,
        totalActivity,
        period: `${days} days`
      };
    } catch (error) {
      console.error('Failed to get user activity summary:', error);
      throw error;
    }
  }

  /**
   * Clean old logs (for maintenance)
   */
  static async cleanOldLogs(daysToKeep = 365) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await ActivityLog.deleteMany({
        timestamp: { $lt: cutoffDate }
      });

      return {
        deletedCount: result.deletedCount,
        cutoffDate
      };
    } catch (error) {
      console.error('Failed to clean old logs:', error);
      throw error;
    }
  }

  /**
   * Export activity logs
   */
  static async exportLogs(filters = {}, format = 'json') {
    try {
      const { logs } = await this.getActivityLogs(filters, { 
        limit: 10000, 
        populate: true 
      });

      if (format === 'csv') {
        return this.convertToCSV(logs);
      }

      return logs;
    } catch (error) {
      console.error('Failed to export logs:', error);
      throw error;
    }
  }

  /**
   * Convert logs to CSV format
   */
  static convertToCSV(logs) {
    if (!logs || logs.length === 0) {
      return '';
    }

    const headers = [
      'Timestamp',
      'User',
      'Action',
      'Resource',
      'Description',
      'Status',
      'Severity',
      'IP Address',
      'Location'
    ];

    const rows = logs.map(log => [
      log.timestamp.toISOString(),
      log.userId?.name || 'Unknown',
      log.action,
      log.resource,
      log.description,
      log.status,
      log.severity,
      log.ipAddress,
      log.location ? `${log.location.city}, ${log.location.region}, ${log.location.country}` : ''
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    return csvContent;
  }
}

module.exports = ActivityLogService;