const mongoose = require('mongoose');
const franchisePlugin = require('../utils/franchisePlugin');

const beneficiarySchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  
  // Location Information
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
  
  // Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'pending'],
    default: 'pending'
  },
  
  // Verification
  isVerified: {
    type: Boolean,
    default: false
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verifiedAt: {
    type: Date
  },
  
  // Applications
  applications: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Application'
  }],
  
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
beneficiarySchema.index({ phone: 1 });
beneficiarySchema.index({ status: 1 });
beneficiarySchema.index({ state: 1, district: 1, area: 1, unit: 1 });
beneficiarySchema.index({ createdAt: -1 });

// Virtual for full location path
beneficiarySchema.virtual('locationPath').get(function() {
  if (this.populated('state') && this.populated('district') && this.populated('area') && this.populated('unit') &&
      this.state && this.district && this.area && this.unit) {
    return `${this.state.name} > ${this.district.name} > ${this.area.name} > ${this.unit.name}`;
  }
  return '';
});

// Ensure virtual fields are serialized
beneficiarySchema.set('toJSON', { virtuals: true });

// Franchise multi-tenancy — compound unique: same phone can exist in different franchises
beneficiarySchema.plugin(franchisePlugin);
beneficiarySchema.index({ phone: 1, franchise: 1 }, { unique: true });

module.exports = mongoose.model('Beneficiary', beneficiarySchema);