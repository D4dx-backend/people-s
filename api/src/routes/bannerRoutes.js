const express = require('express');
const router = express.Router();
const bannerController = require('../controllers/bannerController');
const { authenticate, crossFranchiseResolver } = require('../middleware/auth');
const { hasAnyPermission } = require('../middleware/rbacMiddleware');
const { uploadSingleMemory } = require('../middleware/upload');

// Public routes
router.get('/public', bannerController.getPublicBanners);

// Protected routes
router.use(authenticate);
router.use(crossFranchiseResolver);

router.get(
  '/',
  hasAnyPermission(['website.read', 'website.write']),
  bannerController.getAllBanners
);

router.get(
  '/:id',
  hasAnyPermission(['website.read', 'website.write']),
  bannerController.getBannerById
);

router.post(
  '/',
  hasAnyPermission(['website.write']),
  uploadSingleMemory('image'),
  bannerController.createBanner
);

router.put(
  '/:id',
  hasAnyPermission(['website.write']),
  uploadSingleMemory('image'),
  bannerController.updateBanner
);

router.delete(
  '/:id',
  hasAnyPermission(['website.delete']),
  bannerController.deleteBanner
);

module.exports = router;
