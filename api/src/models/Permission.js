const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema({
  // Basic Permission Information
  name: {
    type: String,
    required: [true, 'Permission name is required'],
    unique: true,
    trim: true,
    maxlength: [100, 'Permission name cannot exceed 100 characters']
  },
  displayName: {
    type: String,
    required: [true, 'Display name is required'],
    trim: true,
    maxlength: [150, 'Display name cannot exceed 150 characters']
  },
  description: {
    type: String,
    required: [true, 'Permission description is required'],
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  
  // Permission Categorization
  module: {
    type: String,
    required: [true, 'Module is required'],
    enum: [
      'users', 'roles', 'permissions', 'beneficiaries', 'applications', 
      'projects', 'schemes', 'locations', 'reports', 'notifications', 
      'finances', 'settings', 'audit', 'dashboard', 'forms', 'documents',
      'donors', 'donations', 'communications', 'system', 'interviews', 'activity_logs',
      'website', 'news', 'brochures', 'login_logs', 'error_logs'
    ]
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: ['create', 'read', 'update', 'delete', 'approve', 'manage', 'configure', 'export', 'send', 'verify', 'debug', 'monitor', 'schedule', 'cancel']
  },
  
  // Permission Scope and Context
  scope: {
    type: String,
    required: [true, 'Scope is required'],
    enum: ['global', 'regional', 'project', 'scheme', 'own', 'subordinate']
  },
  
  // Resource and Action Definition
  resource: {
    type: String,
    required: [true, 'Resource is required'],
    trim: true
  },
  action: {
    type: String,
    required: [true, 'Action is required'],
    trim: true
  },
  
  // Permission Conditions and Constraints
  conditions: {
    // Field-level restrictions
    fieldRestrictions: [{
      field: String,
      access: {
        type: String,
        enum: ['read', 'write', 'hidden'],
        default: 'read'
      }
    }],
    
    // Time-based restrictions
    timeRestrictions: {
      allowedHours: {
        start: { type: Number, min: 0, max: 23 },
        end: { type: Number, min: 0, max: 23 }
      },
      allowedDays: [{
        type: String,
        enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
      }],
      timezone: {
        type: String,
        default: 'Asia/Kolkata'
      }
    },
    
    // IP-based restrictions
    ipRestrictions: {
      allowedIPs: [String],
      blockedIPs: [String]
    },
    
    // Approval requirements
    requiresApproval: {
      type: Boolean,
      default: false
    },
    approvalLevel: {
      type: Number,
      min: 1,
      max: 5
    }
  },
  
  // Permission Dependencies
  dependencies: {
    // Permissions that must be present for this permission to work
    requires: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Permission'
    }],
    // Permissions that conflict with this permission
    conflicts: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Permission'
    }],
    // Permissions that are automatically granted with this permission
    implies: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Permission'
    }]
  },
  
  // Permission Metadata
  type: {
    type: String,
    enum: ['system', 'custom'],
    default: 'custom'
  },
  priority: {
    type: Number,
    default: 0,
    min: -100,
    max: 100
  },
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Security Classification
  securityLevel: {
    type: String,
    enum: ['public', 'internal', 'confidential', 'restricted', 'top_secret'],
    default: 'internal'
  },
  
  // Audit and Compliance
  auditRequired: {
    type: Boolean,
    default: false
  },
  complianceNotes: String,
  
  // Usage Statistics
  stats: {
    totalAssignments: {
      type: Number,
      default: 0
    },
    activeAssignments: {
      type: Number,
      default: 0
    },
    lastUsed: Date,
    usageCount: {
      type: Number,
      default: 0
    }
  },
  
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
permissionSchema.index({ name: 1 });
permissionSchema.index({ module: 1, category: 1 });
permissionSchema.index({ resource: 1, action: 1 });
permissionSchema.index({ scope: 1 });
permissionSchema.index({ type: 1, isActive: 1 });
permissionSchema.index({ securityLevel: 1 });

// Virtual for full permission identifier
permissionSchema.virtual('identifier').get(function() {
  return `${this.module}:${this.resource}:${this.action}:${this.scope}`;
});

// Virtual for roles that have this permission
permissionSchema.virtual('roles', {
  ref: 'Role',
  localField: '_id',
  foreignField: 'permissions',
  justOne: false
});

// Pre-save middleware to validate dependencies
permissionSchema.pre('save', async function(next) {
  // Check for circular dependencies
  if (this.dependencies.requires && this.dependencies.requires.length > 0) {
    const checkCircular = async (permissionId, visited = new Set()) => {
      if (visited.has(permissionId.toString())) {
        throw new Error('Circular permission dependency detected');
      }
      visited.add(permissionId.toString());
      
      const permission = await this.constructor.findById(permissionId);
      if (permission && permission.dependencies.requires) {
        for (const requiredId of permission.dependencies.requires) {
          await checkCircular(requiredId, visited);
        }
      }
    };
    
    for (const requiredId of this.dependencies.requires) {
      await checkCircular(requiredId);
    }
  }
  
  next();
});

// Method to check if permission conflicts with another
permissionSchema.methods.conflictsWith = function(otherPermission) {
  return this.dependencies.conflicts.some(conflictId => 
    conflictId.toString() === otherPermission._id.toString()
  );
};

// Method to get all implied permissions
permissionSchema.methods.getImpliedPermissions = async function() {
  const implied = new Set();
  
  if (this.dependencies.implies && this.dependencies.implies.length > 0) {
    await this.populate('dependencies.implies');
    
    for (const impliedPermission of this.dependencies.implies) {
      implied.add(impliedPermission._id.toString());
      
      // Recursively get implied permissions
      const nestedImplied = await impliedPermission.getImpliedPermissions();
      nestedImplied.forEach(id => implied.add(id));
    }
  }
  
  return Array.from(implied);
};

// Method to validate permission conditions
permissionSchema.methods.validateConditions = function(context = {}) {
  const { user, ip, timestamp = new Date() } = context;
  
  // Check time restrictions
  if (this.conditions.timeRestrictions) {
    const { allowedHours, allowedDays } = this.conditions.timeRestrictions;
    
    if (allowedHours && allowedHours.start !== undefined && allowedHours.end !== undefined) {
      const hour = timestamp.getHours();
      if (hour < allowedHours.start || hour > allowedHours.end) {
        return { valid: false, reason: 'Outside allowed hours' };
      }
    }
    
    if (allowedDays && allowedDays.length > 0) {
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const currentDay = dayNames[timestamp.getDay()];
      if (!allowedDays.includes(currentDay)) {
        return { valid: false, reason: 'Outside allowed days' };
      }
    }
  }
  
  // Check IP restrictions
  if (this.conditions.ipRestrictions && ip) {
    const { allowedIPs, blockedIPs } = this.conditions.ipRestrictions;
    
    if (blockedIPs && blockedIPs.includes(ip)) {
      return { valid: false, reason: 'IP address blocked' };
    }
    
    if (allowedIPs && allowedIPs.length > 0 && !allowedIPs.includes(ip)) {
      return { valid: false, reason: 'IP address not allowed' };
    }
  }
  
  return { valid: true };
};

// Static method to get permissions by module
permissionSchema.statics.getByModule = async function(module) {
  return await this.find({ 
    module, 
    isActive: true 
  }).sort({ category: 1, name: 1 });
};

// Static method to get permissions by security level
permissionSchema.statics.getBySecurityLevel = async function(level) {
  return await this.find({ 
    securityLevel: level, 
    isActive: true 
  }).sort({ module: 1, category: 1 });
};

// Static method to create system permission
permissionSchema.statics.createSystemPermission = async function(permissionData) {
  const permission = new this({
    ...permissionData,
    type: 'system'
  });
  
  return await permission.save();
};

// Static method to bulk create permissions
permissionSchema.statics.bulkCreatePermissions = async function(permissionsData) {
  const permissions = permissionsData.map(data => ({
    ...data,
    type: data.type || 'system'
  }));
  
  return await this.insertMany(permissions, { ordered: false });
};

module.exports = mongoose.model('Permission', permissionSchema);