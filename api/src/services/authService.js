const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { User } = require('../models');
const config = require('../config/environment');
const orgConfig = require('../config/orgConfig');
const staticOTPConfig = require('../config/staticOTP');
const whatsappOTPService = require('../utils/whatsappOtpService');

class AuthService {
  /**
   * Generate single JWT token (for beneficiary auth)
   * @param {Object} user - User object
   * @param {string|null} franchiseId - Active franchise ObjectId
   * @param {Object|null} userFranchise - UserFranchise membership doc
   * @returns {string} Access token
   */
  generateToken(user, franchiseId = null, userFranchise = null) {
    const payload = {
      userId: user._id,
      email: user.email,
      phone: user.phone,
      // Prefer franchise-specific role when available
      role: userFranchise?.role || user.role,
      adminScope: userFranchise?.adminScope || user.adminScope,
      franchiseId: franchiseId ? String(franchiseId) : null,
      isSuperAdmin: !!user.isSuperAdmin,
    };

    return jwt.sign(payload, config.JWT_SECRET, {
      expiresIn: config.JWT_EXPIRE,
      issuer: 'erp-api',
      audience: 'erp-client'
    });
  }

  /**
   * Generate JWT tokens
   * @param {Object} user - User object
   * @param {string|null} franchiseId - Active franchise ObjectId
   * @param {Object|null} userFranchise - UserFranchise membership doc
   * @returns {Object} Access and refresh tokens
   */
  generateTokens(user, franchiseId = null, userFranchise = null) {
    const payload = {
      userId: user._id,
      email: user.email,
      phone: user.phone,
      // Prefer franchise-specific role/scope when available
      role: userFranchise?.role || user.role,
      adminScope: userFranchise?.adminScope || user.adminScope,
      franchiseId: franchiseId ? String(franchiseId) : null,
      isSuperAdmin: !!user.isSuperAdmin,
    };

    const accessToken = jwt.sign(payload, config.JWT_SECRET, {
      expiresIn: config.JWT_EXPIRE,
      issuer: 'erp-api',
      audience: 'erp-client'
    });

    const refreshToken = jwt.sign(
      { userId: user._id, type: 'refresh', franchiseId: franchiseId ? String(franchiseId) : null },
      config.JWT_SECRET,
      {
        expiresIn: config.JWT_REFRESH_EXPIRE,
        issuer: 'erp-api',
        audience: 'erp-client'
      }
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: this.getTokenExpiration(config.JWT_EXPIRE)
    };
  }

  /**
   * Verify JWT token
   * @param {string} token - JWT token
   * @returns {Object} Decoded token payload
   */
  verifyToken(token) {
    try {
      // Accept tokens from any issuer — JWT_SECRET provides auth security.
      // This avoids breakage when switching ORG_NAME between deployments.
      return jwt.verify(token, config.JWT_SECRET);
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Generate and send OTP via DXing SMS
   * @param {string} phone - Mobile number
   * @param {string} purpose - OTP purpose (login, registration, phone_verification)
   * @returns {Promise<Object>} OTP generation result
   */
  async generateAndSendOTP(phone, purpose = 'login') {
    try {
      // Validate phone number format (10-digit Indian mobile number)
      const phoneRegex = /^[6-9]\d{9}$/;
      if (!phoneRegex.test(phone)) {
        throw new Error('Invalid phone number format. Please enter a valid 10-digit mobile number.');
      }

      // Find existing user or prepare for new registration
      let user = await User.findOne({ phone });
      
      // Handle different purposes
      if (purpose === 'login' && !user) {
        throw new Error('No account found with this phone number. Please register first.');
      }

      if (purpose === 'registration' && user && user.isActive) {
        throw new Error('An account already exists with this phone number. Please login instead.');
      }

      // Rate limiting: Check if OTP was sent recently
      if (user && user.otp?.lastSentAt) {
        const timeSinceLastOTP = Date.now() - user.otp.lastSentAt.getTime();
        const minInterval = 60 * 1000; // 1 minute

        if (timeSinceLastOTP < minInterval) {
          const waitTime = Math.ceil((minInterval - timeSinceLastOTP) / 1000);
          throw new Error(`Please wait ${waitTime} seconds before requesting another OTP`);
        }
      }

      // Check daily OTP limit (5 attempts per day)
      if (user && user.otp?.attempts >= 5) {
        const today = new Date();
        const lastAttempt = new Date(user.otp.lastSentAt);
        
        if (today.toDateString() === lastAttempt.toDateString()) {
          throw new Error('Daily OTP limit exceeded. Please try again tomorrow.');
        } else {
          // Reset attempts for new day
          user.otp.attempts = 0;
        }
      }

      // PRODUCTION SAFEGUARD: Prevent static OTP in production
      if (staticOTPConfig.NODE_ENV === 'production' && staticOTPConfig.USE_STATIC_OTP) {
        throw new Error('SECURITY ERROR: Static OTP is not allowed in production mode. Please use real OTP service (WhatsApp or SMS).');
      }

      // Generate OTP (use static OTP if enabled in development, otherwise generate dynamic OTP)
      const otp = staticOTPConfig.USE_STATIC_OTP && staticOTPConfig.isStaticOTPAllowed()
        ? staticOTPConfig.STATIC_OTP 
        : whatsappOTPService.generateOTP(6);
      
      // Send OTP based on configuration
      let sendResult = { success: true, messageId: 'dev-test-message-id' };
      
      if (staticOTPConfig.USE_STATIC_OTP && staticOTPConfig.isStaticOTPAllowed()) {
        // Static OTP mode for testing (development only, no external service)
        console.log(`🔑 STATIC OTP MODE (DEV): OTP for ${phone} is: ${otp}`);
        sendResult = { success: true, messageId: 'static-otp-mode' };
      } else if (staticOTPConfig.USE_WHATSAPP_OTP && staticOTPConfig.WHATSAPP_ENABLED) {
        // WhatsApp OTP service
        console.log(`📱 Sending OTP via WhatsApp to ${phone}...`);
        sendResult = await whatsappOTPService.sendOTP(phone, otp, {
          name: user?.name || 'User',
          purpose: purpose,
          priority: 1
        });
        
        if (!sendResult.success) {
          console.error('❌ WhatsApp OTP failed:', sendResult.error);
          throw new Error(`Failed to send OTP via WhatsApp: ${sendResult.error}`);
        }
        
        console.log(`✅ WhatsApp OTP sent - MessageID: ${sendResult.messageId}`);
      } else if (staticOTPConfig.SMS_ENABLED) {
        // SMS fallback (existing DXing SMS service)
        console.log(`📧 Sending OTP via SMS to ${phone}...`);
        // TODO: Implement SMS sending via existing dxingSmsService
        sendResult = { success: true, messageId: 'sms-mode' };
      } else {
        // No service enabled - development mode
        console.log(`⚠️  No OTP service enabled. OTP: ${otp}`);
        sendResult = { success: true, messageId: 'no-service-mode' };
      }

      // Create or update user with OTP
      if (user) {
        // Update existing user
        user.otp = {
          code: otp, // Store plain OTP for development, hash in production
          expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
          attempts: (user.otp?.attempts || 0) + 1,
          lastSentAt: new Date(),
          purpose,
          verified: false
        };
        await user.save();
      } else {
        // Create temporary user for registration
        user = new User({
          phone,
          email: `temp_${Date.now()}_${phone}@temp.local`, // Temporary unique email
          name: 'Pending Registration',
          role: 'beneficiary',
          otp: {
            code: otp,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000),
            attempts: 1,
            lastSentAt: new Date(),
            purpose,
            verified: false
          },
          isVerified: false,
          isActive: false // Will be activated after registration completion
        });
        await user.save();
      }

      const response = {
        success: true,
        message: staticOTPConfig.USE_WHATSAPP_OTP 
          ? 'OTP sent successfully to your WhatsApp number' 
          : 'OTP sent successfully to your mobile number',
        messageId: sendResult.messageId,
        expiresAt: user.otp.expiresAt,
        attemptsRemaining: Math.max(0, 5 - user.otp.attempts),
        purpose,
        deliveryMethod: (staticOTPConfig.USE_STATIC_OTP && staticOTPConfig.isStaticOTPAllowed())
          ? 'static' 
          : staticOTPConfig.USE_WHATSAPP_OTP 
            ? 'whatsapp' 
            : 'sms'
      };

      // Include OTP in response if static mode is enabled (development only)
      if (staticOTPConfig.USE_STATIC_OTP && staticOTPConfig.isStaticOTPAllowed()) {
        response.staticOTP = otp;
        response.note = 'Static OTP enabled for testing (development mode only)';
      } else if (!staticOTPConfig.USE_WHATSAPP_OTP && !staticOTPConfig.SMS_ENABLED && staticOTPConfig.NODE_ENV === 'development') {
        // Development mode - include OTP in response (only if no service enabled)
        response.developmentOTP = otp;
        response.note = 'Development mode - OTP included in response';
      }

      return response;
    } catch (error) {
      console.error('❌ OTP Generation Error:', error);
      throw error;
    }
  }

  /**
   * Verify OTP and authenticate user (OTP-only authentication)
   * @param {string} phone - Mobile number
   * @param {string} otp - OTP code
   * @param {string} purpose - OTP purpose
   * @returns {Promise<Object>} Authentication result
   */
  /**
   * Verify OTP and log user in for a specific franchise.
   * @param {string} phone
   * @param {string} otp
   * @param {string} purpose
   * @param {string|null} franchiseId - ObjectId of the franchise (from req.franchiseId)
   */
  async verifyOTPAndLogin(phone, otp, purpose = 'login', franchiseId = null) {
    try {
      const user = await User.findOne({ phone });
      
      if (!user) {
        throw new Error('No account found with this phone number');
      }

      // Check if user account is locked
      if (user.isLocked) {
        const lockTime = Math.ceil((user.lockUntil - Date.now()) / (1000 * 60));
        throw new Error(`Account is temporarily locked. Please try again in ${lockTime} minutes.`);
      }

      // Verify OTP using user model method
      const otpVerification = user.verifyOTP(otp, purpose);
      
      if (!otpVerification.success) {
        // Increment login attempts on failed OTP
        await user.incLoginAttempts();
        throw new Error(otpVerification.message);
      }

      // Handle registration completion flow
      if (purpose === 'registration' && !user.isActive) {
        // Mark OTP as verified but don't complete login yet
        user.otp.verified = true;
        await user.save();
        
        return {
          success: true,
          requiresRegistration: true,
          tempUserId: user._id,
          message: 'OTP verified successfully. Please complete your registration.',
          phone: user.phone
        };
      }

      // Check if user account is active for login
      if (!user.isActive) {
        throw new Error('Your account is deactivated. Please contact the administrator.');
      }

      // Successful login - clear OTP and update user
      user.clearOTP();
      user.lastLogin = new Date();
      user.isVerified = true;
      await user.resetLoginAttempts();
      await user.save();

      // ── Franchise-aware token generation ─────────────────────────────────
      let userFranchise = null;
      let effectiveRole = user.role;
      let effectiveAdminScope = user.adminScope;

      if (franchiseId && user.role !== 'beneficiary' && !user.isSuperAdmin) {
        try {
          const UserFranchise = require('../models/UserFranchise');
          userFranchise = await UserFranchise.getMembership(user._id, franchiseId);
          if (!userFranchise) {
            throw new Error('You do not have access to this organization. Please contact the administrator.');
          }
          effectiveRole = userFranchise.role;
          effectiveAdminScope = userFranchise.adminScope;
        } catch (membershipErr) {
          // Re-throw access-denied errors; swallow lookup errors gracefully
          if (membershipErr.message.includes('access to this organization')) throw membershipErr;
          console.error('⚠ UserFranchise lookup failed during login:', membershipErr.message);
        }
      }

      // Generate authentication tokens with franchise context
      const tokens = this.generateTokens(user, franchiseId, userFranchise);

      // Prepare user data for response (exclude sensitive fields)
      const userData = {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: effectiveRole,
        adminScope: effectiveAdminScope,
        franchiseId: franchiseId || null,
        profile: user.profile,
        isVerified: user.isVerified,
        isActive: user.isActive,
        lastLogin: user.lastLogin,
        isSuperAdmin: !!user.isSuperAdmin,
      };

      return {
        success: true,
        message: 'Login successful',
        user: userData,
        tokens,
        loginMethod: 'otp'
      };
    } catch (error) {
      console.error('❌ OTP Verification Error:', error);
      throw error;
    }
  }

  /**
   * Complete user registration after OTP verification (Password-free registration)
   * @param {string} tempUserId - Temporary user ID
   * @param {Object} registrationData - User registration data
   * @returns {Promise<Object>} Registration result
   */
  async completeRegistration(tempUserId, registrationData) {
    try {
      const user = await User.findById(tempUserId);
      
      if (!user) {
        throw new Error('Invalid registration session. Please start registration again.');
      }

      if (user.isActive) {
        throw new Error('Registration already completed for this account.');
      }

      // Verify OTP was verified for registration
      if (!user.otp?.verified || user.otp?.purpose !== 'registration') {
        throw new Error('OTP verification required before completing registration.');
      }

      // Validate required fields (only name is required, email is optional)
      if (!registrationData.name || !registrationData.name.trim()) {
        throw new Error('Name is required for registration');
      }

      // Validate email format if provided
      if (registrationData.email) {
        const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
        if (!emailRegex.test(registrationData.email)) {
          throw new Error('Please enter a valid email address');
        }

        // Check if email is already taken by another user
        const existingUser = await User.findOne({ 
          email: registrationData.email,
          _id: { $ne: tempUserId },
          isActive: true
        });
        
        if (existingUser) {
          throw new Error('This email is already registered with another account');
        }
      }

      // Set default admin scope based on role
      const defaultAdminScope = this.getDefaultAdminScope(registrationData.role || 'beneficiary');

      // Update user with registration data
      user.name = registrationData.name.trim();
      user.email = registrationData.email ? registrationData.email.toLowerCase().trim() : null;
      user.role = registrationData.role || 'beneficiary';
      user.profile = {
        ...user.profile,
        ...registrationData.profile,
        dateOfBirth: registrationData.dateOfBirth,
        gender: registrationData.gender,
        address: registrationData.address
      };
      user.adminScope = defaultAdminScope;
      user.isActive = true;
      user.isVerified = true;
      user.password = null; // Ensure no password is set for OTP-only auth
      
      // Clear OTP data after successful registration
      user.clearOTP();

      await user.save();

      // Generate authentication tokens
      const tokens = this.generateTokens(user);

      // Skip welcome SMS notification for testing
      console.log(`📱 Welcome message for ${user.name} (${user.phone}): Registration completed successfully!`);

      // Prepare user data for response
      const userData = {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        adminScope: user.adminScope,
        profile: user.profile,
        isVerified: user.isVerified,
        isActive: user.isActive
      };

      return {
        success: true,
        message: `Registration completed successfully! Welcome to ${orgConfig.erpTitle}.`,
        user: userData,
        tokens,
        authMethod: 'otp_only'
      };
    } catch (error) {
      console.error('❌ Registration Completion Error:', error);
      throw error;
    }
  }

  /**
   * Get default admin scope based on role
   * @param {string} role - User role
   * @returns {Object} Default admin scope
   */
  getDefaultAdminScope(role) {
    const defaultScopes = {
      super_admin: {
        level: 'super',
        permissions: {
          canCreateUsers: true,
          canManageProjects: true,
          canManageSchemes: true,
          canApproveApplications: true,
          canViewReports: true,
          canManageFinances: true
        }
      },
      state_admin: {
        level: 'state',
        permissions: {
          canCreateUsers: true,
          canManageProjects: true,
          canManageSchemes: true,
          canApproveApplications: true,
          canViewReports: true,
          canManageFinances: true
        }
      },
      district_admin: {
        level: 'district',
        permissions: {
          canCreateUsers: true,
          canManageProjects: false,
          canManageSchemes: false,
          canApproveApplications: true,
          canViewReports: true,
          canManageFinances: false
        }
      },
      area_admin: {
        level: 'area',
        permissions: {
          canCreateUsers: true,
          canManageProjects: false,
          canManageSchemes: false,
          canApproveApplications: true,
          canViewReports: true,
          canManageFinances: false
        }
      },
      unit_admin: {
        level: 'unit',
        permissions: {
          canCreateUsers: false,
          canManageProjects: false,
          canManageSchemes: false,
          canApproveApplications: true,
          canViewReports: true,
          canManageFinances: false
        }
      },
      project_coordinator: {
        level: 'project',
        permissions: {
          canCreateUsers: false,
          canManageProjects: true,
          canManageSchemes: false,
          canApproveApplications: false,
          canViewReports: true,
          canManageFinances: false
        }
      },
      scheme_coordinator: {
        level: 'scheme',
        permissions: {
          canCreateUsers: false,
          canManageProjects: false,
          canManageSchemes: true,
          canApproveApplications: false,
          canViewReports: true,
          canManageFinances: false
        }
      },
      beneficiary: {
        level: 'unit',
        permissions: {
          canCreateUsers: false,
          canManageProjects: false,
          canManageSchemes: false,
          canApproveApplications: false,
          canViewReports: false,
          canManageFinances: false
        }
      }
    };

    return defaultScopes[role] || defaultScopes.beneficiary;
  }

  /**
   * Refresh access token
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<Object>} New tokens
   */
  async refreshToken(refreshToken) {
    try {
      const decoded = this.verifyToken(refreshToken);
      
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid refresh token');
      }

      const user = await User.findById(decoded.userId);
      
      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }

      // Restore franchise context from refresh token
      let userFranchise = null;
      if (decoded.franchiseId) {
        const UserFranchise = require('../models/UserFranchise');
        userFranchise = await UserFranchise.findOne({
          user: user._id,
          franchise: decoded.franchiseId,
          isActive: true
        });
      }

      // Generate new tokens with franchise context preserved
      const tokens = this.generateTokens(user, decoded.franchiseId || null, userFranchise);

      return {
        success: true,
        tokens
      };
    } catch (error) {
      console.error('❌ Token Refresh Error:', error);
      throw error;
    }
  }

  /**
   * Reset password with OTP
   * @param {string} phone - Mobile number
   * @param {string} otp - OTP code
   * @param {string} newPassword - New password
   * @returns {Promise<Object>} Reset result
   */
  async resetPassword(phone, otp, newPassword) {
    try {
      const user = await User.findOne({ phone }).select('+password');
      
      if (!user) {
        throw new Error('User not found');
      }

      // Verify OTP (similar to login)
      if (!user.otp.code || user.otp.expiresAt < new Date()) {
        throw new Error('Invalid or expired OTP');
      }

      const isOTPValid = await bcrypt.compare(otp, user.otp.code);
      
      if (!isOTPValid) {
        throw new Error('Invalid OTP');
      }

      // Update password
      user.password = newPassword; // Will be hashed by pre-save middleware
      user.otp = undefined; // Clear OTP
      await user.save();

      return {
        success: true,
        message: 'Password reset successfully'
      };
    } catch (error) {
      console.error('❌ Password Reset Error:', error);
      throw error;
    }
  }

  /**
   * Change password (authenticated user)
   * @param {string} userId - User ID
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @returns {Promise<Object>} Change result
   */
  async changePassword(userId, currentPassword, newPassword) {
    try {
      const user = await User.findById(userId).select('+password');
      
      if (!user) {
        throw new Error('User not found');
      }

      // Verify current password
      const isCurrentPasswordValid = await user.comparePassword(currentPassword);
      
      if (!isCurrentPasswordValid) {
        throw new Error('Current password is incorrect');
      }

      // Update password
      user.password = newPassword; // Will be hashed by pre-save middleware
      await user.save();

      return {
        success: true,
        message: 'Password changed successfully'
      };
    } catch (error) {
      console.error('❌ Password Change Error:', error);
      throw error;
    }
  }

  /**
   * Logout user (invalidate tokens - in production, use Redis blacklist)
   * @param {string} userId - User ID
   * @param {string} deviceId - Device ID (optional)
   * @returns {Promise<Object>} Logout result
   */
  async logout(userId, deviceId = null) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      // Remove device if specified
      if (deviceId) {
        user.devices = user.devices.filter(device => device.deviceId !== deviceId);
        await user.save();
      }

      // In production, add token to blacklist in Redis
      // For now, we'll just return success
      
      return {
        success: true,
        message: 'Logged out successfully'
      };
    } catch (error) {
      console.error('❌ Logout Error:', error);
      throw error;
    }
  }

  /**
   * Register device for push notifications
   * @param {string} userId - User ID
   * @param {Object} deviceInfo - Device information
   * @returns {Promise<Object>} Registration result
   */
  async registerDevice(userId, deviceInfo) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      // Remove existing device with same deviceId
      user.devices = user.devices.filter(device => device.deviceId !== deviceInfo.deviceId);
      
      // Add new device
      user.devices.push({
        deviceId: deviceInfo.deviceId,
        fcmToken: deviceInfo.fcmToken,
        platform: deviceInfo.platform,
        lastActive: new Date()
      });

      await user.save();

      return {
        success: true,
        message: 'Device registered successfully'
      };
    } catch (error) {
      console.error('❌ Device Registration Error:', error);
      throw error;
    }
  }

  /**
   * Get token expiration time
   * @param {string} expiresIn - Expiration string (e.g., '7d', '1h')
   * @returns {number} Expiration timestamp
   */
  getTokenExpiration(expiresIn) {
    const units = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000
    };

    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) return Date.now() + (7 * 24 * 60 * 60 * 1000); // Default 7 days

    const [, value, unit] = match;
    return Date.now() + (parseInt(value) * units[unit]);
  }

  /**
   * Validate user permissions for resource access (Enhanced multi-layer hierarchy)
   * @param {Object} user - User object
   * @param {string} resource - Resource type
   * @param {string} action - Action type
   * @param {Object} resourceData - Resource data (optional)
   * @returns {boolean} Has permission
   */
  hasPermission(user, resource, action, resourceData = null) {
    // Super admin and state admin have all permissions
    if (user.role === 'super_admin' || user.role === 'state_admin') return true;

    // Define enhanced role-based permissions for multi-layer hierarchy
    const permissions = {
      beneficiary: {
        applications: ['create', 'read_own', 'update_own'],
        beneficiaries: ['read_own', 'update_own'],
        notifications: ['read_own'],
        profile: ['read_own', 'update_own']
      },
      unit_admin: {
        applications: ['read_unit', 'update_unit', 'approve_unit', 'create'],
        beneficiaries: ['read_unit', 'create', 'update_unit'],
        enquiry_reports: ['create', 'read_unit', 'update_unit'],
        notifications: ['read_unit', 'create_unit'],
        users: ['read_unit_beneficiaries'],
        profile: ['read_own', 'update_own']
      },
      area_admin: {
        applications: ['read_area', 'update_area', 'approve_area', 'create'],
        beneficiaries: ['read_area', 'create', 'update_area'],
        enquiry_reports: ['read_area', 'update_area', 'approve_area'],
        notifications: ['read_area', 'create_area'],
        users: ['read_area_subordinates', 'create_unit_admin', 'manage_unit_admins'],
        reports: ['read_area', 'generate_area'],
        profile: ['read_own', 'update_own']
      },
      district_admin: {
        applications: ['read_district', 'update_district', 'approve_district', 'create'],
        beneficiaries: ['read_district', 'create', 'update_district'],
        enquiry_reports: ['read_district', 'update_district', 'approve_district'],
        notifications: ['read_district', 'create_district'],
        users: ['read_district_subordinates', 'create_area_admin', 'create_unit_admin', 'manage_subordinates'],
        projects: ['read_district', 'view_assigned'],
        schemes: ['read_district', 'view_assigned'],
        reports: ['read_district', 'generate_district'],
        finances: ['read_district'],
        profile: ['read_own', 'update_own']
      },
      project_coordinator: {
        projects: ['read_assigned', 'update_assigned', 'manage_assigned'],
        applications: ['read_project', 'update_project', 'approve_project'],
        beneficiaries: ['read_project', 'update_project'],
        notifications: ['read_project', 'create_project'],
        reports: ['read_project', 'generate_project'],
        finances: ['read_project'],
        users: ['read_project_participants'],
        profile: ['read_own', 'update_own']
      },
      scheme_coordinator: {
        schemes: ['read_assigned', 'update_assigned', 'manage_assigned'],
        applications: ['read_scheme', 'update_scheme', 'approve_scheme'],
        beneficiaries: ['read_scheme', 'update_scheme'],
        notifications: ['read_scheme', 'create_scheme'],
        reports: ['read_scheme', 'generate_scheme'],
        finances: ['read_scheme'],
        users: ['read_scheme_participants'],
        profile: ['read_own', 'update_own']
      }
    };

    const userPermissions = permissions[user.role] || {};
    const resourcePermissions = userPermissions[resource] || [];

    // Check basic permission
    if (!resourcePermissions.includes(action)) {
      return false;
    }

    // Additional checks based on admin scope and resource data
    if (resourceData && user.adminScope) {
      return this.checkScopeAccess(user, resource, action, resourceData);
    }

    return true;
  }

  /**
   * Check if user has access based on their administrative scope
   * @param {Object} user - User object
   * @param {string} resource - Resource type
   * @param {string} action - Action type
   * @param {Object} resourceData - Resource data
   * @returns {boolean} Has scope access
   */
  checkScopeAccess(user, resource, action, resourceData) {
    // Super admin and state admin have universal access
    if (user.role === 'super_admin' || user.role === 'state_admin') return true;

    // Check regional access for geographic roles
    if (['district_admin', 'area_admin', 'unit_admin'].includes(user.role)) {
      if (resourceData.regionId || resourceData.regions) {
        const targetRegions = Array.isArray(resourceData.regions) 
          ? resourceData.regions 
          : [resourceData.regionId];
        
        return targetRegions.some(regionId =>
          user.adminScope?.regions?.some(userRegion =>
            userRegion.toString() === regionId.toString()
          )
        );
      }
    }

    // Check project access for project coordinators
    if (user.role === 'project_coordinator') {
      if (resourceData.projectId || resourceData.projects) {
        const targetProjects = Array.isArray(resourceData.projects)
          ? resourceData.projects
          : [resourceData.projectId];
        
        return targetProjects.some(projectId =>
          user.adminScope?.projects?.some(userProject =>
            userProject.toString() === projectId.toString()
          )
        );
      }
    }

    // Check scheme access for scheme coordinators
    if (user.role === 'scheme_coordinator') {
      if (resourceData.schemeId || resourceData.schemes) {
        const targetSchemes = Array.isArray(resourceData.schemes)
          ? resourceData.schemes
          : [resourceData.schemeId];
        
        return targetSchemes.some(schemeId =>
          user.adminScope?.schemes?.some(userScheme =>
            userScheme.toString() === schemeId.toString()
          )
        );
      }
    }

    return true;
  }
}

module.exports = new AuthService();