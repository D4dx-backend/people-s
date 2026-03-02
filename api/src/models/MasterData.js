const mongoose = require('mongoose');
const franchisePlugin = require('../utils/franchisePlugin');

const masterDataSchema = new mongoose.Schema({
  // Master Data Type
  type: {
    type: String,
    required: [true, 'Master data type is required'],
    enum: ['scheme_stages', 'project_stages', 'application_stages', 'distribution_timeline_templates', 'status_configurations'],
    index: true
  },
  
  // Category for grouping (optional)
  category: {
    type: String,
    maxlength: 100,
    index: true
  },
  
  // Name/Title
  name: {
    type: String,
    required: [true, 'Name is required'],
    maxlength: 200,
    trim: true
  },
  
  // Description
  description: {
    type: String,
    maxlength: 1000
  },
  
  // Configuration Data (flexible JSON structure)
  configuration: {
    // For scheme_stages and project_stages
    stages: [{
      name: {
        type: String,
        maxlength: 100
      },
      description: {
        type: String,
        maxlength: 500
      },
      order: {
        type: Number,
        min: 1
      },
      isRequired: {
        type: Boolean,
        default: true
      },
      allowedRoles: [{
        type: String,
        enum: ['super_admin', 'state_admin', 'district_admin', 'area_admin', 'unit_admin', 'project_coordinator', 'scheme_coordinator']
      }],
      estimatedDuration: {
        type: Number, // in days
        min: 0
      },
      autoTransition: {
        type: Boolean,
        default: false
      },
      transitionConditions: {
        type: String,
        maxlength: 500
      },
      color: {
        type: String,
        default: '#3B82F6'
      },
      icon: {
        type: String,
        maxlength: 50
      }
    }],
    
    // For distribution_timeline_templates
    distributionSteps: [{
      description: {
        type: String,
        maxlength: 200
      },
      percentage: {
        type: Number,
        min: 0,
        max: 100
      },
      daysFromApproval: {
        type: Number,
        min: 0
      },
      isAutomatic: {
        type: Boolean,
        default: false
      },
      requiresVerification: {
        type: Boolean,
        default: true
      },
      notes: {
        type: String,
        maxlength: 500
      }
    }],
    
    // General settings
    settings: {
      enableNotifications: {
        type: Boolean,
        default: true
      },
      enablePublicTracking: {
        type: Boolean,
        default: false
      },
      autoProgressCalculation: {
        type: Boolean,
        default: true
      },
      requireApprovalForUpdates: {
        type: Boolean,
        default: false
      }
    }
  },
  
  // Scope and Applicability
  scope: {
    type: String,
    enum: ['global', 'state', 'district', 'area', 'unit', 'project_specific', 'scheme_specific'],
    default: 'global'
  },
  
  // Target Regions (if scope is regional)
  targetRegions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location'
  }],
  
  // Target Projects (if scope is project_specific)
  targetProjects: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project'
  }],
  
  // Target Schemes (if scope is scheme_specific)
  targetSchemes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Scheme'
  }],
  
  // Status and Versioning
  status: {
    type: String,
    enum: ['draft', 'active', 'inactive', 'archived'],
    default: 'draft'
  },
  
  version: {
    type: String,
    default: '1.0'
  },
  
  // Effective dates
  effectiveFrom: {
    type: Date,
    default: Date.now
  },
  
  effectiveTo: {
    type: Date
  },
  
  // Usage tracking
  usageCount: {
    type: Number,
    default: 0
  },
  
  lastUsed: {
    type: Date
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
  },
  
  // Tags for easy searching
  tags: [{
    type: String,
    maxlength: 50
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
masterDataSchema.index({ type: 1, category: 1 });
masterDataSchema.index({ status: 1 });
masterDataSchema.index({ scope: 1 });
masterDataSchema.index({ targetRegions: 1 });
masterDataSchema.index({ targetProjects: 1 });
masterDataSchema.index({ targetSchemes: 1 });
masterDataSchema.index({ effectiveFrom: 1, effectiveTo: 1 });
masterDataSchema.index({ tags: 1 });

// Virtual for checking if configuration is currently effective
masterDataSchema.virtual('isEffective').get(function() {
  const now = new Date();
  const effectiveFrom = this.effectiveFrom || new Date(0);
  const effectiveTo = this.effectiveTo || new Date('2099-12-31');
  
  return this.status === 'active' && 
         now >= effectiveFrom && 
         now <= effectiveTo;
});

// Method to check if user can access this master data
masterDataSchema.methods.canUserAccess = function(user) {
  // Super admin can access all
  if (user.role === 'super_admin') return true;
  
  // Check scope-based access
  switch (this.scope) {
    case 'global':
      return ['state_admin', 'district_admin', 'area_admin', 'unit_admin', 'project_coordinator', 'scheme_coordinator'].includes(user.role);
    
    case 'state':
      return ['state_admin', 'district_admin', 'area_admin', 'unit_admin'].includes(user.role);
    
    case 'district':
    case 'area':
    case 'unit':
      if (!user.adminScope?.regions) return false;
      return this.targetRegions.some(regionId => 
        user.adminScope.regions.some(userRegionId => 
          userRegionId.toString() === regionId.toString()
        )
      );
    
    case 'project_specific':
      if (!user.adminScope?.projects) return false;
      return this.targetProjects.some(projectId => 
        user.adminScope.projects.some(userProjectId => 
          userProjectId.toString() === projectId.toString()
        )
      );
    
    case 'scheme_specific':
      // For scheme-specific, check if user has access to any of the target schemes
      return user.role === 'scheme_coordinator' || ['state_admin', 'district_admin', 'area_admin', 'unit_admin'].includes(user.role);
    
    default:
      return false;
  }
};

// Method to increment usage count
masterDataSchema.methods.incrementUsage = function() {
  this.usageCount += 1;
  this.lastUsed = new Date();
  return this.save();
};

// Pre-save validation
masterDataSchema.pre('save', function(next) {
  // Validate effective dates
  if (this.effectiveFrom && this.effectiveTo && this.effectiveFrom >= this.effectiveTo) {
    return next(new Error('Effective to date must be after effective from date'));
  }
  
  // Validate configuration based on type
  if (this.type === 'scheme_stages' || this.type === 'project_stages') {
    if (!this.configuration.stages || this.configuration.stages.length === 0) {
      return next(new Error('At least one stage is required for stage configurations'));
    }
    
    // Validate stage order uniqueness
    const orders = this.configuration.stages.map(stage => stage.order);
    const uniqueOrders = [...new Set(orders)];
    if (orders.length !== uniqueOrders.length) {
      return next(new Error('Stage orders must be unique'));
    }
  }
  
  if (this.type === 'distribution_timeline_templates') {
    if (!this.configuration.distributionSteps || this.configuration.distributionSteps.length === 0) {
      return next(new Error('At least one distribution step is required'));
    }
    
    // Validate total percentage doesn't exceed 100%
    const totalPercentage = this.configuration.distributionSteps.reduce((sum, step) => sum + (step.percentage || 0), 0);
    if (totalPercentage > 100) {
      return next(new Error('Total distribution percentage cannot exceed 100%'));
    }
  }
  
  next();
});

masterDataSchema.plugin(franchisePlugin);

module.exports = mongoose.model('MasterData', masterDataSchema);