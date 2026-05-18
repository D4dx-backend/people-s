const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/adminReportController');

const SUPER = ['super_admin'];
const ADMIN_ROLES = ['super_admin', 'state_admin', 'district_admin', 'area_admin', 'unit_admin'];

// ── Report CRUD ───────────────────────────────────────────────────────────────
router.get('/', authenticate, authorize(...ADMIN_ROLES), ctrl.getAdminReports);
router.post('/', authenticate, authorize(...SUPER), ctrl.createAdminReport);
router.get('/:id', authenticate, authorize(...ADMIN_ROLES), ctrl.getAdminReportById);
router.put('/:id', authenticate, authorize(...SUPER), ctrl.updateAdminReport);
router.delete('/:id', authenticate, authorize(...SUPER), ctrl.deleteAdminReport);

// ── Form Configuration ────────────────────────────────────────────────────────
router.get('/:id/form-config', authenticate, authorize(...ADMIN_ROLES), ctrl.getFormConfig);
router.put('/:id/form-config', authenticate, authorize(...SUPER), ctrl.updateFormConfig);
router.patch('/:id/form-config/publish', authenticate, authorize(...SUPER), ctrl.publishFormConfig);

// ── Submissions ───────────────────────────────────────────────────────────────
router.get('/:id/submissions', authenticate, authorize(...ADMIN_ROLES), ctrl.getSubmissions);
router.post('/:id/submissions', authenticate, authorize(...ADMIN_ROLES), ctrl.saveSubmission);
router.patch('/:id/submissions/:submissionId/submit', authenticate, authorize(...ADMIN_ROLES), ctrl.submitSubmission);
router.patch('/:id/submissions/:submissionId', authenticate, authorize(...ADMIN_ROLES), ctrl.updateSubmission);
router.delete('/:id/submissions/:submissionId', authenticate, authorize(...ADMIN_ROLES), ctrl.deleteSubmission);

module.exports = router;
