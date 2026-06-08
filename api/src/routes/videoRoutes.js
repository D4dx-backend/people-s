const express = require('express');
const router = express.Router();
const videoController = require('../controllers/videoController');
const { authenticate, crossFranchiseResolver } = require('../middleware/auth');
const { hasAnyPermission } = require('../middleware/rbacMiddleware');
const { uploadSingleMemory } = require('../middleware/upload');

// Public
router.get('/public', videoController.getPublic);

// Protected
router.use(authenticate);
router.use(crossFranchiseResolver);

router.get('/', hasAnyPermission(['website.read', 'website.write']), videoController.getAll);
router.post('/', hasAnyPermission(['website.write']), uploadSingleMemory('thumbnail'), videoController.create);
router.put('/:id', hasAnyPermission(['website.write']), uploadSingleMemory('thumbnail'), videoController.update);
router.delete('/:id', hasAnyPermission(['website.delete']), videoController.remove);

module.exports = router;
