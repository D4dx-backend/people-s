const Application = require('../models/Application');
const Scheme = require('../models/Scheme');
const notificationService = require('./notificationService');

class RenewalCheckerService {
  constructor() {
    this.isRunning = false;
  }

  /**
   * Check applications approaching renewal due date and send notifications
   * Called periodically (e.g., every 6 hours)
   */
  async checkAndNotifyRenewals() {
    if (this.isRunning) {
      console.log('⏳ Renewal check already running, skipping...');
      return;
    }

    this.isRunning = true;
    console.log('🔄 Starting renewal check...');

    try {
      const now = new Date();

      // Find applications where:
      // - renewalStatus is 'active'
      // - renewalDueDate has passed (notification should be sent)
      // - renewalNotificationSent is false
      // - expiryDate is in the future (not yet expired)
      const dueApplications = await Application.find({
        renewalStatus: 'active',
        renewalDueDate: { $lte: now },
        expiryDate: { $gt: now },
        renewalNotificationSent: false
      })
        .populate('beneficiary', 'name phone')
        .populate('scheme', 'name code renewalSettings');

      console.log(`📋 Found ${dueApplications.length} applications due for renewal notification`);

      for (const application of dueApplications) {
        try {
          // Update status to due_for_renewal
          application.renewalStatus = 'due_for_renewal';
          application.renewalNotificationSent = true;
          await application.save();

          // Send in-app notification to the beneficiary
          if (application.beneficiary) {
            const daysUntilExpiry = Math.ceil((application.expiryDate - now) / (1000 * 60 * 60 * 24));

            await notificationService.sendNotification({
              type: 'in_app',
              recipient: {
                user: application.createdBy,
                phone: application.beneficiary.phone,
                name: application.beneficiary.name
              },
              title: 'Application Renewal Due',
              message: `Your application ${application.applicationNumber} for ${application.scheme?.name || 'scheme'} is due for renewal. It expires in ${daysUntilExpiry} days. Please renew your application to continue receiving benefits.`,
              category: 'reminder',
              priority: daysUntilExpiry <= 7 ? 'high' : 'medium',
              relatedEntities: {
                application: application._id,
                scheme: application.scheme?._id
              }
            });

            console.log(`✅ Renewal notification sent for application ${application.applicationNumber}`);
          }
        } catch (err) {
          console.error(`❌ Error processing renewal for ${application.applicationNumber}:`, err);
        }
      }

      // Also update applications that have expired
      await this.updateExpiredApplications();

      console.log('✅ Renewal check completed');
    } catch (error) {
      console.error('❌ Renewal check failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Mark applications past their expiry date as expired
   */
  async updateExpiredApplications() {
    try {
      const now = new Date();

      const result = await Application.updateMany(
        {
          renewalStatus: { $in: ['active', 'due_for_renewal'] },
          expiryDate: { $lte: now }
        },
        {
          $set: { renewalStatus: 'expired' }
        }
      );

      if (result.modifiedCount > 0) {
        console.log(`⏰ Marked ${result.modifiedCount} applications as expired`);
      }
    } catch (error) {
      console.error('❌ Error updating expired applications:', error);
    }
  }

  /**
   * Start periodic renewal checking
   * @param {number} intervalMs - Check interval in milliseconds (default: 6 hours)
   */
  startPeriodicCheck(intervalMs = 6 * 60 * 60 * 1000) {
    console.log(`⏰ Starting periodic renewal check every ${intervalMs / (60 * 60 * 1000)} hours`);

    // Run immediately on startup (with a small delay to let DB connect)
    setTimeout(() => {
      this.checkAndNotifyRenewals();
    }, 10000);

    // Then run periodically
    this.intervalId = setInterval(() => {
      this.checkAndNotifyRenewals();
    }, intervalMs);
  }

  /**
   * Stop periodic checking
   */
  stopPeriodicCheck() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('⏹️ Periodic renewal check stopped');
    }
  }
}

module.exports = new RenewalCheckerService();
