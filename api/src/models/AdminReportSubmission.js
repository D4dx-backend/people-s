const mongoose = require('mongoose');
const franchisePlugin = require('../utils/franchisePlugin');

const adminReportSubmissionSchema = new mongoose.Schema({
  adminReport: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdminReport',
    required: [true, 'AdminReport reference is required']
  },
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Submitter reference is required']
  },
  // Role at the time of submission
  submitterRole: {
    type: String,
    enum: ['unit_admin', 'area_admin', 'district_admin', 'state_admin']
  },
  // The location (district / area / unit) the submitter belongs to
  location: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location'
  },
  // The raw field data: { fieldId: value, ... }
  formData: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  status: {
    type: String,
    enum: ['draft', 'submitted'],
    default: 'draft'
  },
  submittedAt: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

adminReportSubmissionSchema.plugin(franchisePlugin);

// One draft per user per report; submitted ones are kept as immutable records
adminReportSubmissionSchema.index({ adminReport: 1, submittedBy: 1, status: 1 });
adminReportSubmissionSchema.index({ adminReport: 1, location: 1 });
adminReportSubmissionSchema.index({ submittedBy: 1 });
adminReportSubmissionSchema.index({ status: 1 });
adminReportSubmissionSchema.index({ submittedAt: -1 });

module.exports = mongoose.model('AdminReportSubmission', adminReportSubmissionSchema);
