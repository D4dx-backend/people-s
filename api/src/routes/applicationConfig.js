const express = require('express');
const router = express.Router();
const applicationConfigController = require('../controllers/applicationConfigController');
const { authenticate, crossFranchiseResolver, authorize } = require('../middleware/auth');
const { hasAnyPermission } = require('../middleware/rbacMiddleware');
const { uploadSingle } = require('../middleware/upload');

/**
 * Test route to verify public routes work
 */
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'Public route works!' });
});

/**
 * Public route - Get public configurations
 * No authentication required
 */
router.get('/public', applicationConfigController.getPublicConfigs);

/**
 * @route   POST /api/config/logo
 * @desc    Upload organization logo (saves to assets folder)
 * @access  Private (settings.write)
 */
router.post(
  '/logo',
  authenticate, crossFranchiseResolver,
  hasAnyPermission(['config.write', 'settings.write']),
  uploadSingle('logo'),
  applicationConfigController.uploadLogo
);

/**
 * Protected routes - Require authentication and permissions
 */

// Get all configurations (Admin only)
router.get(
  '/',
  authenticate, crossFranchiseResolver,
  hasAnyPermission(['config.read', 'settings.read']),
  applicationConfigController.getAllConfigs
);

// Get single configuration by ID (Admin only)
router.get(
  '/:id',
  authenticate, crossFranchiseResolver,
  hasAnyPermission(['config.read', 'settings.read']),
  applicationConfigController.getConfigById
);

// Create new configuration (Admin only)
router.post(
  '/',
  authenticate, crossFranchiseResolver,
  hasAnyPermission(['config.write', 'settings.write']),
  applicationConfigController.createConfig
);

// Update single configuration (Admin only)
router.put(
  '/:id',
  authenticate, crossFranchiseResolver,
  hasAnyPermission(['config.write', 'settings.write']),
  applicationConfigController.updateConfig
);

// Bulk update configurations (Admin only)
router.put(
  '/bulk/update',
  authenticate, crossFranchiseResolver,
  hasAnyPermission(['config.write', 'settings.write']),
  applicationConfigController.bulkUpdateConfigs
);

// Delete configuration (Admin only)
router.delete(
  '/:id',
  authenticate, crossFranchiseResolver,
  hasAnyPermission(['config.write', 'settings.write']),
  applicationConfigController.deleteConfig
);

// ── Per-franchise Integrations (DXing SMS + SMTP Email) ──────────────────
// Only the franchise super_admin (or global super admin) may read/write these.

router.get(
  '/integrations',
  authenticate, crossFranchiseResolver,
  authorize('super_admin'),
  applicationConfigController.getIntegrationsConfig
);

router.put(
  '/integrations',
  authenticate, crossFranchiseResolver,
  authorize('super_admin'),
  applicationConfigController.updateIntegrationsConfig
);

module.exports = router;
