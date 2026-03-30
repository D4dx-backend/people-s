const Franchise = require('../models/Franchise');
const rbacService = require('../services/rbacService');
const franchiseCache = require('../utils/franchiseCache');

/**
 * Global Admin Controller
 *
 * Manages franchises from a god-level perspective.
 * Only reachable by users with User.isSuperAdmin = true.
 * All operations bypass franchise scoping.
 */
class GlobalAdminController {

  /**
   * Middleware: Reject anyone who isn't a global super admin.
   */
  requireGlobalAdmin(req, res, next) {
    if (!req.user?.isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Global admin access required',
        code: 'NOT_GLOBAL_ADMIN'
      });
    }
    next();
  }

  /**
   * GET /api/global/franchises
   * List all franchises with basic stats.
   */
  async listFranchises(req, res) {
    try {
      const franchises = await Franchise.find({}).sort({ displayName: 1 }).lean();

      const UserFranchise = require('../models/UserFranchise');
      const Beneficiary   = require('../models/Beneficiary');

      const enriched = await Promise.all(franchises.map(async (f) => {
        const [userCount, beneficiaryCount] = await Promise.all([
          UserFranchise.countDocuments({ franchise: f._id, isActive: true }),
          Beneficiary.countDocuments({ franchise: f._id }).catch(() => 0),
        ]);
        // Strip sensitive settings before returning
        const safe = { ...f };
        if (safe.settings) {
          safe.settings = { ...safe.settings };
          delete safe.settings.smsConfig;
          delete safe.settings.emailConfig;
        }
        safe.id = safe._id;
        return { ...safe, stats: { userCount, beneficiaryCount } };
      }));

      res.json({ success: true, data: enriched, total: enriched.length });
    } catch (error) {
      console.error('[GlobalAdmin] listFranchises error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/global/franchises/:id
   */
  async getFranchise(req, res) {
    try {
      const franchise = await Franchise.findById(req.params.id)
        .select('-settings.smsConfig -settings.emailConfig');
      if (!franchise) return res.status(404).json({ success: false, message: 'Franchise not found' });
      res.json({ success: true, data: franchise });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * POST /api/global/franchises
   * Create a new franchise and initialize its RBAC, WebsiteSettings, and default ApplicationConfig.
   */
  async createFranchise(req, res) {
    try {
      const {
        name, slug, displayName, tagline, regNumber, address, phone, email,
        supportEmail, paymentsEmail, website, websiteUrl, logoUrl, logoFilename,
        defaultTheme, customTheme, erpTitle, erpSubtitle, heroSubtext, aboutText,
        footerText, copyrightHolder, communityLabel, communityDescription,
        emailSenderName, domains, settings
      } = req.body;

      // Check slug uniqueness
      const existing = await Franchise.findOne({ slug: slug?.toLowerCase() });
      if (existing) {
        return res.status(409).json({ success: false, message: 'A franchise with this slug already exists' });
      }

      const franchise = await Franchise.create({
        name, slug, displayName, tagline, regNumber, address, phone, email,
        supportEmail, paymentsEmail, website, websiteUrl, logoUrl, logoFilename,
        defaultTheme, customTheme, erpTitle, erpSubtitle, heroSubtext, aboutText,
        footerText, copyrightHolder, communityLabel, communityDescription,
        emailSenderName,
        domains: Array.isArray(domains) ? domains : (domains ? [domains] : []),
        settings,
        createdBy: req.user._id
      });

      // Initialize RBAC (permissions + system roles) for this franchise
      await rbacService.initializeFranchiseRBAC(franchise._id);

      // Create default WebsiteSettings
      const WebsiteSettings = require('../models/WebsiteSettings');
      await WebsiteSettings.create({
        franchise: franchise._id,
        aboutUs: { title: `About ${franchise.displayName}`, description: franchise.aboutText || '' },
        contactDetails: { phone: franchise.phone, email: franchise.email }
      });

      // Invalidate cache
      franchiseCache.invalidateFranchise(franchise);

      res.status(201).json({
        success: true,
        message: 'Franchise created successfully',
        data: franchise
      });
    } catch (error) {
      console.error('[GlobalAdmin] createFranchise error:', error);
      if (error.code === 11000) {
        return res.status(409).json({ success: false, message: 'Slug or domain already exists' });
      }
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * PUT /api/global/franchises/:id
   */
  async updateFranchise(req, res) {
    try {
      // Build a safe dot-notation update — never allow overwriting secrets via this endpoint
      const SAFE_FIELDS = ['displayName', 'name', 'tagline', 'phone', 'email', 'website',
        'websiteUrl', 'logoUrl', 'supportEmail', 'paymentsEmail', 'isActive'];

      const update = {};
      for (const field of SAFE_FIELDS) {
        if (req.body[field] !== undefined) update[field] = req.body[field];
      }
      // Allow updating non-sensitive settings sub-fields
      const safeSettings = ['maxUsers', 'maxBeneficiaries', 'features'];
      for (const sf of safeSettings) {
        if (req.body.settings?.[sf] !== undefined) update[`settings.${sf}`] = req.body.settings[sf];
      }

      if (Object.keys(update).length === 0) {
        return res.status(400).json({ success: false, message: 'No updatable fields provided' });
      }

      const franchise = await Franchise.findByIdAndUpdate(
        req.params.id,
        { $set: update },
        { new: true }
      );
      if (!franchise) return res.status(404).json({ success: false, message: 'Franchise not found' });

      franchiseCache.invalidateFranchise(franchise);
      res.json({ success: true, message: 'Franchise updated', data: franchise });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * DELETE /api/global/franchises/:id
   * Soft-delete (deactivate) only — data is preserved.
   */
  async deactivateFranchise(req, res) {
    try {
      const franchise = await Franchise.findByIdAndUpdate(
        req.params.id,
        { $set: { isActive: false } },
        { new: true }
      );
      if (!franchise) return res.status(404).json({ success: false, message: 'Franchise not found' });

      franchiseCache.invalidateFranchise(franchise);

      res.json({ success: true, message: 'Franchise deactivated', data: { id: franchise._id, slug: franchise.slug } });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * POST /api/global/franchises/:id/domains
   * Add a custom domain to a franchise.
   * Body: { domain: "erp.peoplefoundation.org" }
   */
  async addDomain(req, res) {
    try {
      const { domain } = req.body;
      if (!domain) return res.status(400).json({ success: false, message: 'domain is required' });

      const franchise = await Franchise.addDomain(req.params.id, domain);
      if (!franchise) return res.status(404).json({ success: false, message: 'Franchise not found' });

      franchiseCache.invalidateFranchise(franchise);
      res.json({ success: true, message: `Domain "${domain.toLowerCase()}" added`, data: { domains: franchise.domains } });
    } catch (error) {
      if (error.code === 'DOMAIN_CONFLICT' || error.code === 11000) {
        return res.status(409).json({ success: false, message: error.message });
      }
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * DELETE /api/global/franchises/:id/domains
   * Remove a custom domain from a franchise.
   * Body: { domain: "erp.peoplefoundation.org" }
   */
  async removeDomain(req, res) {
    try {
      const { domain } = req.body;
      if (!domain) return res.status(400).json({ success: false, message: 'domain is required' });

      const franchise = await Franchise.removeDomain(req.params.id, domain);
      if (!franchise) return res.status(404).json({ success: false, message: 'Franchise not found' });

      franchiseCache.invalidateFranchise(franchise);
      res.json({ success: true, message: `Domain "${domain.toLowerCase()}" removed`, data: { domains: franchise.domains } });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/global/franchises/:id/stats
   * Aggregated stats for a single franchise.
   */
  async getFranchiseStats(req, res) {
    try {
      const id = req.params.id;
      const mongoose = require('mongoose');
      const fid = new mongoose.Types.ObjectId(id);

      const UserFranchise  = require('../models/UserFranchise');
      const Beneficiary    = require('../models/Beneficiary');
      const Application    = require('../models/Application');
      const Donation       = require('../models/Donation');
      const Project        = require('../models/Project');
      const Scheme         = require('../models/Scheme');

      const [users, beneficiaries, applications, donations, projects, schemes] = await Promise.all([
        UserFranchise.countDocuments({ franchise: fid, isActive: true }),
        Beneficiary.countDocuments({ franchise: fid }).setOptions({ bypassFranchise: true }),
        Application.countDocuments({ franchise: fid }).setOptions({ bypassFranchise: true }),
        Donation.aggregate([
          { $match: { franchise: fid, status: 'completed' } },
          { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
        ]),
        Project.countDocuments({ franchise: fid }).setOptions({ bypassFranchise: true }),
        Scheme.countDocuments({ franchise: fid }).setOptions({ bypassFranchise: true })
      ]);

      res.json({
        success: true,
        data: {
          franchiseId: id,
          users,
          beneficiaries,
          applications,
          projects,
          schemes,
          donations: {
            total: donations[0]?.total || 0,
            count: donations[0]?.count || 0
          }
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * POST /api/global/franchises/:id/initialize-rbac
   * (Re-)initialize permissions and system roles for a franchise.
   */
  async initializeFranchiseRBAC(req, res) {
    try {
      await rbacService.initializeFranchiseRBAC(req.params.id);
      res.json({ success: true, message: 'RBAC initialized for franchise' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/global/franchises/:id/admins
   * List all admin members of a franchise across all roles.
   */
  async listFranchiseAdmins(req, res) {
    try {
      const UserFranchise = require('../models/UserFranchise');
      const franchise = await Franchise.findById(req.params.id).lean();
      if (!franchise) return res.status(404).json({ success: false, message: 'Franchise not found' });

      const memberships = await UserFranchise.find({
        franchise: req.params.id,
      })
        .populate('user', 'name phone email isActive isVerified lastLogin createdAt')
        .sort({ role: 1, createdAt: -1 })
        .lean();

      return res.json({
        success: true,
        data: {
          franchise: { id: franchise._id, slug: franchise.slug, displayName: franchise.displayName },
          admins: memberships.map(m => ({
            membershipId: m._id,
            isActive: m.isActive,
            joinedAt: m.joinedAt,
            role: m.role,
            user: m.user,
          })),
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * POST /api/global/franchises/:id/admins
   * Create or assign an admin for a franchise.
   * Body: { name, phone, email?, role? }
   */
  async createFranchiseAdmin(req, res) {
    try {
      const { User } = require('../models');
      const UserFranchise = require('../models/UserFranchise');

      const VALID_ROLES = [
        'super_admin', 'state_admin', 'district_admin',
        'area_admin', 'unit_admin', 'project_coordinator', 'scheme_coordinator',
      ];

      const ROLE_SCOPE = {
        super_admin:         { level: 'super',    permissions: { canCreateUsers: true,  canManageProjects: true,  canManageSchemes: true,  canApproveApplications: true,  canViewReports: true,  canManageFinances: true  } },
        state_admin:         { level: 'state',    permissions: { canCreateUsers: true,  canManageProjects: true,  canManageSchemes: true,  canApproveApplications: true,  canViewReports: true,  canManageFinances: true  } },
        district_admin:      { level: 'district', permissions: { canCreateUsers: true,  canManageProjects: false, canManageSchemes: false, canApproveApplications: true,  canViewReports: true,  canManageFinances: false } },
        area_admin:          { level: 'area',     permissions: { canCreateUsers: true,  canManageProjects: false, canManageSchemes: false, canApproveApplications: true,  canViewReports: true,  canManageFinances: false } },
        unit_admin:          { level: 'unit',     permissions: { canCreateUsers: false, canManageProjects: false, canManageSchemes: false, canApproveApplications: true,  canViewReports: true,  canManageFinances: false } },
        project_coordinator: { level: 'project',  permissions: { canCreateUsers: false, canManageProjects: true,  canManageSchemes: false, canApproveApplications: false, canViewReports: true,  canManageFinances: false } },
        scheme_coordinator:  { level: 'scheme',   permissions: { canCreateUsers: false, canManageProjects: false, canManageSchemes: true,  canApproveApplications: false, canViewReports: true,  canManageFinances: false } },
      };

      const franchise = await Franchise.findById(req.params.id);
      if (!franchise) return res.status(404).json({ success: false, message: 'Franchise not found' });

      const { name, phone, email, role = 'super_admin', isCommonAdmin = false, districtId, areaId, unitId, projectId } = req.body;
      if (!phone) return res.status(400).json({ success: false, message: 'Phone number is required' });
      if (!name)  return res.status(400).json({ success: false, message: 'Name is required' });
      if (!VALID_ROLES.includes(role)) {
        return res.status(400).json({ success: false, message: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
      }

      const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
      const scope = ROLE_SCOPE[role];

      // Build location/project scope fields for adminScope
      const locationScope = {};
      if (districtId) locationScope.district = districtId;
      if (areaId)     locationScope.area     = areaId;
      if (unitId)     locationScope.unit      = unitId;
      if (projectId)  locationScope.projects  = [projectId];

      const fullScope = { level: scope.level, permissions: scope.permissions, ...locationScope };

      let user = await User.findOne({ phone: cleanPhone });
      if (!user) {
        user = await User.create({
          name,
          phone: cleanPhone,
          email: email || undefined,
          role,
          password: null,
          isVerified: true,
          isActive: true,
          isSuperAdmin: false,
          adminScope: { level: scope.level, permissions: scope.permissions },
        });
      }

      const assignMembership = async (franchiseId, allowConflict = false) => {
        let membership = await UserFranchise.findOne({ user: user._id, franchise: franchiseId });
        if (membership) {
          if (!allowConflict && membership.isActive && membership.role === role) {
            return { membership, conflict: true };
          }
          membership.isActive = true;
          membership.role = role;
          membership.adminScope = fullScope;
          await membership.save();
          return { membership, conflict: false };
        }
        membership = await UserFranchise.create({
          user: user._id,
          franchise: franchiseId,
          role,
          isActive: true,
          adminScope: fullScope,
          assignedBy: req.user._id,
        });
        return { membership, conflict: false };
      };

      let membership;
      if (isCommonAdmin) {
        const activeFranchises = await Franchise.find({ isActive: true }).select('_id').lean();
        const targetFranchiseIds = [...new Set([franchise._id.toString(), ...activeFranchises.map(f => f._id.toString())])];
        for (const fid of targetFranchiseIds) {
          const result = await assignMembership(fid, true);
          if (fid === franchise._id.toString()) membership = result.membership;
        }
      } else {
        const result = await assignMembership(franchise._id, false);
        if (result.conflict) {
          return res.status(409).json({ success: false, message: `This user is already an active ${role.replace(/_/g, ' ')} for this franchise` });
        }
        membership = result.membership;
      }

      return res.status(201).json({
        success: true,
        message: isCommonAdmin
          ? `${user.name} assigned as ${role.replace(/_/g, ' ')} across all active franchises`
          : `${user.name} assigned as ${role.replace(/_/g, ' ')} for ${franchise.displayName}`,
        data: {
          user: { id: user._id, name: user.name, phone: user.phone, email: user.email },
          membership: { id: membership._id, role: membership.role, isActive: membership.isActive },
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * DELETE /api/global/franchises/:id/admins/:userId
   * Deactivate a franchise admin.
   */
  async deactivateFranchiseAdmin(req, res) {
    try {
      const UserFranchise = require('../models/UserFranchise');
      const membership = await UserFranchise.findOneAndUpdate(
        { user: req.params.userId, franchise: req.params.id },
        { $set: { isActive: false } },
        { new: true }
      );
      if (!membership) return res.status(404).json({ success: false, message: 'Admin membership not found' });
      return res.json({ success: true, message: 'Franchise admin deactivated' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/global/stats
   * Aggregated stats across ALL franchises.
   */
  async getGlobalStats(req, res) {
    try {
      const Beneficiary = require('../models/Beneficiary');
      const Application = require('../models/Application');
      const Donation    = require('../models/Donation');
      const UserFranchise = require('../models/UserFranchise');

      const [franchiseCount, userCount, beneficiaryCount, applicationCount, donationAgg] = await Promise.all([
        Franchise.countDocuments({ isActive: true }),
        UserFranchise.countDocuments({ isActive: true }),
        Beneficiary.countDocuments({}).setOptions({ bypassFranchise: true }),
        Application.countDocuments({}).setOptions({ bypassFranchise: true }),
        Donation.aggregate([
          { $match: { status: 'completed' } },
          { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
        ])
      ]);

      res.json({
        success: true,
        data: {
          franchises: franchiseCount,
          users: userCount,
          beneficiaries: beneficiaryCount,
          applications: applicationCount,
          donations: {
            total: donationAgg[0]?.total || 0,
            count: donationAgg[0]?.count || 0
          }
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = new GlobalAdminController();
