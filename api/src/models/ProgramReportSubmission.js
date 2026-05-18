const mongoose = require('mongoose');
const franchisePlugin = require('../utils/franchisePlugin');

const attachmentSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true
  },
  key: {
    type: String,
    required: true
  },
  fileName: {
    type: String,
    required: true
  },
  mimetype: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    default: 0
  },
  kind: {
    type: String,
    enum: ['image', 'video', 'pdf', 'other'],
    default: 'other'
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

const programReportSubmissionSchema = new mongoose.Schema({
  programReport: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProgramReport',
    required: [true, 'ProgramReport reference is required']
  },
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Submitter reference is required']
  },
  // Role at the time of submission
  submitterRole: {
    type: String,
    enum: ['unit_admin', 'area_admin', 'district_admin']
  },
  // The location (district / area / unit) the submitter belongs to
  location: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location'
  },
  // Custom form field responses: { fieldId: value, ... }
  formData: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // Media/document attachments uploaded to DigitalOcean Spaces CDN
  attachments: [attachmentSchema],
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

programReportSubmissionSchema.plugin(franchisePlugin);

// One draft per user per report; submitted ones are kept as immutable records
programReportSubmissionSchema.index({ programReport: 1, submittedBy: 1, status: 1 });
programReportSubmissionSchema.index({ programReport: 1, location: 1 });
programReportSubmissionSchema.index({ submittedBy: 1 });
programReportSubmissionSchema.index({ status: 1 });
programReportSubmissionSchema.index({ submittedAt: -1 });

module.exports = mongoose.model('ProgramReportSubmission', programReportSubmissionSchema);
