const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  // User who performed the action
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false, // Allow null for system activities or unauthenticated requests
    index: true,
    default: null
  },
  
  // Action details
  action: {
    type: String,
    required: true,
    enum: [
      // Authentication actions
      'login', 'logout', 'login_failed', 'password_reset', 'otp_requested', 'otp_verified',
      'otp_request_failed', 'token_refresh', 'registration_completed', 'profile_accessed',
      
      // User management
      'user_created', 'user_updated', 'user_deleted', 'user_activated', 'user_deactivated',
      'user_create_failed', 'user_update_failed', 'user_delete_failed',
      'role_assigned', 'role_removed', 'permissions_updated',
      
      // Beneficiary management
      'beneficiary_created', 'beneficiary_updated', 'beneficiary_deleted', 'beneficiary_approved', 'beneficiary_rejected',
      'beneficiary_create_failed', 'beneficiary_update_failed', 'beneficiary_delete_failed',
      'interview_scheduled', 'interview_completed', 'interview_cancelled',
      'interview_created', 'interview_updated', 'interview_deleted',
      'interview_create_failed', 'interview_update_failed', 'interview_delete_failed',
      
      // Application management
      'application_created', 'application_updated', 'application_submitted', 'application_approved', 'application_rejected',
      'application_deleted', 'application_create_failed', 'application_update_failed', 'application_delete_failed',
      
      // Project management
      'project_created', 'project_updated', 'project_deleted', 'project_activated', 'project_deactivated',
      'project_create_failed', 'project_update_failed', 'project_delete_failed',
      
      // Scheme management
      'scheme_created', 'scheme_updated', 'scheme_deleted', 'scheme_activated', 'scheme_deactivated',
      'scheme_create_failed', 'scheme_update_failed', 'scheme_delete_failed',
      
      // Payment management
      'payment_created', 'payment_updated', 'payment_approved', 'payment_rejected', 'payment_processed',
      'payment_update_failed', 'payment_create_failed', 'payment_deleted', 'payment_delete_failed',
      
      // Donor management
      'donor_created', 'donor_updated', 'donor_deleted',
      'donor_create_failed', 'donor_update_failed', 'donor_delete_failed',
      
      // Donation management
      'donation_created', 'donation_updated', 'donation_deleted',
      'donation_create_failed', 'donation_update_failed', 'donation_delete_failed',
      
      // Location management
      'location_created', 'location_updated', 'location_deleted',
      'location_create_failed', 'location_update_failed', 'location_delete_failed',
      
      // Form management
      'form_created', 'form_updated', 'form_deleted',
      'form_create_failed', 'form_update_failed', 'form_delete_failed',
      
      // Banner management
      'banner_created', 'banner_updated', 'banner_deleted',
      'banner_create_failed', 'banner_update_failed', 'banner_delete_failed',
      
      // Brochure management
      'brochure_created', 'brochure_updated', 'brochure_deleted',
      'brochure_create_failed', 'brochure_update_failed', 'brochure_delete_failed',
      
      // Partner management
      'partner_created', 'partner_updated', 'partner_deleted',
      'partner_create_failed', 'partner_update_failed', 'partner_delete_failed',
      
      // News/Event management
      'news_event_created', 'news_event_updated', 'news_event_deleted',
      'news_event_create_failed', 'news_event_update_failed', 'news_event_delete_failed',
      
      // Notification management
      'notification_created', 'notification_updated', 'notification_deleted',
      'notification_create_failed', 'notification_update_failed', 'notification_delete_failed',
      
      // Budget management
      'budget_created', 'budget_updated', 'budget_deleted',
      'budget_create_failed', 'budget_update_failed', 'budget_delete_failed',
      
      // Master data management
      'master_data_created', 'master_data_updated', 'master_data_deleted',
      'master_data_create_failed', 'master_data_update_failed', 'master_data_delete_failed',
      
      // Recurring payment management
      'recurring_payment_created', 'recurring_payment_updated', 'recurring_payment_deleted',
      'recurring_payment_create_failed', 'recurring_payment_update_failed', 'recurring_payment_delete_failed',
      
      // Role management
      'role_created', 'role_updated', 'role_deleted',
      'role_create_failed', 'role_update_failed', 'role_delete_failed',
      
      // Permission management
      'permission_created', 'permission_updated', 'permission_deleted',
      'permission_create_failed', 'permission_update_failed', 'permission_delete_failed',
      
      // Settings/Config management
      'settings_created', 'settings_updated', 'settings_deleted',
      'settings_create_failed', 'settings_update_failed', 'settings_delete_failed',
      'config_created', 'config_updated', 'config_deleted',
      'config_create_failed', 'config_update_failed', 'config_delete_failed',
      
      // Upload management
      'upload_created', 'upload_deleted',
      'upload_create_failed', 'upload_delete_failed',
      
      // Website management
      'website_created', 'website_updated', 'website_deleted',
      'website_create_failed', 'website_update_failed', 'website_delete_failed',
      
      // Mobile management
      'mobile_created', 'mobile_updated', 'mobile_deleted',
      'mobile_create_failed', 'mobile_update_failed', 'mobile_delete_failed',
      
      // SMS management  
      'sms_created', 'sms_updated', 'sms_deleted',
      'sms_create_failed', 'sms_update_failed', 'sms_delete_failed',
      
      // Regional admin management
      'regional_admin_created', 'regional_admin_updated', 'regional_admin_deleted',
      'regional_admin_create_failed', 'regional_admin_update_failed', 'regional_admin_delete_failed',
      
      // Report generation
      'report_generated', 'report_downloaded', 'report_shared',
      'report_created', 'report_updated', 'report_deleted',
      'report_create_failed', 'report_update_failed', 'report_delete_failed',
      
      // Data operations
      'data_export', 'data_exported', 'data_import', 'data_accessed',
      'export_failed',
      
      // System actions
      'system_backup', 'system_restore', 'system_maintenance',
      'settings_updated_legacy', 'configuration_changed',
      'logging_error',
      
      // Security actions
      'permission_denied', 'unauthorized_access', 'suspicious_activity',
      
      // Generic CRUD fallbacks
      'created', 'updated', 'deleted',
      'create_failed', 'update_failed', 'delete_failed'
    ]
  },
  
  // Resource information
  resource: {
    type: String,
    required: true,
    enum: [
      'user', 'beneficiary', 'application', 'project', 'scheme', 
      'payment', 'report', 'system', 'auth', 'role', 'permission',
      'donor', 'donation', 'notification', 'interview', 'location',
      'form', 'banner', 'brochure', 'partner', 'news_event',
      'budget', 'master_data', 'upload', 'mobile', 'config',
      'recurring_payment', 'regional_admin', 'website', 'sms', 'settings'
    ]
  },
  
  resourceId: {
    type: mongoose.Schema.Types.ObjectId,
    index: true
  },
  
  // Action description
  description: {
    type: String,
    required: true
  },
  
  // Additional details (flexible JSON)
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Change tracking (before/after values for updates)
  changes: [{
    field: { type: String, required: true },
    oldValue: { type: mongoose.Schema.Types.Mixed },
    newValue: { type: mongoose.Schema.Types.Mixed }
  }],
  
  // Request information
  ipAddress: {
    type: String,
    required: true
  },
  
  userAgent: {
    type: String
  },
  
  // Geographic information
  location: {
    country: String,
    region: String,
    city: String
  },
  
  // Status and severity
  status: {
    type: String,
    enum: ['success', 'failed', 'warning', 'info'],
    default: 'success'
  },
  
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'low'
  },
  
  // Metadata
  metadata: {
    sessionId: String,
    requestId: String,
    duration: Number, // in milliseconds
    endpoint: String,
    method: String,
    statusCode: Number
  },
  
  // Timestamps
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  // Soft delete
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  collection: 'activity_logs'
});

// Indexes for better query performance
activityLogSchema.index({ userId: 1, timestamp: -1 });
activityLogSchema.index({ action: 1, timestamp: -1 });
activityLogSchema.index({ resource: 1, timestamp: -1 });
activityLogSchema.index({ status: 1, timestamp: -1 });
activityLogSchema.index({ severity: 1, timestamp: -1 });
activityLogSchema.index({ 'metadata.endpoint': 1, timestamp: -1 });
activityLogSchema.index({ timestamp: -1 }); // For general sorting

// Compound indexes for common queries
activityLogSchema.index({ userId: 1, action: 1, timestamp: -1 });
activityLogSchema.index({ resource: 1, resourceId: 1, timestamp: -1 });

// Virtual for user details
activityLogSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

// Methods
activityLogSchema.methods.toJSON = function() {
  const log = this.toObject();
  
  // Remove sensitive information
  if (log.details && log.details.password) {
    delete log.details.password;
  }
  if (log.details && log.details.token) {
    delete log.details.token;
  }
  
  return log;
};

// Static methods
activityLogSchema.statics.logActivity = async function(data) {
  try {
    const log = new this(data);
    await log.save();
    return log;
  } catch (error) {
    console.error('Failed to log activity:', error);
    // Don't throw error to avoid breaking the main operation
    return null;
  }
};

activityLogSchema.statics.getActivityStats = async function(filters = {}) {
  const pipeline = [
    { $match: { isDeleted: false, ...filters } },
    {
      $group: {
        _id: {
          action: '$action',
          status: '$status'
        },
        count: { $sum: 1 },
        lastActivity: { $max: '$timestamp' }
      }
    },
    {
      $group: {
        _id: '$_id.action',
        total: { $sum: '$count' },
        success: {
          $sum: {
            $cond: [{ $eq: ['$_id.status', 'success'] }, '$count', 0]
          }
        },
        failed: {
          $sum: {
            $cond: [{ $eq: ['$_id.status', 'failed'] }, '$count', 0]
          }
        },
        lastActivity: { $max: '$lastActivity' }
      }
    },
    { $sort: { total: -1 } }
  ];
  
  return await this.aggregate(pipeline);
};

activityLogSchema.statics.getUserActivity = async function(userId, options = {}) {
  const {
    limit = 50,
    skip = 0,
    startDate,
    endDate,
    actions,
    resources
  } = options;
  
  const filters = { userId, isDeleted: false };
  
  if (startDate || endDate) {
    filters.timestamp = {};
    if (startDate) filters.timestamp.$gte = new Date(startDate);
    if (endDate) filters.timestamp.$lte = new Date(endDate);
  }
  
  if (actions && actions.length > 0) {
    filters.action = { $in: actions };
  }
  
  if (resources && resources.length > 0) {
    filters.resource = { $in: resources };
  }
  
  return await this.find(filters)
    .populate('userId', 'name email phone role')
    .sort({ timestamp: -1 })
    .limit(limit)
    .skip(skip);
};

// TTL index for automatic cleanup (optional - keep logs for 1 year)
activityLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);