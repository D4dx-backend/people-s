const mongoose = require('mongoose');

const schemeSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: [true, 'Scheme name is required'],
    trim: true,
    maxlength: [200, 'Scheme name cannot exceed 200 characters']
  },
  code: {
    type: String,
    required: [true, 'Scheme code is required'],
    unique: true,
    uppercase: true,
    match: [/^[A-Z0-9_-]+$/, 'Scheme code can only contain uppercase letters, numbers, hyphens and underscores']
  },
  description: {
    type: String,
    required: [true, 'Scheme description is required'],
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  
  // Classification
  category: {
    type: String,
    enum: ['education', 'healthcare', 'housing', 'livelihood', 'emergency_relief', 'infrastructure', 'social_welfare', 'other'],
    required: [true, 'Scheme category is required']
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  
  // Eligibility Criteria
  eligibility: {
    ageRange: {
      min: { type: Number, min: 0, max: 100 },
      max: { type: Number, min: 0, max: 100 }
    },
    gender: {
      type: String,
      enum: ['any', 'male', 'female', 'other'],
      default: 'any'
    },
    incomeLimit: {
      type: Number,
      min: 0
    },
    familySize: {
      min: { type: Number, min: 1 },
      max: { type: Number, min: 1 }
    },
    educationLevel: {
      type: String,
      enum: ['any', 'illiterate', 'primary', 'secondary', 'higher_secondary', 'graduate', 'post_graduate']
    },
    employmentStatus: {
      type: String,
      enum: ['any', 'unemployed', 'employed', 'self_employed', 'retired']
    },
    documents: [{
      type: {
        type: String,
        enum: ['aadhaar', 'ration_card', 'income_certificate', 'caste_certificate', 'bank_passbook', 'other']
      },
      required: {
        type: Boolean,
        default: true
      },
      description: String
    }]
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
  
  // Benefit Information
  benefits: {
    type: {
      type: String,
      enum: ['cash', 'kind', 'service', 'scholarship', 'loan', 'subsidy'],
      required: [true, 'Benefit type is required']
    },
    amount: {
      type: Number,
      min: 0
    },
    frequency: {
      type: String,
      enum: ['one_time', 'monthly', 'quarterly', 'yearly'],
      default: 'one_time'
    },
    duration: {
      type: Number, // in months
      min: 1
    },
    description: String
  },
  
  // Application Settings
  applicationSettings: {
    startDate: {
      type: Date,
      required: [true, 'Application start date is required']
    },
    endDate: {
      type: Date,
      required: [true, 'Application end date is required']
    },
    maxApplications: {
      type: Number,
      min: 1,
      default: 1000
    },
    maxBeneficiaries: {
      type: Number,
      min: 1
    },
    requireFieldVerification: {
      type: Boolean,
      default: false
    },
    requiresInterview: {
      type: Boolean,
      default: false
    },
    allowMultipleApplications: {
      type: Boolean,
      default: false
    }
  },

  // Renewal Settings
  renewalSettings: {
    isRenewable: {
      type: Boolean,
      default: false
    },
    renewalPeriodDays: {
      type: Number,
      min: 1,
      default: 365
    },
    maxRenewals: {
      type: Number,
      min: 0,
      default: 0 // 0 = unlimited
    },
    autoNotifyBeforeDays: {
      type: Number,
      min: 1,
      default: 30
    },
    requiresReapproval: {
      type: Boolean,
      default: true
    },
    renewalFormConfigured: {
      type: Boolean,
      default: false
    }
  },

  // Money Distribution Timeline Template
  distributionTimeline: [{
    description: {
      type: String,
      required: true,
      maxlength: 200
    },
    percentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    daysFromApproval: {
      type: Number,
      required: true,
      min: 0
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

  // Status Update Stages Configuration
  statusStages: [{
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
    autoTransition: {
      type: Boolean,
      default: false
    },
    transitionConditions: {
      type: String,
      maxlength: 500
    },
    // Per-role comment configuration
    commentConfig: {
      unitAdmin: {
        enabled: { type: Boolean, default: false },
        required: { type: Boolean, default: false }
      },
      areaAdmin: {
        enabled: { type: Boolean, default: false },
        required: { type: Boolean, default: false }
      },
      districtAdmin: {
        enabled: { type: Boolean, default: false },
        required: { type: Boolean, default: false }
      }
    },
    // Required documents for this stage
    requiredDocuments: [{
      name: {
        type: String,
        required: true,
        maxlength: 200
      },
      description: {
        type: String,
        maxlength: 500
      },
      isRequired: {
        type: Boolean,
        default: true
      }
    }]
  }],
  
  // Status and Workflow
  status: {
    type: String,
    enum: ['draft', 'active', 'suspended', 'closed', 'completed'],
    default: 'draft'
  },
  
  // Relationships
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: [true, 'Project is required']
  },
  targetRegions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location'
  }],
  
  // Statistics
  statistics: {
    totalApplications: {
      type: Number,
      default: 0
    },
    approvedApplications: {
      type: Number,
      default: 0
    },
    rejectedApplications: {
      type: Number,
      default: 0
    },
    pendingApplications: {
      type: Number,
      default: 0
    },
    totalBeneficiaries: {
      type: Number,
      default: 0
    },
    totalAmountDisbursed: {
      type: Number,
      default: 0
    }
  },
  
  // Form Configuration Status
  hasFormConfiguration: {
    type: Boolean,
    default: false
  },
  formConfigurationUpdated: {
    type: Date
  },

  // Documents and Media
  documents: [{
    name: String,
    type: {
      type: String,
      enum: ['guidelines', 'application_form', 'eligibility_criteria', 'other']
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
schemeSchema.index({ code: 1 });
schemeSchema.index({ status: 1 });
schemeSchema.index({ project: 1 });
schemeSchema.index({ category: 1 });
schemeSchema.index({ 'applicationSettings.startDate': 1, 'applicationSettings.endDate': 1 });
schemeSchema.index({ targetRegions: 1 });

// Virtual for budget utilization percentage
schemeSchema.virtual('budgetUtilization').get(function() {
  if (this.budget.total === 0) return 0;
  return Math.round((this.budget.spent / this.budget.total) * 100);
});

// Virtual for remaining budget
schemeSchema.virtual('remainingBudget').get(function() {
  return this.budget.total - this.budget.spent;
});

// Virtual for application success rate
schemeSchema.virtual('successRate').get(function() {
  if (this.statistics.totalApplications === 0) return 0;
  return Math.round((this.statistics.approvedApplications / this.statistics.totalApplications) * 100);
});

// Virtual for days remaining for applications
schemeSchema.virtual('daysRemainingForApplication').get(function() {
  if (!this.applicationSettings.endDate) return null;
  const today = new Date();
  const remaining = Math.ceil((this.applicationSettings.endDate - today) / (1000 * 60 * 60 * 24));
  return remaining > 0 ? remaining : 0;
});

// Virtual for applications count
schemeSchema.virtual('applicationsCount', {
  ref: 'Application',
  localField: '_id',
  foreignField: 'scheme',
  count: true
});

// Method to check if user can access this scheme
schemeSchema.methods.canUserAccess = function(user) {
  // Super admin and state admin can access all schemes
  if (user.role === 'super_admin' || user.role === 'state_admin') return true;
  
  // Project coordinator can access schemes in assigned projects
  if (user.role === 'project_coordinator') {
    return user.adminScope?.projects?.some(projectId => 
      projectId.toString() === this.project.toString()
    ) || false;
  }
  
  // If scheme has no target regions (applicable to all), allow access based on user role
  if (!this.targetRegions || this.targetRegions.length === 0) {
    return ['district_admin', 'area_admin', 'unit_admin'].includes(user.role);
  }
  
  // Helper function to get ID from populated reference or direct ID
  const getId = (ref) => {
    if (!ref) return null;
    if (typeof ref === 'object' && ref._id) return ref._id.toString();
    return ref.toString();
  };
  
  // Check if user has access via regions array (Format 1)
  if (user.adminScope?.regions && user.adminScope.regions.length > 0) {
    const userRegions = user.adminScope.regions.map(r => getId(r));
    const hasAccess = this.targetRegions.some(regionId => 
      userRegions.includes(getId(regionId))
    );
    if (hasAccess) return true;
  }
  
  // Check if user has access via direct district/area/unit properties (Format 2)
  // Unit admins can access schemes if their unit is in targetRegions
  if (user.role === 'unit_admin' && user.adminScope?.unit) {
    const userUnitId = getId(user.adminScope.unit);
    const hasAccess = this.targetRegions.some(regionId => 
      getId(regionId) === userUnitId
    );
    if (hasAccess) return true;
  }
  
  // Area admins can access schemes if their area is in targetRegions
  if (user.role === 'area_admin' && user.adminScope?.area) {
    const userAreaId = getId(user.adminScope.area);
    const hasAccess = this.targetRegions.some(regionId => 
      getId(regionId) === userAreaId
    );
    if (hasAccess) return true;
  }
  
  // District admins can access schemes if their district is in targetRegions
  if (user.role === 'district_admin' && user.adminScope?.district) {
    const userDistrictId = getId(user.adminScope.district);
    const hasAccess = this.targetRegions.some(regionId => 
      getId(regionId) === userDistrictId
    );
    if (hasAccess) return true;
  }
  
  // No matching access found
  return false;
};

// Method to check if scheme is accepting applications
schemeSchema.methods.isAcceptingApplications = function() {
  const today = new Date();
  return this.status === 'active' && 
         this.applicationSettings.startDate <= today && 
         this.applicationSettings.endDate >= today &&
         this.statistics.totalApplications < this.applicationSettings.maxApplications;
};

// Pre-save validation
schemeSchema.pre('save', function(next) {
  // Validate application dates
  if (this.applicationSettings.startDate && this.applicationSettings.endDate && 
      this.applicationSettings.startDate >= this.applicationSettings.endDate) {
    return next(new Error('Application end date must be after start date'));
  }
  
  // Validate age range
  if (this.eligibility.ageRange.min && this.eligibility.ageRange.max && 
      this.eligibility.ageRange.min >= this.eligibility.ageRange.max) {
    return next(new Error('Maximum age must be greater than minimum age'));
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

module.exports = mongoose.model('Scheme', schemeSchema);