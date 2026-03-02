const mongoose = require('mongoose');

/**
 * UserFranchise — Junction model linking a global User to a Franchise.
 *
 * A single User (identified globally by phone number) can be a member of
 * multiple franchises with DIFFERENT roles in each.  The role and adminScope
 * that used to live on the User document now live here, keyed per franchise.
 *
 * Beneficiaries are NOT linked via UserFranchise; their User entry role field
 * stays 'beneficiary' for legacy OTP flow compatibility.  All other roles
 * (super_admin → scheme_coordinator) use this junction.
 */

const ADMIN_ROLES = [
  'super_admin',
  'state_admin',
  'district_admin',
  'area_admin',
  'unit_admin',
  'project_coordinator',
  'scheme_coordinator'
];

const adminScopeSchema = new mongoose.Schema({
  level: {
    type: String,
    enum: ['super', 'state', 'district', 'area', 'unit', 'project', 'scheme']
  },
  district: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
  area:     { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
  unit:     { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
  regions:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'Location' }],
  projects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Project' }],
  schemes:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'Scheme' }],
  permissions: {
    canCreateUsers:        { type: Boolean, default: false },
    canManageProjects:     { type: Boolean, default: false },
    canManageSchemes:      { type: Boolean, default: false },
    canApproveApplications:{ type: Boolean, default: false },
    canViewReports:        { type: Boolean, default: false },
    canManageFinances:     { type: Boolean, default: false }
  }
}, { _id: false });

const userFranchiseSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required']
  },
  franchise: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Franchise',
    required: [true, 'Franchise is required']
  },
  role: {
    type: String,
    enum: ADMIN_ROLES,
    required: [true, 'Role is required']
  },
  adminScope: adminScopeSchema,

  isActive: { type: Boolean, default: true },
  joinedAt:  { type: Date, default: Date.now },
  lastAccessedAt: Date,

  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function (doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// ── Indexes ──────────────────────────────────────────────────────────────────
// Primary: one user ↔ one franchise (unique membership)
userFranchiseSchema.index({ user: 1, franchise: 1 }, { unique: true });
userFranchiseSchema.index({ franchise: 1, role: 1 });
userFranchiseSchema.index({ franchise: 1, isActive: 1 });
userFranchiseSchema.index({ user: 1, isActive: 1 });

// ── Statics ──────────────────────────────────────────────────────────────────

/**
 * Get all active franchise memberships for a user.
 * Returns UserFranchise docs populated with franchise info.
 */
userFranchiseSchema.statics.getUserFranchises = function (userId) {
  return this.find({ user: userId, isActive: true })
    .populate('franchise', 'slug displayName logoUrl isActive');
};

/**
 * Get all users in a franchise (optionally filtered by role).
 */
userFranchiseSchema.statics.getFranchiseUsers = function (franchiseId, filters = {}) {
  return this.find({ franchise: franchiseId, isActive: true, ...filters })
    .populate('user', 'name email phone profile isActive isVerified lastLogin');
};

/**
 * Quick boolean check: does this user have active membership in this franchise?
 * Used by auth middleware and cache layer.
 */
userFranchiseSchema.statics.hasAccess = async function (userId, franchiseId) {
  const doc = await this.findOne({
    user: userId,
    franchise: franchiseId,
    isActive: true
  }).lean();
  return !!doc;
};

/**
 * Returns the UserFranchise doc (with role + adminScope) for a user in a franchise.
 * Returns null if not found.
 */
userFranchiseSchema.statics.getMembership = function (userId, franchiseId) {
  return this.findOne({
    user: userId,
    franchise: franchiseId,
    isActive: true
  });
};

// ── Instance methods ─────────────────────────────────────────────────────────

/**
 * Check region access using this franchise membership's adminScope.
 */
userFranchiseSchema.methods.hasRegionAccess = function (regionId) {
  if (this.role === 'state_admin' || this.role === 'super_admin') return true;
  if (!this.adminScope?.regions?.length) return false;
  return this.adminScope.regions.some(r => r.toString() === regionId.toString());
};

/**
 * Check project access.
 */
userFranchiseSchema.methods.hasProjectAccess = function (projectId) {
  if (['super_admin', 'state_admin'].includes(this.role)) return true;
  if (this.role === 'project_coordinator') {
    return (this.adminScope?.projects || []).some(p => p.toString() === projectId.toString());
  }
  return false;
};

/**
 * Numeric admin level (lower = more powerful).
 */
userFranchiseSchema.methods.getAdminLevel = function () {
  const levels = {
    super_admin: 0,
    state_admin: 1,
    district_admin: 2,
    area_admin: 3,
    unit_admin: 4,
    project_coordinator: 5,
    scheme_coordinator: 5
  };
  return levels[this.role] ?? 6;
};

module.exports = mongoose.model('UserFranchise', userFranchiseSchema);
module.exports.ADMIN_ROLES = ADMIN_ROLES;
