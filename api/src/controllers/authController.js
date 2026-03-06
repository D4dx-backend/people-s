const authService = require('../services/authService');
const { User } = require('../models');
const UserFranchise = require('../models/UserFranchise');
const ResponseHelper = require('../utils/responseHelper');
const { logActivity } = require('../middleware/activityLogger');
const { CROSS_FRANCHISE_ROLES } = require('../middleware/crossFranchiseResolver');
const LoginLogService = require('../services/loginLogService');

class AuthController {
  /**
   * Send OTP for login or registration
   * POST /api/auth/send-otp
   */
  async sendOTP(req, res) {
    try {
      const { phone, purpose = 'login' } = req.body;

      // Validate input
      if (!phone) {
        return ResponseHelper.error(res, 'Phone number is required', 400);
      }

      // Validate purpose
      const validPurposes = ['login', 'registration', 'phone_verification'];
      if (!validPurposes.includes(purpose)) {
        return ResponseHelper.error(res, 'Invalid OTP purpose', 400);
      }

      // Generate and send OTP
      const result = await authService.generateAndSendOTP(phone, purpose);

      // Log OTP request activity
      await logActivity(req, {
        action: 'otp_requested',
        resource: 'auth',
        description: `OTP requested for phone ${phone} (${purpose})`,
        details: { phone, purpose },
        status: 'success',
        severity: 'low'
      });

      // Log to login logs
      await LoginLogService.logLoginEvent({
        userId: null,
        userType: 'admin',
        action: 'otp_requested',
        status: 'success',
        phone,
        req,
        otpDetails: { requestedAt: new Date(), purpose, channel: result.deliveryMethod || 'sms' }
      });

      return ResponseHelper.success(res, result, 'OTP sent successfully');
    } catch (error) {
      console.error('❌ Send OTP Error:', error);
      
      // Log failed OTP request
      await logActivity(req, {
        action: 'otp_request_failed',
        resource: 'auth',
        description: `Failed OTP request: ${error.message}`,
        details: { error: error.message, phone: req.body.phone },
        status: 'failed',
        severity: 'medium'
      });

      // Log failed OTP to login logs
      await LoginLogService.logLoginEvent({
        userId: null,
        userType: 'admin',
        action: 'otp_requested',
        status: 'failed',
        phone: req.body.phone || 'unknown',
        req,
        failureReason: 'server_error',
        metadata: { error: error.message }
      });
      
      return ResponseHelper.error(res, error.message, 400);
    }
  }

  /**
   * Verify OTP and login (OTP-only authentication)
   * POST /api/auth/verify-otp
   */
  async verifyOTP(req, res) {
    try {
      const { phone, otp, purpose = 'login' } = req.body;

      // Validate input
      if (!phone || !otp) {
        return ResponseHelper.error(res, 'Phone number and OTP are required', 400);
      }

      // Verify OTP and authenticate (pass franchiseId for franchise-specific role lookup)
      const result = await authService.verifyOTPAndLogin(phone, otp, purpose, req.franchiseId || null);

      // Log successful login to login logs
      await LoginLogService.logLoginEvent({
        userId: result.user?.id || result.user?._id || null,
        userType: 'admin',
        action: 'login_success',
        status: 'success',
        phone,
        req,
        otpDetails: { verifiedAt: new Date(), purpose }
      });

      return ResponseHelper.success(res, result, result.message);
    } catch (error) {
      console.error('❌ Verify OTP Error:', error);

      // Determine failure reason
      let failureReason = 'server_error';
      if (error.message.includes('Invalid OTP') || error.message.includes('invalid')) failureReason = 'invalid_otp';
      else if (error.message.includes('expired')) failureReason = 'expired_otp';
      else if (error.message.includes('not found')) failureReason = 'user_not_found';
      else if (error.message.includes('inactive') || error.message.includes('deactivated')) failureReason = 'user_inactive';
      else if (error.message.includes('attempts') || error.message.includes('maximum')) failureReason = 'max_attempts';

      // Log failed login to login logs
      await LoginLogService.logLoginEvent({
        userId: null,
        userType: 'admin',
        action: 'login_failed',
        status: 'failed',
        phone: req.body.phone || 'unknown',
        req,
        failureReason,
        metadata: { error: error.message }
      });

      return ResponseHelper.error(res, error.message, 400);
    }
  }

  /**
   * Complete registration after OTP verification
   * POST /api/auth/complete-registration
   */
  async completeRegistration(req, res) {
    try {
      const { tempUserId, name, email, profile } = req.body;

      // Validate input
      if (!tempUserId || !name || !email) {
        return ResponseHelper.error(res, 'Temporary user ID, name, and email are required', 400);
      }

      // Complete registration
      const registrationData = {
        name,
        email,
        profile: profile || {}
      };

      const result = await authService.completeRegistration(tempUserId, registrationData);

      return ResponseHelper.success(res, result, result.message);
    } catch (error) {
      console.error('❌ Complete Registration Error:', error);
      return ResponseHelper.error(res, error.message, 400);
    }
  }

  /**
   * Refresh access token
   * POST /api/auth/refresh-token
   */
  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return ResponseHelper.error(res, 'Refresh token is required', 400);
      }

      const result = await authService.refreshToken(refreshToken);

      // Log token refresh
      await LoginLogService.logLoginEvent({
        userId: result.user?.id || null,
        userType: 'admin',
        action: 'token_refresh',
        status: 'success',
        phone: result.user?.phone || 'unknown',
        req
      });

      return ResponseHelper.success(res, result, 'Token refreshed successfully');
    } catch (error) {
      console.error('❌ Refresh Token Error:', error);

      // Log failed token refresh  
      await LoginLogService.logLoginEvent({
        userId: null,
        userType: 'admin',
        action: 'token_refresh',
        status: 'failed',
        phone: 'unknown',
        req,
        failureReason: 'invalid_token',
        metadata: { error: error.message }
      });

      return ResponseHelper.error(res, error.message, 401);
    }
  }

  /**
   * Logout user
   * POST /api/auth/logout
   */
  async logout(req, res) {
    try {
      const userId = req.user._id;
      const { deviceId } = req.body;

      const result = await authService.logout(userId, deviceId);

      // Log logout to login logs
      await LoginLogService.logLoginEvent({
        userId,
        userType: 'admin',
        action: 'logout',
        status: 'success',
        phone: req.user.phone || 'unknown',
        req
      });

      return ResponseHelper.success(res, result, 'Logged out successfully');
    } catch (error) {
      console.error('❌ Logout Error:', error);
      return ResponseHelper.error(res, error.message, 500);
    }
  }

  /**
   * Get current user profile
   * GET /api/auth/profile
   */
  async getProfile(req, res) {
    try {
      const user = await User.findById(req.user._id)
        .populate('adminScope.regions', 'name type code')
        .populate('adminScope.projects', 'name code')
        .populate('adminScope.schemes', 'name code')
        .select('-password -otp');

      if (!user) {
        return ResponseHelper.error(res, 'User not found', 404);
      }

      return ResponseHelper.success(res, { user }, 'Profile retrieved successfully');
    } catch (error) {
      console.error('❌ Get Profile Error:', error);
      return ResponseHelper.error(res, 'Failed to retrieve profile', 500);
    }
  }

  /**
   * Update user profile
   * PUT /api/auth/profile
   */
  async updateProfile(req, res) {
    try {
      const userId = req.user._id;
      const updates = req.body;

      // Remove sensitive fields that shouldn't be updated via profile
      delete updates.password;
      delete updates.otp;
      delete updates.role;
      delete updates.adminScope;
      delete updates.isActive;
      delete updates.isVerified;

      const user = await User.findByIdAndUpdate(
        userId,
        { 
          ...updates,
          updatedBy: userId
        },
        { new: true, runValidators: true }
      )
        .populate('adminScope.regions', 'name type code')
        .populate('adminScope.projects', 'name code')
        .populate('adminScope.schemes', 'name code')
        .select('-password -otp');

      return ResponseHelper.success(res, { user }, 'Profile updated successfully');
    } catch (error) {
      console.error('❌ Update Profile Error:', error);
      return ResponseHelper.error(res, error.message, 400);
    }
  }

  /**
   * Change password (self-service for all roles)
   * POST /api/auth/change-password
   */
  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user._id;

      if (!newPassword || newPassword.length < 6) {
        return ResponseHelper.error(res, 'New password must be at least 6 characters', 400);
      }

      // Fetch user with password field (it's select: false by default)
      const user = await User.findById(userId).select('+password');
      if (!user) {
        return ResponseHelper.error(res, 'User not found', 404);
      }

      // If user already has a password, verify current password
      if (user.password) {
        if (!currentPassword) {
          return ResponseHelper.error(res, 'Current password is required', 400);
        }
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
          return ResponseHelper.error(res, 'Current password is incorrect', 401);
        }
      }
      // If user has no password (OTP-only), allow setting one without currentPassword

      user.password = newPassword; // Pre-save hook will hash it
      user.updatedBy = userId;
      await user.save();

      return ResponseHelper.success(res, null, 'Password changed successfully');
    } catch (error) {
      console.error('❌ Change Password Error:', error);
      return ResponseHelper.error(res, 'Failed to change password', 500);
    }
  }

  /**
   * Change phone number (requires OTP verification)
   * POST /api/auth/change-phone
   */
  async changePhone(req, res) {
    try {
      const { newPhone, otp } = req.body;
      const userId = req.user._id;

      if (!newPhone || !otp) {
        return ResponseHelper.error(res, 'New phone number and OTP are required', 400);
      }

      // Validate phone number format (10-digit Indian mobile number)
      const phoneRegex = /^[6-9]\d{9}$/;
      if (!phoneRegex.test(newPhone)) {
        return ResponseHelper.error(res, 'Invalid phone number format', 400);
      }

      // Check if phone number is already taken
      const existingUser = await User.findOne({ 
        phone: newPhone, 
        _id: { $ne: userId },
        isActive: true 
      });

      if (existingUser) {
        return ResponseHelper.error(res, 'This phone number is already registered', 400);
      }

      const user = await User.findById(userId);
      if (!user) {
        return ResponseHelper.error(res, 'User not found', 404);
      }

      // Verify OTP for phone change
      const otpVerification = user.verifyOTP(otp, 'phone_verification');
      if (!otpVerification.success) {
        return ResponseHelper.error(res, otpVerification.message, 400);
      }

      // Update phone number
      user.phone = newPhone;
      user.clearOTP();
      await user.save();

      return ResponseHelper.success(res, null, 'Phone number updated successfully');
    } catch (error) {
      console.error('❌ Change Phone Error:', error);
      return ResponseHelper.error(res, error.message, 500);
    }
  }

  /**
   * Register device for push notifications
   * POST /api/auth/register-device
   */
  async registerDevice(req, res) {
    try {
      const userId = req.user._id;
      const deviceInfo = req.body;

      // Validate required fields
      if (!deviceInfo.deviceId || !deviceInfo.platform) {
        return ResponseHelper.error(res, 'Device ID and platform are required', 400);
      }

      const result = await authService.registerDevice(userId, deviceInfo);

      return ResponseHelper.success(res, result, 'Device registered successfully');
    } catch (error) {
      console.error('❌ Register Device Error:', error);
      return ResponseHelper.error(res, error.message, 500);
    }
  }

  /**
   * Check authentication status
   * GET /api/auth/status
   */
  async checkAuthStatus(req, res) {
    try {
      const user = req.user;

      const authStatus = {
        isAuthenticated: true,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          adminScope: user.adminScope,
          isVerified: user.isVerified,
          isActive: user.isActive,
          lastLogin: user.lastLogin
        },
        authMethod: 'otp_only',
        permissions: {
          canCreateUsers: user.adminScope?.permissions?.canCreateUsers || false,
          canManageProjects: user.adminScope?.permissions?.canManageProjects || false,
          canManageSchemes: user.adminScope?.permissions?.canManageSchemes || false,
          canApproveApplications: user.adminScope?.permissions?.canApproveApplications || false,
          canViewReports: user.adminScope?.permissions?.canViewReports || false,
          canManageFinances: user.adminScope?.permissions?.canManageFinances || false
        }
      };

      return ResponseHelper.success(res, authStatus, 'Authentication status retrieved');
    } catch (error) {
      console.error('❌ Check Auth Status Error:', error);
      return ResponseHelper.error(res, 'Failed to check authentication status', 500);
    }
  }

  /**
   * Get franchises the current user has access to.
   * GET /api/auth/my-franchises
   *
   * For cross-franchise eligible roles (district_admin, area_admin, unit_admin)
   * this returns all active franchises the user is a member of.
   * For other roles it returns only the current franchise (if any).
   */
  async getMyFranchises(req, res) {
    try {
      const effectiveRole = req.userRole || req.user.role;

      if (CROSS_FRANCHISE_ROLES.includes(effectiveRole)) {
        const memberships = await UserFranchise.find({
          user: req.user._id,
          isActive: true
        }).populate('franchise', 'slug displayName logoUrl isActive');

        const franchises = memberships
          .filter(m => m.franchise && m.franchise.isActive)
          .map(m => ({
            id: m.franchise._id,
            slug: m.franchise.slug,
            displayName: m.franchise.displayName,
            logoUrl: m.franchise.logoUrl,
            role: m.role
          }));

        return ResponseHelper.success(res, {
          franchises,
          isCrossFranchise: franchises.length > 1,
          currentFranchiseId: req.franchiseId
        });
      }

      // Non-cross-franchise roles: return current franchise only
      const franchises = req.franchise
        ? [{
            id: req.franchise._id,
            slug: req.franchise.slug,
            displayName: req.franchise.displayName,
            logoUrl: req.franchise.logoUrl,
            role: effectiveRole
          }]
        : [];

      return ResponseHelper.success(res, {
        franchises,
        isCrossFranchise: false,
        currentFranchiseId: req.franchiseId
      });
    } catch (error) {
      console.error('❌ Get My Franchises Error:', error);
      return ResponseHelper.error(res, 'Failed to fetch franchises', 500);
    }
  }

  /**
   * Test DXing SMS service connection
   * GET /api/auth/test-sms
   */
  async testSMSService(req, res) {
    try {
      // Only allow super admin and state admin to test SMS service
      if (!['super_admin', 'state_admin'].includes(req.user.role)) {
        return ResponseHelper.error(res, 'Access denied', 403);
      }

      // SMS service disabled for testing
      const testResult = {
        success: true,
        message: 'SMS service disabled - using static OTP mode',
        mode: 'static_otp',
        otp: '123456'
      };

      return ResponseHelper.success(res, testResult, 'SMS service test completed (static mode)');
    } catch (error) {
      console.error('❌ Test SMS Service Error:', error);
      return ResponseHelper.error(res, error.message, 500);
    }
  }
}

module.exports = new AuthController();