const express = require('express');
const router = express.Router();
const newsEventController = require('../controllers/newsEventController');
const { authenticate, crossFranchiseResolver } = require('../middleware/auth');
const { hasAnyPermission } = require('../middleware/rbacMiddleware');
const { uploadSingleMemory } = require('../middleware/upload');

/**
 * @route   GET /api/news-events/public
 * @desc    Get public news/events (published only)
 * @access  Public
 */
router.get('/public', newsEventController.getPublic);

/**
 * @route   GET /api/news-events
 * @desc    Get all news/events
 * @access  Private (super_admin, state_admin, or website.read permission)
 */
router.get('/',
  authenticate, crossFranchiseResolver,
  hasAnyPermission(['website.read', 'news.read']),
  newsEventController.getAll
);

/**
 * @route   GET /api/news-events/:id
 * @desc    Get single news/event
 * @access  Public
 */
router.get('/:id', newsEventController.getById);

/**
 * @route   POST /api/news-events
 * @desc    Create news/event
 * @access  Private (super_admin, state_admin, or website.write permission)
 */
router.post('/',
  authenticate, crossFranchiseResolver,
  hasAnyPermission(['website.write', 'news.write']),
  uploadSingleMemory('image'),
  newsEventController.create
);

/**
 * @route   PUT /api/news-events/:id
 * @desc    Update news/event
 * @access  Private (super_admin, state_admin, or website.write permission)
 */
router.put('/:id',
  authenticate, crossFranchiseResolver,
  hasAnyPermission(['website.write', 'news.write']),
  uploadSingleMemory('image'),
  newsEventController.update
);

/**
 * @route   DELETE /api/news-events/:id
 * @desc    Delete news/event
 * @access  Private (super_admin, state_admin, or website.delete permission)
 */
router.delete('/:id',
  authenticate, crossFranchiseResolver,
  hasAnyPermission(['website.delete', 'news.delete']),
  newsEventController.delete
);

module.exports = router;
