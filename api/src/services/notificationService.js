const { Notification, User, Beneficiary } = require('../models');
const dxingSmsService = require('./dxingSmsService');
const dxingWhatsappService = require('./dxingWhatsappService');
const firebaseService = require('./firebaseService');
const config = require('../config/environment');

class NotificationService {
  constructor() {
    this.dxingService = dxingSmsService;
    this.dxingWhatsappService = dxingWhatsappService;
  }

  /**
   * Send notification to single recipient
   * @param {Object} notificationData - Notification data
   * @returns {Promise<Object>} Send result
   */
  async sendNotification(notificationData) {
    try {
      const {
        type,
        recipient,
        title,
        message,
        category = 'general',
        priority = 'medium',
        relatedEntities = {},
        variables = {},
        templateId = null
      } = notificationData;

      // Create notification record
      const notification = new Notification({
        title,
        message,
        type,
        category,
        priority,
        relatedEntities,
        delivery: {
          status: 'sending',
          totalRecipients: 1
        },
        createdBy: notificationData.createdBy
      });

      // Add recipient
      const recipientData = await this.prepareRecipient(recipient, type);
      notification.recipients.push(recipientData);

      await notification.save();

      // Send based on type
      let sendResult;
      switch (type) {
        case 'sms':
          sendResult = await this.sendDXingSMS(recipientData, message, variables, templateId);
          break;
        case 'whatsapp':
          sendResult = await this.sendDXingWhatsApp(recipientData, message, variables, templateId);
          break;
        case 'email':
          sendResult = await this.sendEmail(recipientData, title, message, variables);
          break;
        case 'push':
          sendResult = await this.sendPushNotification(recipientData, title, message, variables);
          break;
        case 'in_app':
          // In-app: the DB record IS the notification — already saved above
          sendResult = { success: true, messageId: notification._id.toString(), provider: 'Database' };
          break;
        default:
          throw new Error(`Unsupported notification type: ${type}`);
      }

      // Update notification status
      await notification.updateRecipientStatus(
        notification.recipients[0]._id,
        sendResult.success ? 'sent' : 'failed',
        sendResult
      );

      return {
        success: sendResult.success,
        notificationId: notification._id,
        messageId: sendResult.messageId,
        message: sendResult.success ? 'Notification sent successfully' : sendResult.error
      };
    } catch (error) {
      console.error('❌ Send Notification Error:', error);
      throw error;
    }
  }

  /**
   * Send bulk notifications
   * @param {Object} bulkData - Bulk notification data
   * @returns {Promise<Object>} Bulk send result
   */
  async sendBulkNotification(bulkData) {
    try {
      const {
        type,
        recipients,
        title,
        message,
        category = 'general',
        priority = 'medium',
        targeting = {},
        variables = {},
        templateId = null
      } = bulkData;

      // Create notification record
      const notification = new Notification({
        title,
        message,
        type,
        category,
        priority,
        targeting,
        delivery: {
          status: 'sending',
          totalRecipients: recipients.length
        },
        createdBy: bulkData.createdBy
      });

      // Prepare all recipients
      const preparedRecipients = await Promise.all(
        recipients.map(recipient => this.prepareRecipient(recipient, type))
      );

      notification.recipients = preparedRecipients;
      await notification.save();

      // Send based on type
      let sendResults;
      switch (type) {
        case 'sms':
          sendResults = await this.sendBulkSMS(preparedRecipients, message, variables, templateId);
          break;
        case 'whatsapp':
          sendResults = await this.sendBulkWhatsApp(preparedRecipients, message, variables, templateId);
          break;
        case 'email':
          sendResults = await this.sendBulkEmail(preparedRecipients, title, message, variables);
          break;
        case 'push':
          sendResults = await this.sendBulkPushNotification(preparedRecipients, title, message, variables);
          break;
        case 'in_app':
          // In-app: the DB record IS the notification, mark all as sent
          sendResults = preparedRecipients.map(() => ({
            success: true,
            messageId: notification._id.toString(),
            provider: 'Database'
          }));
          break;
        default:
          throw new Error(`Bulk ${type} notifications not supported`);
      }

      // Update recipient statuses
      for (let i = 0; i < sendResults.length; i++) {
        await notification.updateRecipientStatus(
          notification.recipients[i]._id,
          sendResults[i].success ? 'sent' : 'failed',
          sendResults[i]
        );
      }

      const successCount = sendResults.filter(r => r.success).length;
      const failureCount = sendResults.length - successCount;

      return {
        success: successCount > 0,
        notificationId: notification._id,
        totalRecipients: recipients.length,
        successCount,
        failureCount,
        message: `Bulk notification completed: ${successCount} sent, ${failureCount} failed`
      };
    } catch (error) {
      console.error('❌ Send Bulk Notification Error:', error);
      throw error;
    }
  }

  /**
   * Send targeted notifications based on criteria
   */
  async sendTargetedNotification(targetingData) {
    try {
      const {
        type,
        title,
        message,
        targeting,
        category = 'general',
        priority = 'medium',
        variables = {}
      } = targetingData;

      const recipients = await this.findTargetedRecipients(targeting);

      if (recipients.length === 0) {
        return {
          success: false,
          message: 'No recipients found matching the targeting criteria'
        };
      }

      return await this.sendBulkNotification({
        type,
        recipients,
        title,
        message,
        category,
        priority,
        targeting,
        variables,
        relatedEntities: targetingData.relatedEntities,
        createdBy: targetingData.createdBy
      });
    } catch (error) {
      console.error('❌ Send Targeted Notification Error:', error);
      throw error;
    }
  }

  // =====================
  // PROVIDER SEND METHODS
  // =====================

  async sendDXingSMS(recipient, message, variables = {}, templateId = null) {
    try {
      if (!recipient.phone) {
        throw new Error('Phone number is required for DXing SMS');
      }

      const smsMessage = templateId 
        ? this.dxingService.createTemplate(templateId, variables)
        : message;

      const result = await this.dxingService.sendNotification(
        recipient.phone,
        smsMessage,
        variables
      );

      return {
        success: result.success,
        messageId: result.messageId,
        provider: 'DXing',
        error: result.error
      };
    } catch (error) {
      return { success: false, error: error.message, provider: 'DXing' };
    }
  }

  async sendDXingWhatsApp(recipient, message, variables = {}, templateId = null) {
    try {
      if (!recipient.phone) {
        throw new Error('Phone number is required for DXing WhatsApp');
      }

      const result = await this.dxingWhatsappService.sendWhatsApp(
        recipient.phone,
        message,
        variables,
        templateId
      );

      return {
        success: result.success,
        messageId: result.messageId,
        provider: 'DXing',
        error: result.error
      };
    } catch (error) {
      return { success: false, error: error.message, provider: 'DXing' };
    }
  }

  async sendBulkWhatsApp(recipients, message, variables = {}, templateId = null) {
    const results = [];
    for (const recipient of recipients) {
      results.push(await this.sendDXingWhatsApp(recipient, message, { ...variables, name: recipient.name }, templateId));
    }
    return results;
  }

  async sendBulkSMS(recipients, message, variables = {}, templateId = null) {
    try {
      const smsRecipients = recipients
        .filter(r => r.phone)
        .map(recipient => ({
          phone: recipient.phone,
          message: templateId 
            ? dxingSmsService.createTemplate(templateId, { ...variables, name: recipient.name })
            : message,
          variables: { ...variables, name: recipient.name }
        }));

      if (smsRecipients.length === 0) {
        return recipients.map(() => ({ success: false, error: 'No valid phone numbers found' }));
      }

      const bulkResult = await dxingSmsService.sendBulkSMS(smsRecipients);

      return recipients.map((recipient) => ({
        success: recipient.phone ? bulkResult.success : false,
        messageId: bulkResult.batchId,
        provider: 'DXing',
        error: recipient.phone ? bulkResult.error : 'No phone number'
      }));
    } catch (error) {
      return recipients.map(() => ({ success: false, error: error.message, provider: 'DXing' }));
    }
  }

  async sendEmail() {
    return { success: false, error: 'Email notifications are disabled', provider: 'SMTP' };
  }

  async sendBulkEmail(recipients) {
    return recipients.map(() => ({ success: false, error: 'Email notifications are disabled', provider: 'SMTP' }));
  }

  /**
   * Send push notification via Firebase
   */
  async sendPushNotification(recipient, title, message, data = {}) {
    try {
      if (!recipient.fcmToken) {
        // Try to get tokens from all user devices
        if (recipient.user) {
          const user = await User.findById(recipient.user).select('devices');
          if (user && user.devices && user.devices.length > 0) {
            const tokens = user.devices.map(d => d.fcmToken).filter(Boolean);
            if (tokens.length > 0) {
              return await firebaseService.sendPushToMultiple(tokens, title, message, data);
            }
          }
        }
        return { success: false, error: 'No FCM token available', provider: 'Firebase' };
      }

      return await firebaseService.sendPushToDevice(recipient.fcmToken, title, message, data);
    } catch (error) {
      return { success: false, error: error.message, provider: 'Firebase' };
    }
  }

  async sendBulkPushNotification(recipients, title, message, data = {}) {
    const results = [];
    for (const recipient of recipients) {
      const result = await this.sendPushNotification(recipient, title, message, data);
      results.push(result);
    }
    return results;
  }

  // ==============
  // HELPER METHODS
  // ==============

  async prepareRecipient(recipient, type) {
    let recipientData = { status: 'pending', attempts: 0 };

    if (typeof recipient === 'string' && recipient.match(/^[0-9a-fA-F]{24}$/)) {
      const user = await User.findById(recipient);
      if (user) {
        recipientData.user = user._id;
        recipientData.phone = user.phone;
        recipientData.email = user.email;
        recipientData.name = user.name;
        if (user.devices && user.devices.length > 0) {
          recipientData.fcmToken = user.devices[0].fcmToken;
        }
      }
    } else if (typeof recipient === 'object') {
      Object.assign(recipientData, recipient);
    }

    return recipientData;
  }

  async findTargetedRecipients(targeting) {
    try {
      let query = { isActive: true };

      if (targeting.userRoles && targeting.userRoles.length > 0) {
        query.role = { $in: targeting.userRoles };
      }
      if (targeting.regions && targeting.regions.length > 0) {
        query['adminScope.regions'] = { $in: targeting.regions };
      }
      if (targeting.projects && targeting.projects.length > 0) {
        query['adminScope.projects'] = { $in: targeting.projects };
      }
      if (targeting.schemes && targeting.schemes.length > 0) {
        query['adminScope.schemes'] = { $in: targeting.schemes };
      }
      if (targeting.customFilters) {
        Object.assign(query, targeting.customFilters);
      }

      const users = await User.find(query).select('name email phone devices');

      return users.map(user => ({
        user: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        fcmToken: user.devices && user.devices.length > 0 ? user.devices[0].fcmToken : null
      }));
    } catch (error) {
      console.error('❌ Find Targeted Recipients Error:', error);
      return [];
    }
  }

  getTemplates(category = null) {
    const templates = {
      application_status: {
        submitted: { sms: 'application_submitted', push: 'Application Submitted' },
        approved: { sms: 'application_approved', push: 'Great News! Application Approved' },
        rejected: { sms: 'application_rejected', push: 'Application Status Update' }
      },
      payment: {
        processed: { sms: 'payment_processed', push: 'Payment Processed' }
      },
      reminder: {
        document_required: { sms: 'document_required', push: 'Action Required: Upload Documents' },
        interview_scheduled: { sms: 'interview_scheduled', push: 'Interview Scheduled' }
      },
      donation: {
        thank_you: { sms: 'donation_thank_you', whatsapp: 'donation_thank_you', push: 'Thank You for Your Donation!' },
        reminder_7day: { sms: 'donation_reminder_7day', whatsapp: 'donation_reminder_7day', push: 'Donation Reminder' },
        reminder_due: { sms: 'donation_reminder_due', whatsapp: 'donation_reminder_due', push: 'Donation Due Today' },
        lapsed: { sms: 'donation_lapsed', whatsapp: 'donation_lapsed', push: 'We Miss Your Support!' },
        anniversary: { sms: 'donation_anniversary', whatsapp: 'donation_anniversary', push: 'Donation Anniversary' }
      }
    };
    return category ? templates[category] : templates;
  }

  // ============================
  // NOTIFICATION QUERY ENDPOINTS
  // ============================

  async getUserNotifications(userId, filters = {}) {
    try {
      const { type = null, category = null, unreadOnly = false, limit = 50, offset = 0, franchise = null } = filters;

      let query = { 'recipients.user': userId };
      if (type) query.type = type;
      if (category) query.category = category;
      if (franchise) query.franchise = franchise;
      if (unreadOnly) {
        query.recipients = { $elemMatch: { user: userId, status: { $ne: 'read' } } };
      }

      return await Notification.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(offset)
        .populate('createdBy', 'name')
        .populate('relatedEntities.application', 'applicationNumber status')
        .populate('relatedEntities.project', 'name')
        .populate('relatedEntities.scheme', 'name');
    } catch (error) {
      console.error('❌ Get User Notifications Error:', error);
      throw error;
    }
  }

  async getUnreadCount(userId) {
    try {
      return await Notification.countDocuments({
        type: 'in_app',
        recipients: {
          $elemMatch: {
            user: userId,
            status: { $in: ['pending', 'sent', 'delivered'] }
          }
        }
      });
    } catch (error) {
      console.error('❌ Get Unread Count Error:', error);
      return 0;
    }
  }

  async markAsRead(notificationId, userId) {
    try {
      await Notification.markAsRead(notificationId, userId);
      return { success: true, message: 'Notification marked as read' };
    } catch (error) {
      console.error('❌ Mark As Read Error:', error);
      throw error;
    }
  }

  async markAllAsRead(userId) {
    try {
      await Notification.updateMany(
        { 'recipients.user': userId, 'recipients.status': { $ne: 'read' } },
        {
          $set: {
            'recipients.$[elem].status': 'read',
            'recipients.$[elem].readAt': new Date()
          }
        },
        { arrayFilters: [{ 'elem.user': userId, 'elem.status': { $ne: 'read' } }] }
      );
      return { success: true, message: 'All notifications marked as read' };
    } catch (error) {
      console.error('❌ Mark All As Read Error:', error);
      throw error;
    }
  }

  async deleteNotification(notificationId, userId) {
    try {
      await Notification.updateOne(
        { _id: notificationId, 'recipients.user': userId },
        { $pull: { recipients: { user: userId } } }
      );
      return { success: true, message: 'Notification deleted' };
    } catch (error) {
      console.error('❌ Delete Notification Error:', error);
      throw error;
    }
  }

  async getNotificationStatistics(filters = {}) {
    try {
      const stats = await Notification.aggregate([
        { $match: filters },
        {
          $group: {
            _id: '$type',
            total: { $sum: 1 },
            sent: { $sum: '$delivery.sentCount' },
            delivered: { $sum: '$delivery.deliveredCount' },
            failed: { $sum: '$delivery.failedCount' }
          }
        }
      ]);
      return { success: true, statistics: stats };
    } catch (error) {
      console.error('❌ Get Notification Statistics Error:', error);
      throw error;
    }
  }

  // ============================================
  // DOMAIN NOTIFICATION HELPERS — Multi-channel
  // Each event sends: WhatsApp + Push + In-App
  // Recipients: unit_admin + area_admin + district_admin (+ beneficiary where applicable)
  // ============================================

  /**
   * Helper: Send WhatsApp + Push + In-App to targeted admins
   */
  _notifyAdminRole({ role, filterField, filterValue, title, message, category, priority, relatedEntities, pushData, createdBy }) {
    if (!filterValue) return [];

    const targeting = {
      userRoles: [role],
      customFilters: { [filterField]: filterValue }
    };

    return [
      this.sendTargetedNotification({
        type: 'whatsapp', title, message, category, priority, targeting, createdBy
      }).catch(err => console.error(`WhatsApp to ${role} failed:`, err)),

      this.sendTargetedNotification({
        type: 'push', title, message, category, priority, targeting,
        variables: pushData || {}, createdBy
      }).catch(err => console.error(`Push to ${role} failed:`, err)),

      this.sendTargetedNotification({
        type: 'in_app', title, message, category, priority, targeting,
        relatedEntities, createdBy
      }).catch(err => console.error(`In-app to ${role} failed:`, err))
    ];
  }

  /**
   * Helper: Send WhatsApp + Push + In-App to a specific recipient (e.g. beneficiary)
   */
  _notifyRecipient({ recipient, title, message, category, priority, relatedEntities, pushData, createdBy }) {
    return [
      this.sendNotification({
        type: 'whatsapp', recipient, title, message, category, priority, relatedEntities, createdBy
      }).catch(err => console.error('WhatsApp to recipient failed:', err)),

      this.sendNotification({
        type: 'push', recipient, title, message, category, priority, relatedEntities,
        variables: pushData || {}, createdBy
      }).catch(err => console.error('Push to recipient failed:', err)),

      this.sendNotification({
        type: 'in_app', recipient, title, message, category, priority, relatedEntities, createdBy
      }).catch(err => console.error('In-app to recipient failed:', err))
    ];
  }

  // --- Application Submitted ---
  async notifyApplicationSubmitted(application, { createdBy } = {}) {
    const title = 'New application received';
    const schemeName = application.scheme?.name || 'a scheme';
    const beneficiaryName = application.beneficiary?.name || 'A beneficiary';
    const applicationNumber = application.applicationNumber || application._id;
    const message = `New application ${applicationNumber} received from ${beneficiaryName} for ${schemeName}.`;

    const relatedEntities = {
      application: application._id,
      scheme: application.scheme?._id,
      project: application.project
    };
    const pushData = { applicationId: String(application._id), type: 'application_submitted' };

    const jobs = [
      ...this._notifyAdminRole({
        role: 'unit_admin', filterField: 'adminScope.unit', filterValue: application.unit,
        title, message, category: 'application_status', priority: 'high',
        relatedEntities, pushData, createdBy
      }),
      ...this._notifyAdminRole({
        role: 'area_admin', filterField: 'adminScope.area', filterValue: application.area,
        title, message, category: 'application_status', priority: 'high',
        relatedEntities, pushData, createdBy
      }),
      ...this._notifyAdminRole({
        role: 'district_admin', filterField: 'adminScope.district', filterValue: application.district,
        title, message, category: 'application_status', priority: 'high',
        relatedEntities, pushData, createdBy
      })
    ];

    await Promise.allSettled(jobs);
    return { success: true };
  }

  // --- Application Decision (approved/rejected) ---
  async notifyApplicationDecisionToBeneficiary(application, decision, { createdBy } = {}) {
    const schemeName = application.scheme?.name || 'your scheme';
    const applicationNumber = application.applicationNumber || application._id;
    const beneficiaryName = application.beneficiary?.name || 'Beneficiary';

    const title = 'Application status update';
    const msgBeneficiary = decision === 'approved'
      ? `Your application ${applicationNumber} for ${schemeName} has been approved.`
      : `Your application ${applicationNumber} for ${schemeName} has been rejected.`;
    const msgAdmin = decision === 'approved'
      ? `Application ${applicationNumber} from ${beneficiaryName} for ${schemeName} has been approved.`
      : `Application ${applicationNumber} from ${beneficiaryName} for ${schemeName} has been rejected.`;

    const relatedEntities = {
      application: application._id,
      scheme: application.scheme?._id,
      project: application.project
    };
    const pushData = { applicationId: String(application._id), type: 'application_decision', decision };

    const jobs = [
      ...this._notifyRecipient({
        recipient: {
          beneficiary: application.beneficiary?._id,
          phone: application.beneficiary?.phone,
          user: application.beneficiary?.userId || application.beneficiary?._id
        },
        title, message: msgBeneficiary, category: 'application_status', priority: 'high',
        relatedEntities, pushData, createdBy
      }),
      ...this._notifyAdminRole({
        role: 'unit_admin', filterField: 'adminScope.unit', filterValue: application.unit,
        title, message: msgAdmin, category: 'application_status', priority: 'high',
        relatedEntities, pushData, createdBy
      }),
      ...this._notifyAdminRole({
        role: 'area_admin', filterField: 'adminScope.area', filterValue: application.area,
        title, message: msgAdmin, category: 'application_status', priority: 'high',
        relatedEntities, pushData, createdBy
      }),
      ...this._notifyAdminRole({
        role: 'district_admin', filterField: 'adminScope.district', filterValue: application.district,
        title, message: msgAdmin, category: 'application_status', priority: 'high',
        relatedEntities, pushData, createdBy
      })
    ];

    await Promise.allSettled(jobs);
    return { success: true };
  }

  // --- Interview Scheduled ---
  async notifyInterviewScheduled(application, interview, { createdBy } = {}) {
    const schemeName = application.scheme?.name || 'your scheme';
    const applicationNumber = application.applicationNumber || application._id;
    const dateStr = interview?.scheduledDate
      ? new Date(interview.scheduledDate).toLocaleDateString('en-IN') : '';
    const timeStr = interview?.scheduledTime ? ` ${interview.scheduledTime}` : '';

    const title = 'Interview scheduled';
    const msgBeneficiary = `Your interview is scheduled for application ${applicationNumber} (${schemeName}) on ${dateStr}${timeStr}.`;
    const msgAdmin = `Interview scheduled for application ${applicationNumber} (${schemeName}) on ${dateStr}${timeStr}.`;

    const relatedEntities = {
      application: application._id,
      scheme: application.scheme?._id,
      project: application.project
    };
    const pushData = { applicationId: String(application._id), type: 'interview_scheduled' };

    const jobs = [
      ...this._notifyRecipient({
        recipient: {
          beneficiary: application.beneficiary?._id,
          phone: application.beneficiary?.phone,
          user: application.beneficiary?.userId || application.beneficiary?._id
        },
        title, message: msgBeneficiary, category: 'reminder', priority: 'high',
        relatedEntities, pushData, createdBy
      }),
      ...this._notifyAdminRole({
        role: 'unit_admin', filterField: 'adminScope.unit', filterValue: application.unit,
        title, message: msgAdmin, category: 'reminder', priority: 'high',
        relatedEntities, pushData, createdBy
      }),
      ...this._notifyAdminRole({
        role: 'area_admin', filterField: 'adminScope.area', filterValue: application.area,
        title, message: msgAdmin, category: 'reminder', priority: 'high',
        relatedEntities, pushData, createdBy
      }),
      ...this._notifyAdminRole({
        role: 'district_admin', filterField: 'adminScope.district', filterValue: application.district,
        title, message: msgAdmin, category: 'reminder', priority: 'high',
        relatedEntities, pushData, createdBy
      })
    ];

    await Promise.allSettled(jobs);
    return { success: true };
  }

  // --- Interview Rescheduled ---
  async notifyInterviewRescheduled(application, interview, { createdBy } = {}) {
    const schemeName = application.scheme?.name || 'your scheme';
    const applicationNumber = application.applicationNumber || application._id;
    const dateStr = interview?.scheduledDate
      ? new Date(interview.scheduledDate).toLocaleDateString('en-IN') : '';
    const timeStr = interview?.scheduledTime ? ` ${interview.scheduledTime}` : '';

    const title = 'Interview rescheduled';
    const msgBeneficiary = `Your interview for application ${applicationNumber} (${schemeName}) has been rescheduled to ${dateStr}${timeStr}.`;
    const msgAdmin = `Interview rescheduled for application ${applicationNumber} (${schemeName}) to ${dateStr}${timeStr}.`;

    const relatedEntities = {
      application: application._id,
      scheme: application.scheme?._id,
      project: application.project
    };
    const pushData = { applicationId: String(application._id), type: 'interview_rescheduled' };

    const jobs = [
      ...this._notifyRecipient({
        recipient: {
          beneficiary: application.beneficiary?._id,
          phone: application.beneficiary?.phone,
          user: application.beneficiary?.userId || application.beneficiary?._id
        },
        title, message: msgBeneficiary, category: 'reminder', priority: 'high',
        relatedEntities, pushData, createdBy
      }),
      ...this._notifyAdminRole({
        role: 'unit_admin', filterField: 'adminScope.unit', filterValue: application.unit,
        title, message: msgAdmin, category: 'reminder', priority: 'high',
        relatedEntities, pushData, createdBy
      }),
      ...this._notifyAdminRole({
        role: 'area_admin', filterField: 'adminScope.area', filterValue: application.area,
        title, message: msgAdmin, category: 'reminder', priority: 'high',
        relatedEntities, pushData, createdBy
      }),
      ...this._notifyAdminRole({
        role: 'district_admin', filterField: 'adminScope.district', filterValue: application.district,
        title, message: msgAdmin, category: 'reminder', priority: 'high',
        relatedEntities, pushData, createdBy
      })
    ];

    await Promise.allSettled(jobs);
    return { success: true };
  }

  // --- Area/District Review Required ---
  async notifyAreaReviewRequired(application, { createdBy } = {}) {
    const title = 'Application requires review';
    const schemeName = application.scheme?.name || 'a scheme';
    const beneficiaryName = application.beneficiary?.name || 'A beneficiary';
    const applicationNumber = application.applicationNumber || application._id;
    const message = `Application ${applicationNumber} from ${beneficiaryName} for ${schemeName} requires your review.`;

    const relatedEntities = {
      application: application._id,
      scheme: application.scheme?._id,
      project: application.project
    };
    const pushData = { applicationId: String(application._id), type: 'review_required' };

    const jobs = [
      ...this._notifyAdminRole({
        role: 'area_admin', filterField: 'adminScope.area', filterValue: application.area,
        title, message, category: 'application_status', priority: 'high',
        relatedEntities, pushData, createdBy
      }),
      ...this._notifyAdminRole({
        role: 'district_admin', filterField: 'adminScope.district', filterValue: application.district,
        title, message, category: 'application_status', priority: 'high',
        relatedEntities, pushData, createdBy
      })
    ];

    await Promise.allSettled(jobs);
    return { success: true };
  }

  // --- Stage Reverted ---
  async notifyStageReverted(application, revertedToStage, { revertedBy, reason } = {}) {
    const title = 'Application stage reverted';
    const schemeName = application.scheme?.name || 'a scheme';
    const beneficiaryName = application.beneficiary?.name || 'A beneficiary';
    const applicationNumber = application.applicationNumber || application._id;
    const stageName = revertedToStage || 'a previous stage';

    const msgBeneficiary = `Your application ${applicationNumber} for ${schemeName} has been reverted to "${stageName}". Reason: ${reason || 'Not specified'}.`;
    const msgAdmin = `Application ${applicationNumber} from ${beneficiaryName} for ${schemeName} has been reverted to "${stageName}". Reason: ${reason || 'Not specified'}.`;

    const relatedEntities = {
      application: application._id,
      scheme: application.scheme?._id,
      project: application.project
    };
    const pushData = { applicationId: String(application._id), type: 'stage_reverted', stage: stageName };

    const jobs = [
      ...this._notifyRecipient({
        recipient: {
          beneficiary: application.beneficiary?._id,
          phone: application.beneficiary?.phone,
          user: application.beneficiary?.userId || application.beneficiary?._id
        },
        title, message: msgBeneficiary, category: 'application_status', priority: 'high',
        relatedEntities, pushData, createdBy: revertedBy
      }),
      ...this._notifyAdminRole({
        role: 'unit_admin', filterField: 'adminScope.unit', filterValue: application.unit,
        title, message: msgAdmin, category: 'application_status', priority: 'high',
        relatedEntities, pushData, createdBy: revertedBy
      }),
      ...this._notifyAdminRole({
        role: 'area_admin', filterField: 'adminScope.area', filterValue: application.area,
        title, message: msgAdmin, category: 'application_status', priority: 'high',
        relatedEntities, pushData, createdBy: revertedBy
      }),
      ...this._notifyAdminRole({
        role: 'district_admin', filterField: 'adminScope.district', filterValue: application.district,
        title, message: msgAdmin, category: 'application_status', priority: 'high',
        relatedEntities, pushData, createdBy: revertedBy
      })
    ];

    await Promise.allSettled(jobs);
    return { success: true };
  }

  // --- Application Forwarded (Role-Based Revert) ---
  async notifyApplicationForwarded(application, targetStageName, targetRole, targetUsers, { forwardedBy, reason } = {}) {
    const title = 'Application forwarded for review';
    const schemeName = application.scheme?.name || 'a scheme';
    const beneficiaryName = application.beneficiary?.name || 'A beneficiary';
    const applicationNumber = application.applicationNumber || application._id;
    const stageName = targetStageName || 'a previous stage';
    const roleDisplayName = targetRole ? targetRole.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'admin';

    const msgBeneficiary = `Your application ${applicationNumber} for ${schemeName} has been forwarded back to "${stageName}" for further review. Reason: ${reason || 'Not specified'}.`;
    const msgAdmin = `Application ${applicationNumber} from ${beneficiaryName} for ${schemeName} has been forwarded to you for review at "${stageName}". Please take necessary action. Reason: ${reason || 'Not specified'}.`;

    const relatedEntities = {
      application: application._id,
      scheme: application.scheme?._id,
      project: application.project
    };
    const pushData = { 
      applicationId: String(application._id), 
      type: 'application_forwarded', 
      stage: stageName,
      role: targetRole 
    };

    const jobs = [];

    // Notify beneficiary
    jobs.push(
      ...this._notifyRecipient({
        recipient: {
          beneficiary: application.beneficiary?._id,
          phone: application.beneficiary?.phone,
          user: application.beneficiary?.userId || application.beneficiary?._id
        },
        title, 
        message: msgBeneficiary, 
        category: 'application_status', 
        priority: 'high',
        relatedEntities, 
        pushData, 
        createdBy: forwardedBy
      })
    );

    // Notify specific targeted users
    if (targetUsers && targetUsers.length > 0) {
      targetUsers.forEach(user => {
        jobs.push(
          ...this._notifyRecipient({
            recipient: {
              user: user._id,
              phone: user.phone
            },
            title,
            message: msgAdmin,
            category: 'application_status',
            priority: 'high',
            relatedEntities,
            pushData,
            createdBy: forwardedBy
          })
        );
      });
    } else {
      // Fallback to role-based notification if no specific users found
      const filterFields = {
        'unit_admin': 'adminScope.unit',
        'area_admin': 'adminScope.area',
        'district_admin': 'adminScope.district'
      };
      const filterField = filterFields[targetRole];
      const filterValue = targetRole === 'unit_admin' ? application.unit 
                        : targetRole === 'area_admin' ? application.area 
                        : application.district;

      if (filterField && filterValue) {
        jobs.push(
          ...this._notifyAdminRole({
            role: targetRole,
            filterField,
            filterValue,
            title,
            message: msgAdmin,
            category: 'application_status',
            priority: 'high',
            relatedEntities,
            pushData,
            createdBy: forwardedBy
          })
        );
      }
    }

    await Promise.allSettled(jobs);
    return { success: true };
  }
}

module.exports = new NotificationService();
