const mongoose = require('mongoose');
const franchisePlugin = require('../utils/franchisePlugin');

const dashboardSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: [true, 'Dashboard name is required'],
    trim: true
  },
  description: String,
  
  // Dashboard Type and Scope
  type: {
    type: String,
    enum: ['overview', 'applications', 'payments', 'projects', 'schemes', 'beneficiaries', 'reports', 'analytics'],
    required: [true, 'Dashboard type is required']
  },
  scope: {
    type: String,
    enum: ['personal', 'team', 'regional', 'organizational'],
    default: 'personal'
  },
  
  // Access Control
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Dashboard owner is required']
  },
  visibility: {
    type: String,
    enum: ['private', 'shared', 'public'],
    default: 'private'
  },
  sharedWith: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String,
      enum: ['viewer', 'editor', 'admin']
    },
    sharedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Layout and Configuration
  layout: {
    columns: {
      type: Number,
      min: 1,
      max: 12,
      default: 12
    },
    rows: {
      type: Number,
      min: 1,
      default: 10
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'light'
    },
    refreshInterval: {
      type: Number, // in seconds
      min: 30,
      default: 300 // 5 minutes
    }
  },
  
  // Widgets Configuration
  widgets: [{
    id: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: [
        'metric_card', 'chart', 'table', 'list', 'map', 'calendar', 
        'progress_bar', 'gauge', 'timeline', 'notification_feed'
      ],
      required: true
    },
    title: String,
    position: {
      x: { type: Number, required: true },
      y: { type: Number, required: true },
      width: { type: Number, required: true },
      height: { type: Number, required: true }
    },
    config: {
      // Data source configuration
      dataSource: {
        type: {
          type: String,
          enum: ['applications', 'payments', 'beneficiaries', 'projects', 'schemes', 'notifications', 'custom']
        },
        filters: mongoose.Schema.Types.Mixed,
        aggregation: mongoose.Schema.Types.Mixed,
        refreshInterval: Number
      },
      
      // Visualization configuration
      visualization: {
        chartType: {
          type: String,
          enum: ['line', 'bar', 'pie', 'doughnut', 'area', 'scatter', 'radar']
        },
        xAxis: String,
        yAxis: String,
        groupBy: String,
        colorScheme: String,
        showLegend: Boolean,
        showGrid: Boolean
      },
      
      // Display options
      display: {
        showTitle: { type: Boolean, default: true },
        showBorder: { type: Boolean, default: true },
        backgroundColor: String,
        textColor: String,
        fontSize: String
      },
      
      // Interaction options
      interactions: {
        clickable: { type: Boolean, default: false },
        drillDown: String,
        exportable: { type: Boolean, default: true },
        fullScreen: { type: Boolean, default: true }
      }
    },
    
    // Widget data cache
    cachedData: {
      data: mongoose.Schema.Types.Mixed,
      lastUpdated: Date,
      expiresAt: Date
    },
    
    // Widget status
    status: {
      type: String,
      enum: ['active', 'loading', 'error', 'disabled'],
      default: 'active'
    },
    errorMessage: String,
    
    // Widget metadata
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: Date
  }],
  
  // Filters and Parameters
  globalFilters: {
    dateRange: {
      start: Date,
      end: Date,
      preset: {
        type: String,
        enum: ['today', 'yesterday', 'last_7_days', 'last_30_days', 'this_month', 'last_month', 'this_year', 'custom']
      }
    },
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
    status: [String],
    customFilters: mongoose.Schema.Types.Mixed
  },
  
  // Dashboard Statistics
  statistics: {
    viewCount: {
      type: Number,
      default: 0
    },
    lastViewed: Date,
    averageViewDuration: Number, // in seconds
    uniqueViewers: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      viewCount: Number,
      lastViewed: Date
    }]
  },
  
  // Export and Sharing
  exports: [{
    format: {
      type: String,
      enum: ['pdf', 'excel', 'csv', 'png', 'jpeg']
    },
    url: String,
    generatedAt: Date,
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    expiresAt: Date
  }],
  
  // Alerts and Notifications
  alerts: [{
    name: String,
    condition: mongoose.Schema.Types.Mixed,
    threshold: Number,
    operator: {
      type: String,
      enum: ['greater_than', 'less_than', 'equals', 'not_equals']
    },
    enabled: {
      type: Boolean,
      default: true
    },
    recipients: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    lastTriggered: Date,
    triggerCount: {
      type: Number,
      default: 0
    }
  }],
  
  // Dashboard Settings
  settings: {
    autoRefresh: {
      type: Boolean,
      default: true
    },
    showFilters: {
      type: Boolean,
      default: true
    },
    allowExport: {
      type: Boolean,
      default: true
    },
    allowSharing: {
      type: Boolean,
      default: true
    },
    enableAlerts: {
      type: Boolean,
      default: false
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata'
    }
  },
  
  // Status and Metadata
  status: {
    type: String,
    enum: ['active', 'inactive', 'archived'],
    default: 'active'
  },
  tags: [String],
  
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
dashboardSchema.index({ owner: 1, type: 1 });
dashboardSchema.index({ visibility: 1 });
dashboardSchema.index({ 'sharedWith.user': 1 });
dashboardSchema.index({ status: 1 });
dashboardSchema.index({ tags: 1 });

// Virtual for widget count
dashboardSchema.virtual('widgetCount').get(function() {
  return this.widgets ? this.widgets.length : 0;
});

// Virtual for active widgets count
dashboardSchema.virtual('activeWidgetsCount').get(function() {
  return this.widgets ? this.widgets.filter(w => w.status === 'active').length : 0;
});

// Method to add widget
dashboardSchema.methods.addWidget = function(widgetConfig) {
  const widget = {
    id: new mongoose.Types.ObjectId().toString(),
    ...widgetConfig,
    createdAt: new Date(),
    status: 'active'
  };
  
  this.widgets.push(widget);
  return this.save();
};

// Method to update widget
dashboardSchema.methods.updateWidget = function(widgetId, updates) {
  const widget = this.widgets.find(w => w.id === widgetId);
  if (!widget) throw new Error('Widget not found');
  
  Object.assign(widget, updates);
  widget.updatedAt = new Date();
  
  return this.save();
};

// Method to remove widget
dashboardSchema.methods.removeWidget = function(widgetId) {
  this.widgets = this.widgets.filter(w => w.id !== widgetId);
  return this.save();
};

// Method to share dashboard
dashboardSchema.methods.shareWith = function(userId, role = 'viewer') {
  // Check if already shared
  const existingShare = this.sharedWith.find(share => 
    share.user.toString() === userId.toString()
  );
  
  if (existingShare) {
    existingShare.role = role;
    existingShare.sharedAt = new Date();
  } else {
    this.sharedWith.push({
      user: userId,
      role,
      sharedAt: new Date()
    });
  }
  
  return this.save();
};

// Method to unshare dashboard
dashboardSchema.methods.unshareWith = function(userId) {
  this.sharedWith = this.sharedWith.filter(share => 
    share.user.toString() !== userId.toString()
  );
  
  return this.save();
};

// Method to record view
dashboardSchema.methods.recordView = function(userId, duration = null) {
  this.statistics.viewCount++;
  this.statistics.lastViewed = new Date();
  
  if (duration) {
    const currentAvg = this.statistics.averageViewDuration || 0;
    const totalViews = this.statistics.viewCount;
    this.statistics.averageViewDuration = 
      ((currentAvg * (totalViews - 1)) + duration) / totalViews;
  }
  
  // Update unique viewer stats
  let viewer = this.statistics.uniqueViewers.find(v => 
    v.user.toString() === userId.toString()
  );
  
  if (viewer) {
    viewer.viewCount++;
    viewer.lastViewed = new Date();
  } else {
    this.statistics.uniqueViewers.push({
      user: userId,
      viewCount: 1,
      lastViewed: new Date()
    });
  }
  
  return this.save();
};

// Method to update widget data cache
dashboardSchema.methods.updateWidgetCache = function(widgetId, data, ttl = 300) {
  const widget = this.widgets.find(w => w.id === widgetId);
  if (!widget) throw new Error('Widget not found');
  
  widget.cachedData = {
    data,
    lastUpdated: new Date(),
    expiresAt: new Date(Date.now() + (ttl * 1000))
  };
  
  widget.status = 'active';
  widget.errorMessage = null;
  
  return this.save();
};

// Method to set widget error
dashboardSchema.methods.setWidgetError = function(widgetId, errorMessage) {
  const widget = this.widgets.find(w => w.id === widgetId);
  if (!widget) throw new Error('Widget not found');
  
  widget.status = 'error';
  widget.errorMessage = errorMessage;
  
  return this.save();
};

// Method to check user access
dashboardSchema.methods.hasUserAccess = function(userId, requiredRole = 'viewer') {
  // Owner has full access
  if (this.owner.toString() === userId.toString()) return true;
  
  // Check if publicly visible
  if (this.visibility === 'public') return true;
  
  // Check shared access
  const share = this.sharedWith.find(s => s.user.toString() === userId.toString());
  if (!share) return false;
  
  // Check role hierarchy: admin > editor > viewer
  const roleHierarchy = { viewer: 1, editor: 2, admin: 3 };
  const userRoleLevel = roleHierarchy[share.role] || 0;
  const requiredRoleLevel = roleHierarchy[requiredRole] || 0;
  
  return userRoleLevel >= requiredRoleLevel;
};

// Static method to get dashboards by user
dashboardSchema.statics.getByUser = function(userId, type = null) {
  let query = {
    $or: [
      { owner: userId },
      { 'sharedWith.user': userId },
      { visibility: 'public' }
    ]
  };
  
  if (type) {
    query.type = type;
  }
  
  return this.find(query)
    .populate('owner', 'name email')
    .populate('sharedWith.user', 'name email')
    .sort({ updatedAt: -1 });
};

// Static method to get popular dashboards
dashboardSchema.statics.getPopular = function(limit = 10) {
  return this.find({ visibility: 'public', status: 'active' })
    .sort({ 'statistics.viewCount': -1 })
    .limit(limit)
    .populate('owner', 'name');
};

// Pre-save middleware
dashboardSchema.pre('save', function(next) {
  // Ensure widget IDs are unique
  const widgetIds = this.widgets.map(w => w.id);
  const uniqueIds = [...new Set(widgetIds)];
  
  if (widgetIds.length !== uniqueIds.length) {
    return next(new Error('Widget IDs must be unique'));
  }
  
  // Clean expired cached data
  this.widgets.forEach(widget => {
    if (widget.cachedData && widget.cachedData.expiresAt < new Date()) {
      widget.cachedData = undefined;
    }
  });
  
  next();
});

dashboardSchema.plugin(franchisePlugin);

module.exports = mongoose.model('Dashboard', dashboardSchema);