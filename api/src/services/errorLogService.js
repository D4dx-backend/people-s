const ErrorLog = require('../models/ErrorLog');

class ErrorLogService {
  /**
   * Determine error type from error object
   */
  static determineErrorType(err, statusCode) {
    if (err.name === 'ValidationError' || statusCode === 422) return 'validation_error';
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError' || statusCode === 401) return 'authentication_error';
    if (statusCode === 403) return 'authorization_error';
    if (err.name === 'CastError' || statusCode === 404) return 'not_found';
    if (err.name === 'MongoError' || err.name === 'MongoServerError') return 'database_error';
    if (statusCode === 429) return 'rate_limit_error';
    if (err.code === 'LIMIT_FILE_SIZE' || err.code === 'LIMIT_UNEXPECTED_FILE') return 'file_upload_error';
    if (err.code === 'ETIMEOUT' || err.code === 'ESOCKETTIMEDOUT') return 'timeout_error';
    if (statusCode >= 500) return 'internal_error';
    return 'internal_error';
  }

  /**
   * Determine severity from status code
   */
  static determineSeverity(statusCode) {
    if (statusCode >= 500) return 'high';
    if (statusCode === 503 || statusCode === 502) return 'critical';
    if (statusCode >= 400 && statusCode < 500) return 'medium';
    return 'low';
  }

  /**
   * Sanitize request body for storage
   */
  static sanitizeBody(body) {
    if (!body || typeof body !== 'object') return body;
    const sanitized = { ...body };
    const sensitiveFields = ['password', 'token', 'otp', 'secret', 'key', 'authorization', 'credential', 'refreshToken'];
    sensitiveFields.forEach(field => {
      if (sanitized[field]) sanitized[field] = '[REDACTED]';
    });
    return sanitized;
  }

  /**
   * Get client IP from request
   */
  static getClientIP(req) {
    return req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
           req?.headers?.['x-real-ip'] ||
           req?.connection?.remoteAddress ||
           req?.socket?.remoteAddress ||
           '127.0.0.1';
  }

  /**
   * Log an error from the error handler middleware
   */
  static async logError(err, req, statusCode) {
    try {
      const endpoint = req?.originalUrl || req?.url || 'unknown';
      const fingerprint = ErrorLog.generateFingerprint(err, endpoint);
      const errorType = this.determineErrorType(err, statusCode);
      const severity = this.determineSeverity(statusCode);

      const request = req ? {
        method: req.method,
        url: req.originalUrl || req.url,
        params: req.params,
        query: req.query,
        body: this.sanitizeBody(req.body),
        headers: {
          'user-agent': req.get('User-Agent'),
          'content-type': req.get('Content-Type'),
          'x-forwarded-for': req.get('X-Forwarded-For'),
          origin: req.get('Origin'),
          referer: req.get('Referer')
        }
      } : null;

      const errorData = {
        errorType,
        message: err.message || 'Unknown error',
        stack: err.stack || '',
        statusCode,
        severity,
        request,
        userId: req?.user?._id || null,
        ipAddress: req ? this.getClientIP(req) : '127.0.0.1',
        userAgent: req ? (req.get('User-Agent') || '') : '',
        fingerprint,
        firstOccurrence: new Date(),
        lastOccurrence: new Date(),
        metadata: {
          errorName: err.name,
          errorCode: err.code,
          mongooseCode: err.code === 11000 ? 'duplicate_key' : undefined
        }
      };

      return await ErrorLog.logError(errorData);
    } catch (logError) {
      console.error('ErrorLogService.logError failed:', logError);
      return null;
    }
  }

  /**
   * Get error logs with filters and pagination
   */
  static async getErrorLogs({
    page = 1,
    limit = 50,
    search,
    errorType,
    severity,
    statusCode,
    isResolved,
    userId,
    franchise,
    startDate,
    endDate,
    sortBy = 'lastOccurrence',
    sortOrder = 'desc'
  } = {}) {
    try {
      const filters = {};

      if (franchise) filters.franchise = franchise;

      if (search) {
        filters.$or = [
          { message: { $regex: search, $options: 'i' } },
          { 'request.url': { $regex: search, $options: 'i' } },
          { errorType: { $regex: search, $options: 'i' } }
        ];
      }

      if (errorType) filters.errorType = errorType;
      if (severity) filters.severity = severity;
      if (statusCode) filters.statusCode = parseInt(statusCode);
      if (isResolved !== undefined && isResolved !== '') filters.isResolved = isResolved === 'true' || isResolved === true;
      if (userId) filters.userId = userId;

      if (startDate || endDate) {
        filters.timestamp = {};
        if (startDate) filters.timestamp.$gte = new Date(startDate);
        if (endDate) filters.timestamp.$lte = new Date(endDate);
      }

      const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
      const skip = (page - 1) * limit;

      const [logs, total] = await Promise.all([
        ErrorLog.find(filters)
          .populate('userId', 'name email phone role')
          .populate('resolvedBy', 'name email')
          .sort(sort)
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        ErrorLog.countDocuments(filters)
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
      console.error('ErrorLogService.getErrorLogs error:', error);
      throw error;
    }
  }

  /**
   * Get error statistics
   */
  static async getErrorStats({ startDate, endDate } = {}) {
    try {
      const match = {};
      if (startDate || endDate) {
        match.timestamp = {};
        if (startDate) match.timestamp.$gte = new Date(startDate);
        if (endDate) match.timestamp.$lte = new Date(endDate);
      }

      const [byType, bySeverity, byStatus, dailyTrends, topErrors] = await Promise.all([
        ErrorLog.aggregate([
          { $match: match },
          { $group: { _id: '$errorType', count: { $sum: '$occurrenceCount' }, unique: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]),
        ErrorLog.aggregate([
          { $match: match },
          { $group: { _id: '$severity', count: { $sum: '$occurrenceCount' }, unique: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]),
        ErrorLog.aggregate([
          { $match: match },
          { $group: { _id: '$statusCode', count: { $sum: '$occurrenceCount' } } },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ]),
        ErrorLog.aggregate([
          { $match: { ...match, timestamp: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), ...(match.timestamp || {}) } } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
              total: { $sum: '$occurrenceCount' },
              unique: { $sum: 1 }
            }
          },
          { $sort: { '_id': 1 } }
        ]),
        ErrorLog.find(match)
          .sort({ occurrenceCount: -1 })
          .limit(10)
          .select('message errorType severity statusCode occurrenceCount firstOccurrence lastOccurrence request.url isResolved')
          .lean()
      ]);

      const totalErrors = await ErrorLog.countDocuments(match);
      const totalOccurrences = await ErrorLog.aggregate([
        { $match: match },
        { $group: { _id: null, total: { $sum: '$occurrenceCount' } } }
      ]);
      const unresolvedCount = await ErrorLog.countDocuments({ ...match, isResolved: false });
      const resolvedCount = await ErrorLog.countDocuments({ ...match, isResolved: true });

      return {
        totalErrors,
        totalOccurrences: totalOccurrences[0]?.total || 0,
        unresolvedCount,
        resolvedCount,
        resolutionRate: totalErrors > 0 ? ((resolvedCount / totalErrors) * 100).toFixed(1) : 0,
        byType,
        bySeverity,
        byStatus,
        dailyTrends,
        topErrors
      };
    } catch (error) {
      console.error('ErrorLogService.getErrorStats error:', error);
      throw error;
    }
  }

  /**
   * Get grouped errors (unique errors with counts)
   */
  static async getGroupedErrors({ page = 1, limit = 50, severity, isResolved, sortBy = 'occurrenceCount', sortOrder = 'desc' } = {}) {
    try {
      const filters = {};
      if (severity) filters.severity = severity;
      if (isResolved !== undefined && isResolved !== '') filters.isResolved = isResolved === 'true' || isResolved === true;

      const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
      const skip = (page - 1) * limit;

      const [logs, total] = await Promise.all([
        ErrorLog.find(filters)
          .sort(sort)
          .skip(skip)
          .limit(parseInt(limit))
          .select('message errorType severity statusCode occurrenceCount firstOccurrence lastOccurrence request.url request.method isResolved resolvedAt fingerprint')
          .lean(),
        ErrorLog.countDocuments(filters)
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
      console.error('ErrorLogService.getGroupedErrors error:', error);
      throw error;
    }
  }

  /**
   * Mark an error as resolved
   */
  static async markResolved(errorId, userId, note = '') {
    try {
      const errorLog = await ErrorLog.findById(errorId);
      if (!errorLog) throw new Error('Error log not found');

      errorLog.isResolved = true;
      errorLog.resolvedBy = userId;
      errorLog.resolvedAt = new Date();
      errorLog.resolutionNote = note;
      await errorLog.save();

      return errorLog;
    } catch (error) {
      console.error('ErrorLogService.markResolved error:', error);
      throw error;
    }
  }

  /**
   * Get error by ID
   */
  static async getErrorById(id) {
    try {
      return await ErrorLog.findById(id)
        .populate('userId', 'name email phone role')
        .populate('resolvedBy', 'name email')
        .lean();
    } catch (error) {
      console.error('ErrorLogService.getErrorById error:', error);
      throw error;
    }
  }

  /**
   * Export error logs
   */
  static async exportLogs({ format = 'json', ...filters } = {}) {
    try {
      const query = {};
      if (filters.startDate || filters.endDate) {
        query.timestamp = {};
        if (filters.startDate) query.timestamp.$gte = new Date(filters.startDate);
        if (filters.endDate) query.timestamp.$lte = new Date(filters.endDate);
      }
      if (filters.errorType) query.errorType = filters.errorType;
      if (filters.severity) query.severity = filters.severity;
      if (filters.isResolved !== undefined) query.isResolved = filters.isResolved === 'true';

      const logs = await ErrorLog.find(query)
        .populate('userId', 'name email phone role')
        .populate('resolvedBy', 'name email')
        .sort({ lastOccurrence: -1 })
        .limit(10000)
        .lean();

      if (format === 'csv') {
        return this.convertToCSV(logs);
      }
      return logs;
    } catch (error) {
      console.error('ErrorLogService.exportLogs error:', error);
      throw error;
    }
  }

  /**
   * Convert to CSV
   */
  static convertToCSV(logs) {
    if (!logs.length) return '';
    const headers = ['Timestamp', 'Error Type', 'Severity', 'Status Code', 'Message', 'URL', 'Method', 'Occurrences', 'Resolved', 'User'];
    const rows = logs.map(log => [
      log.timestamp ? new Date(log.timestamp).toISOString() : '',
      log.errorType || '',
      log.severity || '',
      log.statusCode || '',
      (log.message || '').replace(/"/g, '""'),
      log.request?.url || '',
      log.request?.method || '',
      log.occurrenceCount || 1,
      log.isResolved ? 'Yes' : 'No',
      log.userId?.name || ''
    ].map(val => `"${String(val)}"`).join(','));
    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Clean old error logs
   */
  static async cleanOldLogs(daysToKeep = 90) {
    try {
      const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
      const result = await ErrorLog.deleteMany({ timestamp: { $lt: cutoffDate } });
      return { deletedCount: result.deletedCount };
    } catch (error) {
      console.error('ErrorLogService.cleanOldLogs error:', error);
      throw error;
    }
  }
}

module.exports = ErrorLogService;
