const express = require('express');
const router = express.Router();
const partnerController = require('../controllers/partnerController');
const { authenticate, crossFranchiseResolver } = require('../middleware/auth');
const { hasAnyPermission } = require('../middleware/rbacMiddleware');
const { uploadSingleMemory } = require('../middleware/upload');
const { createExportHandler } = require('../middleware/exportHandler');
const exportConfigs = require('../config/exportConfigs');
const Partner = require('../models/Partner');

// Public routes
router.get('/public', partnerController.getPublicPartners);
router.get('/public/:id', partnerController.getPartnerById);

// Protected routes
router.use(authenticate);
router.use(crossFranchiseResolver);

// Export partners as CSV or JSON
router.get('/export',
  hasAnyPermission(['website.read', 'partners.read']),
  createExportHandler(Partner, exportConfigs.partner)
);

router.get(
  '/',
  hasAnyPermission(['website.read', 'partners.read']),
  partnerController.getAllPartners
);

router.get(
  '/:id',
  hasAnyPermission(['website.read', 'partners.read']),
  partnerController.getPartnerById
);

router.post(
  '/',
  hasAnyPermission(['website.write', 'partners.write']),
  uploadSingleMemory('logo'),
  partnerController.createPartner
);

router.put(
  '/:id',
  hasAnyPermission(['website.write', 'partners.write']),
  uploadSingleMemory('logo'),
  partnerController.updatePartner
);

router.delete(
  '/:id',
  hasAnyPermission(['website.delete', 'partners.delete']),
  partnerController.deletePartner
);

module.exports = router;
