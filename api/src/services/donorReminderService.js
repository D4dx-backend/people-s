const { Donor, Donation, DonorFollowUp, User } = require('../models');
const notificationService = require('./notificationService');
const DXingTemplates = require('./dxing/dxingTemplates');
const mongoose = require('mongoose');

/**
 * DonorReminderService - Automated donor follow-up and reminder system
 * 
 * Handles:
 * - Creating follow-ups when donations are completed
 * - Processing daily reminders (7 days before + on due date)
 * - Marking overdue and lapsed donors
 * - Sending WhatsApp + in-app notifications
 * - Auto thank-you messages on donation completion
 * - Engagement score calculation
 */
class DonorReminderService {
  constructor() {
    this.isRunning = false;
    this.systemUserId = null; // Will be resolved on first run
  }

  /**
   * Get or create a system user ID for automated notifications
   * Notifications require a createdBy field
   */
  async getSystemUserId() {
    if (this.systemUserId) return this.systemUserId;

    try {
      // Find any admin user to use as system user for automated notifications
      const adminUser = await User.findOne({ 
        role: { $in: ['state_admin', 'super_admin', 'admin'] } 
      }).select('_id').lean();
      
      if (adminUser) {
        this.systemUserId = adminUser._id;
      }
    } catch (error) {
      console.error('⚠️ Could not find system user for notifications:', error.message);
    }

    return this.systemUserId;
  }

  // ==========================
  // FOLLOW-UP CREATION
  // ==========================

  /**
   * Create a follow-up schedule after a donation is completed
   * @param {string} donationId - The completed donation ID
   * @param {string} createdBy - User who created the donation
   * @returns {Object|null} Created follow-up or null
   */
  async createFollowUp(donationId, createdBy) {
    try {
      const donation = await Donation.findById(donationId)
        .populate('donor', 'name phone email donationPreferences communicationPreferences donationStats');

      if (!donation || !donation.donor) {
        console.log('⏭️ Skipping follow-up: no donor linked to donation');
        return null;
      }

      const donor = donation.donor;

      // Determine frequency from donation preferences, then donor preferences
      let frequency = 'one_time';
      let customIntervalDays = null;

      if (donation.preferences?.isRecurring && donation.preferences?.frequency) {
        frequency = this._mapFrequency(donation.preferences.frequency);
        customIntervalDays = donation.preferences.customIntervalDays || null;
      } else if (donor.donationPreferences?.frequency && donor.donationPreferences.frequency !== 'one-time') {
        frequency = this._mapFrequency(donor.donationPreferences.frequency);
        customIntervalDays = donor.donationPreferences.customIntervalDays || null;
      }

      // Calculate next due date
      const baseDate = donation.timeline?.completedAt || donation.createdAt || new Date();
      const nextDueDate = DonorFollowUp.calculateNextDueDate(baseDate, frequency, customIntervalDays);

      // Determine follow-up type
      const type = frequency === 'one_time' ? 'annual_reminder' : 'recurring_reminder';

      // Check if there's already an active follow-up for this donor
      const existingFollowUp = await DonorFollowUp.findOne({
        donor: donor._id,
        status: { $in: ['scheduled', 'sent_first_reminder', 'sent_final_reminder'] }
      });

      if (existingFollowUp) {
        // Update the existing follow-up instead of creating a new one
        existingFollowUp.nextDueDate = nextDueDate;
        existingFollowUp.status = 'scheduled';
        existingFollowUp.donation = donationId;
        existingFollowUp.expectedAmount = donation.amount;
        existingFollowUp.updatedBy = createdBy;
        await existingFollowUp.save();

        console.log(`🔄 Updated existing follow-up ${existingFollowUp._id} for donor ${donor.name}`);
        
        // Update donor's expected donation date
        await this._updateDonorFollowUpStatus(donor._id, 'active', nextDueDate);

        return existingFollowUp;
      }

      // Create new follow-up
      const followUp = new DonorFollowUp({
        donor: donor._id,
        donation: donationId,
        type,
        status: 'scheduled',
        nextDueDate,
        frequency,
        customIntervalDays,
        expectedAmount: donation.amount,
        createdBy: createdBy
      });

      await followUp.save();

      // Link follow-up to donation
      await Donation.findByIdAndUpdate(donationId, { followUp: followUp._id });

      // Update donor status
      await this._updateDonorFollowUpStatus(donor._id, 'active', nextDueDate);

      console.log(`✅ Follow-up created for donor ${donor.name} - next due: ${nextDueDate.toDateString()} (${frequency})`);

      return followUp;
    } catch (error) {
      console.error('❌ Error creating follow-up:', error);
      return null;
    }
  }

  /**
   * Reschedule a follow-up after a donation is received
   * Pushes the next due date forward by the frequency interval
   * @param {string} followUpId - The follow-up to reschedule
   * @param {string} newDonationId - The new donation that triggered rescheduling
   */
  async rescheduleFollowUp(followUpId, newDonationId) {
    try {
      const followUp = await DonorFollowUp.findById(followUpId);
      if (!followUp) return null;

      const nextDueDate = DonorFollowUp.calculateNextDueDate(
        new Date(),
        followUp.frequency,
        followUp.customIntervalDays
      );

      followUp.status = 'scheduled';
      followUp.nextDueDate = nextDueDate;
      followUp.completedDonation = newDonationId;
      followUp.completedAt = new Date();
      
      // Create a new follow-up for the next cycle
      const newFollowUp = new DonorFollowUp({
        donor: followUp.donor,
        donation: newDonationId,
        type: followUp.type,
        status: 'scheduled',
        nextDueDate,
        frequency: followUp.frequency,
        customIntervalDays: followUp.customIntervalDays,
        expectedAmount: followUp.expectedAmount,
        assignedTo: followUp.assignedTo,
        createdBy: followUp.createdBy
      });

      // Complete the old follow-up
      followUp.status = 'completed';
      followUp.completedAt = new Date();
      await followUp.save();

      // Save the new one
      await newFollowUp.save();

      // Update donor
      await this._updateDonorFollowUpStatus(followUp.donor, 'active', nextDueDate);

      console.log(`🔄 Rescheduled follow-up for donor ${followUp.donor} - next: ${nextDueDate.toDateString()}`);

      return newFollowUp;
    } catch (error) {
      console.error('❌ Error rescheduling follow-up:', error);
      return null;
    }
  }

  // ==========================
  // AUTO THANK-YOU
  // ==========================

  /**
   * Send an automatic thank-you message when a donation is completed
   * @param {string} donationId - The completed donation ID
   * @param {string} createdBy - User who processed the donation
   */
  async sendThankYou(donationId, createdBy) {
    try {
      const donation = await Donation.findById(donationId)
        .populate('donor', 'name phone email communicationPreferences')
        .populate('project', 'name')
        .populate('scheme', 'name');

      if (!donation || !donation.donor) return;

      const donor = donation.donor;
      
      // Check if donor prefers WhatsApp (default to true for thank-you)
      const sendWhatsApp = donor.communicationPreferences?.whatsapp !== false;

      const templateVars = {
        name: donor.name,
        amount: donation.amount.toLocaleString('en-IN'),
        projectName: donation.project?.name || donation.scheme?.name || '',
        receiptNumber: donation.receipt?.receiptNumber || 'Will be shared shortly'
      };

      const message = DXingTemplates.createTemplate('donation_thank_you', templateVars);

      // Send WhatsApp thank-you
      if (sendWhatsApp && donor.phone) {
        try {
          await notificationService.sendNotification({
            type: 'whatsapp',
            recipient: {
              phone: donor.phone,
              name: donor.name
            },
            title: 'Thank You for Your Donation!',
            message,
            category: 'payment',
            priority: 'medium',
            relatedEntities: {
              donation: donationId,
              donor: donor._id,
              project: donation.project?._id,
              scheme: donation.scheme?._id
            },
            createdBy: createdBy
          });
          console.log(`💚 Thank-you WhatsApp sent to ${donor.name}`);
        } catch (err) {
          console.error(`⚠️ Failed to send WhatsApp thank-you to ${donor.name}:`, err.message);
        }
      }

      // Always send in-app notification
      try {
        await notificationService.sendNotification({
          type: 'in_app',
          recipient: {
            name: donor.name,
            phone: donor.phone
          },
          title: 'Thank You for Your Donation!',
          message: `Thank you ${donor.name} for your donation of ₹${donation.amount.toLocaleString('en-IN')}`,
          category: 'payment',
          priority: 'low',
          relatedEntities: {
            donation: donationId,
            donor: donor._id
          },
          createdBy: createdBy
        });
      } catch (err) {
        console.error(`⚠️ Failed to send in-app thank-you:`, err.message);
      }

    } catch (error) {
      console.error('❌ Error sending thank-you:', error);
    }
  }

  // ==========================
  // DAILY REMINDER PROCESSING
  // ==========================

  /**
   * Main method - processes all pending reminders
   * Called daily by the cron scheduler
   */
  async processReminders() {
    if (this.isRunning) {
      console.log('⏳ Donor reminder processing already running, skipping...');
      return;
    }

    this.isRunning = true;
    console.log('🔔 Starting donor reminder processing...');

    const stats = {
      firstReminders: 0,
      finalReminders: 0,
      lapsedNotices: 0,
      errors: 0
    };

    try {
      const systemUserId = await this.getSystemUserId();
      if (!systemUserId) {
        console.error('❌ Cannot process reminders: no system user found');
        return;
      }

      // 1. Process 7-day reminders (first reminder)
      await this._processFirstReminders(systemUserId, stats);

      // 2. Process due-date reminders (final reminder)
      await this._processFinalReminders(systemUserId, stats);

      // 3. Process lapsed donors (30+ days overdue)
      await this._processLapsedFollowUps(systemUserId, stats);

      // 4. Mark overdue follow-ups
      await this._markOverdueFollowUps();

      console.log(`✅ Donor reminder processing complete: ${stats.firstReminders} first, ${stats.finalReminders} final, ${stats.lapsedNotices} lapsed, ${stats.errors} errors`);

    } catch (error) {
      console.error('❌ Donor reminder processing failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Process first reminders (7 days before due date)
   */
  async _processFirstReminders(systemUserId, stats) {
    try {
      const followUps = await DonorFollowUp.getFirstReminderDue();
      console.log(`📋 Found ${followUps.length} follow-ups needing first reminder`);

      for (const followUp of followUps) {
        try {
          const donor = followUp.donor;
          if (!donor) continue;

          const templateVars = {
            name: donor.name,
            amount: (followUp.expectedAmount || 0).toLocaleString('en-IN'),
            frequency: this._getFrequencyLabel(followUp.frequency),
            dueDate: followUp.nextDueDate.toLocaleDateString('en-IN', { 
              day: 'numeric', month: 'long', year: 'numeric' 
            })
          };

          const message = DXingTemplates.createTemplate('donation_reminder_7day', templateVars);

          // Send WhatsApp
          if (donor.phone) {
            try {
              const result = await notificationService.sendNotification({
                type: 'whatsapp',
                recipient: { phone: donor.phone, name: donor.name },
                title: 'Donation Reminder',
                message,
                category: 'reminder',
                priority: 'medium',
                relatedEntities: {
                  donation: followUp.donation,
                  donor: donor._id,
                  donorFollowUp: followUp._id
                },
                createdBy: systemUserId
              });

              followUp.reminders.push({
                sentAt: new Date(),
                channel: 'whatsapp',
                messageId: result.messageId,
                status: result.success ? 'sent' : 'failed',
                reminderType: 'first_reminder'
              });
            } catch (err) {
              console.error(`⚠️ WhatsApp failed for ${donor.name}:`, err.message);
              followUp.reminders.push({
                sentAt: new Date(),
                channel: 'whatsapp',
                status: 'failed',
                reminderType: 'first_reminder',
                notes: err.message
              });
            }
          }

          // Send in-app notification
          try {
            await notificationService.sendNotification({
              type: 'in_app',
              recipient: { name: donor.name, phone: donor.phone },
              title: 'Upcoming Donation Reminder',
              message: `${donor.name}'s ${this._getFrequencyLabel(followUp.frequency)} donation of ₹${(followUp.expectedAmount || 0).toLocaleString('en-IN')} is due on ${followUp.nextDueDate.toLocaleDateString('en-IN')}`,
              category: 'reminder',
              priority: 'medium',
              relatedEntities: {
                donor: donor._id,
                donorFollowUp: followUp._id
              },
              createdBy: systemUserId
            });
          } catch (err) {
            console.error(`⚠️ In-app notification failed for ${donor.name}:`, err.message);
          }

          // Update follow-up status
          followUp.status = 'sent_first_reminder';
          followUp.lastReminderSent = new Date();
          await followUp.save();

          // Update donor status
          await this._updateDonorFollowUpStatus(donor._id, 'pending_reminder');

          stats.firstReminders++;
          console.log(`📩 First reminder sent to ${donor.name} (due: ${followUp.nextDueDate.toDateString()})`);

        } catch (err) {
          stats.errors++;
          console.error(`❌ Error processing first reminder for follow-up ${followUp._id}:`, err);
        }
      }
    } catch (error) {
      console.error('❌ Error fetching first reminders:', error);
    }
  }

  /**
   * Process final reminders (on the due date)
   */
  async _processFinalReminders(systemUserId, stats) {
    try {
      const followUps = await DonorFollowUp.getFinalReminderDue();
      console.log(`📋 Found ${followUps.length} follow-ups needing final reminder`);

      for (const followUp of followUps) {
        try {
          const donor = followUp.donor;
          if (!donor) continue;

          const templateVars = {
            name: donor.name,
            amount: (followUp.expectedAmount || 0).toLocaleString('en-IN'),
            frequency: this._getFrequencyLabel(followUp.frequency),
            orgName: "People's Foundation"
          };

          const message = DXingTemplates.createTemplate('donation_reminder_due', templateVars);

          // Send WhatsApp
          if (donor.phone) {
            try {
              const result = await notificationService.sendNotification({
                type: 'whatsapp',
                recipient: { phone: donor.phone, name: donor.name },
                title: 'Donation Due Today',
                message,
                category: 'reminder',
                priority: 'high',
                relatedEntities: {
                  donation: followUp.donation,
                  donor: donor._id,
                  donorFollowUp: followUp._id
                },
                createdBy: systemUserId
              });

              followUp.reminders.push({
                sentAt: new Date(),
                channel: 'whatsapp',
                messageId: result.messageId,
                status: result.success ? 'sent' : 'failed',
                reminderType: 'final_reminder'
              });
            } catch (err) {
              console.error(`⚠️ WhatsApp failed for ${donor.name}:`, err.message);
            }
          }

          // Send in-app
          try {
            await notificationService.sendNotification({
              type: 'in_app',
              recipient: { name: donor.name, phone: donor.phone },
              title: 'Donation Due Today',
              message: `${donor.name}'s ${this._getFrequencyLabel(followUp.frequency)} donation of ₹${(followUp.expectedAmount || 0).toLocaleString('en-IN')} is due today`,
              category: 'reminder',
              priority: 'high',
              relatedEntities: {
                donor: donor._id,
                donorFollowUp: followUp._id
              },
              createdBy: systemUserId
            });
          } catch (err) {
            console.error(`⚠️ In-app failed for ${donor.name}:`, err.message);
          }

          followUp.status = 'sent_final_reminder';
          followUp.lastReminderSent = new Date();
          await followUp.save();

          stats.finalReminders++;
          console.log(`📩 Final reminder sent to ${donor.name} (due today)`);

        } catch (err) {
          stats.errors++;
          console.error(`❌ Error processing final reminder for follow-up ${followUp._id}:`, err);
        }
      }
    } catch (error) {
      console.error('❌ Error fetching final reminders:', error);
    }
  }

  /**
   * Process lapsed follow-ups (30+ days past due)
   */
  async _processLapsedFollowUps(systemUserId, stats) {
    try {
      const followUps = await DonorFollowUp.getLapsedDue();
      console.log(`📋 Found ${followUps.length} follow-ups to mark as lapsed`);

      for (const followUp of followUps) {
        try {
          const donor = followUp.donor;
          if (!donor) continue;

          const templateVars = {
            name: donor.name,
            amount: (followUp.expectedAmount || 0).toLocaleString('en-IN'),
            lastDonationDate: donor.donationStats?.lastDonation 
              ? new Date(donor.donationStats.lastDonation).toLocaleDateString('en-IN', {
                  day: 'numeric', month: 'long', year: 'numeric'
                })
              : 'a while ago'
          };

          const message = DXingTemplates.createTemplate('donation_lapsed', templateVars);

          // Send lapsed notice via WhatsApp
          if (donor.phone) {
            try {
              const result = await notificationService.sendNotification({
                type: 'whatsapp',
                recipient: { phone: donor.phone, name: donor.name },
                title: 'We Miss Your Support!',
                message,
                category: 'reminder',
                priority: 'low',
                relatedEntities: {
                  donor: donor._id,
                  donorFollowUp: followUp._id
                },
                createdBy: systemUserId
              });

              followUp.reminders.push({
                sentAt: new Date(),
                channel: 'whatsapp',
                messageId: result.messageId,
                status: result.success ? 'sent' : 'failed',
                reminderType: 'lapsed_notice'
              });
            } catch (err) {
              console.error(`⚠️ Lapsed WhatsApp failed for ${donor.name}:`, err.message);
            }
          }

          // Send in-app
          try {
            await notificationService.sendNotification({
              type: 'in_app',
              recipient: { name: donor.name, phone: donor.phone },
              title: 'Donor Lapsed - Follow-up Required',
              message: `${donor.name} has not donated for 30+ days past the expected date. Consider manual follow-up.`,
              category: 'alert',
              priority: 'high',
              relatedEntities: {
                donor: donor._id,
                donorFollowUp: followUp._id
              },
              createdBy: systemUserId
            });
          } catch (err) {
            console.error(`⚠️ In-app failed for ${donor.name}:`, err.message);
          }

          followUp.status = 'lapsed';
          followUp.lastReminderSent = new Date();
          await followUp.save();

          // Update donor status
          await this._updateDonorFollowUpStatus(donor._id, 'lapsed');

          stats.lapsedNotices++;
          console.log(`⚠️ Donor ${donor.name} marked as lapsed`);

        } catch (err) {
          stats.errors++;
          console.error(`❌ Error processing lapsed follow-up ${followUp._id}:`, err);
        }
      }
    } catch (error) {
      console.error('❌ Error fetching lapsed follow-ups:', error);
    }
  }

  /**
   * Mark follow-ups as overdue (past due but within 30-day window)
   */
  async _markOverdueFollowUps() {
    try {
      const now = new Date();
      const result = await DonorFollowUp.updateMany(
        {
          status: { $in: ['sent_first_reminder', 'sent_final_reminder'] },
          nextDueDate: { $lt: now },
          lapsedDate: { $gt: now }
        },
        {
          $set: { status: 'overdue' }
        }
      );

      if (result.modifiedCount > 0) {
        console.log(`⏰ Marked ${result.modifiedCount} follow-ups as overdue`);
        
        // Update donor statuses for overdue follow-ups
        const overdueFollowUps = await DonorFollowUp.find({
          status: 'overdue'
        }).select('donor').lean();

        const donorIds = [...new Set(overdueFollowUps.map(f => f.donor.toString()))];
        await Donor.updateMany(
          { _id: { $in: donorIds } },
          { $set: { followUpStatus: 'overdue' } }
        );
      }
    } catch (error) {
      console.error('❌ Error marking overdue follow-ups:', error);
    }
  }

  // ==========================
  // MATCH DONATION TO FOLLOW-UP
  // ==========================

  /**
   * When a new donation comes in, check if it matches a pending follow-up
   * If so, complete the follow-up and create a new one
   * @param {string} donorId
   * @param {string} donationId
   * @param {string} createdBy
   */
  async matchDonationToFollowUp(donorId, donationId, createdBy) {
    try {
      const pendingFollowUp = await DonorFollowUp.findOne({
        donor: donorId,
        status: { $in: ['scheduled', 'sent_first_reminder', 'sent_final_reminder', 'overdue'] }
      }).sort({ nextDueDate: 1 });

      if (pendingFollowUp) {
        // This donation fulfills the pending follow-up
        await this.rescheduleFollowUp(pendingFollowUp._id, donationId);
        console.log(`✅ Donation matched to follow-up ${pendingFollowUp._id} for donor ${donorId}`);
        return true;
      }

      // No pending follow-up — create a new one
      await this.createFollowUp(donationId, createdBy);
      return false;
    } catch (error) {
      console.error('❌ Error matching donation to follow-up:', error);
      return false;
    }
  }

  // ==========================
  // ENGAGEMENT SCORING
  // ==========================

  /**
   * Calculate engagement score for a donor (0-100)
   * Based on: frequency adherence, recency, total amount, consistency
   */
  async calculateEngagementScore(donorId) {
    try {
      const donor = await Donor.findById(donorId);
      if (!donor) return 0;

      let score = 0;

      // Recency (0-30 points) - based on last donation
      if (donor.donationStats?.lastDonation) {
        const daysSinceLastDonation = Math.floor(
          (Date.now() - new Date(donor.donationStats.lastDonation).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSinceLastDonation <= 30) score += 30;
        else if (daysSinceLastDonation <= 90) score += 25;
        else if (daysSinceLastDonation <= 180) score += 15;
        else if (daysSinceLastDonation <= 365) score += 10;
        else score += 5;
      }

      // Frequency / consistency (0-25 points)
      const completedFollowUps = await DonorFollowUp.countDocuments({
        donor: donorId,
        status: 'completed'
      });
      const totalFollowUps = await DonorFollowUp.countDocuments({
        donor: donorId,
        status: { $in: ['completed', 'lapsed', 'overdue'] }
      });

      if (totalFollowUps > 0) {
        const adherenceRate = completedFollowUps / totalFollowUps;
        score += Math.round(adherenceRate * 25);
      }

      // Donation count (0-20 points)
      const donationCount = donor.donationStats?.donationCount || 0;
      if (donationCount >= 12) score += 20;
      else if (donationCount >= 6) score += 15;
      else if (donationCount >= 3) score += 10;
      else if (donationCount >= 1) score += 5;

      // Total amount (0-15 points)
      const totalDonated = donor.donationStats?.totalDonated || 0;
      if (totalDonated >= 500000) score += 15;
      else if (totalDonated >= 100000) score += 12;
      else if (totalDonated >= 50000) score += 9;
      else if (totalDonated >= 10000) score += 6;
      else if (totalDonated >= 1000) score += 3;

      // Communication engagement (0-10 points)
      const contactCount = donor.engagement?.contactCount || 0;
      score += Math.min(contactCount * 2, 10);

      // Cap at 100
      score = Math.min(score, 100);

      // Update donor
      await Donor.findByIdAndUpdate(donorId, { engagementScore: score });

      return score;
    } catch (error) {
      console.error('❌ Error calculating engagement score:', error);
      return 0;
    }
  }

  // ==========================
  // MANUAL REMINDER
  // ==========================

  /**
   * Send a manual reminder to a specific donor
   * @param {string} donorId - Donor to remind
   * @param {string} sentBy - User sending the reminder
   * @param {string} templateType - Template to use
   * @param {Object} customVars - Additional template variables
   */
  async sendManualReminder(donorId, sentBy, templateType = 'donation_reminder_due', customVars = {}) {
    try {
      const donor = await Donor.findById(donorId);
      if (!donor) throw new Error('Donor not found');

      const templateVars = {
        name: donor.name,
        amount: (donor.donationPreferences?.preferredAmount || donor.donationStats?.averageDonation || 0).toLocaleString('en-IN'),
        frequency: this._getFrequencyLabel(donor.donationPreferences?.frequency || 'one-time'),
        dueDate: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
        lastDonationDate: donor.donationStats?.lastDonation 
          ? new Date(donor.donationStats.lastDonation).toLocaleDateString('en-IN')
          : 'N/A',
        orgName: "People's Foundation",
        ...customVars
      };

      const message = DXingTemplates.createTemplate(templateType, templateVars);
      const results = { whatsapp: null, inApp: null };

      // Send WhatsApp
      if (donor.phone) {
        try {
          results.whatsapp = await notificationService.sendNotification({
            type: 'whatsapp',
            recipient: { phone: donor.phone, name: donor.name },
            title: 'Donation Reminder',
            message,
            category: 'reminder',
            priority: 'medium',
            relatedEntities: { donor: donor._id },
            createdBy: sentBy
          });
        } catch (err) {
          console.error(`⚠️ Manual WhatsApp failed for ${donor.name}:`, err.message);
        }
      }

      // Send in-app
      try {
        results.inApp = await notificationService.sendNotification({
          type: 'in_app',
          recipient: { name: donor.name, phone: donor.phone },
          title: 'Donation Reminder Sent',
          message: `Manual reminder sent to ${donor.name}`,
          category: 'reminder',
          priority: 'medium',
          relatedEntities: { donor: donor._id },
          createdBy: sentBy
        });
      } catch (err) {
        console.error(`⚠️ In-app failed:`, err.message);
      }

      // Update engagement contact count
      await Donor.findByIdAndUpdate(donorId, {
        'engagement.lastContact': new Date(),
        $inc: { 'engagement.contactCount': 1 }
      });

      // If there's a pending follow-up, log the manual reminder
      const activeFollowUp = await DonorFollowUp.findOne({
        donor: donorId,
        status: { $in: ['scheduled', 'sent_first_reminder', 'sent_final_reminder', 'overdue'] }
      });

      if (activeFollowUp) {
        activeFollowUp.reminders.push({
          sentAt: new Date(),
          channel: 'whatsapp',
          status: results.whatsapp?.success ? 'sent' : 'failed',
          reminderType: 'custom',
          sentBy: sentBy,
          notes: 'Manual reminder'
        });
        activeFollowUp.lastReminderSent = new Date();
        await activeFollowUp.save();
      }

      return results;
    } catch (error) {
      console.error('❌ Error sending manual reminder:', error);
      throw error;
    }
  }

  // ==========================
  // HELPER METHODS
  // ==========================

  /**
   * Map donation frequency strings to follow-up frequency values
   */
  _mapFrequency(donationFrequency) {
    const map = {
      'one-time': 'one_time',
      'monthly': 'monthly',
      'quarterly': 'quarterly',
      'half_yearly': 'half_yearly',
      'yearly': 'yearly',
      'custom': 'custom'
    };
    return map[donationFrequency] || 'one_time';
  }

  /**
   * Get human-readable frequency label
   */
  _getFrequencyLabel(frequency) {
    const labels = {
      'monthly': 'monthly',
      'quarterly': 'quarterly',
      'half_yearly': 'half-yearly',
      'yearly': 'yearly',
      'one_time': 'annual',
      'custom': 'scheduled'
    };
    return labels[frequency] || 'scheduled';
  }

  /**
   * Update donor's follow-up status and next expected donation date
   */
  async _updateDonorFollowUpStatus(donorId, status, nextExpectedDonation = null) {
    try {
      const update = { followUpStatus: status };
      if (nextExpectedDonation) {
        update.nextExpectedDonation = nextExpectedDonation;
      }
      await Donor.findByIdAndUpdate(donorId, update);
    } catch (error) {
      console.error('❌ Error updating donor follow-up status:', error);
    }
  }

  /**
   * Format date for display in messages
   */
  _formatDate(date) {
    return new Date(date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }
}

module.exports = new DonorReminderService();
