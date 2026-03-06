const mongoose = require('mongoose');
const franchisePlugin = require('../utils/franchisePlugin');

const userRoleSchema = new mongoose.Schema({
  // User and Role Association
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required']
  },
  role: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role',
    required: [true, 'Role is required']
  },
  
  // Assignment Context
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Assigned by is required']
  },
  assignmentReason: {
    type: String,
    trim: true,
    maxlength: [500, 'Assignment reason cannot exceed 500 characters']
  },
  
  // Scope Configuration for this specific assignment
  scope: {
    // Geographic scope
    regions: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location'
    }],
    // Project scope
    projects: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project'
    }],
    // Scheme scope
    schemes: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Scheme'
    }],
    // Custom scope restrictions
    customRestrictions: {
      maxBeneficiaries: Number,
      maxApplicationValue: Number,
      allowedDistricts: [String],
      allowedCategories: [String]
    }
  },
  
  // Additional Permissions (beyond role permissions)
  additionalPermissions: [{
    permission: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Permission'
    },
    grantedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    grantedAt: {
      type: Date,
      default: Date.now
    },
    reason: String,
    expiresAt: Date
  }],
  
  // Permission Restrictions (remove specific permissions from role)
  restrictedPermissions: [{
    permission: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Permission'
    },
    restrictedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    restrictedAt: {
      type: Date,
      default: Date.now
    },
    reason: String,
    expiresAt: Date
  }],
  
  // Temporal Constraints
  validFrom: {
    type: Date,
    default: Date.now
  },
  validUntil: {
    type: Date,
    default: null // null means permanent
  },
  
  // Status and Flags
  isActive: {
    type: Boolean,
    default: true
  },
  isPrimary: {
    type: Boolean,
    default: false // One role per user should be primary
  },
  isTemporary: {
    type: Boolean,
    default: false
  },
  
  // Approval Workflow
  approvalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'revoked'],
    default: 'approved'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  approvalComments: String,
  
  // Delegation Support
  delegatedFrom: {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    originalRole: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Role'
    },
    delegationReason: String,
    delegationExpiry: Date
  },
  
  // Usage Tracking
  stats: {
    lastUsed: Date,
    usageCount: {
      type: Number,
      default: 0
    },
    loginCount: {
      type: Number,
      default: 0
    }
  },
  
  // Audit Trail
  history: [{
    action: {
      type: String,
      enum: ['assigned', 'modified', 'suspended', 'reactivated', 'revoked', 'expired']
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    performedAt: {
      type: Date,
      default: Date.now
    },
    details: mongoose.Schema.Types.Mixed,
    reason: String
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes
// Franchise multi-tenancy
userRoleSchema.plugin(franchisePlugin);
userRoleSchema.index({ user: 1, role: 1, franchise: 1 }, { unique: true });
userRoleSchema.index({ user: 1, isActive: 1 });
userRoleSchema.index({ role: 1, isActive: 1 });
userRoleSchema.index({ assignedBy: 1 });
userRoleSchema.index({ validFrom: 1, validUntil: 1 });
userRoleSchema.index({ approvalStatus: 1 });

// Virtual for checking if role assignment is currently valid
userRoleSchema.virtual('isCurrentlyValid').get(function() {
  const now = new Date();
  return this.isActive && 
         this.approvalStatus === 'approved' &&
         this.validFrom <= now &&
         (!this.validUntil || this.validUntil > now);
});

// Virtual for checking if role assignment is expired
userRoleSchema.virtual('isExpired').get(function() {
  return this.validUntil && this.validUntil < new Date();
});

// Pre-save middleware
userRoleSchema.pre('save', async function(next) {
  // Ensure only one primary role per user
  if (this.isPrimary && this.isModified('isPrimary')) {
    await this.constructor.updateMany(
      { user: this.user, _id: { $ne: this._id } },
      { isPrimary: false }
    );
  }
  
  // Add history entry for changes
  if (this.isModified() && !this.isNew) {
    const changes = this.modifiedPaths();
    this.history.push({
      action: 'modified',
      performedBy: this.assignedBy,
      details: { modifiedFields: changes }
    });
  }
  
  next();
});

// Method to get effective permissions
userRoleSchema.methods.getEffectivePermissions = async function() {
  if (!this.populated('role')) {
    await this.populate({ path: 'role', options: { bypassFranchise: true } });
  }
  
  if (!this.role) {
    console.warn(`[UserRole] Role not found for UserRole ${this._id}. Returning empty permissions.`);
    return [];
  }

  // Get base role permissions
  const rolePermissions = await this.role.getAllPermissions();
  const effectivePermissions = new Set(rolePermissions);
  
  // Add additional permissions
  for (const additional of this.additionalPermissions) {
    if (!additional.expiresAt || additional.expiresAt > new Date()) {
      effectivePermissions.add(additional.permission.toString());
    }
  }
  
  // Remove restricted permissions
  for (const restricted of this.restrictedPermissions) {
    if (!restricted.expiresAt || restricted.expiresAt > new Date()) {
      effectivePermissions.delete(restricted.permission.toString());
    }
  }
  
  return Array.from(effectivePermissions);
};

// Method to check if user has specific permission through this role
userRoleSchema.methods.hasPermission = async function(permissionId) {
  const effectivePermissions = await this.getEffectivePermissions();
  return effectivePermissions.includes(permissionId.toString());
};

// Method to add additional permission
userRoleSchema.methods.addPermission = function(permissionId, grantedBy, reason, expiresAt = null) {
  // Remove if already exists
  this.additionalPermissions = this.additionalPermissions.filter(
    p => p.permission.toString() !== permissionId.toString()
  );
  
  // Add new permission
  this.additionalPermissions.push({
    permission: permissionId,
    grantedBy,
    reason,
    expiresAt
  });
  
  // Add history entry
  this.history.push({
    action: 'modified',
    performedBy: grantedBy,
    details: { addedPermission: permissionId },
    reason: `Added permission: ${reason}`
  });
};

// Method to restrict permission
userRoleSchema.methods.restrictPermission = function(permissionId, restrictedBy, reason, expiresAt = null) {
  // Remove if already exists
  this.restrictedPermissions = this.restrictedPermissions.filter(
    p => p.permission.toString() !== permissionId.toString()
  );
  
  // Add restriction
  this.restrictedPermissions.push({
    permission: permissionId,
    restrictedBy,
    reason,
    expiresAt
  });
  
  // Add history entry
  this.history.push({
    action: 'modified',
    performedBy: restrictedBy,
    details: { restrictedPermission: permissionId },
    reason: `Restricted permission: ${reason}`
  });
};

// Method to suspend role assignment
userRoleSchema.methods.suspend = function(suspendedBy, reason) {
  this.isActive = false;
  this.history.push({
    action: 'suspended',
    performedBy: suspendedBy,
    reason
  });
};

// Method to reactivate role assignment
userRoleSchema.methods.reactivate = function(reactivatedBy, reason) {
  this.isActive = true;
  this.history.push({
    action: 'reactivated',
    performedBy: reactivatedBy,
    reason
  });
};

// Method to revoke role assignment
userRoleSchema.methods.revoke = function(revokedBy, reason) {
  this.isActive = false;
  this.approvalStatus = 'revoked';
  this.history.push({
    action: 'revoked',
    performedBy: revokedBy,
    reason
  });
};

// Static method to get user's active roles
userRoleSchema.statics.getUserActiveRoles = async function(userId) {
  return await this.find({
    user: userId,
    isActive: true,
    approvalStatus: 'approved',
    validFrom: { $lte: new Date() },
    $or: [
      { validUntil: null },
      { validUntil: { $gt: new Date() } }
    ]
  }).setOptions({ bypassFranchise: true })
    .populate({ path: 'role', options: { bypassFranchise: true } });
};

// Static method to get users with specific role
userRoleSchema.statics.getUsersWithRole = async function(roleId, options = {}) {
  const query = {
    role: roleId,
    isActive: true,
    approvalStatus: 'approved'
  };
  
  if (options.includeExpired !== true) {
    query.validFrom = { $lte: new Date() };
    query.$or = [
      { validUntil: null },
      { validUntil: { $gt: new Date() } }
    ];
  }
  
  return await this.find(query).populate('user role');
};

// Static method to cleanup expired assignments
userRoleSchema.statics.cleanupExpired = async function() {
  const expiredAssignments = await this.find({
    validUntil: { $lt: new Date() },
    isActive: true
  });
  
  for (const assignment of expiredAssignments) {
    assignment.isActive = false;
    assignment.history.push({
      action: 'expired',
      performedAt: new Date(),
      reason: 'Automatic expiry'
    });
    await assignment.save();
  }
  
  return expiredAssignments.length;
};

module.exports = mongoose.model('UserRole', userRoleSchema);