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
  },

  // Soft Delete — data is retained permanently for NGO reporting & analysis
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date
  },
  deletedByUser: {
    type: Boolean,
    default: false
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

// Franchise multi-tenancy — compound unique: same phone can exist in different franchises.
// Partial index: uniqueness is only enforced on non-deleted records so that a soft-deleted
// beneficiary and a new active beneficiary can share the same phone+franchise combination.
beneficiarySchema.plugin(franchisePlugin);
beneficiarySchema.index(
  { phone: 1, franchise: 1 },
  { unique: true, partialFilterExpression: { isDeleted: { $ne: true } } }
);

module.exports = mongoose.model('Beneficiary', beneficiarySchema);