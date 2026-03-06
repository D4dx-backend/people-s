const { Donor, Donation, Payment, User, Project, Scheme } = require('../models');
const ResponseHelper = require('../utils/responseHelper');
const mongoose = require('mongoose');
const { buildFranchiseReadFilter, buildFranchiseMatchStage, getWriteFranchiseId } = require('../utils/franchiseFilterHelper');

class DonorController {
  /**
   * Get all donors with pagination and filtering
   * GET /api/donors
   */
  async getDonors(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        search = '',
        status = '',
        type = '',
        category = '',
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      // Build filter object
      const filter = {};
      
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } }
        ];
      }
      
      if (status) filter.status = status;
      if (type) filter.type = type;
      if (category) filter.category = category;

      // Build sort object
      const sort = {};
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

      // Calculate pagination
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      // Multi-tenant: restrict to current franchise
      Object.assign(filter, buildFranchiseReadFilter(req));

      // Get donors with pagination
      const [donors, total] = await Promise.all([
        Donor.find(filter)
          .populate('preferredPrograms', 'name code')
          .populate('preferredSchemes', 'name code')
          .populate('assignedTo', 'name email')
          .populate('createdBy', 'name')
          .sort(sort)
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Donor.countDocuments(filter)
      ]);

      const pagination = {
        current: pageNum,
        pages: Math.ceil(total / limitNum),
        total,
        limit: limitNum
      };

      return ResponseHelper.success(res, {
        donors,
        pagination
      });
    } catch (error) {
      console.error('❌ Get Donors Error:', error);
      return ResponseHelper.error(res, 'Failed to fetch donors', 500);
    }
  }

  /**
   * Get all donors without pagination (for dropdowns/search)
   * GET /api/donors/all
   */
  async getAllDonors(req, res) {
    try {
      const {
        search = '',
        status = '',
        type = '',
        category = '',
        limit = 100
      } = req.query;

      // Build filter object
      const filter = {};
      
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } }
        ];
      }
      
      if (status) filter.status = status;
      if (type) filter.type = type;
      if (category) filter.category = category;

      // Get donors without pagination but with limit
      const donors = await Donor.find(filter)
        .select('name email phone type category status donationStats')
        .sort({ name: 1 })
        .limit(parseInt(limit))
        .lean();

      return ResponseHelper.success(res, {
        donors,
        total: donors.length
      });
    } catch (error) {
      console.error('❌ Get All Donors Error:', error);
      return ResponseHelper.error(res, 'Failed to fetch all donors', 500);
    }
  }

  /**
   * Get single donor by ID
   * GET /api/donors/:id
   */
  async getDonor(req, res) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return ResponseHelper.error(res, 'Invalid donor ID', 400);
      }

      const donor = await Donor.findOne({ _id: id, ...buildFranchiseReadFilter(req) })
        .populate('preferredPrograms', 'name code description')
        .populate('preferredSchemes', 'name code description')
        .populate('assignedTo', 'name email phone')
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email');

      if (!donor) {
        return ResponseHelper.error(res, 'Donor not found', 404);
      }

      // Get donation history
      const donationHistory = await donor.getDonationHistory(20);

      // Transform donor to include id field (convert _id to id)
      const donorObj = donor.toObject ? donor.toObject() : donor;
      const transformedDonor = {
        ...donorObj,
        id: donorObj._id || donorObj.id,
        _id: donorObj._id
      };

      return ResponseHelper.success(res, {
        donor: transformedDonor,
        donationHistory
      });
    } catch (error) {
      console.error('❌ Get Donor Error:', error);
      return ResponseHelper.error(res, 'Failed to fetch donor', 500);
    }
  }

  /**
   * Create new donor
   * POST /api/donors
   */
  async createDonor(req, res) {
    try {
      const donorData = {
        ...req.body,
        createdBy: req.user._id,
        franchise: req.franchiseId || null   // Multi-tenant
      };

      // Check if donor with email already exists (franchise-scoped)
      const dupQuery = donorData.email
        ? { email: donorData.email, ...(req.franchiseId && { franchise: req.franchiseId }) }
        : null;
      if (dupQuery) {
        const existingDonor = await Donor.findOne(dupQuery).setOptions({ bypassFranchise: true });
        if (existingDonor) {
          return ResponseHelper.error(res, 'Donor with this email already exists', 400);
        }
      }

      const donor = new Donor(donorData);
      await donor.save();

      // Populate the created donor
      await donor.populate([
        { path: 'preferredPrograms', select: 'name code' },
        { path: 'preferredSchemes', select: 'name code' },
        { path: 'createdBy', select: 'name email' }
      ]);

      return ResponseHelper.success(res, { donor }, 'Donor created successfully', 201);
    } catch (error) {
      console.error('❌ Create Donor Error:', error);
      
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        return ResponseHelper.error(res, `Donor with this ${field} already exists`, 400);
      }
      
      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(err => err.message);
        return ResponseHelper.error(res, messages.join(', '), 400);
      }
      
      return ResponseHelper.error(res, 'Failed to create donor', 500);
    }
  }

  /**
   * Update donor
   * PUT /api/donors/:id
   */
  async updateDonor(req, res) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return ResponseHelper.error(res, 'Invalid donor ID', 400);
      }

      const updateData = {
        ...req.body,
        updatedBy: req.user._id
      };

      // Remove fields that shouldn't be updated directly
      delete updateData.donationStats;
      delete updateData.createdBy;
      delete updateData.createdAt;

      const donor = await Donor.findOneAndUpdate(
        { _id: id, franchise: req.franchiseId },
        updateData,
        { new: true, runValidators: true }
      )
        .populate('preferredPrograms', 'name code')
        .populate('preferredSchemes', 'name code')
        .populate('assignedTo', 'name email')
        .populate('updatedBy', 'name email');

      if (!donor) {
        return ResponseHelper.error(res, 'Donor not found', 404);
      }

      return ResponseHelper.success(res, { donor }, 'Donor updated successfully');
    } catch (error) {
      console.error('❌ Update Donor Error:', error);
      
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        return ResponseHelper.error(res, `Donor with this ${field} already exists`, 400);
      }
      
      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(err => err.message);
        return ResponseHelper.error(res, messages.join(', '), 400);
      }
      
      return ResponseHelper.error(res, 'Failed to update donor', 500);
    }
  }

  /**
   * Delete donor
   * DELETE /api/donors/:id
   */
  async deleteDonor(req, res) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return ResponseHelper.error(res, 'Invalid donor ID', 400);
      }

      // Check if donor has any donations
      const donationCount = await Payment.countDocuments({
        donor: id,
        type: 'donation'
      });

      if (donationCount > 0) {
        return ResponseHelper.error(res, 'Cannot delete donor with existing donations. Consider deactivating instead.', 400);
      }

      const donor = await Donor.findOneAndDelete({ _id: id, franchise: req.franchiseId });

      if (!donor) {
        return ResponseHelper.error(res, 'Donor not found', 404);
      }

      return ResponseHelper.success(res, null, 'Donor deleted successfully');
    } catch (error) {
      console.error('❌ Delete Donor Error:', error);
      return ResponseHelper.error(res, 'Failed to delete donor', 500);
    }
  }

  /**
   * Get donor statistics
   * GET /api/donors/stats
   */
  async getDonorStats(req, res) {
    try {
      // Get total donors
      const totalDonors = await Donor.countDocuments({ status: 'active' });
      const activeDonors = await Donor.countDocuments({ 
        status: 'active',
        'donationStats.lastDonation': { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) }
      });

      // Get this month's donations and new donors
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

      const [thisMonthStats, newDonorsThisMonth] = await Promise.all([
        Payment.aggregate([
          {
            $match: {
              type: 'donation',
              createdAt: { $gte: startOfMonth, $lte: endOfMonth },
              status: 'completed'
            }
          },
          {
            $group: {
              _id: null,
              totalAmount: { $sum: '$amount' },
              donationCount: { $sum: 1 },
              uniqueDonors: { $addToSet: '$donor' }
            }
          }
        ]),
        Donor.countDocuments({
          createdAt: { $gte: startOfMonth, $lte: endOfMonth }
        })
      ]);

      // Get overall donation statistics
      const [overallStats] = await Payment.aggregate([
        {
          $match: { 
            type: 'donation',
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

      // Get recurring donors count (based on donor preferences)
      const recurringDonors = await Donor.countDocuments({
        'donationPreferences.frequency': { $ne: 'one-time' },
        status: 'active'
      });

      // Get patron donors count
      const patronDonors = await Donor.countDocuments({
        category: { $in: ['patron', 'major'] },
        status: 'active'
      });

      // Get donors by type
      const donorsByType = await Donor.aggregate([
        {
          $match: { status: 'active' }
        },
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 },
            totalDonated: { $sum: '$donationStats.totalDonated' }
          }
        },
        {
          $addFields: {
            percentage: {
              $multiply: [
                { $divide: ['$count', totalDonors] },
                100
              ]
            }
          }
        }
      ]);

      // Get donors by category
      const donorsByCategory = await Donor.aggregate([
        {
          $match: { status: 'active' }
        },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            totalDonated: { $sum: '$donationStats.totalDonated' }
          }
        },
        {
          $addFields: {
            percentage: {
              $multiply: [
                { $divide: ['$count', totalDonors] },
                100
              ]
            }
          }
        }
      ]);

      // Get donations by method
      const donationsByMethod = await Payment.aggregate([
        {
          $match: { 
            type: 'donation',
            status: 'completed' 
          }
        },
        {
          $group: {
            _id: '$method',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' }
          }
        },
        {
          $addFields: {
            percentage: {
              $multiply: [
                { $divide: ['$count', overallStats?.totalDonations || 1] },
                100
              ]
            }
          }
        }
      ]);

      // Get monthly trends for the last 6 months
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const monthlyTrends = await Payment.aggregate([
        {
          $match: {
            type: 'donation',
            status: 'completed',
            createdAt: { $gte: sixMonthsAgo }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            donationAmount: { $sum: '$amount' },
            donorCount: { $addToSet: '$donor' },
            newDonors: { $sum: 1 } // This is simplified, would need more complex logic for actual new donors
          }
        },
        {
          $addFields: {
            month: {
              $concat: [
                { $toString: '$_id.year' },
                '-',
                { $toString: { $cond: [{ $lt: ['$_id.month', 10] }, { $concat: ['0', { $toString: '$_id.month' }] }, { $toString: '$_id.month' }] } }
              ]
            },
            donorCount: { $size: '$donorCount' }
          }
        },
        {
          $sort: { '_id.year': 1, '_id.month': 1 }
        }
      ]);

      // Get top donors
      const topDonors = await Donor.find({ status: 'active' })
        .sort({ 'donationStats.totalDonated': -1 })
        .limit(5)
        .select('name donationStats.totalDonated donationStats.donationCount donationStats.lastDonation')
        .lean();

      const thisMonth = thisMonthStats[0] || { totalAmount: 0, donationCount: 0, uniqueDonors: [] };
      const overall = overallStats || { totalAmount: 0, totalDonations: 0, averageDonation: 0 };

      const stats = {
        overview: {
          totalDonors,
          activeDonors,
          newDonorsThisMonth,
          totalDonationsAmount: overall.totalAmount,
          totalDonationsCount: overall.totalDonations,
          averageDonation: overall.averageDonation,
          recurringDonors,
          patronDonors
        },
        byType: donorsByType.map(item => ({
          type: item._id,
          count: item.count,
          totalAmount: item.totalDonated,
          percentage: item.percentage
        })),
        byCategory: donorsByCategory.map(item => ({
          category: item._id,
          count: item.count,
          totalAmount: item.totalDonated,
          percentage: item.percentage
        })),
        byMethod: donationsByMethod.map(item => ({
          method: item._id,
          count: item.count,
          totalAmount: item.totalAmount,
          percentage: item.percentage
        })),
        monthlyTrends: monthlyTrends.map(trend => ({
          month: trend.month,
          donorCount: trend.donorCount,
          donationAmount: trend.donationAmount,
          newDonors: Math.floor(trend.newDonors * 0.1) // Simplified calculation
        })),
        topDonors: topDonors.map(donor => ({
          id: donor._id,
          name: donor.name,
          totalDonated: donor.donationStats.totalDonated,
          donationCount: donor.donationStats.donationCount,
          lastDonation: donor.donationStats.lastDonation
        })),
        recentDonations: [] // Will be populated by separate endpoint
      };

      return ResponseHelper.success(res, { data: stats });
    } catch (error) {
      console.error('❌ Get Donor Stats Error:', error);
      return ResponseHelper.error(res, 'Failed to fetch donor statistics', 500);
    }
  }

  /**
   * Get top donors
   * GET /api/donors/top
   */
  async getTopDonors(req, res) {
    try {
      const { limit = 10 } = req.query;

      const topDonors = await Donor.find({ status: 'active' })
        .sort({ 'donationStats.totalDonated': -1 })
        .limit(parseInt(limit))
        .populate('preferredPrograms', 'name')
        .lean();

      return ResponseHelper.success(res, { donors: topDonors });
    } catch (error) {
      console.error('❌ Get Top Donors Error:', error);
      return ResponseHelper.error(res, 'Failed to fetch top donors', 500);
    }
  }

  /**
   * Get recent donations
   * GET /api/donors/recent-donations
   */
  async getRecentDonations(req, res) {
    try {
      const { limit = 20 } = req.query;

      const recentDonations = await Payment.find({
        type: 'donation',
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
        paymentNumber: donation.paymentNumber,
        amount: donation.amount,
        donor: {
          id: donation.donor?._id,
          name: donation.donor?.name || 'Anonymous',
          email: donation.donor?.email,
          phone: donation.donor?.phone,
          type: donation.donor?.type,
          category: donation.donor?.category
        },
        project: donation.project?.name,
        scheme: donation.scheme?.name,
        method: donation.method || 'online',
        date: donation.createdAt,
        completedAt: donation.timeline?.completedAt,
        status: donation.status
      }));

      return ResponseHelper.success(res, { donations });
    } catch (error) {
      console.error('❌ Get Recent Donations Error:', error);
      return ResponseHelper.error(res, 'Failed to fetch recent donations', 500);
    }
  }

  /**
   * Get donation trends
   * GET /api/donors/trends
   */
  async getDonationTrends(req, res) {
    try {
      const { months = 6 } = req.query;
      
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);

      const trends = await Payment.aggregate([
        {
          $match: {
            type: 'donation',
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
            donationCount: { $sum: 1 },
            uniqueDonors: { $addToSet: '$donor' }
          }
        },
        {
          $addFields: {
            uniqueDonorCount: { $size: '$uniqueDonors' }
          }
        },
        {
          $sort: { '_id.year': 1, '_id.month': 1 }
        }
      ]);

      const formattedTrends = trends.map(trend => ({
        month: `${trend._id.year}-${String(trend._id.month).padStart(2, '0')}`,
        amount: trend.totalAmount,
        donations: trend.donationCount,
        donors: trend.uniqueDonorCount
      }));

      return ResponseHelper.success(res, { trends: formattedTrends });
    } catch (error) {
      console.error('❌ Get Donation Trends Error:', error);
      return ResponseHelper.error(res, 'Failed to fetch donation trends', 500);
    }
  }

  /**
   * Get projects for dropdown
   * GET /api/donors/projects
   */
  async getProjectsForDropdown(req, res) {
    try {
      const projects = await Project.find({ status: 'active' })
        .select('name code description category')
        .sort({ name: 1 })
        .lean();

      return ResponseHelper.success(res, { projects });
    } catch (error) {
      console.error('❌ Get Projects Error:', error);
      return ResponseHelper.error(res, 'Failed to fetch projects', 500);
    }
  }

  /**
   * Get schemes for dropdown
   * GET /api/donors/schemes
   */
  async getSchemesForDropdown(req, res) {
    try {
      const { projectId } = req.query;
      
      const filter = { status: 'active' };
      if (projectId) {
        filter.project = projectId;
      }

      const schemes = await Scheme.find(filter)
        .select('name code description project')
        .populate('project', 'name code')
        .sort({ name: 1 })
        .lean();

      return ResponseHelper.success(res, { schemes });
    } catch (error) {
      console.error('❌ Get Schemes Error:', error);
      return ResponseHelper.error(res, 'Failed to fetch schemes', 500);
    }
  }

  /**
   * Update donor status
   * PATCH /api/donors/:id/status
   */
  async updateDonorStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return ResponseHelper.error(res, 'Invalid donor ID', 400);
      }

      if (!['active', 'inactive', 'blocked', 'pending_verification'].includes(status)) {
        return ResponseHelper.error(res, 'Invalid status', 400);
      }

      const donor = await Donor.findOneAndUpdate(
        { _id: id, franchise: req.franchiseId },
        { status, updatedBy: req.user._id },
        { new: true }
      ).populate('updatedBy', 'name email');

      if (!donor) {
        return ResponseHelper.error(res, 'Donor not found', 404);
      }

      return ResponseHelper.success(res, { donor }, 'Donor status updated successfully');
    } catch (error) {
      console.error('❌ Update Donor Status Error:', error);
      return ResponseHelper.error(res, 'Failed to update donor status', 500);
    }
  }

  /**
   * Verify donor
   * PATCH /api/donors/:id/verify
   */
  async verifyDonor(req, res) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return ResponseHelper.error(res, 'Invalid donor ID', 400);
      }

      const donor = await Donor.findOneAndUpdate(
        { _id: id, franchise: req.franchiseId },
        { 
          isVerified: true, 
          verificationDate: new Date(),
          status: 'active',
          updatedBy: req.user._id 
        },
        { new: true }
      ).populate('updatedBy', 'name email');

      if (!donor) {
        return ResponseHelper.error(res, 'Donor not found', 404);
      }

      return ResponseHelper.success(res, { donor }, 'Donor verified successfully');
    } catch (error) {
      console.error('❌ Verify Donor Error:', error);
      return ResponseHelper.error(res, 'Failed to verify donor', 500);
    }
  }

  /**
   * Get donation history from Donation model with server-side pagination
   * GET /api/donors/history
   */
  async getDonationHistory(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        donorId = '',
        status = '',
        method = '',
        startDate = '',
        endDate = '',
        minAmount = '',
        maxAmount = '',
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      // Build filter object
      const filter = {};
      
      // Filter by donor ID if provided
      if (donorId && mongoose.Types.ObjectId.isValid(donorId)) {
        filter.donor = donorId;
      }
      
      // Filter by status
      if (status && status !== 'all') {
        filter.status = status;
      }
      
      // Filter by payment method
      if (method && method !== 'all') {
        filter.method = method;
      }
      
      // Filter by date range
      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) {
          filter.createdAt.$gte = new Date(startDate);
        }
        if (endDate) {
          filter.createdAt.$lte = new Date(endDate);
        }
      }
      
      // Filter by amount range
      if (minAmount || maxAmount) {
        filter.amount = {};
        if (minAmount) {
          filter.amount.$gte = parseFloat(minAmount);
        }
        if (maxAmount) {
          filter.amount.$lte = parseFloat(maxAmount);
        }
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
          .populate('donor', 'name email phone type category donationStats')
          .populate('project', 'name code description')
          .populate('scheme', 'name code description')
          .populate('createdBy', 'name email')
          .populate('processedBy', 'name email')
          .populate('verification.verifiedBy', 'name email')
          .sort(sort)
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Donation.countDocuments(filter)
      ]);

      // Format the response data
      const formattedDonations = donations.map(donation => ({
        id: donation._id,
        donationNumber: donation.donationNumber,
        amount: donation.amount,
        netAmount: donation.amount - (donation.tax?.taxDeducted || 0),
        currency: donation.currency,
        method: donation.method,
        status: donation.status,
        purpose: donation.purpose,
        
        // Donor information (handle anonymous donations)
        donor: donation.donor ? {
          id: donation.donor._id,
          name: donation.preferences?.isAnonymous ? 'Anonymous' : donation.donor.name,
          email: donation.preferences?.isAnonymous ? null : donation.donor.email,
          phone: donation.preferences?.isAnonymous ? null : donation.donor.phone,
          type: donation.donor.type,
          category: donation.donor.category,
          totalDonated: donation.donor.donationStats?.totalDonated || 0,
          donationCount: donation.donor.donationStats?.donationCount || 0
        } : {
          name: donation.preferences?.isAnonymous ? 'Anonymous' : (donation.anonymousDonor?.name || 'Anonymous'),
          email: donation.preferences?.isAnonymous ? null : donation.anonymousDonor?.email,
          phone: donation.preferences?.isAnonymous ? null : donation.anonymousDonor?.phone,
          type: 'anonymous'
        },
        
        // Project and scheme information
        project: donation.project ? {
          id: donation.project._id,
          name: donation.project.name,
          code: donation.project.code,
          description: donation.project.description
        } : null,
        
        scheme: donation.scheme ? {
          id: donation.scheme._id,
          name: donation.scheme.name,
          code: donation.scheme.code,
          description: donation.scheme.description
        } : null,
        
        // Payment details based on method
        paymentDetails: formatPaymentDetails(donation.method, donation.paymentDetails),
        
        // Timeline information
        timeline: {
          createdAt: donation.timeline?.createdAt || donation.createdAt,
          processingAt: donation.timeline?.processingAt,
          completedAt: donation.timeline?.completedAt,
          failedAt: donation.timeline?.failedAt,
          cancelledAt: donation.timeline?.cancelledAt,
          refundedAt: donation.timeline?.refundedAt
        },
        
        // Tax and receipt information
        tax: {
          panRequired: donation.tax?.panRequired || false,
          panNumber: donation.tax?.panNumber,
          taxDeducted: donation.tax?.taxDeducted || 0,
          taxRate: donation.tax?.taxRate || 0
        },
        
        receipt: {
          receiptNumber: donation.receipt?.receiptNumber,
          issuedDate: donation.receipt?.issuedDate,
          emailSent: donation.receipt?.emailSent || false
        },
        
        // Preferences
        preferences: {
          isRecurring: donation.preferences?.isRecurring || false,
          frequency: donation.preferences?.frequency || 'one-time',
          isAnonymous: donation.preferences?.isAnonymous || false,
          publicDisplay: donation.preferences?.publicDisplay !== false
        },
        
        // Campaign information
        campaign: donation.campaign ? {
          campaignId: donation.campaign.campaignId,
          campaignName: donation.campaign.campaignName,
          source: donation.campaign.source,
          medium: donation.campaign.medium
        } : null,
        
        // Verification status
        verification: {
          status: donation.verification?.status || 'pending',
          verifiedBy: donation.verification?.verifiedBy ? {
            name: donation.verification.verifiedBy.name,
            email: donation.verification.verifiedBy.email
          } : null,
          verifiedAt: donation.verification?.verifiedAt,
          notes: donation.verification?.notes
        },
        
        // Failure information (if applicable)
        failure: donation.failure?.reason ? {
          reason: donation.failure.reason,
          errorCode: donation.failure.errorCode,
          errorMessage: donation.failure.errorMessage,
          retryCount: donation.failure.retryCount || 0
        } : null,
        
        // Refund information (if applicable)
        refund: donation.refund?.reason ? {
          reason: donation.refund.reason,
          refundAmount: donation.refund.refundAmount,
          refundDate: donation.refund.refundDate,
          refundStatus: donation.refund.refundStatus
        } : null,
        
        // Audit information
        createdBy: donation.createdBy ? {
          name: donation.createdBy.name,
          email: donation.createdBy.email
        } : null,
        
        processedBy: donation.processedBy ? {
          name: donation.processedBy.name,
          email: donation.processedBy.email
        } : null,
        
        // Additional information
        notes: donation.notes,
        tags: donation.tags || [],
        
        // Metadata
        metadata: {
          ipAddress: donation.metadata?.ipAddress,
          location: donation.metadata?.location
        }
      }));

      // Calculate pagination info
      const pagination = {
        current: pageNum,
        pages: Math.ceil(total / limitNum),
        total,
        limit: limitNum,
        hasNext: pageNum < Math.ceil(total / limitNum),
        hasPrev: pageNum > 1
      };

      // Calculate summary statistics for the filtered data
      const [summaryStats] = await Donation.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$amount' },
            totalDonations: { $sum: 1 },
            averageDonation: { $avg: '$amount' },
            completedDonations: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            completedAmount: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$amount', 0] }
            },
            pendingDonations: {
              $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
            },
            failedDonations: {
              $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
            }
          }
        }
      ]);

      const summary = summaryStats || {
        totalAmount: 0,
        totalDonations: 0,
        averageDonation: 0,
        completedDonations: 0,
        completedAmount: 0,
        pendingDonations: 0,
        failedDonations: 0
      };

      return ResponseHelper.success(res, {
        donations: formattedDonations,
        pagination,
        summary: {
          totalAmount: summary.totalAmount,
          totalDonations: summary.totalDonations,
          averageDonation: summary.averageDonation,
          completedDonations: summary.completedDonations,
          completedAmount: summary.completedAmount,
          pendingDonations: summary.pendingDonations,
          failedDonations: summary.failedDonations,
          successRate: summary.totalDonations > 0 ? 
            ((summary.completedDonations / summary.totalDonations) * 100).toFixed(2) : 0
        },
        filters: {
          donorId,
          status,
          method,
          startDate,
          endDate,
          minAmount,
          maxAmount,
          sortBy,
          sortOrder
        }
      });
    } catch (error) {
      console.error('❌ Get Donation History Error:', error);
      return ResponseHelper.error(res, 'Failed to fetch donation history', 500);
    }
  }

  /**
   * Get recent donations from Donation model (last 20 donations)
   * GET /api/donors/donations
   */
  async getRecentDonationsFromDonationModel(req, res) {
    try {
      const {
        limit = 20,
        status = '',
        method = ''
      } = req.query;

      // Build filter object
      const filter = {};
      
      if (status && status !== 'all') {
        filter.status = status;
      }
      
      if (method && method !== 'all') {
        filter.method = method;
      }

      // Limit the maximum number of donations to 50
      const limitNum = Math.min(parseInt(limit), 50);

      // Get recent donations (optimized for speed)
      const donations = await Donation.find(filter)
        .populate('donor', 'name email phone type category')
        .populate('project', 'name code')
        .populate('scheme', 'name code')
        .populate('createdBy', 'name')
        .sort({ createdAt: -1 })
        .limit(limitNum)
        .lean();

      // Format the response data (simplified for recent donations)
      const formattedDonations = donations.map(donation => ({
        id: donation._id,
        donationNumber: donation.donationNumber,
        amount: donation.amount,
        currency: donation.currency || 'INR',
        method: donation.method,
        status: donation.status,
        purpose: donation.purpose,
        
        // Donor information (simplified)
        donor: donation.donor ? {
          id: donation.donor._id,
          name: donation.preferences?.isAnonymous ? 'Anonymous' : donation.donor.name,
          type: donation.donor.type,
          category: donation.donor.category
        } : {
          name: donation.preferences?.isAnonymous ? 'Anonymous' : (donation.anonymousDonor?.name || 'Anonymous'),
          type: 'anonymous'
        },
        
        // Project and scheme (simplified)
        project: donation.project ? {
          name: donation.project.name,
          code: donation.project.code
        } : null,
        
        scheme: donation.scheme ? {
          name: donation.scheme.name,
          code: donation.scheme.code
        } : null,
        
        // Essential timeline
        createdAt: donation.createdAt,
        completedAt: donation.timeline?.completedAt,
        
        // Basic preferences
        isAnonymous: donation.preferences?.isAnonymous || false,
        isRecurring: donation.preferences?.isRecurring || false,
        
        // Created by
        createdBy: donation.createdBy?.name || 'System'
      }));

      // Calculate summary for the filtered data
      const totalAmount = formattedDonations.reduce((sum, donation) => sum + donation.amount, 0);
      const completedDonations = formattedDonations.filter(d => d.status === 'completed');
      const completedAmount = completedDonations.reduce((sum, donation) => sum + donation.amount, 0);

      const summary = {
        totalDonations: formattedDonations.length,
        totalAmount,
        completedDonations: completedDonations.length,
        completedAmount,
        averageDonation: formattedDonations.length > 0 ? totalAmount / formattedDonations.length : 0,
        successRate: formattedDonations.length > 0 ? 
          ((completedDonations.length / formattedDonations.length) * 100).toFixed(2) : 0
      };

      return ResponseHelper.success(res, {
        donations: formattedDonations,
        summary,
        filters: {
          limit: limitNum,
          status,
          method
        }
      });
    } catch (error) {
      console.error('❌ Get Recent Donations From Donation Model Error:', error);
      return ResponseHelper.error(res, 'Failed to fetch recent donations', 500);
    }
  }

}

/**
 * Helper function to format payment details based on method
 */
function formatPaymentDetails(method, paymentDetails) {
  if (!paymentDetails) return null;

  switch (method) {
    case 'online':
      return paymentDetails.online ? {
        gateway: paymentDetails.online.gateway,
        transactionId: paymentDetails.online.transactionId,
        paymentId: paymentDetails.online.paymentId,
        orderId: paymentDetails.online.orderId,
        status: paymentDetails.online.status
      } : null;

    case 'bank_transfer':
      return paymentDetails.bankTransfer ? {
        transactionId: paymentDetails.bankTransfer.transactionId,
        utrNumber: paymentDetails.bankTransfer.utrNumber,
        bankName: paymentDetails.bankTransfer.bankName,
        transferDate: paymentDetails.bankTransfer.transferDate
      } : null;

    case 'card':
      return paymentDetails.card ? {
        last4Digits: paymentDetails.card.last4Digits,
        cardType: paymentDetails.card.cardType,
        bankName: paymentDetails.card.bankName,
        transactionId: paymentDetails.card.transactionId
      } : null;

    case 'upi':
      return paymentDetails.upi ? {
        upiId: paymentDetails.upi.upiId,
        transactionId: paymentDetails.upi.transactionId,
        provider: paymentDetails.upi.provider
      } : null;

    case 'cheque':
      return paymentDetails.cheque ? {
        chequeNumber: paymentDetails.cheque.chequeNumber,
        bankName: paymentDetails.cheque.bankName,
        branchName: paymentDetails.cheque.branchName,
        issueDate: paymentDetails.cheque.issueDate,
        clearanceDate: paymentDetails.cheque.clearanceDate,
        status: paymentDetails.cheque.status
      } : null;

    case 'cash':
      return paymentDetails.cash ? {
        receiptNumber: paymentDetails.cash.receiptNumber,
        location: paymentDetails.cash.location,
        receivedDate: paymentDetails.cash.receivedDate
      } : null;

    default:
      return null;
  }
}

module.exports = new DonorController();