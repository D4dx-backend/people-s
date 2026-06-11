const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { uploadMultipleMemory } = require('../middleware/upload');
const ctrl = require('../controllers/programReportController');

// Roles that can upload program reports (area coordinators)
const COORDINATORS = ['district_admin', 'area_admin', 'unit_admin', 'area_president'];
// Roles that can browse the feed (coordinators see their own, admins see all)
const ALL_ADMINS = ['super_admin', 'state_admin', 'district_admin', 'area_admin', 'unit_admin', 'area_president'];
// Roles allowed to delete (owner coordinators + admin viewers)
const CAN_DELETE = ['super_admin', 'state_admin', 'district_admin', 'area_admin', 'unit_admin', 'area_president'];

const MAX_PHOTOS = 5;

// ── List / Read ────────────────────────────────────────────────────────────────
router.get('/', authenticate, authorize(...ALL_ADMINS), ctrl.getProgramReports);
router.get('/:id', authenticate, authorize(...ALL_ADMINS), ctrl.getProgramReportById);

// ── Create / Update / Delete ─────────────────────────────────────────────────
router.post(
  '/',
  authenticate,
  authorize(...COORDINATORS),
  uploadMultipleMemory('photos', MAX_PHOTOS),
  ctrl.createProgramReport
);
router.put('/:id', authenticate, authorize(...COORDINATORS), ctrl.updateProgramReport);
router.delete('/:id', authenticate, authorize(...CAN_DELETE), ctrl.deleteProgramReport);

// ── Photos ───────────────────────────────────────────────────────────────────
router.post(
  '/:id/photos',
  authenticate,
  authorize(...COORDINATORS),
  uploadMultipleMemory('photos', MAX_PHOTOS),
  ctrl.addPhotos
);
router.delete(
  '/:id/photos/:photoId',
  authenticate,
  authorize(...COORDINATORS),
  ctrl.deletePhoto
);

module.exports = router;
