const { Donation, Donor, Project, Scheme } = require('../models');
const ResponseHelper = require('../utils/responseHelper');
const donorReminderService = require('../services/donorReminderService');
const mongoose = require('mongoose');

// Valid status transitions map — prevents invalid state changes
const DONATION_STATUS_TRANSITIONS = {
  pending:    ['processing', 'completed', 'cancelled'],
  processing: ['completed', 'failed'],
  failed:     ['processing'], // allow retry
  completed:  ['refunded'],
  cancelled:  [], // terminal state
  refunded:   []  // terminal state
};

class DonationController {
  /**
   * Get donations by donor ID
   * GET /api/donors/:donorId/donations
   */
  async getDonationsByDonor(req, res) {
    try {
      const { donorId } = req.params;
      const { page = 1, limit = 10 } = req.query;

      if (!mongoose.Types.ObjectId.isValid(donorId)) {
        return ResponseHelper.error(res, 'Invalid donor ID', 400);
      }

      // Check if donor exists
      const donor = await Donor.findById(donorId);
      if (!donor) {
        return ResponseHelper.error(res, 'Donor not found', 404);
      }

      // Calculate pagination
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      // Get donations for this donor
      const [donations, total] = await Promise.all([
        Donation.find({
          donor: donorId
        })
          .populate('project', 'name code')
          .populate('scheme', 'name code')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Donation.countDocuments({
          donor: donorId
        })
      ]);

      const pagination = {
        current: pageNum,
        pages: Math.ceil(total / limitNum),
        total,
        limit: limitNum
      };

      return ResponseHelper.success(res, {
        donor: {
          id: donor._id,
          name: donor.name,
          email: donor.email
        },
        donations,
        pagination
      });
    } catch (error) {
      console.error('❌ Get Donations by Donor Error:', error);
      return ResponseHelper.error(res, 'Failed to fetch donor donations', 500);
    }
  }

  /**
   * Get all donations with pagination and filtering
   * GET /api/donations
   */
  async getDonations(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        search = '',
        status = '',
        method = '',
        dateFrom = '',
        dateTo = '',
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      // Build filter object
      const filter = {};
      
      if (search) {
        // Search in donor name or payment number
        const donors = await Donor.find({
          name: { $regex: search, $options: 'i' }
        }).select('_id');
        
        filter.$or = [
          { donationNumber: { $regex: search, $options: 'i' } },
          { donor: { $in: donors.map(d => d._id) } }
        ];
      }
      
      if (status) filter.status = status;
      if (method) filter.method = method;
      
      if (dateFrom || dateTo) {
        filter.createdAt = {};
        if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
        if (dateTo) filter.createdAt.$lte = new Date(dateTo);
      }

      // Build sort object
      const sort = {};
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

      // Calculate pagination
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      // Get donations with pagination
      const [donations, total] = await Promise.all([
        Donation.find(filter)
          .populate('donor', 'name email phone type category')
          .populate('project', 'name code')
          .populate('scheme', 'name code')
          .populate('createdBy', 'name')
          .sort(sort)
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Donation.countDocuments(filter)
      ]);

      const pagination = {
        current: pageNum,
        pages: Math.ceil(total / limitNum),
        total,
        limit: limitNum
      };

      // Format donations for response
      const formattedDonations = donations.map(donation => ({
        id: donation._id,
        donationNumber: donation.donationNumber,
        amount: donation.amount,
        method: donation.method,
        status: donation.status,
        donor: donation.donor ? {
          id: donation.donor._id,
          name: donation.donor.name,
          email: donation.donor.email,
          phone: donation.donor.phone,
          type: donation.donor.type,
          category: donation.donor.category
        } : {
          id: null,
          name: 'Anonymous',
          email: null,
          phone: null,
          type: 'anonymous',
          category: null
        },
        project: donation.project ? {
          id: donation.project._id,
          name: donation.project.name,
          code: donation.project.code
        } : null,
        scheme: donation.scheme ? {
          id: donation.scheme._id,
          name: donation.scheme.name,
          code: donation.scheme.code
        } : null,
        notes: donation.notes,
        createdAt: donation.createdAt,
        completedAt: donation.timeline?.completedAt,
        createdBy: donation.createdBy?.name
      }));

      return ResponseHelper.success(res, {
        donations: formattedDonations,
        pagination
      });
    } catch (error) {
      console.error('❌ Get Donations Error:', error);
      return ResponseHelper.error(res, 'Failed to fetch donations', 500);
    }
  }

  /**
   * Get single donation by ID
   * GET /api/donations/:id
   */
  async getDonation(req, res) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return ResponseHelper.error(res, 'Invalid donation ID', 400);
      }

      const donation = await Donation.findById(id)
        .populate('donor', 'name email phone type category address')
        .populate('project', 'name code description')
        .populate('scheme', 'name code description')
        .populate('createdBy', 'name email')
        .populate('lastModifiedBy', 'name email');

      if (!donation) {
        return ResponseHelper.error(res, 'Donation not found', 404);
      }

      return ResponseHelper.success(res, { donation });
    } catch (error) {
      console.error('❌ Get Donation Error:', error);
      return ResponseHelper.error(res, 'Failed to fetch donation', 500);
    }
  }

  /**
   * Create new donation
   * POST /api/donations
   */
  async createDonation(req, res) {
    try {
      // Accept both frontend field names and legacy field names
      const {
        donor: donorFromBody,
        donorId: donorIdFromBody,
        amount,
        method,
        project: projectFromBody,
        scheme: schemeFromBody,
        purpose,
        purposeId,
        mode,
        date,
        receiptNumber,
        isAnonymous,
        notes
      } = req.body;

      // Resolve donor ID (frontend sends "donorId", legacy sends "donor")
      const donorId = donorFromBody || donorIdFromBody || null;

      // Resolve project/scheme from purpose fields
      // Frontend sends { purpose: 'project', purposeId: '...' } or { purpose: 'scheme', purposeId: '...' }
      let project = projectFromBody || null;
      let scheme = schemeFromBody || null;
      if (purpose === 'project' && purposeId) {
        project = purposeId;
      } else if (purpose === 'scheme' && purposeId) {
        scheme = purposeId;
      }

      // Validate required fields
      if (!amount || !method) {
        return ResponseHelper.error(res, 'Amount and method are required', 400);
      }

      // Validate donor ID only if provided (allow anonymous donations)
      if (donorId && !isAnonymous) {
        if (!mongoose.Types.ObjectId.isValid(donorId)) {
          return ResponseHelper.error(res, 'Invalid donor ID', 400);
        }

        // Check if donor exists
        const donor = await Donor.findById(donorId);
        if (!donor) {
          return ResponseHelper.error(res, 'Donor not found', 404);
        }
      }

      // Validate project if provided (optional)
      if (project && String(project).trim() !== '') {
        if (!mongoose.Types.ObjectId.isValid(project)) {
          return ResponseHelper.error(res, 'Invalid project ID', 400);
        }
        const projectExists = await Project.findById(project);
        if (!projectExists) {
          return ResponseHelper.error(res, 'Project not found', 400);
        }
      }

      // Validate scheme if provided (optional)
      if (scheme && String(scheme).trim() !== '') {
        if (!mongoose.Types.ObjectId.isValid(scheme)) {
          return ResponseHelper.error(res, 'Invalid scheme ID', 400);
        }
        const schemeExists = await Scheme.findById(scheme);
        if (!schemeExists) {
          return ResponseHelper.error(res, 'Scheme not found', 400);
        }
      }

      // Map mode to recurring preferences
      const recurringModes = ['monthly', 'quarterly', 'half_yearly', 'yearly', 'custom'];
      const isRecurring = mode && recurringModes.includes(mode);
      const frequency = isRecurring ? mode : 'one-time';

      // Resolve donation date
      const donationDate = date ? new Date(date) : new Date();

      // Resolve effective donor (null for anonymous)
      const effectiveDonorId = isAnonymous ? null : (donorId || null);

      // Create donation data (donor can be null for anonymous donations)
      const donationData = {
        donor: effectiveDonorId,
        amount: parseFloat(amount),
        method,
        project: (project && String(project).trim() !== '') ? project : null,
        scheme: (scheme && String(scheme).trim() !== '') ? scheme : null,
        notes: notes || '',
        receiptNumber: receiptNumber || undefined,
        isAnonymous: !!isAnonymous,
        status: method === 'cash' ? 'completed' : 'pending',
        createdBy: req.user._id,
        donationDate,
        preferences: {
          isRecurring: !!isRecurring,
          frequency: frequency
        }
      };

      // Set payment details based on method
      if (method === 'cash') {
        donationData.paymentDetails = {
          cash: {
            receivedBy: req.user._id,
            location: 'Office',
            receivedDate: donationDate
          }
        };
      }

      const donation = new Donation(donationData);
      await donation.save();

      // Update donor statistics if donation is completed and has a donor
      if (donation.status === 'completed' && effectiveDonorId) {
        await this.updateDonorStats(effectiveDonorId, parseFloat(amount));

        // Send auto thank-you and create follow-up (async, don't block response)
        setImmediate(async () => {
          try {
            await donorReminderService.sendThankYou(donation._id, req.user._id);
          } catch (err) {
            console.error('⚠️ Post-donation thank-you error:', err.message);
          }
          try {
            await donorReminderService.matchDonationToFollowUp(effectiveDonorId, donation._id, req.user._id);
          } catch (err) {
            console.error('⚠️ Post-donation follow-up error:', err.message);
          }
          try {
            await donorReminderService.calculateEngagementScore(effectiveDonorId);
          } catch (err) {
            console.error('⚠️ Post-donation engagement score error:', err.message);
          }
        });
      }

      // Populate the created donation
      await donation.populate([
        { path: 'donor', select: 'name email phone type category' },
        { path: 'project', select: 'name code' },
        { path: 'scheme', select: 'name code' },
        { path: 'createdBy', select: 'name email' }
      ]);

      return ResponseHelper.success(res, { donation }, 'Donation created successfully', 201);
    } catch (error) {
      console.error('❌ Create Donation Error:', error);
      
      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(err => err.message);
        return ResponseHelper.error(res, messages.join(', '), 400);
      }
      
      return ResponseHelper.error(res, 'Failed to create donation', 500);
    }
  }

  /**
   * Update donation
   * PUT /api/donations/:id
   */
  async updateDonation(req, res) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return ResponseHelper.error(res, 'Invalid donation ID', 400);
      }

      // Check previous status before update
      const existingDonation = await Donation.findById(id);
      if (!existingDonation) {
        return ResponseHelper.error(res, 'Donation not found', 404);
      }
      const previousStatus = existingDonation.status;

      // Allowlist of fields that can be updated via PUT
      // Security: block status, donationNumber, timeline, verification, refund, donor from being modified here
      const ALLOWED_UPDATE_FIELDS = [
        'amount', 'method', 'purpose', 'notes', 'internalNotes', 'tags',
        'paymentDetails', 'project', 'scheme',
        'anonymousDonor', 'preferences', 'campaign',
        'tax', 'receipt', 'metadata'
      ];

      const updateData = { lastModifiedBy: req.user._id };
      for (const field of ALLOWED_UPDATE_FIELDS) {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      }

      const donation = await Donation.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      )
        .populate('donor', 'name email phone')
        .populate('project', 'name code')
        .populate('scheme', 'name code')
        .populate('lastModifiedBy', 'name email');

      if (!donation) {
        return ResponseHelper.error(res, 'Donation not found', 404);
      }

      // If status changed to completed and has a donor, trigger follow-up hooks
      if (previousStatus !== 'completed' && donation.status === 'completed' && donation.donor) {
        const donorObjId = donation.donor._id || donation.donor;
        await this.updateDonorStats(donorObjId, donation.amount);

        setImmediate(async () => {
          try {
            await donorReminderService.sendThankYou(donation._id, req.user._id);
          } catch (err) {
            console.error('⚠️ Update donation thank-you error:', err.message);
          }
          try {
            await donorReminderService.matchDonationToFollowUp(donorObjId, donation._id, req.user._id);
          } catch (err) {
            console.error('⚠️ Update donation follow-up error:', err.message);
          }
          try {
            await donorReminderService.calculateEngagementScore(donorObjId);
          } catch (err) {
            console.error('⚠️ Update donation engagement error:', err.message);
          }
        });
      }

      return ResponseHelper.success(res, { donation }, 'Donation updated successfully');
    } catch (error) {
      console.error('❌ Update Donation Error:', error);
      
      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(err => err.message);
        return ResponseHelper.error(res, messages.join(', '), 400);
      }
      
      return ResponseHelper.error(res, 'Failed to update donation', 500);
    }
  }

  /**
   * Update donation status
   * PATCH /api/donations/:id/status
   */
  async updateDonationStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return ResponseHelper.error(res, 'Invalid donation ID', 400);
      }

      if (!['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'].includes(status)) {
        return ResponseHelper.error(res, 'Invalid status', 400);
      }

      // Get current donation to enforce transition rules
      const existingDonation = await Donation.findById(id);
      if (!existingDonation) {
        return ResponseHelper.error(res, 'Donation not found', 404);
      }

      const currentStatus = existingDonation.status;
      const allowedTransitions = DONATION_STATUS_TRANSITIONS[currentStatus] || [];

      if (!allowedTransitions.includes(status)) {
        return ResponseHelper.error(
          res,
          `Cannot transition from "${currentStatus}" to "${status}". Allowed transitions: ${allowedTransitions.join(', ') || 'none (terminal state)'}`,
          400
        );
      }

      const previousStatus = currentStatus;

      const donation = await Donation.findByIdAndUpdate(
        id,
        { 
          status, 
          lastModifiedBy: req.user._id
        },
        { new: true }
      )
        .populate('donor', 'name email phone')
        .populate('lastModifiedBy', 'name email');

      if (!donation) {
        return ResponseHelper.error(res, 'Donation not found', 404);
      }

      // Reverse donor stats if transitioning FROM completed to another status
      if (previousStatus === 'completed' && status !== 'completed' && donation.donor) {
        const donorObjId = donation.donor._id || donation.donor;
        await this.reverseDonorStats(donorObjId, donation.amount);
      }

      // Update donor stats if donation is newly completed and has a donor
      if (previousStatus !== 'completed' && status === 'completed' && donation.donor) {
        const donorObjId = donation.donor._id || donation.donor;
        await this.updateDonorStats(donorObjId, donation.amount);

        // Send auto thank-you and match to follow-up (async, don't block response)
        setImmediate(async () => {
          try {
            await donorReminderService.sendThankYou(donation._id, req.user._id);
          } catch (err) {
            console.error('⚠️ Post-status thank-you error:', err.message);
          }
          try {
            await donorReminderService.matchDonationToFollowUp(donorObjId, donation._id, req.user._id);
          } catch (err) {
            console.error('⚠️ Post-status follow-up error:', err.message);
          }
          try {
            await donorReminderService.calculateEngagementScore(donorObjId);
          } catch (err) {
            console.error('⚠️ Post-status engagement error:', err.message);
          }
        });
      }

      return ResponseHelper.success(res, { donation }, 'Donation status updated successfully');
    } catch (error) {
      console.error('❌ Update Donation Status Error:', error);
      return ResponseHelper.error(res, 'Failed to update donation status', 500);
    }
  }

  /**
   * Get donation statistics
   * GET /api/donations/analytics/stats
   */
  async getDonationStats(req, res) {
    try {
      // Get overall stats
      const [overallStats] = await Donation.aggregate([
        {
          $match: { 
            status: 'completed' 
          }
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$amount' },
            totalDonations: { $sum: 1 },
            averageDonation: { $avg: '$amount' }
          }
        }
      ]);

      // Get this month's stats
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const [thisMonthStats] = await Donation.aggregate([
        {
          $match: {
            status: 'completed',
            createdAt: { $gte: startOfMonth }
          }
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$amount' },
            donationCount: { $sum: 1 }
          }
        }
      ]);

      const stats = {
        overall: overallStats || { totalAmount: 0, totalDonations: 0, averageDonation: 0 },
        thisMonth: thisMonthStats || { totalAmount: 0, donationCount: 0 }
      };

      return ResponseHelper.success(res, { stats });
    } catch (error) {
      console.error('❌ Get Donation Stats Error:', error);
      return ResponseHelper.error(res, 'Failed to fetch donation statistics', 500);
    }
  }

  /**
   * Get recent donations
   * GET /api/donations/analytics/recent
   */
  async getRecentDonations(req, res) {
    try {
      const { limit = 20 } = req.query;

      const recentDonations = await Donation.find({
        status: 'completed'
      })
        .populate('donor', 'name email phone type category')
        .populate('project', 'name code')
        .populate('scheme', 'name code')
        .sort({ 'timeline.completedAt': -1 })
        .limit(parseInt(limit))
        .lean();

      const donations = recentDonations.map(donation => ({
        id: donation._id,
        donationNumber: donation.donationNumber,
        amount: donation.amount,
        donor: donation.donor ? {
          id: donation.donor._id,
          name: donation.donor.name,
          email: donation.donor.email,
          phone: donation.donor.phone,
          type: donation.donor.type,
          category: donation.donor.category
        } : {
          id: null,
          name: 'Anonymous',
          email: null,
          phone: null,
          type: 'anonymous',
          category: null
        },
        project: donation.project?.name,
        scheme: donation.scheme?.name,
        method: donation.method || 'online',
        status: donation.status,
        date: donation.createdAt,
        completedAt: donation.timeline?.completedAt
      }));

      return ResponseHelper.success(res, { donations });
    } catch (error) {
      console.error('❌ Get Recent Donations Error:', error);
      return ResponseHelper.error(res, 'Failed to fetch recent donations', 500);
    }
  }

  /**
   * Get donation trends
   * GET /api/donations/analytics/trends
   */
  async getDonationTrends(req, res) {
    try {
      const { months = 6 } = req.query;
      
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);

      const trends = await Donation.aggregate([
        {
          $match: {
            status: 'completed',
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            totalAmount: { $sum: '$amount' },
            donationCount: { $sum: 1 }
          }
        },
        {
          $sort: { '_id.year': 1, '_id.month': 1 }
        }
      ]);

      return ResponseHelper.success(res, { trends });
    } catch (error) {
      console.error('❌ Get Donation Trends Error:', error);
      return ResponseHelper.error(res, 'Failed to fetch donation trends', 500);
    }
  }

  /**
   * Helper method to update donor statistics
   */
  async updateDonorStats(donorId, amount) {
    try {
      // Skip if no donor ID (anonymous donation)
      if (!donorId) return;

      const donor = await Donor.findById(donorId);
      if (!donor) return;

      // Update donation statistics
      donor.donationStats.totalDonated += amount;
      donor.donationStats.donationCount += 1;
      donor.donationStats.lastDonation = new Date();

      // Update average donation
      donor.donationStats.averageDonation = donor.donationStats.totalDonated / donor.donationStats.donationCount;

      await donor.save();
    } catch (error) {
      console.error('❌ Update Donor Stats Error:', error);
    }
  }

  /**
   * Helper method to reverse donor statistics (when donation status changes away from completed)
   */
  async reverseDonorStats(donorId, amount) {
    try {
      if (!donorId) return;

      const donor = await Donor.findById(donorId);
      if (!donor) return;

      // Decrement donation statistics
      donor.donationStats.totalDonated = Math.max(0, (donor.donationStats.totalDonated || 0) - amount);
      donor.donationStats.donationCount = Math.max(0, (donor.donationStats.donationCount || 0) - 1);

      // Recalculate average
      if (donor.donationStats.donationCount > 0) {
        donor.donationStats.averageDonation = donor.donationStats.totalDonated / donor.donationStats.donationCount;
      } else {
        donor.donationStats.averageDonation = 0;
      }

      await donor.save();
    } catch (error) {
      console.error('❌ Reverse Donor Stats Error:', error);
    }
  }
}

module.exports = new DonationController();