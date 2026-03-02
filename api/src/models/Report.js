const mongoose = require('mongoose');
const franchisePlugin = require('../utils/franchisePlugin');

const reportSchema = new mongoose.Schema({
  // Report Details
  reportNumber: {
    type: String
  },
  
  // Application Reference
  application: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Application',
    required: true
  },
  
  // Report Information
  reportDate: {
    type: Date,
    required: true
  },
  reportType: {
    type: String,
    enum: ['interview', 'enquiry', 'field_verification', 'document_review', 'follow_up', 'other'],
    required: true
  },

  // Report Content
  title: {
    type: String,
    required: true
  },
  details: {
    type: String,
    required: true
  },
  
  // Field Verification Information (consolidated)
  fieldVerification: {
    isRequired: {
      type: Boolean,
      default: false
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'failed', 'verified', 'rejected', 'needs_clarification'],
      default: 'pending'
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    verifiedAt: {
      type: Date
    },
    verificationNotes: {
      type: String
    },
    // Stage-based verification tracking
    stageVerifications: [{
      stageName: {
        type: String,
        required: true
      },
      stageOrder: {
        type: Number,
        required: true
      },
      isCompleted: {
        type: Boolean,
        default: false
      },
      completedAt: Date,
      completedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      notes: String,
      documents: [{
        fileName: String,
        fileUrl: String,
        uploadedAt: {
          type: Date,
          default: Date.now
        }
      }]
    }],
    verificationHistory: [{
      status: {
        type: String,
        enum: ['pending', 'in_progress', 'completed', 'failed'],
        required: true
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
      notes: String
    }]
  },
  
  // Status and Priority
  status: {
    type: String,
    enum: ['draft', 'submitted', 'reviewed', 'approved'],
    default: 'submitted'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  
  // Attachments
  attachments: [{
    fileName: String,
    fileUrl: String,
    fileSize: Number,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Follow-up Information
  followUpRequired: {
    type: Boolean,
    default: false
  },
  followUpDate: {
    type: Date
  },
  followUpNotes: {
    type: String
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
  
  // Tags for categorization
  tags: [{
    type: String
  }],
  
  // Visibility
  isPublic: {
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
reportSchema.index({ application: 1 });
reportSchema.index({ reportNumber: 1 });
reportSchema.index({ reportType: 1 });
reportSchema.index({ reportDate: -1 });
reportSchema.index({ status: 1 });
reportSchema.index({ createdBy: 1 });
reportSchema.index({ createdAt: -1 });

// Pre-save middleware to generate report number
reportSchema.pre('save', async function(next) {
  if (this.isNew && !this.reportNumber) {
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      try {
        const year = new Date().getFullYear();
        
        // Find the highest report number for this year
        const lastReport = await this.constructor
          .findOne({ reportNumber: new RegExp(`^REP${year}`) })
          .sort({ reportNumber: -1 })
          .select('reportNumber')
          .lean();
        
        let reportNumber;
        if (lastReport && lastReport.reportNumber) {
          // Extract the number part and increment
          const lastNumber = parseInt(lastReport.reportNumber.replace(`REP${year}`, '')) || 0;
          const nextNumber = lastNumber + 1;
          reportNumber = `REP${year}${String(nextNumber).padStart(6, '0')}`;
        } else {
          // First report of the year
          reportNumber = `REP${year}000001`;
        }
        
        // Check if this number already exists (race condition protection)
        const exists = await this.constructor.findOne({ reportNumber }).lean();
        if (!exists) {
          this.reportNumber = reportNumber;
          return next();
        }
        
        // If exists, increment and try again
        attempts++;
        if (attempts < maxAttempts) {
          // Add a small random delay to avoid race conditions
          await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
        }
      } catch (error) {
        console.error('Error generating report number:', error);
        // Fallback to timestamp-based number
        const timestamp = Date.now().toString().slice(-9);
        this.reportNumber = `REP${new Date().getFullYear()}${timestamp}`;
        return next();
      }
    }
    
    // Final fallback if all attempts failed
    const timestamp = Date.now().toString().slice(-9);
    this.reportNumber = `REP${new Date().getFullYear()}${timestamp}`;
  }
  next();
});

// Virtual for getting related reports
reportSchema.virtual('relatedReports', {
  ref: 'Report',
  localField: 'application',
  foreignField: 'application'
});

// Method to mark as reviewed
reportSchema.methods.markAsReviewed = async function(reviewerId, comments) {
  this.status = 'reviewed';
  this.reviewedBy = reviewerId;
  this.reviewedAt = new Date();
  this.reviewComments = comments;
  this.updatedBy = reviewerId;
  
  return await this.save();
};

// Method to approve report
reportSchema.methods.approve = async function(approverId, comments) {
  this.status = 'approved';
  this.reviewedBy = approverId;
  this.reviewedAt = new Date();
  this.reviewComments = comments;
  this.updatedBy = approverId;
  
  return await this.save();
};

// Static method to get reports for an application
reportSchema.statics.getApplicationReports = function(applicationId, options = {}) {
  const query = { application: applicationId };
  
  if (options.reportType) {
    query.reportType = options.reportType;
  }
  
  if (options.status) {
    query.status = options.status;
  }
  
  return this.find(query)
    .populate('createdBy', 'name')
    .populate('reviewedBy', 'name')
    .populate('updatedBy', 'name')
    .sort({ reportDate: -1, createdAt: -1 });
};

// Static method to get reports by type
reportSchema.statics.getReportsByType = function(reportType, options = {}) {
  const query = { reportType };
  
  if (options.dateFrom) {
    query.reportDate = { $gte: new Date(options.dateFrom) };
  }
  
  if (options.dateTo) {
    query.reportDate = { ...query.reportDate, $lte: new Date(options.dateTo) };
  }
  
  return this.find(query)
    .populate('application', 'applicationNumber')
    .populate('createdBy', 'name')
    .sort({ reportDate: -1 });
};

// Static method to get reports requiring follow-up
reportSchema.statics.getFollowUpReports = function() {
  return this.find({
    followUpRequired: true,
    followUpDate: { $lte: new Date() },
    status: { $ne: 'approved' }
  })
    .populate('application', 'applicationNumber')
    .populate('createdBy', 'name')
    .sort({ followUpDate: 1 });
};

// Franchise multi-tenancy — compound unique per franchise
reportSchema.plugin(franchisePlugin);
reportSchema.index({ reportNumber: 1, franchise: 1 }, { unique: true });

module.exports = mongoose.model('Report', reportSchema);