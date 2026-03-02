const mongoose = require('mongoose');
const franchisePlugin = require('../utils/franchisePlugin');

const applicationConfigSchema = new mongoose.Schema({
  // Configuration category
  category: {
    type: String,
    enum: ['theme', 'menu', 'features', 'uploads', 'forms', 'validation', 'notifications', 'security'],
    required: true,
    index: true
  },
  
  // Configuration key (unique within category)
  key: {
    type: String,
    required: true,
    index: true
  },
  
  // Configuration value (flexible JSON)
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  
  // Metadata
  label: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  dataType: {
    type: String,
    enum: ['string', 'number', 'boolean', 'array', 'object'],
    required: true
  },
  
  // Validation rules
  validation: {
    min: Number,
    max: Number,
    pattern: String,
    enum: [mongoose.Schema.Types.Mixed]
  },
  
  // Access control
  scope: {
    type: String,
    enum: ['global', 'regional', 'user'],
    default: 'global'
  },
  isEditable: {
    type: Boolean,
    default: true
  },
  requiredPermission: {
    type: String,
    default: 'config.write'
  },
  
  // Audit
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Franchise multi-tenancy
applicationConfigSchema.plugin(franchisePlugin);
applicationConfigSchema.index({ category: 1, key: 1, franchise: 1 }, { unique: true });

module.exports = mongoose.model('ApplicationConfig', applicationConfigSchema);
