const express = require('express');
const notificationController = require('../controllers/notificationController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Get current user's notifications (with filters)
router.get('/me', authenticate, (req, res) => notificationController.getMyNotifications(req, res));

// Get unread notification count (for bell badge)
router.get('/me/count', authenticate, (req, res) => notificationController.getUnreadCount(req, res));

// Mark a single notification as read
router.patch('/:id/read', authenticate, (req, res) => notificationController.markAsRead(req, res));

// Mark all notifications as read
router.patch('/read-all', authenticate, (req, res) => notificationController.markAllAsRead(req, res));

// Delete a notification
router.delete('/:id', authenticate, (req, res) => notificationController.deleteNotification(req, res));

module.exports = router;
