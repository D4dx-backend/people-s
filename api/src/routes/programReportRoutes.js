const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { uploadMultipleMemory } = require('../middleware/upload');
const ctrl = require('../controllers/programReportController');

const SUPER = ['super_admin'];
const ALL_ADMINS = ['super_admin', 'state_admin', 'district_admin', 'area_admin', 'unit_admin', 'area_president'];
const FIELD_ADMINS = ['district_admin', 'area_admin', 'unit_admin', 'area_president'];

// ── Report CRUD ───────────────────────────────────────────────────────────────
router.get('/', authenticate, authorize(...ALL_ADMINS), ctrl.getProgramReports);
router.post('/', authenticate, authorize(...SUPER), ctrl.createProgramReport);
router.get('/:id', authenticate, authorize(...ALL_ADMINS), ctrl.getProgramReportById);
router.put('/:id', authenticate, authorize(...SUPER), ctrl.updateProgramReport);
router.delete('/:id', authenticate, authorize(...SUPER), ctrl.deleteProgramReport);

// ── Form Configuration ────────────────────────────────────────────────────────
router.get('/:id/form-config', authenticate, authorize(...ALL_ADMINS), ctrl.getFormConfig);
router.put('/:id/form-config', authenticate, authorize(...SUPER), ctrl.updateFormConfig);
router.patch('/:id/form-config/publish', authenticate, authorize(...SUPER), ctrl.publishFormConfig);

// ── Submissions ───────────────────────────────────────────────────────────────
router.get('/:id/submissions', authenticate, authorize(...ALL_ADMINS), ctrl.getSubmissions);
router.post('/:id/submissions', authenticate, authorize(...FIELD_ADMINS), ctrl.saveSubmission);
router.patch('/:id/submissions/:submissionId/submit', authenticate, authorize(...FIELD_ADMINS), ctrl.submitSubmission);
router.patch('/:id/submissions/:submissionId', authenticate, authorize(...FIELD_ADMINS), ctrl.updateSubmission);
router.delete('/:id/submissions/:submissionId', authenticate, authorize(...FIELD_ADMINS), ctrl.deleteSubmission);

// ── Attachments ───────────────────────────────────────────────────────────────
router.post(
  '/:id/submissions/:submissionId/attachments',
  authenticate,
  authorize(...FIELD_ADMINS),
  uploadMultipleMemory('files', 50),
  ctrl.uploadAttachments
);
router.delete(
  '/:id/submissions/:submissionId/attachments/:attachmentId',
  authenticate,
  authorize(...FIELD_ADMINS),
  ctrl.deleteAttachment
);

module.exports = router;
