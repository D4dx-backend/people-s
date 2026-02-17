const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  // Basic Information
  title: {
    type: String,
    required: [true, 'Notification title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  message: {
    type: String,
    required: [true, 'Notification message is required'],
    maxlength: [1000, 'Message cannot exceed 1000 characters']
  },
  
  // Notification Type and Category
  type: {
    type: String,
    enum: ['sms', 'email', 'push', 'in_app', 'whatsapp'],
    required: [true, 'Notification type is required']
  },
  category: {
    type: String,
    enum: ['application_status', 'payment', 'reminder', 'announcement', 'alert', 'system', 'marketing'],
    required: [true, 'Notification category is required']
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  
  // Recipients
  recipients: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    beneficiary: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Beneficiary'
    },
    phone: String,
    email: String,
    fcmToken: String,
    status: {
      type: String,
      enum: ['pending', 'sent', 'delivered', 'read', 'failed'],
      default: 'pending'
    },
    sentAt: Date,
    deliveredAt: Date,
    readAt: Date,
    failureReason: String,
    attempts: {
      type: Number,
      default: 0
    }
  }],
  
  // Content Variations
  content: {
    sms: {
      text: String,
      templateId: String,
      variables: mongoose.Schema.Types.Mixed
    },
    email: {
      subject: String,
      htmlBody: String,
      textBody: String,
      attachments: [{
        name: String,
        url: String,
        type: String
      }]
    },
    push: {
      title: String,
      body: String,
      icon: String,
      image: String,
      clickAction: String,
      data: mongoose.Schema.Types.Mixed
    },
    inApp: {
      title: String,
      body: String,
      icon: String,
      actionUrl: String,
      actionText: String
    }
  },
  
  // Targeting and Filtering
  targeting: {
    userRoles: [{
      type: String,
      enum: ['state_admin', 'project_coordinator', 'scheme_coordinator', 'district_admin', 'area_admin', 'unit_admin', 'beneficiary']
    }],
    regions: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location'
    }],
    projects: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project'
    }],
    schemes: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Scheme'
    }],
    customFilters: mongoose.Schema.Types.Mixed
  },
  
  // Scheduling
  scheduling: {
    sendAt: {
      type: Date,
      default: Date.now
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata'
    },
    recurring: {
      enabled: {
        type: Boolean,
        default: false
      },
      frequency: {
        type: String,
        enum: ['daily', 'weekly', 'monthly', 'yearly']
      },
      interval: Number,
      endDate: Date,
      daysOfWeek: [Number], // 0-6 (Sunday-Saturday)
      dayOfMonth: Number,
      lastSent: Date
    }
  },
  
  // Related Entities
  relatedEntities: {
    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Application'
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project'
    },
    scheme: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Scheme'
    },
    enquiryReport: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EnquiryReport'
    },
    donation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Donation'
    },
    donor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Donor'
    },
    donorFollowUp: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DonorFollowUp'
    }
  },
  
  // Delivery Status
  delivery: {
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'sending', 'sent', 'partially_sent', 'failed'],
      default: 'draft'
    },
    totalRecipients: {
      type: Number,
      default: 0
    },
    sentCount: {
      type: Number,
      default: 0
    },
    deliveredCount: {
      type: Number,
      default: 0
    },
    readCount: {
      type: Number,
      default: 0
    },
    failedCount: {
      type: Number,
      default: 0
    },
    startedAt: Date,
    completedAt: Date,
    estimatedDeliveryTime: Date
  },
  
  // Provider Information
  provider: {
    sms: {
      name: {
        type: String,
        default: 'DXing'
      },
      messageId: String,
      cost: Number,
      credits: Number
    },
    email: {
      name: {
        type: String,
        default: 'SMTP'
      },
      messageId: String
    },
    push: {
      name: {
        type: String,
        default: 'Firebase'
      },
      messageId: String,
      multicastId: String
    }
  },
  
  // Analytics and Tracking
  analytics: {
    openRate: {
      type: Number,
      default: 0
    },
    clickRate: {
      type: Number,
      default: 0
    },
    bounceRate: {
      type: Number,
      default: 0
    },
    unsubscribeRate: {
      type: Number,
      default: 0
    },
    clicks: [{
      url: String,
      count: Number,
      recipients: [String]
    }]
  },
  
  // Settings
  settings: {
    trackOpens: {
      type: Boolean,
      default: true
    },
    trackClicks: {
      type: Boolean,
      default: true
    },
    allowUnsubscribe: {
      type: Boolean,
      default: true
    },
    retryFailures: {
      type: Boolean,
      default: true
    },
    maxRetries: {
      type: Number,
      default: 3
    }
  },
  
  // Audit Trail
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
notificationSchema.index({ type: 1, category: 1 });
notificationSchema.index({ 'delivery.status': 1 });
notificationSchema.index({ 'scheduling.sendAt': 1 });
notificationSchema.index({ 'recipients.user': 1 });
notificationSchema.index({ 'recipients.beneficiary': 1 });
notificationSchema.index({ 'relatedEntities.application': 1 });
notificationSchema.index({ createdBy: 1 });
notificationSchema.index({ 'targeting.userRoles': 1 });
notificationSchema.index({ 'targeting.regions': 1 });

// Virtual for delivery rate
notificationSchema.virtual('deliveryRate').get(function() {
  if (this.delivery.totalRecipients === 0) return 0;
  return Math.round((this.delivery.deliveredCount / this.delivery.totalRecipients) * 100);
});

// Virtual for success rate
notificationSchema.virtual('successRate').get(function() {
  if (this.delivery.totalRecipients === 0) return 0;
  return Math.round((this.delivery.sentCount / this.delivery.totalRecipients) * 100);
});

// Method to add recipient
notificationSchema.methods.addRecipient = function(recipientData) {
  this.recipients.push({
    ...recipientData,
    status: 'pending',
    attempts: 0
  });
  
  this.delivery.totalRecipients = this.recipients.length;
  return this.save();
};

// Method to update recipient status
notificationSchema.methods.updateRecipientStatus = function(recipientId, status, metadata = {}) {
  const recipient = this.recipients.id(recipientId);
  if (!recipient) return false;
  
  recipient.status = status;
  
  switch (status) {
    case 'sent':
      recipient.sentAt = new Date();
      this.delivery.sentCount++;
      break;
    case 'delivered':
      recipient.deliveredAt = new Date();
      this.delivery.deliveredCount++;
      break;
    case 'read':
      recipient.readAt = new Date();
      this.delivery.readCount++;
      break;
    case 'failed':
      recipient.failureReason = metadata.reason;
      this.delivery.failedCount++;
      break;
  }
  
  // Update overall delivery status
  this.updateDeliveryStatus();
  
  return this.save();
};

// Method to update delivery status
notificationSchema.methods.updateDeliveryStatus = function() {
  const total = this.delivery.totalRecipients;
  const sent = this.delivery.sentCount;
  const failed = this.delivery.failedCount;
  
  if (sent + failed === total) {
    this.delivery.status = failed === 0 ? 'sent' : (sent > 0 ? 'partially_sent' : 'failed');
    this.delivery.completedAt = new Date();
  } else if (sent > 0 || failed > 0) {
    this.delivery.status = 'sending';
  }
};

// Method to calculate analytics
notificationSchema.methods.calculateAnalytics = function() {
  const total = this.delivery.totalRecipients;
  if (total === 0) return;
  
  this.analytics.openRate = Math.round((this.delivery.readCount / total) * 100);
  
  // Calculate click rate if tracking is enabled
  if (this.settings.trackClicks && this.analytics.clicks.length > 0) {
    const totalClicks = this.analytics.clicks.reduce((sum, click) => sum + click.count, 0);
    this.analytics.clickRate = Math.round((totalClicks / total) * 100);
  }
  
  // Calculate bounce rate
  this.analytics.bounceRate = Math.round((this.delivery.failedCount / total) * 100);
  
  return this.save();
};

// Static method to get notifications by user
notificationSchema.statics.getByUser = function(userId, type = null, unreadOnly = false) {
  let query = { 'recipients.user': userId };
  
  if (type) {
    query.type = type;
  }
  
  if (unreadOnly) {
    // Ensure we match the same recipient element for this user
    query.recipients = { $elemMatch: { user: userId, status: { $ne: 'read' } } };
  }
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .populate('createdBy', 'name')
    .populate('relatedEntities.application', 'applicationNumber')
    .populate('relatedEntities.project', 'name')
    .populate('relatedEntities.scheme', 'name');
};

// Static method to mark as read
notificationSchema.statics.markAsRead = function(notificationId, userId) {
  return this.updateOne(
    { 
      _id: notificationId,
      'recipients.user': userId 
    },
    { 
      $set: { 
        'recipients.$.status': 'read',
        'recipients.$.readAt': new Date()
      }
    }
  );
};

// Static method to get pending notifications for sending
notificationSchema.statics.getPendingNotifications = function() {
  return this.find({
    'delivery.status': { $in: ['scheduled', 'sending'] },
    'scheduling.sendAt': { $lte: new Date() }
  }).sort({ 'scheduling.sendAt': 1 });
};

// Pre-save middleware
notificationSchema.pre('save', function(next) {
  // Set total recipients count
  if (this.isModified('recipients')) {
    this.delivery.totalRecipients = this.recipients.length;
  }
  
  // Set delivery status to scheduled if sendAt is in future
  if (this.isNew && this.scheduling.sendAt > new Date()) {
    this.delivery.status = 'scheduled';
  }
  
  next();
});

module.exports = mongoose.model('Notification', notificationSchema);