const rbacService = require('../services/rbacService');
const { UserRole } = require('../models');

/**
 * Enhanced RBAC middleware for permission-based access control
 */
class RBACMiddleware {
  /**
   * Check if user has specific permission
   * @param {string} permissionName - Permission name to check
   * @param {Object} options - Additional options
   * @returns {Function} Express middleware
   */
  static hasPermission(permissionName, options = {}) {
    return async (req, res, next) => {
      try {
        if (!req.user) {
          return res.status(401).json({
            success: false,
            message: 'Authentication required'
          });
        }

        // Super admin and state admin have all permissions - bypass check
        if ((req.user.isSuperAdmin || req.userRole === 'super_admin' || req.userRole === 'state_admin')) {
          req.checkedPermission = permissionName;
          return next();
        }

        const context = {
          user: req.user,
          ip: req.ip,
          timestamp: new Date(),
          ...options.context
        };

        const hasPermission = await rbacService.hasPermission(
          req.user._id, 
          permissionName, 
          context
        );

        if (!hasPermission) {
          return res.status(403).json({
            success: false,
            message: `Access denied. Required permission: ${permissionName}`,
            requiredPermission: permissionName
          });
        }

        // Add permission info to request for logging
        req.checkedPermission = permissionName;
        next();
      } catch (error) {
        console.error('❌ Permission check error:', error);
        return res.status(500).json({
          success: false,
          message: 'Permission check failed'
        });
      }
    };
  }

  /**
   * Check if user has any of the specified permissions
   * @param {string[]} permissions - Array of permission names
   * @returns {Function} Express middleware
   */
  static hasAnyPermission(permissions) {
    return async (req, res, next) => {
      try {
        if (!req.user) {
          return res.status(401).json({
            success: false,
            message: 'Authentication required'
          });
        }

        // Super admin and state admin have all permissions - bypass check
        if ((req.user.isSuperAdmin || req.userRole === 'super_admin' || req.userRole === 'state_admin')) {
          req.grantedPermission = permissions[0];
          return next();
        }

        const context = {
          user: req.user,
          ip: req.ip,
          timestamp: new Date()
        };

        let hasAnyPermission = false;
        let grantedPermission = null;

        for (const permission of permissions) {
          const hasPermission = await rbacService.hasPermission(
            req.user._id, 
            permission, 
            context
          );
          
          if (hasPermission) {
            hasAnyPermission = true;
            grantedPermission = permission;
            break;
          }
        }

        if (!hasAnyPermission) {
          return res.status(403).json({
            success: false,
            message: 'Access denied. Required permissions: ' + permissions.join(' OR '),
            requiredPermissions: permissions
          });
        }

        req.grantedPermission = grantedPermission;
        next();
      } catch (error) {
        console.error('❌ Permission check error:', error);
        return res.status(500).json({
          success: false,
          message: 'Permission check failed'
        });
      }
    };
  }

  /**
   * Check if user has all specified permissions
   * @param {string[]} permissions - Array of permission names
   * @returns {Function} Express middleware
   */
  static hasAllPermissions(permissions) {
    return async (req, res, next) => {
      try {
        if (!req.user) {
          return res.status(401).json({
            success: false,
            message: 'Authentication required'
          });
        }

        const context = {
          user: req.user,
          ip: req.ip,
          timestamp: new Date()
        };

        const missingPermissions = [];

        for (const permission of permissions) {
          const hasPermission = await rbacService.hasPermission(
            req.user._id, 
            permission, 
            context
          );
          
          if (!hasPermission) {
            missingPermissions.push(permission);
          }
        }

        if (missingPermissions.length > 0) {
          return res.status(403).json({
            success: false,
            message: 'Access denied. Missing permissions: ' + missingPermissions.join(', '),
            missingPermissions
          });
        }

        req.checkedPermissions = permissions;
        next();
      } catch (error) {
        console.error('❌ Permission check error:', error);
        return res.status(500).json({
          success: false,
          message: 'Permission check failed'
        });
      }
    };
  }

  /**
   * Check if user can access resource based on scope
   * @param {string} resourceType - Type of resource (user, beneficiary, application, etc.)
   * @param {string} scopeField - Field name containing resource scope info
   * @returns {Function} Express middleware
   */
  static checkResourceScope(resourceType, scopeField = 'id') {
    return async (req, res, next) => {
      try {
        if (!req.user) {
          return res.status(401).json({
            success: false,
            message: 'Authentication required'
          });
        }

        // Super admin and state admin have global access
        if ((req.user.isSuperAdmin || req.userRole === 'super_admin' || req.userRole === 'state_admin')) {
          return next();
        }

        const resourceId = req.params[scopeField];
        if (!resourceId) {
          return res.status(400).json({
            success: false,
            message: 'Resource ID is required'
          });
        }

        // Get user's active roles with scope information
        const userRoles = await UserRole.getUserActiveRoles(req.user._id);
        
        let hasAccess = false;

        for (const userRole of userRoles) {
          // Check regional scope
          if (userRole.scope.regions && userRole.scope.regions.length > 0) {
            // This would need to be implemented based on resource type
            // For now, we'll allow access if user has any regional scope
            hasAccess = true;
            break;
          }

          // Check project scope
          if (userRole.scope.projects && userRole.scope.projects.length > 0) {
            if (resourceType === 'project' && userRole.scope.projects.includes(resourceId)) {
              hasAccess = true;
              break;
            }
          }

          // Check scheme scope
          if (userRole.scope.schemes && userRole.scope.schemes.length > 0) {
            if (resourceType === 'scheme' && userRole.scope.schemes.includes(resourceId)) {
              hasAccess = true;
              break;
            }
          }
        }

        if (!hasAccess) {
          return res.status(403).json({
            success: false,
            message: `Access denied. You do not have permission to access this ${resourceType}`
          });
        }

        next();
      } catch (error) {
        console.error('❌ Resource scope check error:', error);
        return res.status(500).json({
          success: false,
          message: 'Resource access check failed'
        });
      }
    };
  }

  /**
   * Check if user can manage other users based on role hierarchy
   * @returns {Function} Express middleware
   */
  static checkUserManagementAccess() {
    return async (req, res, next) => {
      try {
        if (!req.user) {
          return res.status(401).json({
            success: false,
            message: 'Authentication required'
          });
        }

        const targetUserId = req.params.userId || req.params.id;
        if (!targetUserId) {
          return res.status(400).json({
            success: false,
            message: 'Target user ID is required'
          });
        }

        // Users can always access their own data
        if (targetUserId === req.user._id.toString()) {
          return next();
        }

        // Check if user has permission to manage other users
        const hasPermission = await rbacService.hasPermission(
          req.user._id, 
          'users.read.regional'
        );

        if (!hasPermission) {
          return res.status(403).json({
            success: false,
            message: 'Access denied. You do not have permission to manage other users'
          });
        }

        next();
      } catch (error) {
        console.error('❌ User management access check error:', error);
        return res.status(500).json({
          success: false,
          message: 'User management access check failed'
        });
      }
    };
  }


  /**
   * Audit logging middleware for sensitive operations
   * @param {string} operation - Operation being performed
   * @returns {Function} Express middleware
   */
  static auditLog(operation) {
    return (req, res, next) => {
      // Store original res.json to intercept response
      const originalJson = res.json;

      res.json = function(data) {
        // Log the operation
        console.log(`🔍 AUDIT: ${operation}`, {
          user: req.user._id,
          userRole: req.user.role,
          operation,
          resource: req.params,
          success: data.success !== false,
          timestamp: new Date(),
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });

        // Call original json method
        return originalJson.call(this, data);
      };

      next();
    };
  }

  /**
   * Check if operation is allowed during business hours
   * @param {Object} businessHours - Business hours configuration
   * @returns {Function} Express middleware
   */
  static checkBusinessHours(businessHours = { start: 9, end: 17 }) {
    return (req, res, next) => {
      const now = new Date();
      const hour = now.getHours();
      const day = now.getDay(); // 0 = Sunday, 6 = Saturday

      // Skip check for weekends (optional)
      if (day === 0 || day === 6) {
        return res.status(403).json({
          success: false,
          message: 'This operation is not allowed during weekends'
        });
      }

      if (hour < businessHours.start || hour >= businessHours.end) {
        return res.status(403).json({
          success: false,
          message: `This operation is only allowed during business hours (${businessHours.start}:00 - ${businessHours.end}:00)`
        });
      }

      next();
    };
  }

  /**
   * Dynamic permission check based on request data
   * @param {Function} permissionResolver - Function that returns permission name based on request
   * @returns {Function} Express middleware
   */
  static dynamicPermission(permissionResolver) {
    return async (req, res, next) => {
      try {
        if (!req.user) {
          return res.status(401).json({
            success: false,
            message: 'Authentication required'
          });
        }

        const permissionName = await permissionResolver(req);
        if (!permissionName) {
          return res.status(400).json({
            success: false,
            message: 'Could not determine required permission'
          });
        }

        const context = {
          user: req.user,
          ip: req.ip,
          timestamp: new Date()
        };

        const hasPermission = await rbacService.hasPermission(
          req.user._id, 
          permissionName, 
          context
        );

        if (!hasPermission) {
          return res.status(403).json({
            success: false,
            message: `Access denied. Required permission: ${permissionName}`,
            requiredPermission: permissionName
          });
        }

        req.resolvedPermission = permissionName;
        next();
      } catch (error) {
        console.error('❌ Dynamic permission check error:', error);
        return res.status(500).json({
          success: false,
          message: 'Permission check failed'
        });
      }
    };
  }
  /**
   * Get user scope for filtering data
   * @param {Object} user - User object
   * @returns {Object} User scope
   */
  static async getUserScope(user) {
    try {
      const userRoles = await UserRole.find({ 
        user: user._id, 
        isActive: true,
        $or: [
          { validUntil: { $exists: false } },
          { validUntil: null },
          { validUntil: { $gt: new Date() } }
        ]
      }).populate('role');

      let scope = {
        regions: [],
        projects: [],
        schemes: []
      };

      for (const userRole of userRoles) {
        if (userRole.scope) {
          if (userRole.scope.regions) {
            scope.regions = [...scope.regions, ...userRole.scope.regions];
          }
          if (userRole.scope.projects) {
            scope.projects = [...scope.projects, ...userRole.scope.projects];
          }
          if (userRole.scope.schemes) {
            scope.schemes = [...scope.schemes, ...userRole.scope.schemes];
          }
        }
      }

      // Remove duplicates
      scope.regions = [...new Set(scope.regions)];
      scope.projects = [...new Set(scope.projects)];
      scope.schemes = [...new Set(scope.schemes)];

      return scope;
    } catch (error) {
      console.error('Error getting user scope:', error);
      return { regions: [], projects: [], schemes: [] };
    }
  }

  /**
   * Check if user has access to a specific application
   * @param {Object} user - User object
   * @param {Object} application - Application object
   * @returns {boolean} Has access
   */
  static async checkApplicationAccess(user, application) {
    try {
      // Super admin and state admin have access to everything
      if (user.role === 'super_admin' || user.role === 'state_admin') {
        console.log(`✅ RBAC: ${user.role} - full access granted`);
        return true;
      }

      console.log('🔍 RBAC: Getting user scope...');
      const userScope = await this.getUserScope(user);
      console.log('🔍 RBAC: User scope:', userScope);
      
      // Helper function to get ID from populated reference or direct ID
      const getId = (ref) => {
        if (!ref) return null;
        if (typeof ref === 'object' && ref._id) return ref._id.toString();
        return ref.toString();
      };
      
      // Check if user has access to the application's regions
      const applicationRegions = [
        getId(application.state),
        getId(application.district),
        getId(application.area),
        getId(application.unit)
      ].filter(Boolean);

      console.log('🔍 RBAC: Application regions:', applicationRegions);
      console.log('🔍 RBAC: User scope regions:', userScope.regions.map(r => r.toString()));

      const hasRegionAccess = userScope.regions.some(region => 
        applicationRegions.includes(region.toString())
      );

      console.log('🔍 RBAC: Region access:', hasRegionAccess);

      // Check if user has access to the application's project
      const applicationProjectId = getId(application.project);
      const hasProjectAccess = !applicationProjectId || 
        userScope.projects.includes(applicationProjectId);

      console.log('🔍 RBAC: Project access:', hasProjectAccess, {
        applicationProject: applicationProjectId,
        userProjects: userScope.projects.map(p => p.toString())
      });

      // Check if user has access to the application's scheme
      const applicationSchemeId = getId(application.scheme);
      const hasSchemeAccess = userScope.schemes.length === 0 || 
        userScope.schemes.includes(applicationSchemeId);

      console.log('🔍 RBAC: Scheme access:', hasSchemeAccess, {
        applicationScheme: applicationSchemeId,
        userSchemes: userScope.schemes.map(s => s.toString())
      });

      const hasAccess = hasRegionAccess && hasProjectAccess && hasSchemeAccess;
      console.log(`✅ RBAC: Final access result: ${hasAccess}`);
      
      return hasAccess;
    } catch (error) {
      console.error('❌ RBAC: Error checking application access:', error);
      return false;
    }
  }
}

module.exports = RBACMiddleware;