const mongoose = require('mongoose');
const franchisePlugin = require('../utils/franchisePlugin');
const crypto = require('crypto');

const errorLogSchema = new mongoose.Schema({
  // Error classification
  errorType: {
    type: String,
    required: true,
    enum: [
      'validation_error',
      'authentication_error',
      'authorization_error',
      'not_found',
      'database_error',
      'external_service_error',
      'rate_limit_error',
      'file_upload_error',
      'internal_error',
      'timeout_error',
      'unhandled_rejection',
      'uncaught_exception'
    ],
    default: 'internal_error'
  },

  // Error details
  message: {
    type: String,
    required: true
  },

  stack: {
    type: String
  },

  statusCode: {
    type: Number,
    default: 500
  },

  // Severity
  severity: {
    type: String,
    enum: ['critical', 'high', 'medium', 'low'],
    required: true,
    default: 'medium'
  },

  // Request context
  request: {
    method: String,
    url: String,
    params: mongoose.Schema.Types.Mixed,
    query: mongoose.Schema.Types.Mixed,
    body: mongoose.Schema.Types.Mixed, // sanitized
    headers: mongoose.Schema.Types.Mixed
  },

  // User context (if authenticated)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  // Client info
  ipAddress: String,
  userAgent: String,

  // Error fingerprint for grouping duplicate errors
  fingerprint: {
    type: String,
    required: true,
    index: true
  },

  // Deduplication tracking
  occurrenceCount: {
    type: Number,
    default: 1
  },

  firstOccurrence: {
    type: Date,
    default: Date.now
  },

  lastOccurrence: {
    type: Date,
    default: Date.now
  },

  // Resolution tracking
  isResolved: {
    type: Boolean,
    default: false,
    index: true
  },

  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  resolvedAt: {
    type: Date,
    default: null
  },

  resolutionNote: {
    type: String,
    default: null
  },

  // Additional metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Timestamp
  timestamp: {
    type: Date,
    default: Date.now
    // index handled by TTL index below
  }
}, {
  timestamps: true,
  collection: 'error_logs'
});

// Indexes
errorLogSchema.index({ errorType: 1, timestamp: -1 });
errorLogSchema.index({ severity: 1, timestamp: -1 });
errorLogSchema.index({ statusCode: 1, timestamp: -1 });
errorLogSchema.index({ isResolved: 1, timestamp: -1 });
errorLogSchema.index({ userId: 1, timestamp: -1 });
errorLogSchema.index({ fingerprint: 1, isResolved: 1 });

// Compound indexes
errorLogSchema.index({ errorType: 1, severity: 1, timestamp: -1 });
errorLogSchema.index({ 'request.url': 1, timestamp: -1 });

// TTL index - auto-delete after 90 days
errorLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

/**
 * Generate a fingerprint hash for error deduplication
 */
errorLogSchema.statics.generateFingerprint = function(err, endpoint) {
  const key = `${err.name || 'Error'}:${err.message}:${endpoint || 'unknown'}`;
  return crypto.createHash('md5').update(key).digest('hex');
};

/**
 * Log an error (upsert by fingerprint for deduplication)
 */
errorLogSchema.statics.logError = async function(data) {
  try {
    const existing = await this.findOne({
      fingerprint: data.fingerprint,
      isResolved: false
    });

    if (existing) {
      // Increment occurrence count for duplicate errors
      existing.occurrenceCount += 1;
      existing.lastOccurrence = new Date();
      // Update request context to latest
      if (data.request) existing.request = data.request;
      if (data.userId) existing.userId = data.userId;
      if (data.ipAddress) existing.ipAddress = data.ipAddress;
      if (data.userAgent) existing.userAgent = data.userAgent;
      await existing.save();
      return existing;
    }

    // Create new error log
    const log = new this(data);
    await log.save();
    return log;
  } catch (error) {
    console.error('Failed to log error:', error);
    return null;
  }
};

errorLogSchema.plugin(franchisePlugin);

module.exports = mongoose.model('ErrorLog', errorLogSchema);
