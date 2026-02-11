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
      
      // User management
      'user_created', 'user_updated', 'user_deleted', 'user_activated', 'user_deactivated',
      'role_assigned', 'role_removed', 'permissions_updated',
      
      // Beneficiary management
      'beneficiary_created', 'beneficiary_updated', 'beneficiary_deleted', 'beneficiary_approved', 'beneficiary_rejected',
      'beneficiary_create_failed', 'beneficiary_update_failed',
      'interview_scheduled', 'interview_completed', 'interview_cancelled',
      
      // Application management
      'application_created', 'application_updated', 'application_submitted', 'application_approved', 'application_rejected',
      
      // Project management
      'project_created', 'project_updated', 'project_deleted', 'project_activated', 'project_deactivated',
      'project_create_failed', 'project_update_failed',
      
      // Scheme management
      'scheme_created', 'scheme_updated', 'scheme_deleted', 'scheme_activated', 'scheme_deactivated',
      'scheme_create_failed', 'scheme_update_failed',
      
      // Payment management
      'payment_created', 'payment_updated', 'payment_approved', 'payment_rejected', 'payment_processed',
      'payment_update_failed', 'payment_create_failed',
      
      // Report generation
      'report_generated', 'report_downloaded', 'report_shared',
      
      // System actions
      'system_backup', 'system_restore', 'data_export', 'data_import',
      'settings_updated', 'configuration_changed', 'data_accessed',
      
      // Security actions
      'permission_denied', 'unauthorized_access', 'suspicious_activity'
    ]
  },
  
  // Resource information
  resource: {
    type: String,
    required: true,
    enum: [
      'user', 'beneficiary', 'application', 'project', 'scheme', 
      'payment', 'report', 'system', 'auth', 'role', 'permission'
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