const mongoose = require('mongoose');
const franchisePlugin = require('../utils/franchisePlugin');

const projectSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: [true, 'Project name is required'],
    trim: true,
    maxlength: [200, 'Project name cannot exceed 200 characters']
  },
  code: {
    type: String,
    required: [true, 'Project code is required'],
    uppercase: true,
    match: [/^[A-Z0-9_-]+$/, 'Project code can only contain uppercase letters, numbers, hyphens and underscores']
  },
  description: {
    type: String,
    required: [true, 'Project description is required'],
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  
  // Project Classification
  category: {
    type: String,
    enum: ['education', 'healthcare', 'housing', 'livelihood', 'emergency_relief', 'infrastructure', 'social_welfare', 'other'],
    required: [true, 'Project category is required']
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  
  // Geographic Scope
  scope: {
    type: String,
    enum: ['state', 'district', 'area', 'unit', 'multi_region'],
    default: 'state'
  },
  targetRegions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    required: false
  }],
  
  // Timeline
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required']
  },
  
  // Financial Information
  budget: {
    total: {
      type: Number,
      required: [true, 'Total budget is required'],
      min: [0, 'Budget cannot be negative']
    },
    allocated: {
      type: Number,
      default: 0,
      min: [0, 'Allocated amount cannot be negative']
    },
    spent: {
      type: Number,
      default: 0,
      min: [0, 'Spent amount cannot be negative']
    },
    currency: {
      type: String,
      default: 'INR'
    }
  },
  
  // Project Management
  coordinator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  team: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String,
      enum: ['coordinator', 'manager', 'supervisor', 'field_officer', 'volunteer']
    },
    assignedDate: {
      type: Date,
      default: Date.now
    },
    permissions: [{
      type: String,
      enum: ['view', 'edit', 'approve', 'manage_team', 'manage_budget']
    }]
  }],
  
  // Status and Progress
  status: {
    type: String,
    enum: ['draft', 'approved', 'active', 'on_hold', 'completed', 'cancelled'],
    default: 'draft'
  },
  progress: {
    percentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    milestones: [{
      name: String,
      description: String,
      targetDate: Date,
      completedDate: Date,
      status: {
        type: String,
        enum: ['pending', 'in_progress', 'completed', 'delayed'],
        default: 'pending'
      }
    }]
  },

  // Independent Project Status Updates
  statusUpdates: [{
    stage: {
      type: String,
      required: true,
      maxlength: 100
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'on_hold', 'cancelled'],
      default: 'pending'
    },
    description: {
      type: String,
      maxlength: 1000
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    updatedAt: {
      type: Date,
      default: Date.now
    },
    attachments: [{
      name: String,
      url: String,
      type: String
    }],
    remarks: {
      type: String,
      maxlength: 500
    },
    isVisible: {
      type: Boolean,
      default: true
    }
  }],

  // Project Status Configuration
  statusConfiguration: {
    stages: [{
      name: {
        type: String,
        required: true,
        maxlength: 100
      },
      description: {
        type: String,
        maxlength: 500
      },
      order: {
        type: Number,
        required: true,
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
      }
    }],
    enablePublicTracking: {
      type: Boolean,
      default: false
    },
    notificationSettings: {
      emailNotifications: {
        type: Boolean,
        default: true
      },
      smsNotifications: {
        type: Boolean,
        default: false
      }
    }
  },
  
  // Documents and Media
  documents: [{
    name: String,
    type: {
      type: String,
      enum: ['proposal', 'approval', 'budget', 'report', 'certificate', 'other']
    },
    url: String,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Beneficiary Information
  targetBeneficiaries: {
    estimated: {
      type: Number,
      min: [0, 'Estimated beneficiaries cannot be negative']
    },
    actual: {
      type: Number,
      default: 0,
      min: [0, 'Actual beneficiaries cannot be negative']
    },
    demographics: {
      ageGroups: {
        children: { type: Number, default: 0 },
        youth: { type: Number, default: 0 },
        adults: { type: Number, default: 0 },
        elderly: { type: Number, default: 0 }
      },
      gender: {
        male: { type: Number, default: 0 },
        female: { type: Number, default: 0 },
        other: { type: Number, default: 0 }
      }
    }
  },
  
  // Approval Workflow
  approvals: [{
    level: {
      type: String,
      enum: ['district', 'state', 'board']
    },
    approver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    comments: String,
    date: Date
  }],
  
  // Settings and Configuration
  settings: {
    allowPublicView: {
      type: Boolean,
      default: false
    },
    requireApprovalForApplications: {
      type: Boolean,
      default: true
    },
    maxApplicationsPerBeneficiary: {
      type: Number,
      default: 1,
      min: 1
    },
    autoAssignApplications: {
      type: Boolean,
      default: false
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
projectSchema.index({ code: 1 });
projectSchema.index({ status: 1 });
projectSchema.index({ coordinator: 1 });
projectSchema.index({ targetRegions: 1 });
projectSchema.index({ category: 1 });
projectSchema.index({ startDate: 1, endDate: 1 });
projectSchema.index({ 'budget.total': 1 });

// Virtual for budget utilization percentage
projectSchema.virtual('budgetUtilization').get(function() {
  if (this.budget.total === 0) return 0;
  return Math.round((this.budget.spent / this.budget.total) * 100);
});

// Virtual for remaining budget
projectSchema.virtual('remainingBudget').get(function() {
  return this.budget.total - this.budget.spent;
});

// Virtual for project duration in days
projectSchema.virtual('duration').get(function() {
  if (!this.startDate || !this.endDate) return 0;
  return Math.ceil((this.endDate - this.startDate) / (1000 * 60 * 60 * 24));
});

// Virtual for days remaining
projectSchema.virtual('daysRemaining').get(function() {
  if (!this.endDate) return null;
  const today = new Date();
  const remaining = Math.ceil((this.endDate - today) / (1000 * 60 * 60 * 24));
  return remaining > 0 ? remaining : 0;
});

// Virtual for schemes count
projectSchema.virtual('schemesCount', {
  ref: 'Scheme',
  localField: '_id',
  foreignField: 'project',
  count: true
});

// Virtual for applications count
projectSchema.virtual('applicationsCount', {
  ref: 'Application',
  localField: '_id',
  foreignField: 'project',
  count: true
});

// Method to check if user can access this project
projectSchema.methods.canUserAccess = function(user) {
  // Super admin and state admin can access all projects
  if (user.role === 'super_admin' || user.role === 'state_admin') return true;

  // Project coordinator can access assigned projects
  if (user.role === 'project_coordinator') {
    return user.adminScope?.projects?.some(projectId =>
      projectId.toString() === this._id.toString()
    ) || false;
  }

  // Scheme coordinator can access projects that contain their assigned schemes
  if (user.role === 'scheme_coordinator') {
    const assignedSchemes = (user.adminScope?.schemes || []).map(s =>
      s && typeof s === 'object' ? s._id?.toString() : s?.toString()
    ).filter(Boolean);
    if (assignedSchemes.length === 0) return false;
    // Check if this project's _id is referenced from any assigned scheme
    // Fine-grained lookup is done at controller level; here we verify the project
    // has at least one scheme ID listed in the user's assigned schemes
    const projectSchemes = (this.schemes || []).map(s =>
      s && typeof s === 'object' ? s._id?.toString() : s?.toString()
    ).filter(Boolean);
    if (projectSchemes.length > 0) {
      return projectSchemes.some(sid => assignedSchemes.includes(sid));
    }
    // If project.schemes is not populated, fall back to allowing access
    // (controller will perform the authoritative scheme→project lookup)
    return true;
  }

  // District/area/unit admins - check via direct scope properties
  const getId = (ref) => {
    if (!ref) return null;
    if (typeof ref === 'object' && ref._id) return ref._id.toString();
    return ref.toString();
  };

  if (user.role === 'district_admin' && user.adminScope?.district) {
    const districtId = getId(user.adminScope.district);
    if (this.targetRegions?.some(r => getId(r) === districtId)) return true;
  }
  if (user.role === 'area_admin' && user.adminScope?.area) {
    const areaId = getId(user.adminScope.area);
    if (this.targetRegions?.some(r => getId(r) === areaId)) return true;
  }
  if (user.role === 'unit_admin' && user.adminScope?.unit) {
    const unitId = getId(user.adminScope.unit);
    if (this.targetRegions?.some(r => getId(r) === unitId)) return true;
  }

  // Check via regions array
  if (!user.adminScope?.regions || !this.targetRegions) return false;

  return this.targetRegions.some(regionId =>
    user.adminScope.regions.some(userRegionId =>
      userRegionId.toString() === regionId.toString()
    )
  );
};

// Method to update progress
projectSchema.methods.updateProgress = function() {
  const completedMilestones = this.progress.milestones.filter(
    milestone => milestone.status === 'completed'
  ).length;
  
  const totalMilestones = this.progress.milestones.length;
  
  if (totalMilestones > 0) {
    this.progress.percentage = Math.round((completedMilestones / totalMilestones) * 100);
  }
  
  return this.save();
};

// Pre-save validation
projectSchema.pre('save', function(next) {
  // Validate dates
  if (this.startDate && this.endDate && this.startDate >= this.endDate) {
    return next(new Error('End date must be after start date'));
  }
  
  // Validate budget
  if (this.budget.spent > this.budget.total) {
    return next(new Error('Spent amount cannot exceed total budget'));
  }
  
  if (this.budget.allocated > this.budget.total) {
    return next(new Error('Allocated amount cannot exceed total budget'));
  }
  
  next();
});

// Franchise multi-tenancy — compound unique: same code can exist in different franchises
projectSchema.plugin(franchisePlugin);
projectSchema.index({ code: 1, franchise: 1 }, { unique: true });

module.exports = mongoose.model('Project', projectSchema);