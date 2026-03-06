const express = require('express');
const router = express.Router();
const websiteController = require('../controllers/websiteController');
const { authenticate, crossFranchiseResolver } = require('../middleware/auth');
const { hasAnyPermission } = require('../middleware/rbacMiddleware');
const { uploadSingleMemory } = require('../middleware/upload');

/**
 * @route   GET /api/website/public-settings
 * @desc    Get public website settings (no auth)
 * @access  Public
 */
router.get('/public-settings', websiteController.getPublicSettings);

/**
 * @route   GET /api/website/settings
 * @desc    Get website settings
 * @access  Private (super_admin, state_admin, or website.read permission)
 */
router.get('/settings',
  authenticate, crossFranchiseResolver,
  hasAnyPermission(['website.read', 'settings.read']),
  websiteController.getSettings
);

/**
 * @route   PUT /api/website/settings
 * @desc    Update website settings
 * @access  Private (super_admin, state_admin, or website.write permission)
 */
router.put('/settings',
  authenticate, crossFranchiseResolver,
  hasAnyPermission(['website.write', 'settings.write']),
  websiteController.updateSettings
);

/**
 * @route   POST /api/website/settings/counter
 * @desc    Add counter
 * @access  Private (super_admin, state_admin, or website.write permission)
 */
router.post('/settings/counter',
  authenticate, crossFranchiseResolver,
  hasAnyPermission(['website.write', 'settings.write']),
  websiteController.addCounter
);

/**
 * @route   PUT /api/website/settings/counter/:id
 * @desc    Update counter
 * @access  Private (super_admin, state_admin, or website.write permission)
 */
router.put('/settings/counter/:id',
  authenticate, crossFranchiseResolver,
  hasAnyPermission(['website.write', 'settings.write']),
  websiteController.updateCounter
);

/**
 * @route   DELETE /api/website/settings/counter/:id
 * @desc    Delete counter
 * @access  Private (super_admin, state_admin, or website.write permission)
 */
router.delete('/settings/counter/:id',
  authenticate, crossFranchiseResolver,
  hasAnyPermission(['website.write', 'settings.write']),
  websiteController.deleteCounter
);

module.exports = router;
