const mongoose = require('mongoose');
const franchisePlugin = require('../utils/franchisePlugin');

const programReportSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Report title is required'],
    trim: true,
    maxlength: [300, 'Title cannot exceed 300 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  // Who should submit this program report
  targetUserType: {
    type: String,
    required: [true, 'Target user type is required'],
    enum: ['unit_admin', 'area_admin', 'district_admin']
  },
  // Optional: narrow to specific locations; empty = all locations of the targetUserType
  targetLocations: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location'
  }],
  // Set to true once a form config is saved for this report
  hasFormConfiguration: {
    type: Boolean,
    default: false
  },
  // Set to true once the form config is published (available to fill)
  isFormPublished: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'closed'],
    default: 'draft'
  },
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

programReportSchema.plugin(franchisePlugin);
programReportSchema.index({ targetUserType: 1 });
programReportSchema.index({ status: 1 });
programReportSchema.index({ createdBy: 1 });
programReportSchema.index({ targetLocations: 1 });
programReportSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ProgramReport', programReportSchema);
