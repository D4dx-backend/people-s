const LoginLog = require('../models/LoginLog');
const geoip = require('geoip-lite');

class LoginLogService {
  /**
   * Get client IP from request
   */
  static getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
           req.headers['x-real-ip'] ||
           req.connection?.remoteAddress ||
           req.socket?.remoteAddress ||
           '127.0.0.1';
  }

  /**
   * Parse device info from user agent
   */
  static parseDevice(userAgentString) {
    try {
      const UAParser = require('ua-parser-js');
      const parser = new UAParser(userAgentString);
      const result = parser.getResult();

      return {
        type: result.device.type || 'desktop',
        os: result.os.name || 'Unknown',
        osVersion: result.os.version || '',
        browser: result.browser.name || 'Unknown',
        browserVersion: result.browser.version || '',
        deviceModel: result.device.model || '',
        deviceVendor: result.device.vendor || ''
      };
    } catch (error) {
      return {
        type: 'unknown',
        os: 'Unknown',
        osVersion: '',
        browser: 'Unknown',
        browserVersion: '',
        deviceModel: '',
        deviceVendor: ''
      };
    }
  }

  /**
   * Log a login event
   */
  static async logLoginEvent({
    userId = null,
    userType = 'admin',
    action,
    status = 'success',
    phone,
    req,
    failureReason = null,
    otpDetails = {},
    sessionId = null,
    metadata = {}
  }) {
    try {
      const ipAddress = req ? this.getClientIP(req) : '127.0.0.1';
      const userAgentString = req ? (req.get('User-Agent') || '') : '';
      const device = this.parseDevice(userAgentString);

      // Geolocation from IP
      let location = {};
      const geo = geoip.lookup(ipAddress);
      if (geo) {
        location = {
          country: geo.country,
          region: geo.region,
          city: geo.city,
          latitude: geo.ll ? geo.ll[0] : null,
          longitude: geo.ll ? geo.ll[1] : null
        };
      }

      const logData = {
        userId,
        userType,
        action,
        status,
        phone,
        ipAddress,
        userAgent: userAgentString,
        device,
        location,
        failureReason,
        otpDetails,
        sessionId,
        metadata,
        timestamp: new Date(),
        // Multi-tenant: attach franchise from request context
        franchise: req?.franchiseId || null
      };

      return await LoginLog.logEvent(logData);
    } catch (error) {
      console.error('LoginLogService.logLoginEvent error:', error);
      return null;
    }
  }

  /**
   * Get login logs with filters and pagination
   */
  static async getLoginLogs({
    page = 1,
    limit = 50,
    search,
    action,
    status,
    userType,
    userId,
    phone,
    ipAddress,
    startDate,
    endDate,
    failureReason,
    deviceType,
    franchise,
    sortBy = 'timestamp',
    sortOrder = 'desc'
  } = {}) {
    try {
      const filters = {};

      if (franchise) filters.franchise = franchise;

      if (search) {
        filters.$or = [
          { phone: { $regex: search, $options: 'i' } },
          { ipAddress: { $regex: search, $options: 'i' } },
          { 'device.browser': { $regex: search, $options: 'i' } },
          { 'device.os': { $regex: search, $options: 'i' } },
          { 'location.city': { $regex: search, $options: 'i' } },
          { 'location.country': { $regex: search, $options: 'i' } }
        ];
      }

      if (action) filters.action = action;
      if (status) filters.status = status;
      if (userType) filters.userType = userType;
      if (userId) filters.userId = userId;
      if (phone) filters.phone = { $regex: phone, $options: 'i' };
      if (ipAddress) filters.ipAddress = ipAddress;
      if (failureReason) filters.failureReason = failureReason;
      if (deviceType) filters['device.type'] = deviceType;

      if (startDate || endDate) {
        filters.timestamp = {};
        if (startDate) filters.timestamp.$gte = new Date(startDate);
        if (endDate) filters.timestamp.$lte = new Date(endDate);
      }

      const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
      const skip = (page - 1) * limit;

      const [logs, total] = await Promise.all([
        LoginLog.find(filters)
          .populate('userId', 'name email phone role')
          .sort(sort)
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        LoginLog.countDocuments(filters)
      ]);

      return {
        logs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      console.error('LoginLogService.getLoginLogs error:', error);
      throw error;
    }
  }

  /**
   * Get login statistics
   */
  static async getLoginStats({ startDate, endDate, userType } = {}) {
    try {
      const match = {};
      if (startDate || endDate) {
        match.timestamp = {};
        if (startDate) match.timestamp.$gte = new Date(startDate);
        if (endDate) match.timestamp.$lte = new Date(endDate);
      }
      if (userType) match.userType = userType;

      const [actionStats, statusOverview, hourlyDistribution, dailyTrends] = await Promise.all([
        // Stats by action
        LoginLog.aggregate([
          { $match: match },
          {
            $group: {
              _id: { action: '$action', status: '$status' },
              count: { $sum: 1 }
            }
          },
          {
            $group: {
              _id: '$_id.action',
              total: { $sum: '$count' },
              success: { $sum: { $cond: [{ $eq: ['$_id.status', 'success'] }, '$count', 0] } },
              failed: { $sum: { $cond: [{ $eq: ['$_id.status', 'failed'] }, '$count', 0] } }
            }
          },
          { $sort: { total: -1 } }
        ]),
        // Overall status counts
        LoginLog.aggregate([
          { $match: match },
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ]),
        // Hourly distribution
        LoginLog.aggregate([
          { $match: match },
          {
            $group: {
              _id: { $hour: '$timestamp' },
              count: { $sum: 1 },
              success: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
              failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } }
            }
          },
          { $sort: { '_id': 1 } }
        ]),
        // Daily trends (last 30 days)
        LoginLog.aggregate([
          { $match: { ...match, timestamp: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), ...(match.timestamp || {}) } } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
              total: { $sum: 1 },
              success: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
              failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } }
            }
          },
          { $sort: { '_id': 1 } }
        ])
      ]);

      const totalLogs = await LoginLog.countDocuments(match);

      return {
        totalLogs,
        actionStats,
        statusOverview,
        hourlyDistribution,
        dailyTrends
      };
    } catch (error) {
      console.error('LoginLogService.getLoginStats error:', error);
      throw error;
    }
  }

  /**
   * Get user login history
   */
  static async getUserLoginHistory(userId, { page = 1, limit = 50 } = {}) {
    try {
      const skip = (page - 1) * limit;
      const filters = { userId };

      const [logs, total] = await Promise.all([
        LoginLog.find(filters)
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        LoginLog.countDocuments(filters)
      ]);

      return {
        logs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      console.error('LoginLogService.getUserLoginHistory error:', error);
      throw error;
    }
  }

  /**
   * Detect suspicious login activity
   */
  static async getSuspiciousActivity({ hours = 24, failThreshold = 5 } = {}) {
    try {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);

      const [failedByIP, failedByPhone, rapidOTPRequests] = await Promise.all([
        // Multiple failures from same IP
        LoginLog.aggregate([
          {
            $match: {
              status: 'failed',
              timestamp: { $gte: since }
            }
          },
          {
            $group: {
              _id: '$ipAddress',
              failCount: { $sum: 1 },
              phones: { $addToSet: '$phone' },
              lastAttempt: { $max: '$timestamp' },
              reasons: { $push: '$failureReason' }
            }
          },
          { $match: { failCount: { $gte: failThreshold } } },
          { $sort: { failCount: -1 } },
          { $limit: 50 }
        ]),

        // Multiple failures for same phone
        LoginLog.aggregate([
          {
            $match: {
              status: 'failed',
              timestamp: { $gte: since }
            }
          },
          {
            $group: {
              _id: '$phone',
              failCount: { $sum: 1 },
              ips: { $addToSet: '$ipAddress' },
              lastAttempt: { $max: '$timestamp' },
              reasons: { $push: '$failureReason' }
            }
          },
          { $match: { failCount: { $gte: failThreshold } } },
          { $sort: { failCount: -1 } },
          { $limit: 50 }
        ]),

        // Rapid OTP requests (more than 10 in 1 hour)
        LoginLog.aggregate([
          {
            $match: {
              action: { $in: ['otp_requested', 'otp_resent'] },
              timestamp: { $gte: since }
            }
          },
          {
            $group: {
              _id: { phone: '$phone', hour: { $dateToString: { format: '%Y-%m-%d %H:00', date: '$timestamp' } } },
              count: { $sum: 1 },
              ips: { $addToSet: '$ipAddress' }
            }
          },
          { $match: { count: { $gte: 10 } } },
          { $sort: { count: -1 } },
          { $limit: 50 }
        ])
      ]);

      return {
        failedByIP,
        failedByPhone,
        rapidOTPRequests,
        summary: {
          suspiciousIPs: failedByIP.length,
          suspiciousPhones: failedByPhone.length,
          rapidOTPAbuse: rapidOTPRequests.length,
          totalSuspicious: failedByIP.length + failedByPhone.length + rapidOTPRequests.length
        }
      };
    } catch (error) {
      console.error('LoginLogService.getSuspiciousActivity error:', error);
      throw error;
    }
  }

  /**
   * Get device breakdown
   */
  static async getDeviceBreakdown({ startDate, endDate } = {}) {
    try {
      const match = {};
      if (startDate || endDate) {
        match.timestamp = {};
        if (startDate) match.timestamp.$gte = new Date(startDate);
        if (endDate) match.timestamp.$lte = new Date(endDate);
      }

      const [byType, byOS, byBrowser] = await Promise.all([
        LoginLog.aggregate([
          { $match: match },
          { $group: { _id: '$device.type', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]),
        LoginLog.aggregate([
          { $match: match },
          { $group: { _id: '$device.os', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]),
        LoginLog.aggregate([
          { $match: match },
          { $group: { _id: '$device.browser', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ])
      ]);

      return { byType, byOS, byBrowser };
    } catch (error) {
      console.error('LoginLogService.getDeviceBreakdown error:', error);
      throw error;
    }
  }

  /**
   * Get location breakdown
   */
  static async getLocationBreakdown({ startDate, endDate } = {}) {
    try {
      const match = {};
      if (startDate || endDate) {
        match.timestamp = {};
        if (startDate) match.timestamp.$gte = new Date(startDate);
        if (endDate) match.timestamp.$lte = new Date(endDate);
      }

      const [byCountry, byCity] = await Promise.all([
        LoginLog.aggregate([
          { $match: { ...match, 'location.country': { $exists: true, $ne: '' } } },
          { $group: { _id: '$location.country', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 20 }
        ]),
        LoginLog.aggregate([
          { $match: { ...match, 'location.city': { $exists: true, $ne: '' } } },
          {
            $group: {
              _id: { city: '$location.city', country: '$location.country' },
              count: { $sum: 1 }
            }
          },
          { $sort: { count: -1 } },
          { $limit: 20 }
        ])
      ]);

      return { byCountry, byCity };
    } catch (error) {
      console.error('LoginLogService.getLocationBreakdown error:', error);
      throw error;
    }
  }

  /**
   * Get OTP statistics
   */
  static async getOTPStats({ startDate, endDate } = {}) {
    try {
      const match = {
        action: { $in: ['otp_requested', 'otp_resent', 'otp_verified'] }
      };
      if (startDate || endDate) {
        match.timestamp = {};
        if (startDate) match.timestamp.$gte = new Date(startDate);
        if (endDate) match.timestamp.$lte = new Date(endDate);
      }

      const [byAction, byChannel, dailyOTP] = await Promise.all([
        LoginLog.aggregate([
          { $match: match },
          {
            $group: {
              _id: { action: '$action', status: '$status' },
              count: { $sum: 1 }
            }
          },
          { $sort: { count: -1 } }
        ]),
        LoginLog.aggregate([
          { $match: match },
          { $group: { _id: '$otpDetails.channel', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]),
        LoginLog.aggregate([
          { $match: match },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
              requested: {
                $sum: { $cond: [{ $in: ['$action', ['otp_requested', 'otp_resent']] }, 1, 0] }
              },
              verified: {
                $sum: { $cond: [{ $eq: ['$action', 'otp_verified'] }, 1, 0] }
              }
            }
          },
          { $sort: { '_id': 1 } },
          { $limit: 30 }
        ])
      ]);

      return { byAction, byChannel, dailyOTP };
    } catch (error) {
      console.error('LoginLogService.getOTPStats error:', error);
      throw error;
    }
  }

  /**
   * Export login logs
   */
  static async exportLogs({ format = 'json', ...filters } = {}) {
    try {
      const query = {};
      if (filters.startDate || filters.endDate) {
        query.timestamp = {};
        if (filters.startDate) query.timestamp.$gte = new Date(filters.startDate);
        if (filters.endDate) query.timestamp.$lte = new Date(filters.endDate);
      }
      if (filters.action) query.action = filters.action;
      if (filters.status) query.status = filters.status;
      if (filters.userType) query.userType = filters.userType;

      const logs = await LoginLog.find(query)
        .populate('userId', 'name email phone role')
        .sort({ timestamp: -1 })
        .limit(10000)
        .lean();

      if (format === 'csv') {
        return this.convertToCSV(logs);
      }
      return logs;
    } catch (error) {
      console.error('LoginLogService.exportLogs error:', error);
      throw error;
    }
  }

  /**
   * Convert logs to CSV
   */
  static convertToCSV(logs) {
    if (!logs.length) return '';

    const headers = [
      'Timestamp', 'Action', 'Status', 'User Type', 'Phone', 'User Name',
      'IP Address', 'Device Type', 'OS', 'Browser', 'City', 'Country',
      'Failure Reason'
    ];

    const rows = logs.map(log => [
      log.timestamp ? new Date(log.timestamp).toISOString() : '',
      log.action || '',
      log.status || '',
      log.userType || '',
      log.phone || '',
      log.userId?.name || '',
      log.ipAddress || '',
      log.device?.type || '',
      log.device?.os || '',
      log.device?.browser || '',
      log.location?.city || '',
      log.location?.country || '',
      log.failureReason || ''
    ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(','));

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Clean old login logs
   */
  static async cleanOldLogs(daysToKeep = 365) {
    try {
      const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
      const result = await LoginLog.deleteMany({ timestamp: { $lt: cutoffDate } });
      return { deletedCount: result.deletedCount };
    } catch (error) {
      console.error('LoginLogService.cleanOldLogs error:', error);
      throw error;
    }
  }
}

module.exports = LoginLogService;
