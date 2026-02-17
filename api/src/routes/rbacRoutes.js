const express = require('express');
const rbacController = require('../controllers/rbacController');
const { authenticate, authorize, checkPermission } = require('../middleware/auth');
const { validate, validateRequest } = require('../middleware/validation');
const { body, param, query } = require('express-validator');
const { createExportHandler } = require('../middleware/exportHandler');
const exportConfigs = require('../config/exportConfigs');
const Role = require('../models/Role');

const router = express.Router();

// Apply authentication to all RBAC routes
router.use(authenticate);

// Export roles as CSV or JSON
router.get('/roles/export',
  checkPermission('roles', 'read'),
  createExportHandler(Role, exportConfigs.role)
);

/**
 * Role Management Routes
 */

/**
 * @route   GET /api/rbac/roles
 * @desc    Get all roles
 * @access  Private (requires roles.read permission)
 */
router.get('/roles', 
  checkPermission('roles', 'read'),
  [
    query('category').optional().isIn(['admin', 'coordinator', 'staff', 'beneficiary', 'external']),
    query('type').optional().isIn(['system', 'custom']),
    query('isActive').optional().isBoolean(),
    validateRequest
  ],
  rbacController.getRoles
);

/**
 * @route   GET /api/rbac/roles/hierarchy
 * @desc    Get role hierarchy
 * @access  Private (requires roles.read permission)
 */
router.get('/roles/hierarchy',
  checkPermission('roles', 'read'),
  rbacController.getRoleHierarchy
);

/**
 * @route   GET /api/rbac/roles/:id
 * @desc    Get role by ID
 * @access  Private (requires roles.read permission)
 */
router.get('/roles/:id',
  checkPermission('roles', 'read'),
  [
    param('id').isMongoId().withMessage('Invalid role ID'),
    validateRequest
  ],
  rbacController.getRoleById
);

/**
 * @route   POST /api/rbac/roles
 * @desc    Create custom role
 * @access  Private (requires roles.create permission)
 */
router.post('/roles',
  checkPermission('roles', 'create'),
  [
    body('name')
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Role name must be between 2 and 50 characters')
      .matches(/^[a-z_]+$/)
      .withMessage('Role name must contain only lowercase letters and underscores'),
    body('displayName')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Display name must be between 2 and 100 characters'),
    body('description')
      .trim()
      .isLength({ min: 10, max: 500 })
      .withMessage('Description must be between 10 and 500 characters'),
    body('level')
      .isInt({ min: 0, max: 10 })
      .withMessage('Level must be between 0 and 10'),
    body('category')
      .isIn(['admin', 'coordinator', 'staff', 'beneficiary', 'external'])
      .withMessage('Invalid category'),
    body('permissions')
      .optional()
      .isArray()
      .withMessage('Permissions must be an array'),
    body('permissions.*')
      .optional()
      .isMongoId()
      .withMessage('Invalid permission ID'),
    body('scopeConfig.allowedScopeLevels')
      .optional()
      .isArray()
      .withMessage('Allowed scope levels must be an array'),
    body('scopeConfig.defaultScopeLevel')
      .optional()
      .isIn(['super', 'state', 'district', 'area', 'unit', 'project', 'scheme'])
      .withMessage('Invalid default scope level'),
    body('scopeConfig.maxScopes')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Max scopes must be at least 1'),
    validateRequest
  ],
  rbacController.createRole
);

/**
 * @route   PUT /api/rbac/roles/:id
 * @desc    Update role
 * @access  Private (requires roles.update permission)
 */
router.put('/roles/:id',
  checkPermission('roles', 'update'),
  [
    param('id').isMongoId().withMessage('Invalid role ID'),
    body('displayName')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Display name must be between 2 and 100 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ min: 10, max: 500 })
      .withMessage('Description must be between 10 and 500 characters'),
    body('permissions')
      .optional()
      .isArray()
      .withMessage('Permissions must be an array'),
    body('permissions.*')
      .optional()
      .isMongoId()
      .withMessage('Invalid permission ID'),
    validateRequest
  ],
  rbacController.updateRole
);

/**
 * @route   DELETE /api/rbac/roles/:id
 * @desc    Delete role
 * @access  Private (requires roles.delete permission)
 */
router.delete('/roles/:id',
  checkPermission('roles', 'delete'),
  [
    param('id').isMongoId().withMessage('Invalid role ID'),
    validateRequest
  ],
  rbacController.deleteRole
);

/**
 * @route   GET /api/rbac/roles/:roleId/users
 * @desc    Get users with specific role
 * @access  Private (requires roles.read permission)
 */
router.get('/roles/:roleId/users',
  checkPermission('roles', 'read'),
  [
    param('roleId').isMongoId().withMessage('Invalid role ID'),
    query('includeExpired').optional().isBoolean(),
    validateRequest
  ],
  rbacController.getUsersWithRole
);

/**
 * Permission Management Routes
 */

/**
 * @route   GET /api/rbac/permissions
 * @desc    Get all permissions
 * @access  Private (requires permissions.read permission)
 */
router.get('/permissions',
  checkPermission('permissions', 'read'),
  [
    query('module').optional().isIn([
      'users', 'roles', 'permissions', 'beneficiaries', 'applications', 
      'projects', 'schemes', 'locations', 'reports', 'notifications', 
      'finances', 'settings', 'audit', 'dashboard', 'forms', 'documents'
    ]),
    query('category').optional().isIn(['create', 'read', 'update', 'delete', 'approve', 'manage', 'configure', 'export']),
    query('scope').optional().isIn(['global', 'regional', 'project', 'scheme', 'own', 'subordinate']),
    query('securityLevel').optional().isIn(['public', 'internal', 'confidential', 'restricted', 'top_secret']),
    validateRequest
  ],
  rbacController.getPermissions
);

/**
 * @route   GET /api/rbac/permissions/:id
 * @desc    Get permission by ID
 * @access  Private (requires permissions.read permission)
 */
router.get('/permissions/:id',
  checkPermission('permissions', 'read'),
  [
    param('id').isMongoId().withMessage('Invalid permission ID'),
    validateRequest
  ],
  rbacController.getPermissionById
);

/**
 * User Role Assignment Routes
 */

/**
 * @route   POST /api/rbac/users/:userId/roles
 * @desc    Assign role to user
 * @access  Private (requires roles.assign permission)
 */
router.post('/users/:userId/roles',
  checkPermission('roles', 'assign'),
  [
    param('userId').isMongoId().withMessage('Invalid user ID'),
    body('roleId').isMongoId().withMessage('Invalid role ID'),
    body('reason')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Reason cannot exceed 500 characters'),
    body('validUntil')
      .optional()
      .isISO8601()
      .withMessage('Invalid expiry date'),
    body('isPrimary')
      .optional()
      .isBoolean()
      .withMessage('isPrimary must be boolean'),
    body('isTemporary')
      .optional()
      .isBoolean()
      .withMessage('isTemporary must be boolean'),
    body('scope.regions')
      .optional()
      .isArray()
      .withMessage('Regions must be an array'),
    body('scope.regions.*')
      .optional()
      .isMongoId()
      .withMessage('Invalid region ID'),
    body('scope.projects')
      .optional()
      .isArray()
      .withMessage('Projects must be an array'),
    body('scope.projects.*')
      .optional()
      .isMongoId()
      .withMessage('Invalid project ID'),
    body('scope.schemes')
      .optional()
      .isArray()
      .withMessage('Schemes must be an array'),
    body('scope.schemes.*')
      .optional()
      .isMongoId()
      .withMessage('Invalid scheme ID'),
    validateRequest
  ],
  rbacController.assignRole
);

/**
 * @route   DELETE /api/rbac/users/:userId/roles/:roleId
 * @desc    Remove role from user
 * @access  Private (requires roles.assign permission)
 */
router.delete('/users/:userId/roles/:roleId',
  checkPermission('roles', 'assign'),
  [
    param('userId').isMongoId().withMessage('Invalid user ID'),
    param('roleId').isMongoId().withMessage('Invalid role ID'),
    body('reason')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Reason cannot exceed 500 characters'),
    validateRequest
  ],
  rbacController.removeRole
);

/**
 * @route   GET /api/rbac/users/:userId/roles
 * @desc    Get user roles
 * @access  Private (requires users.read permission or own user)
 */
router.get('/users/:userId/roles',
  [
    param('userId').isMongoId().withMessage('Invalid user ID'),
    validateRequest
  ],
  (req, res, next) => {
    // Allow users to view their own roles
    if (req.params.userId === req.user._id.toString()) {
      return next();
    }
    // Otherwise require permission
    return checkPermission('users', 'read')(req, res, next);
  },
  rbacController.getUserRoles
);

/**
 * @route   GET /api/rbac/users/:userId/permissions
 * @desc    Get user permissions
 * @access  Private (requires users.read permission or own user)
 */
router.get('/users/:userId/permissions',
  [
    param('userId').isMongoId().withMessage('Invalid user ID'),
    validateRequest
  ],
  (req, res, next) => {
    // Allow users to view their own permissions
    if (req.params.userId === req.user._id.toString()) {
      return next();
    }
    // Otherwise require permission
    return checkPermission('users', 'read')(req, res, next);
  },
  rbacController.getUserPermissions
);

/**
 * @route   POST /api/rbac/users/:userId/check-permission
 * @desc    Check if user has specific permission
 * @access  Private (requires users.read permission or own user)
 */
router.post('/users/:userId/check-permission',
  [
    param('userId').isMongoId().withMessage('Invalid user ID'),
    body('permission')
      .trim()
      .notEmpty()
      .withMessage('Permission name is required'),
    body('context')
      .optional()
      .isObject()
      .withMessage('Context must be an object'),
    validateRequest
  ],
  (req, res, next) => {
    // Allow users to check their own permissions
    if (req.params.userId === req.user._id.toString()) {
      return next();
    }
    // Otherwise require permission
    return checkPermission('users', 'read')(req, res, next);
  },
  rbacController.checkPermission
);

/**
 * User Role Permission Management Routes
 */

/**
 * @route   POST /api/rbac/user-roles/:userRoleId/permissions
 * @desc    Add additional permission to user role
 * @access  Private (requires roles.assign permission)
 */
router.post('/user-roles/:userRoleId/permissions',
  checkPermission('roles', 'assign'),
  [
    param('userRoleId').isMongoId().withMessage('Invalid user role ID'),
    body('permissionId').isMongoId().withMessage('Invalid permission ID'),
    body('reason')
      .trim()
      .isLength({ min: 5, max: 500 })
      .withMessage('Reason must be between 5 and 500 characters'),
    body('expiresAt')
      .optional()
      .isISO8601()
      .withMessage('Invalid expiry date'),
    validateRequest
  ],
  rbacController.addPermissionToUserRole
);

/**
 * @route   POST /api/rbac/user-roles/:userRoleId/restrictions
 * @desc    Restrict permission from user role
 * @access  Private (requires roles.assign permission)
 */
router.post('/user-roles/:userRoleId/restrictions',
  checkPermission('roles', 'assign'),
  [
    param('userRoleId').isMongoId().withMessage('Invalid user role ID'),
    body('permissionId').isMongoId().withMessage('Invalid permission ID'),
    body('reason')
      .trim()
      .isLength({ min: 5, max: 500 })
      .withMessage('Reason must be between 5 and 500 characters'),
    body('expiresAt')
      .optional()
      .isISO8601()
      .withMessage('Invalid expiry date'),
    validateRequest
  ],
  rbacController.restrictPermissionFromUserRole
);

/**
 * System Management Routes
 */

/**
 * @route   POST /api/rbac/initialize
 * @desc    Initialize RBAC system
 * @access  Private (Super Admin only)
 */
router.post('/initialize',
  authorize('super_admin'),
  rbacController.initializeRBAC
);

/**
 * @route   GET /api/rbac/stats
 * @desc    Get RBAC statistics
 * @access  Private (requires roles.read permission)
 */
router.get('/stats',
  checkPermission('roles', 'read'),
  rbacController.getRBACStats
);

/**
 * @route   POST /api/rbac/cleanup
 * @desc    Cleanup expired role assignments
 * @access  Private (Super Admin or State Admin only)
 */
router.post('/cleanup',
  authorize('super_admin', 'state_admin'),
  rbacController.cleanupExpired
);

module.exports = router;