const ActivityLogService = require('../services/activityLogService');

/**
 * Middleware to automatically log activities
 */
const activityLogger = (options = {}) => {
  return async (req, res, next) => {
    // Store original res.json to intercept response
    const originalJson = res.json;
    const startTime = Date.now();

    // Override res.json to capture response
    res.json = function(data) {
      const duration = Date.now() - startTime;
      
      // Log activity after response is sent
      setImmediate(async () => {
        try {
          await logRequestActivity(req, res, data, duration, options);
        } catch (error) {
          console.error('Failed to log activity:', error);
        }
      });

      // Call original json method
      return originalJson.call(this, data);
    };

    next();
  };
};

/**
 * Log request activity
 */
async function logRequestActivity(req, res, responseData, duration, options) {
  try {
    // Skip logging for certain endpoints
    const skipEndpoints = options.skipEndpoints || [
      '/api/ping',
      '/api/activity-logs', // Avoid recursive logging
      '/api/login-logs',
      '/api/error-logs'
    ];

    if (skipEndpoints.some(endpoint => req.originalUrl.startsWith(endpoint))) {
      return;
    }

    // Log all activities including public endpoints for security monitoring
    // Only skip internal system endpoints
    const isInternalEndpoint = req.originalUrl.includes('/internal') || 
                              req.originalUrl.includes('/system/ping');
    
    if (isInternalEndpoint) {
      return;
    }

    const action = determineAction(req, res, responseData);
    const resource = determineResource(req);
    const description = generateDescription(req, res, action, resource);
    const status = res.statusCode >= 400 ? 'failed' : 'success';
    const severity = determineSeverity(req, res, action);

    // Extract resource ID from request
    const resourceId = extractResourceId(req, resource);

    // Prepare details
    const details = {
      method: req.method,
      endpoint: req.originalUrl,
      statusCode: res.statusCode,
      duration,
      queryParams: req.query,
      userAgent: req.get('User-Agent')
    };

    // Add request body for certain actions (excluding sensitive data)
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      details.requestBody = sanitizeRequestBody(req.body);
    }

    // Add response data for certain actions
    if (options.includeResponseData && responseData) {
      details.responseData = sanitizeResponseData(responseData);
    }

    await ActivityLogService.logActivity({
      userId: req.user?._id || null,
      action,
      resource,
      resourceId,
      description,
      details,
      req,
      status,
      severity
    });

  } catch (error) {
    console.error('Activity logging error:', error);
    // Try to log the error itself as an activity
    try {
      await ActivityLogService.logActivity({
        userId: req.user?._id || null,
        action: 'logging_error',
        resource: 'system',
        resourceId: null,
        description: `Activity logging failed: ${error.message}`,
        details: { error: error.message, stack: error.stack },
        req,
        status: 'failed',
        severity: 'medium'
      });
    } catch (loggingError) {
      console.error('Failed to log activity logging error:', loggingError);
    }
  }
}

/**
 * Determine action based on request
 */
function determineAction(req, res, responseData) {
  const method = req.method;
  const path = req.originalUrl;
  const statusCode = res.statusCode;

  // Authentication actions
  if (path.includes('/auth/send-otp')) {
    return 'otp_requested';
  }
  if (path.includes('/auth/verify-otp')) {
    return statusCode === 200 ? 'login' : 'login_failed';
  }
  if (path.includes('/auth/logout')) {
    return 'logout';
  }
  if (path.includes('/auth/reset-password')) {
    return 'password_reset';
  }
  if (path.includes('/auth/me')) {
    return 'profile_accessed';
  }

  // Security-related actions
  if (statusCode === 401) {
    return 'unauthorized_access';
  }
  if (statusCode === 403) {
    return 'permission_denied';
  }

  // CRUD operations
  switch (method) {
    case 'POST':
      if (statusCode === 201 || statusCode === 200) {
        return getResourceAction('created', path);
      } else if (statusCode >= 400) {
        return getResourceAction('create_failed', path);
      }
      break;
    case 'PUT':
    case 'PATCH':
      if (statusCode === 200) {
        return getResourceAction('updated', path);
      } else if (statusCode >= 400) {
        return getResourceAction('update_failed', path);
      }
      break;
    case 'DELETE':
      if (statusCode === 200 || statusCode === 204) {
        return getResourceAction('deleted', path);
      } else if (statusCode >= 400) {
        return getResourceAction('delete_failed', path);
      }
      break;
    case 'GET':
      if (path.includes('/export') || path.includes('/download')) {
        return statusCode === 200 ? 'data_exported' : 'export_failed';
      }
      if (path.includes('/stats') || path.includes('/analytics')) {
        return 'data_accessed'; // Use valid enum value
      }
      return statusCode === 200 ? 'data_accessed' : 'permission_denied';
  }

  return statusCode >= 400 ? 'permission_denied' : 'data_accessed';
}

/**
 * Get resource-specific action
 */
function getResourceAction(baseAction, path) {
  if (path.includes('/users')) return `user_${baseAction}`;
  if (path.includes('/beneficiaries') || path.includes('/beneficiary')) return `beneficiary_${baseAction}`;
  if (path.includes('/applications')) return `application_${baseAction}`;
  if (path.includes('/projects')) return `project_${baseAction}`;
  if (path.includes('/schemes')) return `scheme_${baseAction}`;
  if (path.includes('/recurring-payments')) return `recurring_payment_${baseAction}`;
  if (path.includes('/payments')) return `payment_${baseAction}`;
  if (path.includes('/reports')) return `report_${baseAction}`;
  if (path.includes('/roles')) return `role_${baseAction}`;
  if (path.includes('/permissions')) return `permission_${baseAction}`;
  if (path.includes('/donors')) return `donor_${baseAction}`;
  if (path.includes('/donations')) return `donation_${baseAction}`;
  if (path.includes('/interviews')) return `interview_${baseAction}`;
  if (path.includes('/locations')) return `location_${baseAction}`;
  if (path.includes('/form')) return `form_${baseAction}`;
  if (path.includes('/settings')) return `settings_${baseAction}`;
  if (path.includes('/banners')) return `banner_${baseAction}`;
  if (path.includes('/brochures')) return `brochure_${baseAction}`;
  if (path.includes('/partners')) return `partner_${baseAction}`;
  if (path.includes('/news-events')) return `news_event_${baseAction}`;
  if (path.includes('/notifications')) return `notification_${baseAction}`;
  if (path.includes('/budget')) return `budget_${baseAction}`;
  if (path.includes('/master-data')) return `master_data_${baseAction}`;
  if (path.includes('/upload')) return `upload_${baseAction}`;
  if (path.includes('/mobile')) return `mobile_${baseAction}`;
  if (path.includes('/config')) return `config_${baseAction}`;
  if (path.includes('/website')) return `website_${baseAction}`;
  if (path.includes('/sms')) return `sms_${baseAction}`;
  if (path.includes('/regional-admin')) return `regional_admin_${baseAction}`;
  
  return baseAction;
}

/**
 * Determine resource from request path
 */
function determineResource(req) {
  const path = req.originalUrl.toLowerCase();

  if (path.includes('/auth')) return 'auth';
  if (path.includes('/users')) return 'user';
  if (path.includes('/beneficiaries') || path.includes('/beneficiary')) return 'beneficiary';
  if (path.includes('/applications')) return 'application';
  if (path.includes('/projects')) return 'project';
  if (path.includes('/schemes')) return 'scheme';
  if (path.includes('/recurring-payments')) return 'recurring_payment';
  if (path.includes('/payments')) return 'payment';
  if (path.includes('/reports')) return 'report';
  if (path.includes('/roles')) return 'role';
  if (path.includes('/permissions')) return 'permission';
  if (path.includes('/donors')) return 'donor';
  if (path.includes('/donations')) return 'donation';
  if (path.includes('/interviews')) return 'interview';
  if (path.includes('/locations')) return 'location';
  if (path.includes('/form')) return 'form';
  if (path.includes('/banners')) return 'banner';
  if (path.includes('/brochures')) return 'brochure';
  if (path.includes('/partners')) return 'partner';
  if (path.includes('/news-events')) return 'news_event';
  if (path.includes('/notifications')) return 'notification';
  if (path.includes('/budget')) return 'budget';
  if (path.includes('/master-data')) return 'master_data';
  if (path.includes('/upload')) return 'upload';
  if (path.includes('/mobile')) return 'mobile';
  if (path.includes('/config')) return 'config';
  if (path.includes('/website')) return 'website';
  if (path.includes('/sms')) return 'sms';
  if (path.includes('/regional-admin')) return 'regional_admin';
  if (path.includes('/settings')) return 'settings';
  if (path.includes('/system')) return 'system';

  return 'system';
}

/**
 * Generate human-readable description
 */
function generateDescription(req, res, action, resource) {
  const method = req.method;
  const path = req.originalUrl;
  const statusCode = res.statusCode;
  const userName = req.user?.name || (req.user ? 'Unknown User' : 'System/Anonymous');

  // Authentication descriptions
  if (action === 'login') {
    return `${userName} logged in successfully`;
  }
  if (action === 'login_failed') {
    return `Failed login attempt for ${req.body?.phone || 'unknown'}`;
  }
  if (action === 'logout') {
    return `${userName} logged out`;
  }

  // CRUD descriptions
  const resourceName = resource.charAt(0).toUpperCase() + resource.slice(1);
  
  switch (action.split('_')[1]) {
    case 'created':
      return `${userName} created a new ${resourceName}`;
    case 'updated':
      return `${userName} updated ${resourceName}`;
    case 'deleted':
      return `${userName} deleted ${resourceName}`;
    default:
      return `${userName} performed ${action} on ${resource}`;
  }
}

/**
 * Determine severity level
 */
function determineSeverity(req, res, action) {
  const statusCode = res.statusCode;

  // Critical actions
  if (action.includes('deleted') || action.includes('deactivated')) {
    return 'high';
  }

  // Security-related actions
  if (action === 'login_failed' || action.includes('unauthorized')) {
    return 'medium';
  }

  // Error responses
  if (statusCode >= 500) {
    return 'high';
  }
  if (statusCode >= 400) {
    return 'medium';
  }

  // System actions
  if (action.includes('system') || action.includes('backup')) {
    return 'medium';
  }

  return 'low';
}

/**
 * Extract resource ID from request
 */
function extractResourceId(req, resource) {
  // Try to get ID from params
  if (req.params.id) {
    return req.params.id;
  }

  // Try to get ID from specific resource params
  const resourceIdFields = {
    user: 'userId',
    beneficiary: 'beneficiaryId',
    application: 'applicationId',
    project: 'projectId',
    scheme: 'schemeId',
    payment: 'paymentId'
  };

  const idField = resourceIdFields[resource];
  if (idField && req.params[idField]) {
    return req.params[idField];
  }

  // Try to get ID from request body
  if (req.body && req.body._id) {
    return req.body._id;
  }

  return null;
}

/**
 * Sanitize request body (remove sensitive data)
 */
function sanitizeRequestBody(body) {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const sanitized = { ...body };
  
  // Remove sensitive fields
  const sensitiveFields = [
    'password', 'token', 'otp', 'secret', 'key',
    'authorization', 'auth', 'credential'
  ];

  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });

  return sanitized;
}

/**
 * Sanitize response data
 */
function sanitizeResponseData(data) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const sanitized = { ...data };
  
  // Remove sensitive fields from response
  if (sanitized.token) {
    sanitized.token = '[REDACTED]';
  }
  if (sanitized.password) {
    sanitized.password = '[REDACTED]';
  }

  return sanitized;
}

/**
 * Manual activity logging helper
 */
const logActivity = async (req, activityData) => {
  try {
    const {
      action,
      resource,
      resourceId,
      description,
      details = {},
      status = 'success',
      severity = 'low'
    } = activityData;

    await ActivityLogService.logActivity({
      userId: req.user?._id || null,
      action,
      resource,
      resourceId,
      description,
      details,
      req,
      status,
      severity
    });
  } catch (error) {
    console.error('Manual activity logging failed:', error);
  }
};

module.exports = {
  activityLogger,
  logActivity
};