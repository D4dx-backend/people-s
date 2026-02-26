const mongoose = require('mongoose');
const franchisePlugin = require('../utils/franchisePlugin');

const roleSchema = new mongoose.Schema({
  // Basic Role Information
  name: {
    type: String,
    required: [true, 'Role name is required'],
    trim: true,
    maxlength: [50, 'Role name cannot exceed 50 characters']
  },
  displayName: {
    type: String,
    required: [true, 'Display name is required'],
    trim: true,
    maxlength: [100, 'Display name cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Role description is required'],
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  
  // Role Type and Hierarchy
  type: {
    type: String,
    enum: ['system', 'custom'],
    default: 'custom',
    required: true
  },
  level: {
    type: Number,
    required: [true, 'Role level is required'],
    min: [0, 'Role level cannot be negative'],
    max: [10, 'Role level cannot exceed 10']
  },
  category: {
    type: String,
    enum: ['admin', 'coordinator', 'staff', 'beneficiary', 'external'],
    required: [true, 'Role category is required']
  },
  
  // Permissions Array
  permissions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Permission'
  }],
  
  // Role Inheritance (can inherit permissions from parent roles)
  inheritsFrom: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role'
  }],
  
  // Administrative Scope Configuration
  scopeConfig: {
    // Geographic scope levels this role can manage
    allowedScopeLevels: [{
      type: String,
      enum: ['super', 'state', 'district', 'area', 'unit', 'project', 'scheme']
    }],
    // Default scope level for new users with this role
    defaultScopeLevel: {
      type: String,
      enum: ['super', 'state', 'district', 'area', 'unit', 'project', 'scheme']
    },
    // Whether this role can manage multiple regions/projects/schemes
    allowMultipleScopes: {
      type: Boolean,
      default: false
    },
    // Maximum number of scopes this role can handle
    maxScopes: {
      type: Number,
      default: 1,
      min: 1
    }
  },
  
  // Role Constraints and Limitations
  constraints: {
    // Maximum number of users that can have this role
    maxUsers: {
      type: Number,
      default: null // null means unlimited
    },
    // Whether this role requires approval to assign
    requiresApproval: {
      type: Boolean,
      default: false
    },
    // Roles that can assign this role to users
    assignableBy: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Role'
    }],
    // Whether this role can be deleted
    isDeletable: {
      type: Boolean,
      default: true
    },
    // Whether this role can be modified
    isModifiable: {
      type: Boolean,
      default: true
    }
  },
  
  // Status and Metadata
  isActive: {
    type: Boolean,
    default: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  
  // Audit Trail
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Usage Statistics
  stats: {
    totalUsers: {
      type: Number,
      default: 0
    },
    activeUsers: {
      type: Number,
      default: 0
    },
    lastAssigned: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
roleSchema.index({ name: 1 });
roleSchema.index({ type: 1, isActive: 1 });
roleSchema.index({ level: 1 });
roleSchema.index({ category: 1 });

// Virtual for computed permissions (including inherited)
roleSchema.virtual('computedPermissions', {
  ref: 'Permission',
  localField: '_id',
  foreignField: 'roles',
  justOne: false
});

// Pre-save middleware to validate role hierarchy
roleSchema.pre('save', async function(next) {
  // Prevent circular inheritance
  if (this.inheritsFrom && this.inheritsFrom.length > 0) {
    const checkCircular = async (roleId, visited = new Set()) => {
      if (visited.has(roleId.toString())) {
        throw new Error('Circular role inheritance detected');
      }
      visited.add(roleId.toString());
      
      const role = await this.constructor.findById(roleId);
      if (role && role.inheritsFrom) {
        for (const parentId of role.inheritsFrom) {
          await checkCircular(parentId, visited);
        }
      }
    };
    
    for (const parentId of this.inheritsFrom) {
      await checkCircular(parentId);
    }
  }
  
  next();
});

// Method to get all permissions (including inherited)
roleSchema.methods.getAllPermissions = async function() {
  const allPermissions = new Set();
  
  // Add direct permissions
  await this.populate('permissions');
  this.permissions.forEach(permission => {
    allPermissions.add(permission._id.toString());
  });
  
  // Add inherited permissions
  if (this.inheritsFrom && this.inheritsFrom.length > 0) {
    await this.populate('inheritsFrom');
    for (const parentRole of this.inheritsFrom) {
      const parentPermissions = await parentRole.getAllPermissions();
      parentPermissions.forEach(permission => {
        allPermissions.add(permission.toString());
      });
    }
  }
  
  return Array.from(allPermissions);
};

// Method to check if role can be assigned by another role
roleSchema.methods.canBeAssignedBy = function(assignerRole) {
  if (!this.constraints.requiresApproval) return true;
  
  return this.constraints.assignableBy.some(roleId => 
    roleId.toString() === assignerRole._id.toString()
  );
};

// Method to check if role has reached user limit
roleSchema.methods.hasReachedUserLimit = function() {
  if (!this.constraints.maxUsers) return false;
  return this.stats.activeUsers >= this.constraints.maxUsers;
};

// Static method to get role hierarchy
roleSchema.statics.getRoleHierarchy = async function() {
  const roles = await this.find({ isActive: true }).sort({ level: 1 });
  
  const hierarchy = {};
  roles.forEach(role => {
    if (!hierarchy[role.level]) {
      hierarchy[role.level] = [];
    }
    hierarchy[role.level].push(role);
  });
  
  return hierarchy;
};

// Static method to get roles by category
roleSchema.statics.getRolesByCategory = async function(category) {
  return await this.find({ 
    category, 
    isActive: true 
  }).populate('permissions').sort({ level: 1 });
};

// Static method to create system roles (used in seeding)
roleSchema.statics.createSystemRole = async function(roleData) {
  const role = new this({
    ...roleData,
    type: 'system',
    constraints: {
      ...roleData.constraints,
      isDeletable: false,
      isModifiable: false
    }
  });
  
  return await role.save();
};

// Franchise multi-tenancy — compound unique: same role name per franchise
roleSchema.plugin(franchisePlugin);
roleSchema.index({ name: 1, franchise: 1 }, { unique: true });

module.exports = mongoose.model('Role', roleSchema);