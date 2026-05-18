const mongoose = require('mongoose');
const franchisePlugin = require('../utils/franchisePlugin');

const adminReportSchema = new mongoose.Schema({
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
  // Who should receive / fill this report
  targetUserType: {
    type: String,
    required: [true, 'Target user type is required'],
    enum: ['unit_admin', 'area_admin', 'district_admin', 'state_admin']
  },
  // Optional: narrow down to specific locations (districts / areas / units)
  // When empty, ALL locations of targetUserType are targeted
  targetLocations: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location'
  }],
  // Set to true once a form config is saved for this report
  hasFormConfiguration: {
    type: Boolean,
    default: false
  },
  // Set to true once the form config is published (available for admins to fill)
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

adminReportSchema.plugin(franchisePlugin);
adminReportSchema.index({ targetUserType: 1 });
adminReportSchema.index({ status: 1 });
adminReportSchema.index({ createdBy: 1 });
adminReportSchema.index({ targetLocations: 1 });
adminReportSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AdminReport', adminReportSchema);
