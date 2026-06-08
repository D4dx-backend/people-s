const express = require('express');
const router = express.Router();
const galleryController = require('../controllers/galleryController');
const { authenticate, crossFranchiseResolver } = require('../middleware/auth');
const { hasAnyPermission } = require('../middleware/rbacMiddleware');
const { uploadFields } = require('../middleware/upload');

const galleryUpload = uploadFields([
  { name: 'images', maxCount: 30 },
  { name: 'cover', maxCount: 1 }
]);

// Public
router.get('/public', galleryController.getPublic);
router.get('/public/:id', galleryController.getPublicById);

// Protected
router.use(authenticate);
router.use(crossFranchiseResolver);

router.get('/', hasAnyPermission(['website.read', 'website.write']), galleryController.getAll);
router.get('/:id', hasAnyPermission(['website.read', 'website.write']), galleryController.getById);
router.post('/', hasAnyPermission(['website.write']), galleryUpload, galleryController.create);
router.put('/:id', hasAnyPermission(['website.write']), galleryUpload, galleryController.update);
router.delete('/:id', hasAnyPermission(['website.delete']), galleryController.remove);

module.exports = router;
