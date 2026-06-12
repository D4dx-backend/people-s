const express = require('express');
const downloadController = require('../controllers/downloadController');
const { authenticate, crossFranchiseResolver, authorize } = require('../middleware/auth');

const router = express.Router();

// Roles allowed to manage downloads
const DOWNLOAD_ADMIN_ROLES = [
  'super_admin',
  'state_admin',
  'district_admin',
  'area_admin',
  'unit_admin',
  'area_president',
  'project_coordinator',
  'scheme_coordinator'
];

// Files available to the current user (any authenticated user)
router.get('/available', authenticate, crossFranchiseResolver, (req, res) => downloadController.available(req, res));

// Track a download (any authenticated user)
router.post('/:id/track', authenticate, crossFranchiseResolver, (req, res) => downloadController.track(req, res));

// ── Admin management ──
router.get('/', authenticate, crossFranchiseResolver, authorize(...DOWNLOAD_ADMIN_ROLES), (req, res) => downloadController.list(req, res));
router.post('/', authenticate, crossFranchiseResolver, authorize(...DOWNLOAD_ADMIN_ROLES), (req, res) => downloadController.create(req, res));
router.get('/:id', authenticate, crossFranchiseResolver, authorize(...DOWNLOAD_ADMIN_ROLES), (req, res) => downloadController.getById(req, res));
router.put('/:id', authenticate, crossFranchiseResolver, authorize(...DOWNLOAD_ADMIN_ROLES), (req, res) => downloadController.update(req, res));
router.delete('/:id', authenticate, crossFranchiseResolver, authorize(...DOWNLOAD_ADMIN_ROLES), (req, res) => downloadController.remove(req, res));

module.exports = router;
