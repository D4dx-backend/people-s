const express = require('express');
const notificationController = require('../controllers/notificationController');
const { authenticate, crossFranchiseResolver, authorize } = require('../middleware/auth');

const router = express.Router();

// Roles allowed to compose and manage broadcasts
const BROADCAST_ADMIN_ROLES = [
  'super_admin',
  'state_admin',
  'district_admin',
  'area_admin',
  'unit_admin',
  'area_president',
  'project_coordinator',
  'scheme_coordinator'
];

// Get current user's notifications (with filters)
router.get('/me', authenticate, crossFranchiseResolver, (req, res) => notificationController.getMyNotifications(req, res));

// Get unread notification count (for bell badge)
router.get('/me/count', authenticate, crossFranchiseResolver, (req, res) => notificationController.getUnreadCount(req, res));

// ── Admin broadcast management ──
// Create a broadcast
router.post('/', authenticate, crossFranchiseResolver, authorize(...BROADCAST_ADMIN_ROLES), (req, res) => notificationController.createBroadcast(req, res));

// List sent broadcasts
router.get('/sent', authenticate, crossFranchiseResolver, authorize(...BROADCAST_ADMIN_ROLES), (req, res) => notificationController.listSent(req, res));

// Get a single broadcast with stats
router.get('/sent/:id', authenticate, crossFranchiseResolver, authorize(...BROADCAST_ADMIN_ROLES), (req, res) => notificationController.getSentById(req, res));

// Update a broadcast
router.put('/sent/:id', authenticate, crossFranchiseResolver, authorize(...BROADCAST_ADMIN_ROLES), (req, res) => notificationController.updateBroadcast(req, res));

// Delete a broadcast for everyone
router.delete('/sent/:id', authenticate, crossFranchiseResolver, authorize(...BROADCAST_ADMIN_ROLES), (req, res) => notificationController.adminDelete(req, res));

// Mark a single notification as read
router.patch('/:id/read', authenticate, crossFranchiseResolver, (req, res) => notificationController.markAsRead(req, res));

// Mark all notifications as read
router.patch('/read-all', authenticate, crossFranchiseResolver, (req, res) => notificationController.markAllAsRead(req, res));

// Delete a notification
router.delete('/:id', authenticate, crossFranchiseResolver, (req, res) => notificationController.deleteNotification(req, res));

module.exports = router;
