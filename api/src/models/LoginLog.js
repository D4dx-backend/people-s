const mongoose = require('mongoose');

const loginLogSchema = new mongoose.Schema({
  // User who attempted login
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },

  // User type
  userType: {
    type: String,
    enum: ['admin', 'beneficiary'],
    required: true,
    default: 'admin'
  },

  // Login action
  action: {
    type: String,
    required: true,
    enum: [
      'otp_requested',
      'otp_verified',
      'login_success',
      'login_failed',
      'logout',
      'token_refresh',
      'registration_completed',
      'otp_resent'
    ]
  },

  // Status
  status: {
    type: String,
    enum: ['success', 'failed'],
    required: true,
    default: 'success'
  },

  // Phone number (always capture for login attempts)
  phone: {
    type: String,
    required: true,
    index: true
  },

  // Request information
  ipAddress: {
    type: String,
    required: true
  },

  userAgent: {
    type: String
  },

  // Parsed device info
  device: {
    type: {
      type: String // desktop, mobile, tablet
    },
    os: String,
    osVersion: String,
    browser: String,
    browserVersion: String,
    deviceModel: String,
    deviceVendor: String
  },

  // Geographic information (from geoip-lite)
  location: {
    country: String,
    region: String,
    city: String,
    latitude: Number,
    longitude: Number
  },

  // Failure details
  failureReason: {
    type: String,
    enum: [
      'invalid_otp',
      'expired_otp',
      'rate_limited',
      'user_not_found',
      'user_inactive',
      'max_attempts',
      'invalid_token',
      'invalid_phone',
      'security_error',
      'server_error',
      null
    ],
    default: null
  },

  // OTP tracking details
  otpDetails: {
    requestedAt: Date,
    verifiedAt: Date,
    attempts: Number,
    channel: {
      type: String,
      enum: ['sms', 'whatsapp', 'static', 'test', 'development', null],
      default: null
    },
    purpose: String
  },

  // Session tracking
  sessionId: String,

  // Additional metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Timestamp
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true,
  collection: 'login_logs'
});

// Indexes for common queries
loginLogSchema.index({ userId: 1, timestamp: -1 });
loginLogSchema.index({ phone: 1, timestamp: -1 });
loginLogSchema.index({ action: 1, status: 1, timestamp: -1 });
loginLogSchema.index({ ipAddress: 1, timestamp: -1 });
loginLogSchema.index({ userType: 1, timestamp: -1 });
loginLogSchema.index({ 'device.type': 1, timestamp: -1 });
loginLogSchema.index({ status: 1, timestamp: -1 });

// Compound indexes for analytics
loginLogSchema.index({ action: 1, status: 1, userType: 1, timestamp: -1 });
loginLogSchema.index({ ipAddress: 1, status: 1, timestamp: -1 });

// TTL index - auto-delete after 1 year
loginLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

// Static method to log a login event
loginLogSchema.statics.logEvent = async function(data) {
  try {
    const log = new this(data);
    await log.save();
    return log;
  } catch (error) {
    console.error('Failed to log login event:', error);
    return null;
  }
};

// Static method to get login stats
loginLogSchema.statics.getLoginStats = async function(filters = {}) {
  const match = { ...filters };
  
  const pipeline = [
    { $match: match },
    {
      $group: {
        _id: {
          action: '$action',
          status: '$status'
        },
        count: { $sum: 1 },
        lastEvent: { $max: '$timestamp' }
      }
    },
    {
      $group: {
        _id: '$_id.action',
        total: { $sum: '$count' },
        success: {
          $sum: { $cond: [{ $eq: ['$_id.status', 'success'] }, '$count', 0] }
        },
        failed: {
          $sum: { $cond: [{ $eq: ['$_id.status', 'failed'] }, '$count', 0] }
        },
        lastEvent: { $max: '$lastEvent' }
      }
    },
    { $sort: { total: -1 } }
  ];

  return await this.aggregate(pipeline);
};

module.exports = mongoose.model('LoginLog', loginLogSchema);
