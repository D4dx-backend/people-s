const mongoose = require('mongoose');
const franchisePlugin = require('../utils/franchisePlugin');

/**
 * Value Target Schema
 * Target count for a specific option value of a form field
 */
const valueTargetSchema = new mongoose.Schema({
  value: {
    type: String,
    required: [true, 'Option value is required'],
    trim: true
  },
  target: {
    type: Number,
    required: [true, 'Target count is required'],
    min: [0, 'Target must be non-negative']
  }
}, { _id: false });

/**
 * Criteria Target Schema
 * Maps a form field to per-option targets within a monthly target
 */
const criteriaTargetSchema = new mongoose.Schema({
  formFieldId: {
    type: Number,
    required: [true, 'Form field ID is required']
  },
  formFieldLabel: {
    type: String,
    required: [true, 'Form field label is required'],
    trim: true
  },
  formFieldType: {
    type: String,
    required: [true, 'Form field type is required'],
    enum: ['select', 'dropdown', 'radio', 'multiselect', 'yesno', 'checkbox']
  },
  valueTargets: {
    type: [valueTargetSchema],
    default: [],
    validate: {
      validator: function(v) {
        // Ensure no duplicate values within the same criteria
        const values = v.map(vt => vt.value);
        return values.length === new Set(values).size;
      },
      message: 'Duplicate option values are not allowed within a criteria target'
    }
  }
}, { _id: false });

/**
 * Monthly Target Schema
 * Breakdown of target for a specific month/year with optional criteria
 */
const monthlyTargetSchema = new mongoose.Schema({
  month: {
    type: Number,
    required: [true, 'Month is required'],
    min: [1, 'Month must be between 1 and 12'],
    max: [12, 'Month must be between 1 and 12']
  },
  year: {
    type: Number,
    required: [true, 'Year is required'],
    min: [2020, 'Year must be 2020 or later'],
    max: [2050, 'Year must be before 2050']
  },
  target: {
    type: Number,
    required: [true, 'Monthly target count is required'],
    min: [0, 'Target must be non-negative']
  },
  criteriaTargets: {
    type: [criteriaTargetSchema],
    default: []
  }
}, { _id: false });

/**
 * Scheme Target Schema
 * Stores the target configuration for a scheme — total target, 
 * monthly breakdowns, and criteria-based targets mapped to form fields
 */
const schemeTargetSchema = new mongoose.Schema({
  scheme: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Scheme',
    required: [true, 'Scheme reference is required'],
    unique: true
  },
  totalTarget: {
    type: Number,
    required: [true, 'Total target is required'],
    min: [1, 'Total target must be at least 1']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  monthlyTargets: {
    type: [monthlyTargetSchema],
    default: [],
    validate: {
      validator: function(v) {
        // Ensure no duplicate month/year combinations
        const keys = v.map(mt => `${mt.year}-${mt.month}`);
        return keys.length === new Set(keys).size;
      },
      message: 'Duplicate month/year combinations are not allowed'
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Franchise multi-tenancy
schemeTargetSchema.plugin(franchisePlugin);
schemeTargetSchema.index({ scheme: 1, franchise: 1 }, { unique: true });
schemeTargetSchema.index({ createdAt: -1 });

// Virtual: sum of all monthly targets
schemeTargetSchema.virtual('monthlyTargetSum').get(function() {
  return this.monthlyTargets.reduce((sum, mt) => sum + mt.target, 0);
});

// Ensure virtuals are included in JSON
schemeTargetSchema.set('toJSON', { virtuals: true });
schemeTargetSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('SchemeTarget', schemeTargetSchema);
