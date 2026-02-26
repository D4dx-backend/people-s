const mongoose = require('mongoose');
const franchisePlugin = require('../utils/franchisePlugin');

const applicationSchema = new mongoose.Schema({
  // Application Details
  applicationNumber: {
    type: String,
    required: true
  },
  
  // Beneficiary
  beneficiary: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Beneficiary',
    required: true
  },
  
  // Scheme
  scheme: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Scheme',
    required: true
  },
  
  // Project (if applicable)
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project'
  },
  
  // Application Status
  status: {
    type: String,
    enum: [
      'draft', 'pending', 'under_review', 'interview_scheduled', 'interview_completed', 'pending_committee_approval',
      'approved', 'rejected', 'on_hold', 'cancelled', 'disbursed', 'completed'
    ],
    default: 'pending'
  },
  
  // Amount
  requestedAmount: {
    type: Number,
    default: 0
  },
  approvedAmount: {
    type: Number,
    default: 0
  },
  
  // Documents
  documents: [{
    name: String,
    url: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Form Data - Custom fields submitted by beneficiary
  formData: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Draft metadata
  draftMetadata: {
    lastSavedAt: { type: Date },
    currentPage: { type: Number, default: 0 },
    completedPages: [{ type: Number }],
    autoSaved: { type: Boolean, default: false }
  },

  // Eligibility Score - Calculated from form data against scoring rules
  eligibilityScore: {
    totalPoints: {
      type: Number,
      default: 0
    },
    maxPoints: {
      type: Number,
      default: 0
    },
    percentage: {
      type: Number,
      default: 0
    },
    meetsThreshold: {
      type: Boolean,
      default: true
    },
    threshold: {
      type: Number,
      default: 0
    },
    fieldScores: [{
      fieldId: Number,
      fieldLabel: String,
      earnedPoints: {
        type: Number,
        default: 0
      },
      maxPoints: {
        type: Number,
        default: 0
      },
      appliedRule: String,
      answerValue: mongoose.Schema.Types.Mixed
    }],
    autoRejected: {
      type: Boolean,
      default: false
    },
    calculatedAt: Date
  },
  
  // Review Information
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: {
    type: Date
  },
  reviewComments: {
    type: String
  },
  
  // Approval Information
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  approvalComments: {
    type: String
  },
  
  // Post-approval modification tracking
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lastModifiedAt: {
    type: Date
  },
  modificationHistory: [{
    modifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    modifiedAt: {
      type: Date,
      default: Date.now
    },
    reason: {
      type: String,
      required: true
    },
    previousAmount: {
      type: Number
    },
    newAmount: {
      type: Number
    },
    previousComments: {
      type: String
    }
  }],
  
  // Committee Approval Information
  interviewReport: {
    type: String
  },
  committeeApprovedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  committeeApprovedAt: {
    type: Date
  },
  committeeComments: {
    type: String
  },
  
  // Distribution Timeline (for installment payments)
  distributionTimeline: [{
    description: {
      type: String,
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    percentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    expectedDate: {
      type: Date,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'scheduled', 'processing', 'completed', 'failed'],
      default: 'pending'
    },
    actualDate: Date,
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment'
    },
    notes: String
  }],

  // Recurring Payment Configuration
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringConfig: {
    enabled: {
      type: Boolean,
      default: false
    },
    period: {
      type: String,
      enum: ['monthly', 'quarterly', 'semi_annually', 'annually'],
      required: function() { 
        return this.isRecurring && this.status !== 'pending_committee_approval'; 
      }
    },
    numberOfPayments: {
      type: Number,
      min: 1,
      max: 60,
      required: function() { 
        return this.isRecurring && this.status !== 'pending_committee_approval'; 
      }
    },
    amountPerPayment: {
      type: Number,
      min: 0,
      required: function() { 
        return this.isRecurring && this.status !== 'pending_committee_approval'; 
      }
    },
    startDate: {
      type: Date,
      required: function() { 
        return this.isRecurring && this.status !== 'pending_committee_approval'; 
      }
    },
    endDate: {
      type: Date
    },
    customAmounts: [{
      paymentNumber: {
        type: Number,
        required: true,
        min: 1
      },
      amount: {
        type: Number,
        required: true,
        min: 0
      },
      description: {
        type: String,
        maxlength: 200
      }
    }],
    totalRecurringAmount: {
      type: Number,
      default: 0
    },
    completedPayments: {
      type: Number,
      default: 0
    },
    nextPaymentDate: {
      type: Date
    },
    lastPaymentDate: {
      type: Date
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'completed', 'cancelled'],
      default: 'active'
    },
    notes: {
      type: String,
      maxlength: 500
    }
  },

  // Application Workflow Stages (from scheme configuration)
  applicationStages: [{
    name: {
      type: String,
      required: true
    },
    description: String,
    order: {
      type: Number,
      required: true
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
    transitionConditions: String,
    completedAt: Date,
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'skipped', 'reverted'],
      default: 'pending'
    },
    notes: String,
    // Per-role comment configuration (copied from scheme)
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
    // Actual comments from each role
    comments: {
      unitAdmin: {
        comment: String,
        commentedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        commentedAt: Date
      },
      areaAdmin: {
        comment: String,
        commentedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        commentedAt: Date
      },
      districtAdmin: {
        comment: String,
        commentedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        commentedAt: Date
      }
    },
    // Required documents for this stage (copied from scheme + upload tracking)
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
      },
      uploadedFile: String,
      uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      uploadedAt: Date
    }]
  }],

  // Current Stage in the workflow
  currentStage: {
    type: String,
    default: 'Application Received'
  },

  // Stage History for tracking
  stageHistory: [{
    stageName: String,
    status: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    notes: String,
    revertedTo: String // Target stage name when action is revert
  }],

  // Status History for tracking status changes
  statusHistory: [{
    status: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    comment: String
  }],
  
  // Interview Information
  interview: {
    scheduledDate: {
      type: Date
    },
    scheduledTime: {
      type: String
    },
    type: {
      type: String,
      enum: ['offline', 'online'],
      default: 'offline'
    },
    location: {
      type: String
    },
    meetingLink: {
      type: String
    },
    interviewers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    scheduledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    scheduledAt: {
      type: Date
    },
    completedAt: {
      type: Date
    },
    notes: {
      type: String
    },
    result: {
      type: String,
      enum: ['pending', 'passed', 'failed'],
      default: 'pending'
    }
  },

  // Interview History (tracks all schedule/reschedule changes)
  interviewHistory: [{
    scheduledDate: {
      type: Date,
      required: true
    },
    scheduledTime: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['offline', 'online'],
      required: true
    },
    location: String,
    meetingLink: String,
    scheduledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    scheduledAt: {
      type: Date,
      default: Date.now
    },
    action: {
      type: String,
      enum: ['scheduled', 'rescheduled', 'cancelled'],
      default: 'scheduled'
    },
    reason: String
  }],
  
  // Location Information (inherited from beneficiary)
  state: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    required: true
  },
  district: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    required: true
  },
  area: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    required: true
  },
  unit: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    required: true
  },
  
  // Renewal Tracking
  isRenewal: {
    type: Boolean,
    default: false
  },
  parentApplication: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Application',
    default: null
  },
  renewalNumber: {
    type: Number,
    default: 0 // 0 = original, 1 = first renewal, etc.
  },
  expiryDate: {
    type: Date,
    default: null
  },
  renewalDueDate: {
    type: Date,
    default: null
  },
  renewalStatus: {
    type: String,
    enum: ['not_applicable', 'active', 'due_for_renewal', 'expired', 'renewed'],
    default: 'not_applicable'
  },
  renewalNotificationSent: {
    type: Boolean,
    default: false
  },

  // Metadata
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
  timestamps: true
});

// Indexes for better performance
applicationSchema.index({ applicationNumber: 1 });
applicationSchema.index({ beneficiary: 1 });
applicationSchema.index({ scheme: 1 });
applicationSchema.index({ project: 1 });
applicationSchema.index({ status: 1 });
applicationSchema.index({ state: 1, district: 1, area: 1, unit: 1 });
applicationSchema.index({ createdAt: -1 });
applicationSchema.index({ isRecurring: 1, 'recurringConfig.status': 1 });
applicationSchema.index({ 'recurringConfig.nextPaymentDate': 1 });
applicationSchema.index({ renewalStatus: 1, expiryDate: 1 });
applicationSchema.index({ parentApplication: 1 });
applicationSchema.index({ isRenewal: 1 });

// Pre-save middleware to generate application number
applicationSchema.pre('save', async function(next) {
  if (this.isNew && !this.applicationNumber) {
    const count = await this.constructor.countDocuments();
    const year = new Date().getFullYear();
    this.applicationNumber = `APP${year}${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

// Franchise multi-tenancy — compound unique per franchise
applicationSchema.plugin(franchisePlugin);
applicationSchema.index({ applicationNumber: 1, franchise: 1 }, { unique: true });

module.exports = mongoose.model('Application', applicationSchema);