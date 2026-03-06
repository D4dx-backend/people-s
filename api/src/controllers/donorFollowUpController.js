const { DonorFollowUp, Donor, Donation } = require('../models');
const ResponseHelper = require('../utils/responseHelper');
const donorReminderService = require('../services/donorReminderService');
const mongoose = require('mongoose');
const { buildFranchiseReadFilter, buildFranchiseMatchStage, getWriteFranchiseId } = require('../utils/franchiseFilterHelper');

class DonorFollowUpController {
  /**
   * Get all follow-ups with pagination and filtering
   * GET /api/donor-followups
   */
  async getFollowUps(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        status = '',
        assignedTo = '',
        frequency = '',
        type = '',
        dateFrom = '',
        dateTo = '',
        search = '',
        sortBy = 'nextDueDate',
        sortOrder = 'asc'
      } = req.query;

      const filter = {};

      if (status) filter.status = status;
      if (assignedTo) filter.assignedTo = assignedTo;
      if (frequency) filter.frequency = frequency;
      if (type) filter.type = type;

      if (dateFrom || dateTo) {
        filter.nextDueDate = {};
        if (dateFrom) filter.nextDueDate.$gte = new Date(dateFrom);
        if (dateTo) filter.nextDueDate.$lte = new Date(dateTo);
      }

      // Search by donor name
      if (search) {
        const donors = await Donor.find({
          ...buildFranchiseReadFilter(req),
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { phone: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } }
          ]
        }).select('_id');
        filter.donor = { $in: donors.map(d => d._id) };
      }

      // Franchise scope
      Object.assign(filter, buildFranchiseReadFilter(req));

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      const sort = {};
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const [followUps, total] = await Promise.all([
        DonorFollowUp.find(filter)
          .populate('donor', 'name email phone type category donationStats followUpStatus engagementScore')
          .populate('donation', 'amount method donationNumber')
          .populate('assignedTo', 'name email')
          .populate('createdBy', 'name email')
          .sort(sort)
          .skip(skip)
          .limit(limitNum)
          .lean(),
        DonorFollowUp.countDocuments(filter)
      ]);

      return ResponseHelper.success(res, {
        followUps,
        pagination: {
          current: pageNum,
          pages: Math.ceil(total / limitNum),
          total,
          limit: limitNum
        }
      });
    } catch (error) {
      console.error('❌ Get Follow-ups Error:', error);
      return ResponseHelper.error(res, 'Failed to fetch follow-ups', 500);
    }
  }

  /**
   * Get dashboard statistics
   * GET /api/donor-followups/dashboard
   */
  async getDashboardStats(req, res) {
    try {
      const now = new Date();
      const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [
        totalScheduled,
        dueThisWeek,
        overdue,
        lapsed,
        completedThisMonth,
        totalActive,
        byStatus,
        byFrequency
      ] = await Promise.all([
        DonorFollowUp.countDocuments({ status: 'scheduled' }),
        DonorFollowUp.countDocuments({
          status: { $in: ['scheduled', 'sent_first_reminder'] },
          nextDueDate: { $gte: now, $lte: weekFromNow }
        }),
        DonorFollowUp.countDocuments({ status: 'overdue' }),
        DonorFollowUp.countDocuments({ status: 'lapsed' }),
        DonorFollowUp.countDocuments({
          status: 'completed',
          completedAt: { $gte: startOfMonth }
        }),
        DonorFollowUp.countDocuments({
          status: { $in: ['scheduled', 'sent_first_reminder', 'sent_final_reminder', 'overdue'] }
        }),
        DonorFollowUp.aggregate([
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ]),
        DonorFollowUp.aggregate([
          { 
            $match: { status: { $in: ['scheduled', 'sent_first_reminder', 'sent_final_reminder', 'overdue'] } }
          },
          { $group: { _id: '$frequency', count: { $sum: 1 }, totalExpected: { $sum: '$expectedAmount' } } }
        ])
      ]);

      // Get total expected amount for active follow-ups
      const [expectedAmountResult] = await DonorFollowUp.aggregate([
        { 
          $match: { status: { $in: ['scheduled', 'sent_first_reminder', 'sent_final_reminder'] } }
        },
        { $group: { _id: null, total: { $sum: '$expectedAmount' } } }
      ]);

      return ResponseHelper.success(res, {
        stats: {
          totalScheduled,
          dueThisWeek,
          overdue,
          lapsed,
          completedThisMonth,
          totalActive,
          expectedAmount: expectedAmountResult?.total || 0,
          byStatus: byStatus.reduce((acc, s) => { acc[s._id] = s.count; return acc; }, {}),
          byFrequency: byFrequency.map(f => ({
            frequency: f._id,
            count: f.count,
            totalExpected: f.totalExpected
          }))
        }
      });
    } catch (error) {
      console.error('❌ Get Dashboard Stats Error:', error);
      return ResponseHelper.error(res, 'Failed to fetch dashboard stats', 500);
    }
  }

  /**
   * Get upcoming follow-ups (due in next N days)
   * GET /api/donor-followups/upcoming
   */
  async getUpcoming(req, res) {
    try {
      const { days = 7, limit = 50 } = req.query;
      const now = new Date();
      const futureDate = new Date(now.getTime() + parseInt(days) * 24 * 60 * 60 * 1000);

      const followUps = await DonorFollowUp.find({
        status: { $in: ['scheduled', 'sent_first_reminder'] },
        nextDueDate: { $gte: now, $lte: futureDate }
      })
        .populate('donor', 'name email phone type category donationStats engagementScore')
        .populate('donation', 'amount method donationNumber')
        .populate('assignedTo', 'name email')
        .sort({ nextDueDate: 1 })
        .limit(parseInt(limit))
        .lean();

      return ResponseHelper.success(res, { followUps, days: parseInt(days) });
    } catch (error) {
      console.error('❌ Get Upcoming Error:', error);
      return ResponseHelper.error(res, 'Failed to fetch upcoming follow-ups', 500);
    }
  }

  /**
   * Get overdue follow-ups
   * GET /api/donor-followups/overdue
   */
  async getOverdue(req, res) {
    try {
      const { limit = 50 } = req.query;

      const followUps = await DonorFollowUp.find({
        status: { $in: ['overdue', 'sent_final_reminder'] },
        nextDueDate: { $lt: new Date() }
      })
        .populate('donor', 'name email phone type category donationStats engagementScore')
        .populate('donation', 'amount method donationNumber')
        .populate('assignedTo', 'name email')
        .sort({ nextDueDate: 1 })
        .limit(parseInt(limit))
        .lean();

      return ResponseHelper.success(res, { followUps });
    } catch (error) {
      console.error('❌ Get Overdue Error:', error);
      return ResponseHelper.error(res, 'Failed to fetch overdue follow-ups', 500);
    }
  }

  /**
   * Get lapsed donors
   * GET /api/donor-followups/lapsed
   */
  async getLapsed(req, res) {
    try {
      const { limit = 50 } = req.query;

      const followUps = await DonorFollowUp.find({
        status: 'lapsed'
      })
        .populate('donor', 'name email phone type category donationStats engagementScore')
        .populate('donation', 'amount method donationNumber')
        .populate('assignedTo', 'name email')
        .sort({ lapsedDate: -1 })
        .limit(parseInt(limit))
        .lean();

      return ResponseHelper.success(res, { followUps });
    } catch (error) {
      console.error('❌ Get Lapsed Error:', error);
      return ResponseHelper.error(res, 'Failed to fetch lapsed donors', 500);
    }
  }

  /**
   * Get single follow-up by ID
   * GET /api/donor-followups/:id
   */
  async getFollowUpById(req, res) {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return ResponseHelper.error(res, 'Invalid follow-up ID', 400);
      }

      const followUp = await DonorFollowUp.findOne({ _id: id, ...buildFranchiseReadFilter(req) })
        .populate('donor', 'name email phone type category address donationStats communicationPreferences engagementScore followUpStatus')
        .populate('donation', 'amount method donationNumber status timeline')
        .populate('assignedTo', 'name email phone')
        .populate('assignedBy', 'name email')
        .populate('completedDonation', 'amount method donationNumber')
        .populate('createdBy', 'name email')
        .populate('reminders.sentBy', 'name email')
        .populate('staffNotes.addedBy', 'name email');

      if (!followUp) {
        return ResponseHelper.error(res, 'Follow-up not found', 404);
      }

      return ResponseHelper.success(res, { followUp });
    } catch (error) {
      console.error('❌ Get Follow-up Error:', error);
      return ResponseHelper.error(res, 'Failed to fetch follow-up', 500);
    }
  }

  /**
   * Create a manual follow-up
   * POST /api/donor-followups
   */
  async createFollowUp(req, res) {
    try {
      const { donor, nextDueDate, frequency, customIntervalDays, expectedAmount, notes, assignedTo, type } = req.body;

      if (!donor || !nextDueDate || !frequency) {
        return ResponseHelper.error(res, 'Donor, nextDueDate, and frequency are required', 400);
      }

      if (!mongoose.Types.ObjectId.isValid(donor)) {
        return ResponseHelper.error(res, 'Invalid donor ID', 400);
      }

      const donorDoc = await Donor.findOne({ _id: donor, franchise: req.franchiseId });
      if (!donorDoc) {
        return ResponseHelper.error(res, 'Donor not found', 404);
      }

      const followUp = new DonorFollowUp({
        donor,
        type: type || 'custom',
        status: 'scheduled',
        nextDueDate: new Date(nextDueDate),
        frequency,
        customIntervalDays: frequency === 'custom' ? customIntervalDays : null,
        expectedAmount: expectedAmount || donorDoc.donationPreferences?.preferredAmount || 0,
        notes,
        assignedTo: assignedTo || null,
        assignedAt: assignedTo ? new Date() : null,
        assignedBy: assignedTo ? req.user._id : null,
        createdBy: req.user._id,
        franchise: req.franchiseId || null  // Multi-tenant
      });

      await followUp.save();

      // Update donor status
      await Donor.findOneAndUpdate({ _id: donor, franchise: req.franchiseId }, {
        followUpStatus: 'active',
        nextExpectedDonation: new Date(nextDueDate)
      });

      await followUp.populate([
        { path: 'donor', select: 'name email phone' },
        { path: 'assignedTo', select: 'name email' }
      ]);

      return ResponseHelper.success(res, { followUp }, 'Follow-up created successfully', 201);
    } catch (error) {
      console.error('❌ Create Follow-up Error:', error);
      return ResponseHelper.error(res, 'Failed to create follow-up', 500);
    }
  }

  /**
   * Update a follow-up
   * PUT /api/donor-followups/:id
   */
  async updateFollowUp(req, res) {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return ResponseHelper.error(res, 'Invalid follow-up ID', 400);
      }

      const updateData = { ...req.body, updatedBy: req.user._id };
      delete updateData.createdBy;
      delete updateData.createdAt;
      delete updateData.reminders; // Don't allow manual reminder history edits

      const followUp = await DonorFollowUp.findOneAndUpdate(
        { _id: id, franchise: req.franchiseId },
        updateData,
        { new: true, runValidators: true }
      )
        .populate('donor', 'name email phone')
        .populate('assignedTo', 'name email');

      if (!followUp) {
        return ResponseHelper.error(res, 'Follow-up not found', 404);
      }

      return ResponseHelper.success(res, { followUp }, 'Follow-up updated successfully');
    } catch (error) {
      console.error('❌ Update Follow-up Error:', error);
      return ResponseHelper.error(res, 'Failed to update follow-up', 500);
    }
  }

  /**
   * Assign a follow-up to a staff member
   * PATCH /api/donor-followups/:id/assign
   */
  async assignFollowUp(req, res) {
    try {
      const { id } = req.params;
      const { assignedTo } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return ResponseHelper.error(res, 'Invalid follow-up ID', 400);
      }
      if (!assignedTo || !mongoose.Types.ObjectId.isValid(assignedTo)) {
        return ResponseHelper.error(res, 'Valid assignedTo user ID is required', 400);
      }

      const followUp = await DonorFollowUp.findOneAndUpdate(
        { _id: id, franchise: req.franchiseId },
        {
          assignedTo,
          assignedAt: new Date(),
          assignedBy: req.user._id,
          updatedBy: req.user._id
        },
        { new: true }
      )
        .populate('donor', 'name email phone')
        .populate('assignedTo', 'name email');

      if (!followUp) {
        return ResponseHelper.error(res, 'Follow-up not found', 404);
      }

      return ResponseHelper.success(res, { followUp }, 'Follow-up assigned successfully');
    } catch (error) {
      console.error('❌ Assign Follow-up Error:', error);
      return ResponseHelper.error(res, 'Failed to assign follow-up', 500);
    }
  }

  /**
   * Mark a follow-up as completed (manual)
   * PATCH /api/donor-followups/:id/complete
   */
  async completeFollowUp(req, res) {
    try {
      const { id } = req.params;
      const { notes } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return ResponseHelper.error(res, 'Invalid follow-up ID', 400);
      }

      const followUp = await DonorFollowUp.findOne({ _id: id, franchise: req.franchiseId });
      if (!followUp) {
        return ResponseHelper.error(res, 'Follow-up not found', 404);
      }

      followUp.status = 'completed';
      followUp.completedAt = new Date();
      followUp.updatedBy = req.user._id;

      if (notes) {
        followUp.staffNotes.push({
          note: notes,
          addedBy: req.user._id,
          addedAt: new Date()
        });
      }

      await followUp.save();

      // Update donor status
      const nextActiveFollowUp = await DonorFollowUp.findOne({
        donor: followUp.donor,
        status: { $in: ['scheduled', 'sent_first_reminder', 'sent_final_reminder'] },
        _id: { $ne: id }
      });

      if (!nextActiveFollowUp) {
        await Donor.findOneAndUpdate({ _id: followUp.donor, franchise: req.franchiseId }, {
          followUpStatus: 'no_followup',
          nextExpectedDonation: null
        });
      }

      await followUp.populate([
        { path: 'donor', select: 'name email phone' }
      ]);

      return ResponseHelper.success(res, { followUp }, 'Follow-up marked as completed');
    } catch (error) {
      console.error('❌ Complete Follow-up Error:', error);
      return ResponseHelper.error(res, 'Failed to complete follow-up', 500);
    }
  }

  /**
   * Cancel a follow-up
   * PATCH /api/donor-followups/:id/cancel
   */
  async cancelFollowUp(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return ResponseHelper.error(res, 'Invalid follow-up ID', 400);
      }

      const followUp = await DonorFollowUp.findOne({ _id: id, franchise: req.franchiseId });
      if (!followUp) {
        return ResponseHelper.error(res, 'Follow-up not found', 404);
      }

      followUp.status = 'cancelled';
      followUp.updatedBy = req.user._id;

      if (reason) {
        followUp.staffNotes.push({
          note: `Cancelled: ${reason}`,
          addedBy: req.user._id,
          addedAt: new Date()
        });
      }

      await followUp.save();

      // Check if donor has other active follow-ups
      const otherActive = await DonorFollowUp.findOne({
        donor: followUp.donor,
        status: { $in: ['scheduled', 'sent_first_reminder', 'sent_final_reminder'] },
        _id: { $ne: id }
      });

      if (!otherActive) {
        await Donor.findOneAndUpdate({ _id: followUp.donor, franchise: req.franchiseId }, {
          followUpStatus: 'no_followup',
          nextExpectedDonation: null
        });
      }

      return ResponseHelper.success(res, { followUp }, 'Follow-up cancelled');
    } catch (error) {
      console.error('❌ Cancel Follow-up Error:', error);
      return ResponseHelper.error(res, 'Failed to cancel follow-up', 500);
    }
  }

  /**
   * Add a staff note to a follow-up
   * POST /api/donor-followups/:id/notes
   */
  async addNote(req, res) {
    try {
      const { id } = req.params;
      const { note } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return ResponseHelper.error(res, 'Invalid follow-up ID', 400);
      }
      if (!note) {
        return ResponseHelper.error(res, 'Note text is required', 400);
      }

      const followUp = await DonorFollowUp.findOneAndUpdate(
        { _id: id, franchise: req.franchiseId },
        {
          $push: {
            staffNotes: {
              note,
              addedBy: req.user._id,
              addedAt: new Date()
            }
          },
          updatedBy: req.user._id
        },
        { new: true }
      )
        .populate('staffNotes.addedBy', 'name email');

      if (!followUp) {
        return ResponseHelper.error(res, 'Follow-up not found', 404);
      }

      return ResponseHelper.success(res, { followUp }, 'Note added successfully');
    } catch (error) {
      console.error('❌ Add Note Error:', error);
      return ResponseHelper.error(res, 'Failed to add note', 500);
    }
  }

  /**
   * Send a manual reminder to a donor
   * POST /api/donor-followups/:id/send-reminder
   */
  async sendReminder(req, res) {
    try {
      const { id } = req.params;
      const { templateType } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return ResponseHelper.error(res, 'Invalid follow-up ID', 400);
      }

      const followUp = await DonorFollowUp.findOne({ _id: id, franchise: req.franchiseId }).populate('donor', 'name phone email');
      if (!followUp) {
        return ResponseHelper.error(res, 'Follow-up not found', 404);
      }

      const results = await donorReminderService.sendManualReminder(
        followUp.donor._id,
        req.user._id,
        templateType || 'donation_reminder_due'
      );

      return ResponseHelper.success(res, { results }, 'Reminder sent successfully');
    } catch (error) {
      console.error('❌ Send Reminder Error:', error);
      return ResponseHelper.error(res, 'Failed to send reminder', 500);
    }
  }

  /**
   * Send manual reminder to a specific donor (from donor page)
   * POST /api/donors/:id/send-reminder
   */
  async sendDonorReminder(req, res) {
    try {
      const { id } = req.params;
      const { templateType } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return ResponseHelper.error(res, 'Invalid donor ID', 400);
      }

      const donor = await Donor.findOne({ _id: id, franchise: req.franchiseId });
      if (!donor) {
        return ResponseHelper.error(res, 'Donor not found', 404);
      }

      const results = await donorReminderService.sendManualReminder(
        id,
        req.user._id,
        templateType || 'donation_reminder_due'
      );

      return ResponseHelper.success(res, { results }, 'Reminder sent to donor');
    } catch (error) {
      console.error('❌ Send Donor Reminder Error:', error);
      return ResponseHelper.error(res, 'Failed to send donor reminder', 500);
    }
  }

  /**
   * Get follow-ups for a specific donor
   * GET /api/donor-followups/by-donor/:donorId
   */
  async getByDonor(req, res) {
    try {
      const { donorId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(donorId)) {
        return ResponseHelper.error(res, 'Invalid donor ID', 400);
      }

      const followUps = await DonorFollowUp.find({ donor: donorId })
        .populate('donation', 'amount method donationNumber status')
        .populate('assignedTo', 'name email')
        .populate('completedDonation', 'amount method donationNumber')
        .populate('reminders.sentBy', 'name')
        .populate('staffNotes.addedBy', 'name')
        .sort({ createdAt: -1 })
        .lean();

      return ResponseHelper.success(res, { followUps });
    } catch (error) {
      console.error('❌ Get By Donor Error:', error);
      return ResponseHelper.error(res, 'Failed to fetch donor follow-ups', 500);
    }
  }

  /**
   * Manually trigger reminder processing (admin only)
   * POST /api/donor-followups/process-reminders
   */
  async triggerProcessing(req, res) {
    try {
      // Run in background
      setImmediate(async () => {
        try {
          await donorReminderService.processReminders();
        } catch (err) {
          console.error('❌ Manual reminder processing failed:', err);
        }
      });

      return ResponseHelper.success(res, null, 'Reminder processing triggered. Check logs for results.');
    } catch (error) {
      console.error('❌ Trigger Processing Error:', error);
      return ResponseHelper.error(res, 'Failed to trigger processing', 500);
    }
  }
}

module.exports = new DonorFollowUpController();
