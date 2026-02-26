const authService = require('../services/authService');
const { User, Location, UserFranchise } = require('../models');
const ResponseHelper = require('../utils/responseHelper');
const staticOTPConfig = require('../config/staticOTP');
const whatsappOTPService = require('../utils/whatsappOtpService');
const LoginLogService = require('../services/loginLogService');

class BeneficiaryAuthController {
  /**
   * Send OTP for beneficiary login/registration
   * POST /api/beneficiary/auth/send-otp
   */
  async sendOTP(req, res) {
    try {
      const { phone } = req.body;

      // Validate input
      if (!phone) {
        return ResponseHelper.error(res, 'Phone number is required', 400);
      }

      // Validate phone number format (10-digit Indian mobile number)
      const phoneRegex = /^[6-9]\d{9}$/;
      if (!phoneRegex.test(phone)) {
        return ResponseHelper.error(res, 'Invalid phone number format', 400);
      }

      // Check for test beneficiary account
      const isTestAccount = phone === '9999999999';

      // Check if user exists, if not create a beneficiary account
      let user = await User.findOne({ phone, isActive: true });
      
      if (!user) {
        // Create new beneficiary user
        user = new User({
          phone,
          role: 'beneficiary',
          name: isTestAccount ? 'Test Beneficiary' : `Beneficiary ${phone.slice(-4)}`, // Temporary name
          isVerified: isTestAccount ? true : false, // Test account is pre-verified
          isActive: true
        });
        await user.save();

        // Create UserFranchise membership for this franchise
        if (req.franchiseId) {
          try {
            const existingMembership = await UserFranchise.findOne({ user: user._id, franchise: req.franchiseId });
            if (!existingMembership) {
              await new UserFranchise({
                user: user._id,
                franchise: req.franchiseId,
                role: 'beneficiary',
                isActive: true
              }).save();
            }
          } catch (ufErr) {
            console.error('⚠️  UserFranchise creation failed for beneficiary:', ufErr.message);
          }
        }
      }

      // PRODUCTION SAFEGUARD: Prevent static OTP in production (except test account)
      if (!isTestAccount && staticOTPConfig.NODE_ENV === 'production' && staticOTPConfig.USE_STATIC_OTP) {
        throw new Error('SECURITY ERROR: Static OTP is not allowed in production mode. Please use real OTP service (WhatsApp or SMS).');
      }

      // Generate OTP based on configuration or test account
      const otp = isTestAccount 
        ? '123456' // Fixed OTP for test account (allowed in all environments)
        : (staticOTPConfig.USE_STATIC_OTP && staticOTPConfig.isStaticOTPAllowed())
          ? staticOTPConfig.STATIC_OTP 
          : whatsappOTPService.generateOTP(6);
      
      // Send OTP based on configuration
      let sendResult = { success: true, messageId: 'dev-test-message-id' };
      
      if (isTestAccount) {
        // Test account mode - no external service (allowed in all environments for testing)
        console.log(`🧪 TEST ACCOUNT MODE: OTP for ${phone} is: ${otp}`);
        sendResult = { success: true, messageId: 'test-account-mode' };
      } else if (staticOTPConfig.USE_STATIC_OTP && staticOTPConfig.isStaticOTPAllowed()) {
        // Static OTP mode for testing (development only, no external service)
        console.log(`🔑 STATIC OTP MODE (DEV): OTP for ${phone} is: ${otp}`);
        sendResult = { success: true, messageId: 'static-otp-mode' };
      } else if (staticOTPConfig.USE_WHATSAPP_OTP && staticOTPConfig.WHATSAPP_ENABLED) {
        // WhatsApp OTP service
        console.log(`📱 Sending OTP via WhatsApp to ${phone}...`);
        sendResult = await whatsappOTPService.sendOTP(phone, otp, {
          name: user.name || 'Beneficiary',
          purpose: 'beneficiary-login',
          priority: 1
        });
        
        if (!sendResult.success) {
          console.error('❌ WhatsApp OTP failed:', sendResult.error);
          throw new Error(`Failed to send OTP via WhatsApp: ${sendResult.error}`);
        }
        
        console.log(`✅ WhatsApp OTP sent - MessageID: ${sendResult.messageId}`);
      } else {
        // Development mode - no service enabled
        console.log(`⚠️  No OTP service enabled. OTP: ${otp}`);
        sendResult = { success: true, messageId: 'no-service-mode' };
      }
      
      // Set OTP in user model
      user.otp = {
        code: otp,
        expiresAt: new Date(Date.now() + staticOTPConfig.OTP_EXPIRY_MINUTES * 60 * 1000),
        attempts: (user.otp?.attempts || 0) + 1,
        lastSentAt: new Date(),
        purpose: 'beneficiary-login',
        verified: false
      };
      await user.save();

      const response = {
        message: isTestAccount
          ? 'Test account - OTP is always 123456'
          : staticOTPConfig.USE_WHATSAPP_OTP 
            ? 'OTP sent successfully to your WhatsApp number' 
            : 'OTP sent successfully',
        phone: phone,
        expiresIn: staticOTPConfig.OTP_EXPIRY_MINUTES,
        messageId: sendResult.messageId,
        deliveryMethod: isTestAccount
          ? 'test'
          : (staticOTPConfig.USE_STATIC_OTP && staticOTPConfig.isStaticOTPAllowed())
            ? 'static' 
            : staticOTPConfig.USE_WHATSAPP_OTP 
              ? 'whatsapp' 
              : 'development'
      };

      // Include OTP in response for test account or development modes only
      if (isTestAccount) {
        response.staticOTP = otp;
        response.note = 'Test account for Play Store testing - OTP is always 123456';
      } else if (staticOTPConfig.USE_STATIC_OTP && staticOTPConfig.isStaticOTPAllowed()) {
        response.staticOTP = otp;
        response.note = 'Static OTP enabled for testing (development mode only)';
      } else if (!staticOTPConfig.USE_WHATSAPP_OTP && !staticOTPConfig.SMS_ENABLED && staticOTPConfig.NODE_ENV === 'development') {
        // Development mode - include OTP in response (only if no service enabled)
        response.developmentOTP = otp;
        response.note = 'Development mode - OTP included in response';
      }

      // Log successful OTP request to login logs
      await LoginLogService.logLoginEvent({
        userId: user._id,
        userType: 'beneficiary',
        action: 'otp_requested',
        status: 'success',
        phone,
        req,
        otpDetails: {
          requestedAt: new Date(),
          purpose: 'beneficiary-login',
          channel: isTestAccount ? 'test' : (staticOTPConfig.USE_STATIC_OTP && staticOTPConfig.isStaticOTPAllowed()) ? 'static' : staticOTPConfig.USE_WHATSAPP_OTP ? 'whatsapp' : 'development'
        }
      });

      return ResponseHelper.success(res, response, 'OTP sent successfully');

    } catch (error) {
      console.error('❌ Beneficiary Send OTP Error:', error);

      // Log failed OTP request
      await LoginLogService.logLoginEvent({
        userId: null,
        userType: 'beneficiary',
        action: 'otp_requested',
        status: 'failed',
        phone: req.body.phone || 'unknown',
        req,
        failureReason: 'server_error',
        metadata: { error: error.message }
      });

      return ResponseHelper.error(res, error.message, 500);
    }
  }

  /**
   * Verify OTP and login beneficiary
   * POST /api/beneficiary/auth/verify-otp
   */
  async verifyOTP(req, res) {
    try {
      const { phone, otp } = req.body;

      // Validate input
      if (!phone || !otp) {
        return ResponseHelper.error(res, 'Phone number and OTP are required', 400);
      }

      // Check for test beneficiary account
      const isTestAccount = phone === '9999999999';

      // Find user
      const user = await User.findOne({ phone, isActive: true });
      if (!user) {
        // Log failed login - user not found
        await LoginLogService.logLoginEvent({
          userId: null,
          userType: 'beneficiary',
          action: 'login_failed',
          status: 'failed',
          phone,
          req,
          failureReason: 'user_not_found'
        });
        return ResponseHelper.error(res, 'User not found', 404);
      }

      // Verify OTP - special handling for test account
      let otpVerification;
      if (isTestAccount) {
        // Test account: only accept OTP 123456
        if (otp === '123456') {
          otpVerification = { success: true, message: 'Test account OTP verified' };
          // Mark OTP as verified for test account
          if (user.otp) {
            user.otp.verified = true;
          }
        } else {
          // Log failed test account login
          await LoginLogService.logLoginEvent({
            userId: user._id,
            userType: 'beneficiary',
            action: 'login_failed',
            status: 'failed',
            phone,
            req,
            failureReason: 'invalid_otp'
          });
          return ResponseHelper.error(res, 'Invalid OTP. Test account OTP is always 123456', 400);
        }
      } else {
        // Regular account: use standard OTP verification
        otpVerification = user.verifyOTP(otp, 'beneficiary-login');
        if (!otpVerification.success) {
          // Log failed OTP verification
          await LoginLogService.logLoginEvent({
            userId: user._id,
            userType: 'beneficiary',
            action: 'login_failed',
            status: 'failed',
            phone,
            req,
            failureReason: otpVerification.message.includes('expired') ? 'expired_otp' : 'invalid_otp',
            metadata: { message: otpVerification.message }
          });
          return ResponseHelper.error(res, otpVerification.message, 400);
        }
      }

      // Generate JWT token
      console.log('🔑 Generating token for beneficiary:');
      console.log('- User ID:', user._id);
      console.log('- User role:', user.role);
      console.log('- User phone:', user.phone);
      
      const token = authService.generateToken(user);
      console.log('- Token generated (first 50 chars):', token.substring(0, 50) + '...');

      // Update last login and clear OTP
      user.lastLogin = new Date();
      user.clearOTP();
      await user.save();

      // Return user data and token
      const userData = {
        id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        isVerified: user.isVerified,
        profile: user.profile
      };

      console.log('✅ Beneficiary login successful');
      console.log('- Returning user data:', userData);

      // Log successful login to login logs
      await LoginLogService.logLoginEvent({
        userId: user._id,
        userType: 'beneficiary',
        action: 'login_success',
        status: 'success',
        phone,
        req,
        otpDetails: { verifiedAt: new Date(), purpose: 'beneficiary-login' }
      });

      return ResponseHelper.success(res, {
        user: userData,
        token,
        message: 'Login successful'
      }, 'Login successful');

    } catch (error) {
      console.error('❌ Beneficiary Verify OTP Error:', error);

      // Determine failure reason
      let failureReason = 'server_error';
      if (error.message.includes('Invalid OTP') || error.message.includes('invalid')) failureReason = 'invalid_otp';
      else if (error.message.includes('expired')) failureReason = 'expired_otp';
      else if (error.message.includes('not found')) failureReason = 'user_not_found';
      else if (error.message.includes('inactive')) failureReason = 'user_inactive';

      // Log failed login to login logs
      await LoginLogService.logLoginEvent({
        userId: null,
        userType: 'beneficiary',
        action: 'login_failed',
        status: 'failed',
        phone: req.body.phone || 'unknown',
        req,
        failureReason,
        metadata: { error: error.message }
      });

      return ResponseHelper.error(res, error.message, 500);
    }
  }

  /**
   * Update beneficiary profile
   * PUT /api/beneficiary/auth/profile
   */
  async updateProfile(req, res) {
    try {
      const userId = req.user._id;
      const { name, profile } = req.body;

      // Build update object
      const updateData = {
        updatedBy: userId,
        isVerified: true // Mark as verified after profile completion
      };

      // Update name if provided
      if (name) {
        updateData.name = name.trim();
      }

      // Update profile fields if provided
      if (profile) {
        if (profile.dateOfBirth) {
          updateData['profile.dateOfBirth'] = profile.dateOfBirth;
        }
        if (profile.gender) {
          updateData['profile.gender'] = profile.gender;
        }
        if (profile.address) {
          updateData['profile.address'] = profile.address;
        }
        if (profile.emergencyContact) {
          updateData['profile.emergencyContact'] = profile.emergencyContact;
        }
        // Update location references
        if (profile.location) {
          if (profile.location.district) {
            updateData['profile.location.district'] = profile.location.district;
          }
          if (profile.location.area) {
            updateData['profile.location.area'] = profile.location.area;
          }
          if (profile.location.unit) {
            updateData['profile.location.unit'] = profile.location.unit;
          }
        }
      }

      const user = await User.findByIdAndUpdate(
        userId,
        { $set: updateData },
        { new: true, runValidators: true }
      )
        .select('-password -otp')
        .populate('profile.location.district', 'name code type')
        .populate('profile.location.area', 'name code type')
        .populate('profile.location.unit', 'name code type');

      if (!user) {
        return ResponseHelper.error(res, 'User not found', 404);
      }

      return ResponseHelper.success(res, { user }, 'Profile updated successfully');

    } catch (error) {
      console.error('❌ Update Beneficiary Profile Error:', error);
      return ResponseHelper.error(res, error.message, 400);
    }
  }

  /**
   * Get beneficiary profile
   * GET /api/beneficiary/auth/profile
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
      console.error('❌ Get Beneficiary Profile Error:', error);
      return ResponseHelper.error(res, 'Failed to retrieve profile', 500);
    }
  }

  /**
   * Resend OTP
   * POST /api/beneficiary/auth/resend-otp
   */
  async resendOTP(req, res) {
    try {
      const { phone } = req.body;

      if (!phone) {
        return ResponseHelper.error(res, 'Phone number is required', 400);
      }

      // Check for test beneficiary account
      const isTestAccount = phone === '9999999999';

      const user = await User.findOne({ phone, isActive: true });
      if (!user) {
        return ResponseHelper.error(res, 'User not found', 404);
      }


      // PRODUCTION SAFEGUARD: Prevent static OTP in production (except test account)
      if (!isTestAccount && staticOTPConfig.NODE_ENV === 'production' && staticOTPConfig.USE_STATIC_OTP) {
        throw new Error('SECURITY ERROR: Static OTP is not allowed in production mode. Please use real OTP service (WhatsApp or SMS).');
      }

      // Generate OTP based on configuration or test account
      const otp = isTestAccount
        ? '123456' // Fixed OTP for test account (allowed in all environments)
        : (staticOTPConfig.USE_STATIC_OTP && staticOTPConfig.isStaticOTPAllowed())
          ? staticOTPConfig.STATIC_OTP 
          : user.generateOTP('beneficiary-login');
      
      // Set OTP in user model
      user.otp = {
        code: otp,
        expiresAt: new Date(Date.now() + staticOTPConfig.OTP_EXPIRY_MINUTES * 60 * 1000),
        attempts: (user.otp?.attempts || 0) + 1,
        lastSentAt: new Date(),
        purpose: 'beneficiary-login',
        verified: false
      };
      await user.save();

      // Log OTP generation mode
      if (isTestAccount) {
        console.log(`🧪 TEST ACCOUNT MODE: Resent OTP for ${phone} is: ${otp}`);
      } else if (staticOTPConfig.USE_STATIC_OTP && staticOTPConfig.isStaticOTPAllowed()) {
        console.log(`🔑 STATIC OTP MODE (DEV): Resent OTP for ${phone} is: ${otp}`);
      }
      const smsResult = { success: true, messageId: isTestAccount ? 'test-account-mode' : 'static-otp-mode' };

      const response = {
        message: isTestAccount ? 'Test account - OTP is always 123456' : 'OTP resent successfully',
        expiresIn: staticOTPConfig.OTP_EXPIRY_MINUTES
      };

      // Include OTP in response for test account or static mode (development only)
      if (isTestAccount) {
        response.staticOTP = otp;
        response.note = 'Test account for Play Store testing - OTP is always 123456';
      } else if (staticOTPConfig.USE_STATIC_OTP && staticOTPConfig.isStaticOTPAllowed()) {
        response.staticOTP = otp;
        response.note = 'Static OTP enabled for testing (development mode only)';
      }

      // Log OTP resend to login logs
      await LoginLogService.logLoginEvent({
        userId: user._id,
        userType: 'beneficiary',
        action: 'otp_resent',
        status: 'success',
        phone,
        req,
        otpDetails: {
          requestedAt: new Date(),
          purpose: 'beneficiary-login',
          channel: isTestAccount ? 'test' : 'static'
        }
      });

      return ResponseHelper.success(res, response, 'OTP resent successfully');

    } catch (error) {
      console.error('❌ Resend OTP Error:', error);

      // Log failed OTP resend
      await LoginLogService.logLoginEvent({
        userId: null,
        userType: 'beneficiary',
        action: 'otp_resent',
        status: 'failed',
        phone: req.body.phone || 'unknown',
        req,
        failureReason: 'server_error',
        metadata: { error: error.message }
      });

      return ResponseHelper.error(res, error.message, 500);
    }
  }

  /**
   * Get locations for beneficiary signup
   * GET /api/beneficiary/auth/locations
   */
  async getLocations(req, res) {
    try {
      const { type, parent } = req.query;

      const query = { isActive: true };
      
      if (type) {
        query.type = type;
      }
      
      if (parent) {
        query.parent = parent;
      }

      const locations = await Location.find(query)
        .select('_id name code type parent')
        .sort({ name: 1 });

      return ResponseHelper.success(res, { locations }, 'Locations retrieved successfully');

    } catch (error) {
      console.error('❌ Get Locations Error:', error);
      return ResponseHelper.error(res, 'Failed to retrieve locations', 500);
    }
  }
}

module.exports = new BeneficiaryAuthController();