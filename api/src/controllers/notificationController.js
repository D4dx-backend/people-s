const notificationService = require('../services/notificationService');
const ResponseHelper = require('../utils/responseHelper');

class NotificationController {
  /**
   * Get current user's notifications
   * GET /api/notifications/me
   */
  async getMyNotifications(req, res) {
    try {
      const { type, category, unreadOnly, limit, offset } = req.query;
      const notifications = await notificationService.getUserNotifications(req.user._id, {
        type: type || null,
        category: category || null,
        unreadOnly: unreadOnly === 'true' || unreadOnly === true,
        limit: limit ? parseInt(limit, 10) : 50,
        offset: offset ? parseInt(offset, 10) : 0,
        franchise: req.franchiseId || null  // Multi-tenant
      });
      return ResponseHelper.success(res, { notifications }, 'Notifications retrieved successfully');
    } catch (error) {
      return ResponseHelper.error(res, error.message || 'Failed to fetch notifications', 500);
    }
  }

  /**
   * Get unread notification count
   * GET /api/notifications/me/count
   */
  async getUnreadCount(req, res) {
    try {
      const count = await notificationService.getUnreadCount(req.user._id);
      return ResponseHelper.success(res, { count }, 'Unread count retrieved');
    } catch (error) {
      return ResponseHelper.error(res, error.message || 'Failed to fetch unread count', 500);
    }
  }

  /**
   * Mark a notification as read
   * PATCH /api/notifications/:id/read
   */
  async markAsRead(req, res) {
    try {
      const { id } = req.params;
      const result = await notificationService.markAsRead(id, req.user._id);
      return ResponseHelper.success(res, result, 'Notification marked as read');
    } catch (error) {
      return ResponseHelper.error(res, error.message || 'Failed to mark notification as read', 500);
    }
  }

  /**
   * Mark all notifications as read
   * PATCH /api/notifications/read-all
   */
  async markAllAsRead(req, res) {
    try {
      const result = await notificationService.markAllAsRead(req.user._id);
      return ResponseHelper.success(res, result, 'All notifications marked as read');
    } catch (error) {
      return ResponseHelper.error(res, error.message || 'Failed to mark all as read', 500);
    }
  }

  /**
   * Delete a notification
   * DELETE /api/notifications/:id
   */
  async deleteNotification(req, res) {
    try {
      const { id } = req.params;
      const result = await notificationService.deleteNotification(id, req.user._id);
      return ResponseHelper.success(res, result, 'Notification deleted');
    } catch (error) {
      return ResponseHelper.error(res, error.message || 'Failed to delete notification', 500);
    }
  }
}

module.exports = new NotificationController();
