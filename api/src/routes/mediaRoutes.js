const express = require('express');
const router = express.Router();
const mediaController = require('../controllers/mediaController');
const { authenticate, crossFranchiseResolver } = require('../middleware/auth');
const { hasAnyPermission } = require('../middleware/rbacMiddleware');
const { uploadSingleMemory } = require('../middleware/upload');

// Public
router.get('/public', mediaController.getPublic);

// Protected
router.use(authenticate);
router.use(crossFranchiseResolver);

router.get('/', hasAnyPermission(['website.read', 'website.write']), mediaController.getAll);
router.post('/', hasAnyPermission(['website.write']), uploadSingleMemory('image'), mediaController.create);
router.put('/:id', hasAnyPermission(['website.write']), uploadSingleMemory('image'), mediaController.update);
router.delete('/:id', hasAnyPermission(['website.delete']), mediaController.remove);

module.exports = router;
