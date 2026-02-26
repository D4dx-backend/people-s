const { Application, User, Scheme, Beneficiary, Location } = require('../models');
const ResponseHelper = require('../utils/responseHelper');
const authService = require('../services/authService');
const staticOTPConfig = require('../config/staticOTP');
const whatsappOTPService = require('../utils/whatsappOtpService');
const notificationService = require('../services/notificationService');

class RegionalAdminController {
  /**
   * Send OTP for regional admin login
   * POST /api/regional-admin/auth/send-otp
   */
  async sendOTP(req, res) {
    try {
      const { phone } = req.body;

      if (!phone) {
        return ResponseHelper.error(res, 'Phone number is required', 400);
      }

      // Validate phone number format
      const phoneRegex = /^[6-9]\d{9}$/;
      if (!phoneRegex.test(phone)) {
        return ResponseHelper.error(res, 'Invalid phone number format', 400);
      }

      // Check if user exists and is a regional admin
      const user = await User.findOne({ 
        phone, 
        isActive: true,
        role: { $in: ['unit_admin', 'area_admin', 'district_admin'] }
      }).populate('profile.location.district profile.location.area profile.location.unit');

      if (!user) {
        return ResponseHelper.error(res, 'No admin account found for this phone number', 404);
      }

      // PRODUCTION SAFEGUARD: Prevent static OTP in production
      if (staticOTPConfig.NODE_ENV === 'production' && staticOTPConfig.USE_STATIC_OTP) {
        throw new Error('SECURITY ERROR: Static OTP is not allowed in production mode. Please use real OTP service (WhatsApp or SMS).');
      }

      // Generate OTP (use static OTP only in development)
      const otp = (staticOTPConfig.USE_STATIC_OTP && staticOTPConfig.isStaticOTPAllowed())
        ? staticOTPConfig.STATIC_OTP 
        : whatsappOTPService.generateOTP(6);

      // Send OTP
      let sendResult = { success: true, messageId: 'dev-test-message-id' };
      
      if (staticOTPConfig.USE_STATIC_OTP && staticOTPConfig.isStaticOTPAllowed()) {
        // Static OTP mode for testing (development only, no external service)
        console.log(`🔑 STATIC OTP MODE (DEV): OTP for ${phone} is: ${otp}`);
        sendResult = { success: true, messageId: 'static-otp-mode' };
      } else if (staticOTPConfig.USE_WHATSAPP_OTP && staticOTPConfig.WHATSAPP_ENABLED) {
        console.log(`📱 Sending OTP via WhatsApp to ${phone}...`);
        sendResult = await whatsappOTPService.sendOTP(phone, otp, {
          name: user.name || 'Admin',
          purpose: 'admin-login',
          priority: 2
        });
        
        if (!sendResult.success) {
          throw new Error(`Failed to send OTP via WhatsApp: ${sendResult.error}`);
        }
      }

      // Set OTP in user model
      user.otp = {
        code: otp,
        expiresAt: new Date(Date.now() + staticOTPConfig.OTP_EXPIRY_MINUTES * 60 * 1000),
        attempts: (user.otp?.attempts || 0) + 1,
        lastSentAt: new Date(),
        purpose: 'admin-login',
        verified: false
      };
      await user.save();

      const response = {
        message: staticOTPConfig.USE_WHATSAPP_OTP 
          ? 'OTP sent successfully to your WhatsApp number' 
          : 'OTP sent successfully',
        phone: phone,
        role: user.role,
        expiresIn: staticOTPConfig.OTP_EXPIRY_MINUTES,
        messageId: sendResult.messageId
      };

      if (staticOTPConfig.USE_STATIC_OTP && staticOTPConfig.isStaticOTPAllowed()) {
        response.staticOTP = otp;
        response.note = 'Static OTP enabled for testing (development mode only)';
      }

      return ResponseHelper.success(res, response, 'OTP sent successfully');

    } catch (error) {
      console.error('❌ Regional Admin Send OTP Error:', error);
      return ResponseHelper.error(res, error.message, 500);
    }
  }

  /**
   * Verify OTP and login regional admin
   * POST /api/regional-admin/auth/verify-otp
   */
  async verifyOTP(req, res) {
    try {
      const { phone, otp } = req.body;

      if (!phone || !otp) {
        return ResponseHelper.error(res, 'Phone number and OTP are required', 400);
      }

      // Find admin user
      const user = await User.findOne({ 
        phone, 
        isActive: true,
        role: { $in: ['unit_admin', 'area_admin', 'district_admin'] }
      }).populate('profile.location.district profile.location.area profile.location.unit');

      if (!user) {
        return ResponseHelper.error(res, 'Admin user not found', 404);
      }

      // Verify OTP
      const otpVerification = user.verifyOTP(otp, 'admin-login');
      if (!otpVerification.success) {
        return ResponseHelper.error(res, otpVerification.message, 400);
      }

      // Generate JWT token
      const token = authService.generateToken(user);

      // Update last login and clear OTP
      user.lastLogin = new Date();
      user.clearOTP();
      await user.save();

      // Prepare user data with location info
      const userData = {
        id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        location: {
          district: user.profile?.location?.district ? {
            _id: user.profile.location.district._id,
            name: user.profile.location.district.name,
            code: user.profile.location.district.code
          } : null,
          area: user.profile?.location?.area ? {
            _id: user.profile.location.area._id,
            name: user.profile.location.area.name,
            code: user.profile.location.area.code
          } : null,
          unit: user.profile?.location?.unit ? {
            _id: user.profile.location.unit._id,
            name: user.profile.location.unit.name,
            code: user.profile.location.unit.code
          } : null
        },
        permissions: user.role
      };

      console.log('✅ Regional Admin login successful:', userData.role);

      return ResponseHelper.success(res, {
        user: userData,
        token,
        message: 'Login successful'
      }, 'Login successful');

    } catch (error) {
      console.error('❌ Regional Admin Verify OTP Error:', error);
      return ResponseHelper.error(res, error.message, 500);
    }
  }

  /**
   * Get admin profile
   * GET /api/regional-admin/auth/profile
   */
  async getProfile(req, res) {
    try {
      const user = await User.findById(req.user._id)
        .select('-password -otp')
        .populate('profile.location.district', 'name code type')
        .populate('profile.location.area', 'name code type')
        .populate('profile.location.unit', 'name code type');

      if (!user) {
        return ResponseHelper.error(res, 'User not found', 404);
      }

      return ResponseHelper.success(res, { user }, 'Profile retrieved successfully');

    } catch (error) {
      console.error('❌ Get Regional Admin Profile Error:', error);
      return ResponseHelper.error(res, 'Failed to retrieve profile', 500);
    }
  }

  /**
   * Get applications for regional admin (READ ONLY)
   * GET /api/regional-admin/applications
   */
  async getApplications(req, res) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        status = '', 
        scheme = '',
        search = '',
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const user = req.user;

      // Build filter based on admin role and location
      const filter = {};

      // Role-based filtering
      if (user.role === 'district_admin') {
        // Support both new (adminScope.district) and old (adminScope.regions) formats
        const districtId = user.adminScope?.district || 
                          (user.adminScope?.regions && user.adminScope.regions[0]) ||
                          user.profile?.location?.district;
        
        if (!districtId) {
          return ResponseHelper.error(res, 'District location not set for admin', 400);
        }
        filter.district = districtId;
        console.log('🔍 District admin filter:', filter);
      } else if (user.role === 'area_admin') {
        // Support both new (adminScope.area) and old (adminScope.regions) formats
        const areaId = user.adminScope?.area || 
                      (user.adminScope?.regions && user.adminScope.regions[0]) ||
                      user.profile?.location?.area;
        
        if (!areaId) {
          return ResponseHelper.error(res, 'Area location not set for admin', 400);
        }
        filter.area = areaId;
        console.log('🔍 Area admin filter:', filter);
      } else if (user.role === 'unit_admin') {
        // Support both new (adminScope.unit) and old (adminScope.regions) formats
        const unitId = user.adminScope?.unit || 
                      (user.adminScope?.regions && user.adminScope.regions[0]) ||
                      user.profile?.location?.unit;
        
        if (!unitId) {
          return ResponseHelper.error(res, 'Unit location not set for admin', 400);
        }
        filter.unit = unitId;
        console.log('🔍 Unit admin filter:', filter);
      }

      // Additional filters
      if (status) filter.status = status;
      if (scheme) filter.scheme = scheme;
      if (search) {
        filter.applicationNumber = { $regex: search, $options: 'i' };
      }

      // Franchise scope
      if (req.franchiseId) filter.franchise = req.franchiseId;

      // Pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      // Sort options
      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

      // Fetch applications
      const applications = await Application.find(filter)
        .populate('scheme', 'name category benefits')
        .populate('beneficiary', 'name phone profile')
        .populate('reviewedBy', 'name role')
        .populate('approvedBy', 'name role')
        .populate('district', 'name code type')
        .populate('area', 'name code type')
        .populate('unit', 'name code type')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Application.countDocuments(filter);

      // Get statistics
      const stats = await Application.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      const statistics = {
        total,
        pending: 0,
        under_review: 0,
        approved: 0,
        rejected: 0,
        completed: 0
      };

      stats.forEach(stat => {
        if (statistics.hasOwnProperty(stat._id)) {
          statistics[stat._id] = stat.count;
        }
      });

      return ResponseHelper.success(res, {
        applications,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total,
          limit: parseInt(limit)
        },
        statistics
      }, 'Applications retrieved successfully');

    } catch (error) {
      console.error('❌ Get Applications Error:', error);
      return ResponseHelper.error(res, error.message, 500);
    }
  }

  /**
   * Get single application details
   * GET /api/regional-admin/applications/:id
   */
  async getApplicationDetails(req, res) {
    try {
      const { id } = req.params;
      const user = req.user;

      const application = await Application.findOne({ _id: id, franchise: req.franchiseId })
        .populate('scheme', 'name category benefits eligibility applicationSettings')
        .populate('beneficiary')
        .populate('project', 'name')
        .populate('reviewedBy', 'name role')
        .populate('approvedBy', 'name role')
        .populate('district', 'name code')
        .populate('area', 'name code')
        .populate('unit', 'name code');

      if (!application) {
        return ResponseHelper.error(res, 'Application not found', 404);
      }

      // Check if admin has access to this application (support both old and new location formats)
      const districtId = user.adminScope?.district || 
                        (user.adminScope?.regions && user.adminScope.regions[0]) ||
                        user.profile?.location?.district;
      const areaId = user.adminScope?.area || 
                    (user.adminScope?.regions && user.adminScope.regions[0]) ||
                    user.profile?.location?.area;
      const unitId = user.adminScope?.unit || 
                    (user.adminScope?.regions && user.adminScope.regions[0]) ||
                    user.profile?.location?.unit;

      const hasAccess = 
        (user.role === 'district_admin' && application.district?._id.toString() === districtId?.toString()) ||
        (user.role === 'area_admin' && application.area?._id.toString() === areaId?.toString()) ||
        (user.role === 'unit_admin' && application.unit?._id.toString() === unitId?.toString());

      if (!hasAccess) {
        return ResponseHelper.error(res, 'Access denied to this application', 403);
      }

      return ResponseHelper.success(res, { application }, 'Application details retrieved successfully');

    } catch (error) {
      console.error('❌ Get Application Details Error:', error);
      return ResponseHelper.error(res, error.message, 500);
    }
  }

  /**
   * Update application status (AREA ADMIN ONLY)
   * PUT /api/regional-admin/applications/:id/status
   */
  async updateApplicationStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, comments, approvedAmount } = req.body;
      const user = req.user;

      // Only area admin can update status
      if (user.role !== 'area_admin') {
        return ResponseHelper.error(res, 'Only area admins can update application status', 403);
      }

      // Validate status
      const validStatuses = ['under_review', 'approved', 'rejected'];
      if (!validStatuses.includes(status)) {
        return ResponseHelper.error(res, 'Invalid status', 400);
      }

      const application = await Application.findOne({ _id: id, franchise: req.franchiseId })
        .populate('scheme', 'name benefits')
        .populate('beneficiary', 'name phone');

      if (!application) {
        return ResponseHelper.error(res, 'Application not found', 404);
      }

      // Check if admin has access (support both old and new location formats)
      const areaId = user.adminScope?.area || 
                    (user.adminScope?.regions && user.adminScope.regions[0]) ||
                    user.profile?.location?.area;
      
      if (application.area?._id.toString() !== areaId?.toString()) {
        return ResponseHelper.error(res, 'Access denied to this application', 403);
      }

      // Check current status
      if (application.status === 'completed' || application.status === 'cancelled') {
        return ResponseHelper.error(res, 'Cannot update completed or cancelled applications', 400);
      }

      // Update application
      const oldStatus = application.status;
      application.status = status;

      if (status === 'under_review') {
        application.reviewedBy = user._id;
        application.reviewedAt = new Date();
      }

      if (status === 'approved') {
        application.approvedBy = user._id;
        application.approvedAt = new Date();
        application.approvedAmount = approvedAmount || application.requestedAmount;
      }

      if (status === 'rejected') {
        application.rejectedBy = user._id;
        application.rejectedAt = new Date();
        application.rejectionReason = comments;
      }

      // Add to status history
      application.statusHistory.push({
        status,
        timestamp: new Date(),
        updatedBy: user._id,
        comment: comments || `Status changed from ${oldStatus} to ${status}`
      });

      await application.save();

        // Notify beneficiary on approval/rejection (DXing WhatsApp + in-app)
        if (status === 'approved' || status === 'rejected') {
          notificationService
            .notifyApplicationDecisionToBeneficiary(application, status, { createdBy: user._id })
            .catch(err => console.error('❌ Beneficiary decision notification failed:', err));
        } else if (status === 'under_review') {
          // Notify area coordinator (self-reminder for review)
          notificationService
            .notifyAreaReviewRequired(application, { createdBy: user._id })
            .catch(err => console.error('❌ Area review notification failed:', err));
        }

      // Populate for response
      await application.populate('reviewedBy approvedBy', 'name role');

      return ResponseHelper.success(res, {
        application: {
          _id: application._id,
          applicationNumber: application.applicationNumber,
          status: application.status,
          approvedAmount: application.approvedAmount,
          reviewedAt: application.reviewedAt,
          approvedAt: application.approvedAt,
          beneficiary: application.beneficiary,
          scheme: application.scheme
        }
      }, `Application ${status} successfully`);

    } catch (error) {
      console.error('❌ Update Application Status Error:', error);
      return ResponseHelper.error(res, error.message, 500);
    }
  }

  /**
   * Get dashboard statistics for regional admin
   * GET /api/regional-admin/dashboard/stats
   */
  async getDashboardStats(req, res) {
    try {
      const user = req.user;

      // Build filter based on admin role (support both old and new location formats)
      const filter = {};
      if (user.role === 'district_admin') {
        const districtId = user.adminScope?.district || 
                          (user.adminScope?.regions && user.adminScope.regions[0]) ||
                          user.profile?.location?.district;
        filter.district = districtId;
      } else if (user.role === 'area_admin') {
        const areaId = user.adminScope?.area || 
                      (user.adminScope?.regions && user.adminScope.regions[0]) ||
                      user.profile?.location?.area;
        filter.area = areaId;
      } else if (user.role === 'unit_admin') {
        const unitId = user.adminScope?.unit || 
                      (user.adminScope?.regions && user.adminScope.regions[0]) ||
                      user.profile?.location?.unit;
        filter.unit = unitId;
      }

      // Franchise scope
      if (req.franchiseId) filter.franchise = req.franchiseId;

      // Get application statistics
      const applicationStats = await Application.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalRequested: { $sum: '$requestedAmount' },
            totalApproved: { $sum: '$approvedAmount' }
          }
        }
      ]);

      // Get scheme-wise breakdown
      const schemeStats = await Application.aggregate([
        { $match: { ...filter, status: { $in: ['approved', 'completed'] } } },
        {
          $group: {
            _id: '$scheme',
            count: { $sum: 1 },
            totalApproved: { $sum: '$approvedAmount' }
          }
        },
        {
          $lookup: {
            from: 'schemes',
            localField: '_id',
            foreignField: '_id',
            as: 'schemeDetails'
          }
        },
        { $unwind: '$schemeDetails' },
        {
          $project: {
            schemeName: '$schemeDetails.name',
            category: '$schemeDetails.category',
            count: 1,
            totalApproved: 1
          }
        },
        { $limit: 10 }
      ]);

      // Format statistics
      const stats = {
        applications: {
          total: 0,
          pending: 0,
          under_review: 0,
          approved: 0,
          rejected: 0,
          completed: 0,
          totalRequested: 0,
          totalApproved: 0
        },
        schemes: schemeStats
      };

      applicationStats.forEach(stat => {
        stats.applications.total += stat.count;
        stats.applications[stat._id] = stat.count;
        stats.applications.totalRequested += stat.totalRequested || 0;
        stats.applications.totalApproved += stat.totalApproved || 0;
      });

      return ResponseHelper.success(res, stats, 'Dashboard statistics retrieved successfully');

    } catch (error) {
      console.error('❌ Get Dashboard Stats Error:', error);
      return ResponseHelper.error(res, error.message, 500);
    }
  }
}

module.exports = new RegionalAdminController();
