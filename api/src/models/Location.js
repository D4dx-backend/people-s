const mongoose = require('mongoose');

// GLOBAL MODEL — shared across ALL franchises.
// DO NOT add franchise plugin here. Districts, areas, and units are
// geographical facts that all NGO franchises share in common.

const locationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Location name is required'],
    trim: true
  },
  type: {
    type: String,
    enum: ['state', 'district', 'area', 'unit'],
    required: [true, 'Location type is required']
  },
  code: {
    type: String,
    required: [true, 'Location code is required'],
    unique: true,
    uppercase: true
  },
  
  // Hierarchical Structure
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    default: null
  },
  
  // Geographic Information
  coordinates: {
    latitude: Number,
    longitude: Number
  },
  boundaries: {
    type: {
      type: String,
      enum: ['Polygon'],
      default: 'Polygon'
    },
    coordinates: [[[Number]]] // GeoJSON format
  },
  
  // Administrative Details
  population: Number,
  area: Number, // in square kilometers
  
  // Contact Information
  contactPerson: {
    name: String,
    phone: String,
    email: String
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Metadata
  description: String,
  establishedDate: Date,
  
  // Audit Trail
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
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

// Indexes
locationSchema.index({ type: 1, parent: 1 });
// code: unique index defined on field (unique: true)
locationSchema.index({ name: 1 });
locationSchema.index({ coordinates: '2dsphere' });
locationSchema.index({ isActive: 1 });

// Virtual for full hierarchy path
locationSchema.virtual('fullPath').get(function() {
  // This will be populated by a separate method
  return this._fullPath;
});

// Virtual for children count
locationSchema.virtual('childrenCount', {
  ref: 'Location',
  localField: '_id',
  foreignField: 'parent',
  count: true
});

// Method to get full hierarchy path
locationSchema.methods.getFullPath = async function() {
  const path = [this.name];
  let current = this;
  
  while (current.parent) {
    current = await this.constructor.findById(current.parent);
    if (current) {
      path.unshift(current.name);
    }
  }
  
  return path.join(' > ');
};

// Method to get all children (recursive)
locationSchema.methods.getAllChildren = async function() {
  const children = await this.constructor.find({ parent: this._id });
  let allChildren = [...children];
  
  for (const child of children) {
    const grandChildren = await child.getAllChildren();
    allChildren = allChildren.concat(grandChildren);
  }
  
  return allChildren;
};

// Static method to get hierarchy tree
locationSchema.statics.getHierarchyTree = async function(parentId = null) {
  const locations = await this.find({ parent: parentId, isActive: true })
    .sort({ name: 1 });
  
  const tree = [];
  for (const location of locations) {
    const children = await this.getHierarchyTree(location._id);
    tree.push({
      ...location.toObject(),
      children
    });
  }
  
  return tree;
};

// Static method to validate hierarchy
locationSchema.statics.validateHierarchy = function(type, parentId) {
  const hierarchy = {
    state: null,
    district: 'state',
    area: 'district',
    unit: 'area'
  };
  
  if (!parentId && type !== 'state') {
    throw new Error(`${type} must have a parent`);
  }
  
  if (parentId && type === 'state') {
    throw new Error('State cannot have a parent');
  }
  
  return true;
};

// Pre-save validation
locationSchema.pre('save', async function(next) {
  try {
    // Validate hierarchy
    if (this.parent) {
      const parent = await this.constructor.findById(this.parent);
      if (!parent) {
        throw new Error('Parent location not found');
      }
      
      const hierarchy = {
        district: 'state',
        area: 'district',
        unit: 'area'
      };
      
      if (hierarchy[this.type] !== parent.type) {
        throw new Error(`Invalid hierarchy: ${this.type} cannot be child of ${parent.type}`);
      }
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model('Location', locationSchema);