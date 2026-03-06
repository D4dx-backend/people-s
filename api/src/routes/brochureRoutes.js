const express = require('express');
const router = express.Router();
const brochureController = require('../controllers/brochureController');
const { authenticate, crossFranchiseResolver } = require('../middleware/auth');
const { hasAnyPermission } = require('../middleware/rbacMiddleware');
const { uploadSingleMemory } = require('../middleware/upload');

/**
 * @route   GET /api/brochures/public
 * @desc    Get public brochures (active only)
 * @access  Public
 */
router.get('/public', brochureController.getPublic);

/**
 * @route   GET /api/brochures
 * @desc    Get all brochures
 * @access  Private (super_admin, state_admin, or website.read permission)
 */
router.get('/',
  authenticate, crossFranchiseResolver,
  hasAnyPermission(['website.read', 'brochures.read']),
  brochureController.getAll
);

/**
 * @route   GET /api/brochures/:id
 * @desc    Get single brochure
 * @access  Public
 */
router.get('/:id', brochureController.getById);

/**
 * @route   POST /api/brochures
 * @desc    Create brochure
 * @access  Private (super_admin, state_admin, or website.write permission)
 */
router.post('/',
  authenticate, crossFranchiseResolver,
  hasAnyPermission(['website.write', 'brochures.write']),
  uploadSingleMemory('file'),
  brochureController.create
);

/**
 * @route   PUT /api/brochures/:id
 * @desc    Update brochure
 * @access  Private (super_admin, state_admin, or website.write permission)
 */
router.put('/:id',
  authenticate, crossFranchiseResolver,
  hasAnyPermission(['website.write', 'brochures.write']),
  uploadSingleMemory('file'),
  brochureController.update
);

/**
 * @route   DELETE /api/brochures/:id
 * @desc    Delete brochure
 * @access  Private (super_admin, state_admin, or website.delete permission)
 */
router.delete('/:id',
  authenticate, crossFranchiseResolver,
  hasAnyPermission(['website.delete', 'brochures.delete']),
  brochureController.delete
);

/**
 * @route   POST /api/brochures/:id/download
 * @desc    Track brochure download
 * @access  Public
 */
router.post('/:id/download', brochureController.trackDownload);

module.exports = router;
