const UserFranchise = require('../models/UserFranchise');

/**
 * Cross-Franchise Resolver Middleware
 *
 * Runs AFTER authenticate. For district_admin, area_admin and unit_admin
 * users who hold active memberships in more than one franchise, it attaches
 * multi-franchise context to the request so that READ queries can span all
 * their franchises.
 *
 * Properties set on `req` when applicable:
 *   req.isCrossFranchise  {boolean}  — true when the user may read across franchises
 *   req.crossFranchiseIds {ObjectId[]} — all franchise IDs the user can read from
 *   req.crossFranchises   {Array}     — lightweight franchise objects (id, slug, displayName)
 *
 * For all other roles (or users with only one franchise) this middleware is a
 * no-op — existing behaviour is completely unchanged.
 */

const CROSS_FRANCHISE_ROLES = ['district_admin', 'area_admin', 'unit_admin'];

async function crossFranchiseResolver(req, res, next) {
  try {
    if (!req.user) return next();

    const effectiveRole = req.userRole || req.user.role;

    if (!CROSS_FRANCHISE_ROLES.includes(effectiveRole)) return next();

    const memberships = await UserFranchise.find({
      user: req.user._id,
      isActive: true
    }).populate('franchise', 'slug displayName logoUrl isActive');

    const activeMemberships = memberships.filter(
      m => m.franchise && m.franchise.isActive
    );

    if (activeMemberships.length <= 1) return next();

    req.isCrossFranchise = true;
    req.crossFranchiseIds = activeMemberships.map(m => m.franchise._id);
    req.crossFranchises = activeMemberships.map(m => ({
      id: m.franchise._id,
      slug: m.franchise.slug,
      displayName: m.franchise.displayName,
      logoUrl: m.franchise.logoUrl,
      role: m.role
    }));

    next();
  } catch (error) {
    console.error('[crossFranchiseResolver] Error:', error.message);
    next();
  }
}

module.exports = crossFranchiseResolver;
module.exports.CROSS_FRANCHISE_ROLES = CROSS_FRANCHISE_ROLES;
