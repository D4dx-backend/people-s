const express = require('express');
const router = express.Router();
const blogController = require('../controllers/blogController');
const { authenticate, crossFranchiseResolver } = require('../middleware/auth');
const { hasAnyPermission } = require('../middleware/rbacMiddleware');
const { uploadSingleMemory } = require('../middleware/upload');

// Public
router.get('/public', blogController.getPublic);
router.get('/public/:slug', blogController.getPublicBySlug);

// Protected
router.use(authenticate);
router.use(crossFranchiseResolver);

router.get('/', hasAnyPermission(['website.read', 'website.write']), blogController.getAll);
router.get('/:id', hasAnyPermission(['website.read', 'website.write']), blogController.getById);
router.post('/', hasAnyPermission(['website.write']), uploadSingleMemory('cover'), blogController.create);
router.put('/:id', hasAnyPermission(['website.write']), uploadSingleMemory('cover'), blogController.update);
router.delete('/:id', hasAnyPermission(['website.delete']), blogController.remove);

module.exports = router;
