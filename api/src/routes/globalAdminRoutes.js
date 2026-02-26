const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const globalAdminController = require('../controllers/globalAdminController');

/**
 * Global Admin Routes — /api/global/*
 *
 * These routes bypass the tenantResolver middleware and operate across ALL
 * franchises. Access requires User.isSuperAdmin = true on the global User.
 *
 * Authentication still requires a valid JWT, but the JWT may contain any
 * franchiseId (or none for global admin login).
 */

// All global routes require authentication + global super-admin check
router.use(authenticate);
router.use(globalAdminController.requireGlobalAdmin);

// ── Franchise management ──────────────────────────────────────────────
router.get('/franchises', globalAdminController.listFranchises);
router.post('/franchises', globalAdminController.createFranchise);
router.get('/franchises/:id', globalAdminController.getFranchise);
router.put('/franchises/:id', globalAdminController.updateFranchise);
router.delete('/franchises/:id', globalAdminController.deactivateFranchise);
router.get('/franchises/:id/stats', globalAdminController.getFranchiseStats);

// ── Domain management (add/remove custom domains per franchise) ──────────────
router.post('/franchises/:id/domains', globalAdminController.addDomain);
router.delete('/franchises/:id/domains', globalAdminController.removeDomain);

// ── Franchise admin management ────────────────────────────────────────────────
router.get('/franchises/:id/admins', globalAdminController.listFranchiseAdmins);
router.post('/franchises/:id/admins', globalAdminController.createFranchiseAdmin);
router.delete('/franchises/:id/admins/:userId', globalAdminController.deactivateFranchiseAdmin);

// ── RBAC initialization ──────────────────────────────────────────────────────
router.post('/franchises/:id/initialize-rbac', globalAdminController.initializeFranchiseRBAC);

// ── Cross-franchise analytics ────────────────────────────────────────────────
router.get('/stats', globalAdminController.getGlobalStats);

module.exports = router;
