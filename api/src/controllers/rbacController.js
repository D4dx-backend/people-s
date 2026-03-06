const rbacService = require('../services/rbacService');
const { Role, Permission, UserRole } = require('../models');
const ResponseHelper = require('../utils/responseHelper');
const { buildFranchiseReadFilter, buildFranchiseMatchStage, getWriteFranchiseId } = require('../utils/franchiseFilterHelper');

class RBACController {
  /**
   * Get all roles
   * GET /api/rbac/roles
   */
  async getRoles(req, res) {
    try {
      const { category, type, isActive = true } = req.query;
      
      const filter = { isActive };
      Object.assign(filter, buildFranchiseReadFilter(req));
      if (category) filter.category = category;
      if (type) filter.type = type;

      const roles = await Role.find(filter)
        .populate('permissions', 'name displayName module category')
        .sort({ level: 1, name: 1 });

      // Calculate user stats for each role
      const rolesWithStats = await Promise.all(roles.map(async (role) => {
        const roleObj = role.toObject();
        
        // Count total users with this role
        const totalUsers = await UserRole.countDocuments({ 
          role: role._id,
          ...buildFranchiseReadFilter(req)
        });
        
        // Count active users with this role
        const activeUsers = await UserRole.countDocuments({ 
          role: role._id,
          isActive: true,
          ...buildFranchiseReadFilter(req),
          $or: [
            { validUntil: { $exists: false } },
            { validUntil: null },
            { validUntil: { $gte: new Date() } }
          ]
        });
        
        // Update stats in the response
        roleObj.stats = {
          totalUsers,
          activeUsers,
          lastAssigned: roleObj.stats?.lastAssigned
        };
        
        return roleObj;
      }));

      return ResponseHelper.success(res, rolesWithStats, 'Roles retrieved successfully');
    } catch (error) {
      console.error('❌ Get roles error:', error);
      return ResponseHelper.error(res, 'Failed to retrieve roles', 500);
    }
  }

  /**
   * Get role by ID
   * GET /api/rbac/roles/:id
   */
  async getRoleById(req, res) {
    try {
      const { id } = req.params;
      
      const roleQuery = { _id: id };
      Object.assign(roleQuery, buildFranchiseReadFilter(req));
      const role = await Role.findOne(roleQuery)
        .populate('permissions')
        .populate('inheritsFrom', 'name displayName')
        .populate('createdBy', 'name')
        .populate('updatedBy', 'name');

      if (!role) {
        return ResponseHelper.error(res, 'Role not found', 404);
      }

      return ResponseHelper.success(res, role, 'Role retrieved successfully');
    } catch (error) {
      console.error('❌ Get role by ID error:', error);
      return ResponseHelper.error(res, 'Failed to retrieve role', 500);
    }
  }

  /**
   * Create custom role
   * POST /api/rbac/roles
   */
  async createRole(req, res) {
    try {
      const roleData = req.body;
      if (req.franchiseId) roleData.franchise = req.franchiseId;
      const createdBy = req.user._id;

      const role = await rbacService.createCustomRole(roleData, createdBy);

      return ResponseHelper.success(res, role, 'Role created successfully', 201);
    } catch (error) {
      console.error('❌ Create role error:', error);
      return ResponseHelper.error(res, error.message || 'Failed to create role', 400);
    }
  }

  /**
   * Update role
   * PUT /api/rbac/roles/:id
   */
  async updateRole(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;
      const updatedBy = req.user._id;

      const role = await rbacService.updateCustomRole(id, updates, updatedBy);

      return ResponseHelper.success(res, role, 'Role updated successfully');
    } catch (error) {
      console.error('❌ Update role error:', error);
      return ResponseHelper.error(res, error.message || 'Failed to update role', 400);
    }
  }

  /**
   * Delete role
   * DELETE /api/rbac/roles/:id
   */
  async deleteRole(req, res) {
    try {
      const { id } = req.params;
      const deletedBy = req.user._id;

      await rbacService.deleteCustomRole(id, deletedBy);

      return ResponseHelper.success(res, null, 'Role deleted successfully');
    } catch (error) {
      console.error('❌ Delete role error:', error);
      return ResponseHelper.error(res, error.message || 'Failed to delete role', 400);
    }
  }

  /**
   * Get role hierarchy
   * GET /api/rbac/roles/hierarchy
   */
  async getRoleHierarchy(req, res) {
    try {
      const hierarchy = await rbacService.getRoleHierarchy();

      return ResponseHelper.success(res, hierarchy, 'Role hierarchy retrieved successfully');
    } catch (error) {
      console.error('❌ Get role hierarchy error:', error);
      return ResponseHelper.error(res, 'Failed to retrieve role hierarchy', 500);
    }
  }

  /**
   * Get all permissions
   * GET /api/rbac/permissions
   */
  async getPermissions(req, res) {
    try {
      const { module, category, scope, securityLevel } = req.query;
      
      const filter = { isActive: true };
      Object.assign(filter, buildFranchiseReadFilter(req));
      if (module) filter.module = module;
      if (category) filter.category = category;
      if (scope) filter.scope = scope;
      if (securityLevel) filter.securityLevel = securityLevel;

      const permissions = await Permission.find(filter)
        .sort({ module: 1, category: 1, name: 1 });

      // Group by module for better organization
      const groupedPermissions = permissions.reduce((acc, permission) => {
        if (!acc[permission.module]) {
          acc[permission.module] = [];
        }
        acc[permission.module].push(permission);
        return acc;
      }, {});

      return ResponseHelper.success(res, {
        permissions,
        groupedPermissions
      }, 'Permissions retrieved successfully');
    } catch (error) {
      console.error('❌ Get permissions error:', error);
      return ResponseHelper.error(res, 'Failed to retrieve permissions', 500);
    }
  }

  /**
   * Get permission by ID
   * GET /api/rbac/permissions/:id
   */
  async getPermissionById(req, res) {
    try {
      const { id } = req.params;
      
      const permQuery = { _id: id };
      Object.assign(permQuery, buildFranchiseReadFilter(req));
      const permission = await Permission.findOne(permQuery)
        .populate('dependencies.requires', 'name displayName')
        .populate('dependencies.conflicts', 'name displayName')
        .populate('dependencies.implies', 'name displayName');

      if (!permission) {
        return ResponseHelper.error(res, 'Permission not found', 404);
      }

      return ResponseHelper.success(res, permission, 'Permission retrieved successfully');
    } catch (error) {
      console.error('❌ Get permission by ID error:', error);
      return ResponseHelper.error(res, 'Failed to retrieve permission', 500);
    }
  }

  /**
   * Assign role to user
   * POST /api/rbac/users/:userId/roles
   */
  async assignRole(req, res) {
    try {
      const { userId } = req.params;
      const { roleId, reason, scope, validUntil, isPrimary, isTemporary } = req.body;
      const assignedBy = req.user._id;

      const userRole = await rbacService.assignRole(userId, roleId, assignedBy, {
        reason,
        scope,
        validUntil,
        isPrimary,
        isTemporary
      });

      return ResponseHelper.success(res, userRole, 'Role assigned successfully', 201);
    } catch (error) {
      console.error('❌ Assign role error:', error);
      return ResponseHelper.error(res, error.message || 'Failed to assign role', 400);
    }
  }

  /**
   * Remove role from user
   * DELETE /api/rbac/users/:userId/roles/:roleId
   */
  async removeRole(req, res) {
    try {
      const { userId, roleId } = req.params;
      const { reason = 'Role removal' } = req.body;
      const removedBy = req.user._id;

      await rbacService.removeRole(userId, roleId, removedBy, reason);

      return ResponseHelper.success(res, null, 'Role removed successfully');
    } catch (error) {
      console.error('❌ Remove role error:', error);
      return ResponseHelper.error(res, error.message || 'Failed to remove role', 400);
    }
  }

  /**
   * Get user roles
   * GET /api/rbac/users/:userId/roles
   */
  async getUserRoles(req, res) {
    try {
      const { userId } = req.params;
      
      const userRoles = await UserRole.getUserActiveRoles(userId);

      return ResponseHelper.success(res, userRoles, 'User roles retrieved successfully');
    } catch (error) {
      console.error('❌ Get user roles error:', error);
      return ResponseHelper.error(res, 'Failed to retrieve user roles', 500);
    }
  }

  /**
   * Get user permissions
   * GET /api/rbac/users/:userId/permissions
   */
  async getUserPermissions(req, res) {
    try {
      const { userId } = req.params;
      
      const permissionIds = await rbacService.getUserPermissions(userId);
      const permissions = await Permission.find({
        _id: { $in: permissionIds }
      }).setOptions({ bypassFranchise: true }).sort({ module: 1, category: 1 });

      // Group by module
      const groupedPermissions = permissions.reduce((acc, permission) => {
        if (!acc[permission.module]) {
          acc[permission.module] = [];
        }
        acc[permission.module].push(permission);
        return acc;
      }, {});

      return ResponseHelper.success(res, {
        permissions,
        groupedPermissions,
        totalCount: permissions.length
      }, 'User permissions retrieved successfully');
    } catch (error) {
      console.error('❌ Get user permissions error:', error);
      return ResponseHelper.error(res, 'Failed to retrieve user permissions', 500);
    }
  }

  /**
   * Check user permission
   * POST /api/rbac/users/:userId/check-permission
   */
  async checkPermission(req, res) {
    try {
      const { userId } = req.params;
      const { permission, context = {} } = req.body;

      const hasPermission = await rbacService.hasPermission(userId, permission, context);

      return ResponseHelper.success(res, {
        hasPermission,
        permission,
        userId
      }, 'Permission check completed');
    } catch (error) {
      console.error('❌ Check permission error:', error);
      return ResponseHelper.error(res, 'Failed to check permission', 500);
    }
  }

  /**
   * Add additional permission to user role
   * POST /api/rbac/user-roles/:userRoleId/permissions
   */
  async addPermissionToUserRole(req, res) {
    try {
      const { userRoleId } = req.params;
      const { permissionId, reason, expiresAt } = req.body;
      const grantedBy = req.user._id;

      const addPermQuery = { _id: userRoleId };
      if (req.franchiseId) addPermQuery.franchise = req.franchiseId;
      const userRole = await UserRole.findOne(addPermQuery);
      if (!userRole) {
        return ResponseHelper.error(res, 'User role assignment not found', 404);
      }

      userRole.addPermission(permissionId, grantedBy, reason, expiresAt);
      await userRole.save();

      return ResponseHelper.success(res, userRole, 'Permission added successfully');
    } catch (error) {
      console.error('❌ Add permission to user role error:', error);
      return ResponseHelper.error(res, error.message || 'Failed to add permission', 400);
    }
  }

  /**
   * Restrict permission from user role
   * POST /api/rbac/user-roles/:userRoleId/restrictions
   */
  async restrictPermissionFromUserRole(req, res) {
    try {
      const { userRoleId } = req.params;
      const { permissionId, reason, expiresAt } = req.body;
      const restrictedBy = req.user._id;

      const userRoleQuery = { _id: userRoleId };
      if (req.franchiseId) userRoleQuery.franchise = req.franchiseId;
      const userRole = await UserRole.findOne(userRoleQuery);
      if (!userRole) {
        return ResponseHelper.error(res, 'User role assignment not found', 404);
      }

      userRole.restrictPermission(permissionId, restrictedBy, reason, expiresAt);
      await userRole.save();

      return ResponseHelper.success(res, userRole, 'Permission restricted successfully');
    } catch (error) {
      console.error('❌ Restrict permission from user role error:', error);
      return ResponseHelper.error(res, error.message || 'Failed to restrict permission', 400);
    }
  }

  /**
   * Get users with specific role
   * GET /api/rbac/roles/:roleId/users
   */
  async getUsersWithRole(req, res) {
    try {
      const { roleId } = req.params;
      const { includeExpired = false } = req.query;

      const userRoles = await UserRole.getUsersWithRole(roleId, { includeExpired });

      return ResponseHelper.success(res, userRoles, 'Users with role retrieved successfully');
    } catch (error) {
      console.error('❌ Get users with role error:', error);
      return ResponseHelper.error(res, 'Failed to retrieve users with role', 500);
    }
  }

  /**
   * Initialize RBAC system
   * POST /api/rbac/initialize
   */
  async initializeRBAC(req, res) {
    try {
      await rbacService.initializeRBAC();

      return ResponseHelper.success(res, null, 'RBAC system initialized successfully');
    } catch (error) {
      console.error('❌ Initialize RBAC error:', error);
      return ResponseHelper.error(res, error.message || 'Failed to initialize RBAC system', 500);
    }
  }

  /**
   * Get RBAC statistics
   * GET /api/rbac/stats
   */
  async getRBACStats(req, res) {
    try {
      const franchiseFilter = buildFranchiseReadFilter(req);
      const [
        totalRoles,
        activeRoles,
        customRoles,
        totalPermissions,
        activePermissions,
        totalUserRoles,
        activeUserRoles
      ] = await Promise.all([
        Role.countDocuments({ ...franchiseFilter }),
        Role.countDocuments({ isActive: true, ...franchiseFilter }),
        Role.countDocuments({ type: 'custom', isActive: true, ...franchiseFilter }),
        Permission.countDocuments({ ...franchiseFilter }),
        Permission.countDocuments({ isActive: true, ...franchiseFilter }),
        UserRole.countDocuments({ ...franchiseFilter }),
        UserRole.countDocuments({ isActive: true, approvalStatus: 'approved', ...franchiseFilter })
      ]);

      const stats = {
        roles: {
          total: totalRoles,
          active: activeRoles,
          custom: customRoles,
          system: activeRoles - customRoles
        },
        permissions: {
          total: totalPermissions,
          active: activePermissions
        },
        assignments: {
          total: totalUserRoles,
          active: activeUserRoles
        }
      };

      return ResponseHelper.success(res, stats, 'RBAC statistics retrieved successfully');
    } catch (error) {
      console.error('❌ Get RBAC stats error:', error);
      return ResponseHelper.error(res, 'Failed to retrieve RBAC statistics', 500);
    }
  }

  /**
   * Cleanup expired role assignments
   * POST /api/rbac/cleanup
   */
  async cleanupExpired(req, res) {
    try {
      const cleanedCount = await rbacService.cleanupExpiredAssignments();

      return ResponseHelper.success(res, {
        cleanedCount
      }, `Cleaned up ${cleanedCount} expired role assignments`);
    } catch (error) {
      console.error('❌ Cleanup expired error:', error);
      return ResponseHelper.error(res, 'Failed to cleanup expired assignments', 500);
    }
  }
}

module.exports = new RBACController();