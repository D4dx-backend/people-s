const notificationService = require('../services/notificationService');
const ResponseHelper = require('../utils/responseHelper');
const { buildFranchiseReadFilter, buildFranchiseMatchStage, getWriteFranchiseId } = require('../utils/franchiseFilterHelper');

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
        ...buildFranchiseReadFilter(req)
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

  // ============================================
  // ADMIN BROADCAST ENDPOINTS
  // ============================================

  /**
   * Create an admin broadcast (announcement)
   * POST /api/notifications
   */
  async createBroadcast(req, res) {
    try {
      const {
        title,
        message,
        htmlContent,
        images,
        linkUrl,
        linkLabel,
        targeting,
        priority,
        category
      } = req.body;

      if (!title || !title.trim()) {
        return ResponseHelper.error(res, 'Title is required', 400);
      }
      if (!message || !message.trim()) {
        return ResponseHelper.error(res, 'Message is required', 400);
      }
      if (!targeting || !Array.isArray(targeting.userRoles) || targeting.userRoles.length === 0) {
        return ResponseHelper.error(res, 'At least one target role is required', 400);
      }

      const notification = await notificationService.createAdminBroadcast({
        title: title.trim(),
        message: message.trim(),
        htmlContent: htmlContent || '',
        images: Array.isArray(images) ? images : [],
        linkUrl: linkUrl || '',
        linkLabel: linkLabel || '',
        targeting: {
          userRoles: targeting.userRoles,
          locationIds: Array.isArray(targeting.locationIds) ? targeting.locationIds : []
        },
        priority: priority || 'medium',
        category: category || 'announcement',
        createdBy: req.user._id,
        franchise: getWriteFranchiseId(req)
      });

      return ResponseHelper.success(
        res,
        { notification, recipientCount: notification.delivery?.totalRecipients || 0 },
        'Notification sent successfully',
        201
      );
    } catch (error) {
      return ResponseHelper.error(res, error.message || 'Failed to create notification', 500);
    }
  }

  /**
   * List admin broadcasts (sent feed)
   * GET /api/notifications/sent
   */
  async listSent(req, res) {
    try {
      const { limit, offset } = req.query;
      const filter = {
        type: 'in_app',
        category: 'announcement',
        ...buildFranchiseReadFilter(req)
      };
      const notifications = await notificationService.getSentNotifications(filter, {
        limit: limit ? parseInt(limit, 10) : 50,
        offset: offset ? parseInt(offset, 10) : 0
      });
      return ResponseHelper.success(res, { notifications }, 'Sent notifications retrieved');
    } catch (error) {
      return ResponseHelper.error(res, error.message || 'Failed to fetch sent notifications', 500);
    }
  }

  /**
   * Get a single broadcast with stats
   * GET /api/notifications/sent/:id
   */
  async getSentById(req, res) {
    try {
      const filter = { _id: req.params.id, ...buildFranchiseReadFilter(req) };
      const result = await notificationService.getSentNotificationById(filter);
      if (!result) {
        return ResponseHelper.error(res, 'Notification not found', 404);
      }
      return ResponseHelper.success(res, result, 'Notification retrieved');
    } catch (error) {
      return ResponseHelper.error(res, error.message || 'Failed to fetch notification', 500);
    }
  }

  /**
   * Update a broadcast
   * PUT /api/notifications/sent/:id
   */
  async updateBroadcast(req, res) {
    try {
      const filter = { _id: req.params.id, ...buildFranchiseReadFilter(req) };
      const updates = { ...req.body, updatedBy: req.user._id };
      if (updates.targeting && Array.isArray(updates.targeting.locationIds) === false) {
        updates.targeting.locationIds = [];
      }
      const notification = await notificationService.updateBroadcast(filter, updates);
      if (!notification) {
        return ResponseHelper.error(res, 'Notification not found', 404);
      }
      return ResponseHelper.success(res, { notification }, 'Notification updated');
    } catch (error) {
      return ResponseHelper.error(res, error.message || 'Failed to update notification', 500);
    }
  }

  /**
   * Delete a broadcast for everyone
   * DELETE /api/notifications/sent/:id
   */
  async adminDelete(req, res) {
    try {
      const filter = { _id: req.params.id, ...buildFranchiseReadFilter(req) };
      const result = await notificationService.deleteBroadcast(filter);
      if (!result.success) {
        return ResponseHelper.error(res, 'Notification not found', 404);
      }
      return ResponseHelper.success(res, result, 'Notification deleted');
    } catch (error) {
      return ResponseHelper.error(res, error.message || 'Failed to delete notification', 500);
    }
  }
}

module.exports = new NotificationController();
