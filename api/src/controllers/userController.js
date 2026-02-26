const { User, Location, Project, Scheme, Role, UserRole, UserFranchise } = require('../models');
const authService = require('../services/authService');
const notificationService = require('../services/notificationService');
const ResponseHelper = require('../utils/responseHelper');

class UserController {
  /**
   * Get all users with filtering and pagination
   * GET /api/users
   */
  async getUsers(req, res) {
    try {
      const {
        role,
        isActive,
        region,
        search,
        page = 1,
        limit = 10,
        sort = 'createdAt',
        order = 'desc'
      } = req.query;

      // Build query based on user's access level
      let query = {};
      const currentUser = req.user;

      // Regional filtering based on user's admin scope
      // Super admin and state admin can see all users
      if (currentUser.role !== 'super_admin' && currentUser.role !== 'state_admin') {
        if (currentUser.adminScope && currentUser.adminScope.regions && currentUser.adminScope.regions.length > 0) {
          // For admin users, filter by adminScope.regions
          // For beneficiaries, filter by profile.location (district/area/unit)
          const regionIds = currentUser.adminScope.regions.map(r => 
            r.toString ? r.toString() : String(r)
          );
          
          query.$or = [
            // Admin users with matching adminScope.regions
            { 'adminScope.regions': { $in: regionIds } },
            // Beneficiaries with matching profile.location
            { 
              role: 'beneficiary',
              $or: [
                { 'profile.location.district': { $in: regionIds } },
                { 'profile.location.area': { $in: regionIds } },
                { 'profile.location.unit': { $in: regionIds } }
              ]
            }
          ];
        }
      }

      // Apply filters
      if (role) query.role = role;
      // Handle isActive filter - convert string to boolean
      if (isActive !== undefined && isActive !== null && isActive !== '') {
        query.isActive = isActive === 'true' || isActive === true;
      }
      if (region) {
        // If region filter is applied, combine with existing $or or create new one
        if (query.$or) {
          query.$and = [
            { $or: query.$or },
            { 'adminScope.regions': region }
          ];
          delete query.$or;
        } else {
          query['adminScope.regions'] = region;
        }
      }

      // Search functionality - combine with existing $or if present
      if (search) {
        const searchConditions = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } }
        ];
        
        if (query.$or) {
          // Combine search with existing $or using $and
          if (query.$and) {
            query.$and.push({ $or: searchConditions });
          } else {
            query.$and = [
              { $or: query.$or },
              { $or: searchConditions }
            ];
            delete query.$or;
          }
        } else {
          query.$or = searchConditions;
        }
      }

      // Pagination
      const skip = (page - 1) * limit;
      const sortOrder = order === 'desc' ? -1 : 1;

      // Franchise scope - restrict to users in this franchise
      if (req.franchiseId) {
        const franchiseUserIds = await UserFranchise.find({ franchise: req.franchiseId, isActive: true }).distinct('user');
        query._id = { $in: franchiseUserIds };
      }

      const users = await User.find(query)
        .populate('adminScope.regions', 'name type')
        .populate('adminScope.district', 'name type code')
        .populate('adminScope.area', 'name type code')
        .populate('adminScope.unit', 'name type code')
        .populate('adminScope.projects', 'name code')
        .populate('adminScope.schemes', 'name code')
        .populate('createdBy', 'name')
        .select('-password -otp')
        .sort({ [sort]: sortOrder })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await User.countDocuments(query);

      res.status(200).json({
        success: true,
        data: {
          users,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      console.error('❌ Get Users Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch users'
      });
    }
  }

  /**
   * Get user by ID
   * GET /api/users/:id
   */
  async getUserById(req, res) {
    try {
      const { id } = req.params;
      const currentUser = req.user;

      const user = await User.findById(id)
        .populate('adminScope.regions', 'name type code')
        .populate('adminScope.district', 'name type code')
        .populate('adminScope.area', 'name type code')
        .populate('adminScope.unit', 'name type code')
        .populate('adminScope.projects', 'name code')
        .populate('adminScope.schemes', 'name code')
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email')
        .select('-password -otp');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Check if current user can access this user's data
      // Super admin and state admin can view any user
      if (currentUser.role !== 'super_admin' && currentUser.role !== 'state_admin' && currentUser._id.toString() !== id) {
        // Check if the user is in the same region hierarchy
        const hasAccess = user.adminScope?.regions?.some(region =>
          currentUser.adminScope?.regions?.some(userRegion =>
            userRegion.toString() === region._id.toString()
          )
        );

        if (!hasAccess) {
          return res.status(403).json({
            success: false,
            message: 'Access denied. You cannot view this user.'
          });
        }
      }

      res.status(200).json({
        success: true,
        data: { user }
      });
    } catch (error) {
      console.error('❌ Get User By ID Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user'
      });
    }
  }

  /**
   * Create new user
   * POST /api/users
   */
  async createUser(req, res) {
    try {
      const userData = req.body;
      const currentUser = req.user;

      // Check if current user can create users with this role (Enhanced hierarchy)
      const roleHierarchy = {
        super_admin: ['super_admin', 'state_admin', 'district_admin', 'area_admin', 'unit_admin', 'project_coordinator', 'scheme_coordinator', 'beneficiary'],
        state_admin: ['district_admin', 'area_admin', 'unit_admin', 'project_coordinator', 'scheme_coordinator', 'beneficiary'],
        district_admin: ['area_admin', 'unit_admin', 'beneficiary'],
        area_admin: ['unit_admin', 'beneficiary'],
        unit_admin: ['beneficiary'],
        project_coordinator: [],
        scheme_coordinator: []
      };

      const allowedRoles = roleHierarchy[currentUser.role] || [];
      if (!allowedRoles.includes(userData.role)) {
        return res.status(403).json({
          success: false,
          message: `You are not authorized to create users with role: ${userData.role}`
        });
      }

      // Check if email or phone already exists
      // Build query conditions - only check email if it's provided and not empty
      const duplicateConditions = [
        { phone: userData.phone }
      ];
      
      // Only add email check if email is provided and not empty
      if (userData.email && userData.email.trim() !== '') {
        duplicateConditions.push({ email: userData.email.trim().toLowerCase() });
      }

      const existingUser = await User.findOne({
        $or: duplicateConditions
      });

      if (existingUser) {
        // Determine which field caused the duplicate
        const duplicateField = existingUser.phone === userData.phone ? 'phone' : 'email';
        return res.status(400).json({
          success: false,
          message: `User with this ${duplicateField} already exists`
        });
      }

      // Validate admin scope regions are within current user's scope
      // Super admin and state admin can assign any regions
      if (userData.adminScope?.regions && currentUser.role !== 'super_admin' && currentUser.role !== 'state_admin') {
        const invalidRegions = userData.adminScope.regions.filter(regionId =>
          !currentUser.adminScope?.regions?.some(userRegion =>
            userRegion.toString() === regionId.toString()
          )
        );

        if (invalidRegions.length > 0) {
          return res.status(403).json({
            success: false,
            message: 'You can only assign regions within your administrative scope'
          });
        }
      }

      // Set default admin scope and permissions based on role
      const defaultAdminScope = authService.getDefaultAdminScope(userData.role);
      
      // Prepare user data - ensure email is only included if provided and not empty
      const userDataToSave = { ...userData };
      if (userDataToSave.email && userDataToSave.email.trim() === '') {
        delete userDataToSave.email; // Remove empty email
      } else if (userDataToSave.email) {
        userDataToSave.email = userDataToSave.email.trim().toLowerCase();
      }
      
      // Create user (OTP-only authentication - no password)
      const user = new User({
        ...userDataToSave,
        password: null, // No password for OTP-only authentication
        adminScope: {
          ...defaultAdminScope,
          ...userData.adminScope // Override with provided scope if any
        },
        createdBy: currentUser._id,
        isVerified: true, // Admin-created users are pre-verified
        isActive: true
      });

      await user.save();

      // Create UserFranchise membership if operating within franchise context
      if (req.franchiseId && userData.role !== 'beneficiary') {
        try {
          const existingMembership = await UserFranchise.findOne({ user: user._id, franchise: req.franchiseId });
          if (!existingMembership) {
            const membership = new UserFranchise({
              user: user._id,
              franchise: req.franchiseId,
              role: userData.role,
              adminScope: user.adminScope,
              assignedBy: currentUser._id,
              isActive: true
            });
            await membership.save();
            console.log(`✅ UserFranchise membership created for ${user.name} in franchise ${req.franchiseId}`);
          }
        } catch (ufError) {
          console.error('❌ Error creating UserFranchise:', ufError);
          // Continue even if UserFranchise creation fails
        }
      }

      // Create UserRole entry to link user with system role
      try {
        const systemRole = await Role.findOne({ name: userData.role });
        if (systemRole) {
          const existingUserRole = await UserRole.findOne({
            user: user._id,
            role: systemRole._id,
            isActive: true
          });

          if (!existingUserRole) {
            const userRole = new UserRole({
              user: user._id,
              role: systemRole._id,
              assignedBy: currentUser._id,
              assignmentReason: 'User creation',
              isPrimary: true,
              approvalStatus: 'approved',
              isActive: true
            });
            await userRole.save();
            console.log(`✅ UserRole created for ${user.name} with role ${userData.role}`);
          }
        } else {
          console.warn(`⚠️  System role '${userData.role}' not found in database`);
        }
      } catch (roleError) {
        console.error('❌ Error creating UserRole:', roleError);
        // Continue even if UserRole creation fails - user still created
      }

      // Skip welcome SMS notification for testing
      console.log(`📱 Welcome message for ${user.name} (${user.phone}): Account created by ${currentUser.name}. Role: ${user.role}`);

      // Remove sensitive data before sending response
      const userResponse = await User.findById(user._id)
        .populate('adminScope.regions', 'name type')
        .populate('adminScope.projects', 'name code')
        .populate('adminScope.schemes', 'name code')
        .select('-password -otp');

      res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: { user: userResponse }
      });
    } catch (error) {
      console.error('❌ Create User Error:', error);
      
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'User with this email or phone already exists'
        });
      }

      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Update user
   * PUT /api/users/:id
   */
  async updateUser(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;
      const currentUser = req.user;

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Check permissions
      // Super admin and state admin can update any user
      if (currentUser.role !== 'super_admin' && currentUser.role !== 'state_admin' && currentUser._id.toString() !== id) {
        // Check if current user can update this user
        const canUpdate = user.adminScope?.regions?.some(region =>
          currentUser.adminScope?.regions?.some(userRegion =>
            userRegion.toString() === region._id.toString()
          )
        );

        if (!canUpdate) {
          return res.status(403).json({
            success: false,
            message: 'You are not authorized to update this user'
          });
        }
      }

      // Prevent role escalation
      if (updates.role && updates.role !== user.role) {
        const roleHierarchy = {
          super_admin: ['super_admin', 'state_admin', 'project_coordinator', 'scheme_coordinator', 'district_admin', 'area_admin', 'unit_admin', 'beneficiary'],
          state_admin: ['state_admin', 'project_coordinator', 'scheme_coordinator', 'district_admin', 'area_admin', 'unit_admin', 'beneficiary'],
          district_admin: ['area_admin', 'unit_admin', 'beneficiary'],
          area_admin: ['unit_admin', 'beneficiary']
        };

        const allowedRoles = roleHierarchy[currentUser.role] || [];
        if (!allowedRoles.includes(updates.role)) {
          return res.status(403).json({
            success: false,
            message: 'You are not authorized to assign this role'
          });
        }
      }

      // Validate admin scope regions
      // Super admin and state admin can assign any regions
      if (updates.adminScope?.regions && currentUser.role !== 'super_admin' && currentUser.role !== 'state_admin') {
        const invalidRegions = updates.adminScope.regions.filter(regionId =>
          !currentUser.adminScope?.regions?.some(userRegion =>
            userRegion.toString() === regionId.toString()
          )
        );

        if (invalidRegions.length > 0) {
          return res.status(403).json({
            success: false,
            message: 'You can only assign regions within your administrative scope'
          });
        }
      }

      // Check for duplicate email or phone if they're being updated
      if (updates.email !== undefined || updates.phone !== undefined) {
        const duplicateConditions = [];
        
        // Normalize phone numbers for comparison
        const currentPhone = user.phone ? String(user.phone).trim() : '';
        const newPhone = updates.phone ? String(updates.phone).trim() : '';
        
        // Check phone if it's being updated and different from current phone
        if (updates.phone !== undefined && newPhone !== '' && newPhone !== currentPhone) {
          duplicateConditions.push({ phone: newPhone });
        }
        
        // Normalize email for comparison
        const currentEmail = user.email ? String(user.email).trim().toLowerCase() : '';
        const newEmail = updates.email ? String(updates.email).trim().toLowerCase() : '';
        
        // Check email if it's being updated and not empty and different from current email
        if (updates.email !== undefined && newEmail !== '' && newEmail !== currentEmail) {
          duplicateConditions.push({ email: newEmail });
        }
        
        if (duplicateConditions.length > 0) {
          const existingUser = await User.findOne({
            _id: { $ne: id }, // Exclude current user
            $or: duplicateConditions
          });
          
          if (existingUser) {
            // Determine which field caused the duplicate
            let duplicateField = 'email';
            if (duplicateConditions.some(cond => cond.phone)) {
              duplicateField = existingUser.phone === newPhone ? 'phone' : 'email';
            }
            return res.status(400).json({
              success: false,
              message: `User with this ${duplicateField} already exists`
            });
          }
        }
      }

      // Remove sensitive fields that shouldn't be updated
      delete updates.password;
      delete updates.otp;
      delete updates.createdBy;

      // Clean up email field - remove if empty, lowercase if provided
      if (updates.email !== undefined) {
        if (updates.email && updates.email.trim() !== '') {
          updates.email = updates.email.trim().toLowerCase();
        } else {
          updates.email = undefined; // Set to undefined instead of empty string
        }
      }

      const updatedUser = await User.findByIdAndUpdate(
        id,
        { ...updates, updatedBy: currentUser._id },
        { new: true, runValidators: true }
      )
        .populate('adminScope.regions', 'name type')
        .populate('adminScope.projects', 'name code')
        .populate('adminScope.schemes', 'name code')
        .select('-password -otp');

      res.status(200).json({
        success: true,
        message: 'User updated successfully',
        data: { user: updatedUser }
      });
    } catch (error) {
      console.error('❌ Update User Error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Delete user (soft delete)
   * DELETE /api/users/:id
   */
  async deleteUser(req, res) {
    try {
      const { id } = req.params;
      const currentUser = req.user;

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Check permissions
      // Only super admin and state admin can delete users
      if (currentUser.role !== 'super_admin' && currentUser.role !== 'state_admin') {
        return res.status(403).json({
          success: false,
          message: 'Only super admins and state admins can delete users'
        });
      }

      // Prevent self-deletion
      if (currentUser._id.toString() === id) {
        return res.status(400).json({
          success: false,
          message: 'You cannot delete your own account'
        });
      }

      // Actually delete the user (hard delete)
      await User.findByIdAndDelete(id);

      // Also delete associated UserRole entries
      const UserRole = require('../models/UserRole');
      await UserRole.deleteMany({ user: id });

      res.status(200).json({
        success: true,
        message: 'User deleted successfully'
      });
    } catch (error) {
      console.error('❌ Delete User Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete user'
      });
    }
  }

  /**
   * Activate/Deactivate user
   * PATCH /api/users/:id/status
   */
  async toggleUserStatus(req, res) {
    try {
      const { id } = req.params;
      const { isActive, reason } = req.body;
      const currentUser = req.user;

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Check permissions
      // Super admin, state admin, and district admin can change user status
      if (currentUser.role !== 'super_admin' && currentUser.role !== 'state_admin' && currentUser.role !== 'district_admin') {
        return res.status(403).json({
          success: false,
          message: 'You are not authorized to change user status'
        });
      }

      // Prevent self-deactivation
      if (currentUser._id.toString() === id && !isActive) {
        return res.status(400).json({
          success: false,
          message: 'You cannot deactivate your own account'
        });
      }

      const updateData = {
        isActive,
        updatedBy: currentUser._id
      };

      if (!isActive) {
        updateData.deactivatedAt = new Date();
        updateData.deactivationReason = reason;
      } else {
        updateData.reactivatedAt = new Date();
        updateData.reactivationReason = reason;
      }

      await User.findByIdAndUpdate(id, updateData);

      // Send notification to user
      try {
        await notificationService.sendNotification({
          type: 'sms',
          recipient: id,
          title: `Account ${isActive ? 'Activated' : 'Deactivated'}`,
          message: `Your account has been ${isActive ? 'activated' : 'deactivated'}. ${reason ? `Reason: ${reason}` : ''}`,
          category: 'system',
          createdBy: currentUser._id
        });
      } catch (notificationError) {
        console.error('❌ Status change notification failed:', notificationError);
      }

      res.status(200).json({
        success: true,
        message: `User ${isActive ? 'activated' : 'deactivated'} successfully`
      });
    } catch (error) {
      console.error('❌ Toggle User Status Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update user status'
      });
    }
  }

  /**
   * Reset user password (admin only)
   * POST /api/users/:id/reset-password
   */
  async resetUserPassword(req, res) {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;
      const currentUser = req.user;

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Check permissions
      if (currentUser.role !== 'state_admin' && currentUser.role !== 'district_admin') {
        return res.status(403).json({
          success: false,
          message: 'You are not authorized to reset passwords'
        });
      }

      // Update password
      user.password = newPassword; // Will be hashed by pre-save middleware
      user.updatedBy = currentUser._id;
      await user.save();

      // Send notification
      try {
        await notificationService.sendNotification({
          type: 'sms',
          recipient: id,
          title: 'Password Reset',
          message: 'Your password has been reset by an administrator. Please login with your new password.',
          category: 'system',
          createdBy: currentUser._id
        });
      } catch (notificationError) {
        console.error('❌ Password reset notification failed:', notificationError);
      }

      res.status(200).json({
        success: true,
        message: 'Password reset successfully'
      });
    } catch (error) {
      console.error('❌ Reset User Password Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reset password'
      });
    }
  }

  /**
   * Get user statistics
   * GET /api/users/statistics
   */
  async getUserStatistics(req, res) {
    try {
      const currentUser = req.user;

      // Build query based on user's access level
      let matchQuery = {};
      if (currentUser.role !== 'state_admin') {
        if (currentUser.adminScope?.regions) {
          matchQuery['adminScope.regions'] = { $in: currentUser.adminScope.regions };
        }
      }

      const stats = await User.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: '$role',
            count: { $sum: 1 },
            active: { $sum: { $cond: ['$isActive', 1, 0] } },
            inactive: { $sum: { $cond: ['$isActive', 0, 1] } }
          }
        }
      ]);

      const totalUsers = await User.countDocuments(matchQuery);
      const activeUsers = await User.countDocuments({ ...matchQuery, isActive: true });
      const verifiedUsers = await User.countDocuments({ ...matchQuery, isVerified: true });
      const recentUsers = await User.countDocuments({
        ...matchQuery,
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      });

      res.status(200).json({
        success: true,
        data: {
          overview: {
            totalUsers: totalUsers,
            activeUsers: activeUsers,
            verifiedUsers: verifiedUsers,
            inactiveUsers: totalUsers - activeUsers,
            recentlyAdded: recentUsers
          },
          byRole: stats,
          lastUpdated: new Date()
        }
      });
    } catch (error) {
      console.error('❌ Get User Statistics Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user statistics'
      });
    }
  }

  /**
   * Get users by role
   * GET /api/users/by-role/:role
   */
  async getUsersByRole(req, res) {
    try {
      const { role } = req.params;
      const { region, active = true } = req.query;
      const currentUser = req.user;

      let query = { role };
      
      if (typeof active === 'boolean') {
        query.isActive = active;
      }

      // Regional filtering
      if (currentUser.role !== 'state_admin') {
        if (currentUser.adminScope?.regions) {
          query['adminScope.regions'] = { $in: currentUser.adminScope.regions };
        }
      }

      if (region) {
        query['adminScope.regions'] = region;
      }

      const users = await User.find(query)
        .populate('adminScope.regions', 'name type')
        .select('name email phone adminScope.regions isActive')
        .sort({ name: 1 });

      res.status(200).json({
        success: true,
        data: { users }
      });
    } catch (error) {
      console.error('❌ Get Users By Role Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch users by role'
      });
    }
  }

  /**
   * Bulk update users
   * PATCH /api/users/bulk-update
   */
  async bulkUpdateUsers(req, res) {
    try {
      const { userIds, updates } = req.body;
      const currentUser = req.user;

      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'User IDs array is required'
        });
      }

      // Check permissions
      if (currentUser.role !== 'state_admin' && currentUser.role !== 'district_admin') {
        return res.status(403).json({
          success: false,
          message: 'You are not authorized to perform bulk updates'
        });
      }

      // Remove sensitive fields
      delete updates.password;
      delete updates.otp;
      delete updates.role;

      const result = await User.updateMany(
        { _id: { $in: userIds } },
        { ...updates, updatedBy: currentUser._id }
      );

      res.status(200).json({
        success: true,
        message: `${result.modifiedCount} users updated successfully`,
        data: {
          matched: result.matchedCount,
          modified: result.modifiedCount
        }
      });
    } catch (error) {
      console.error('❌ Bulk Update Users Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update users'
      });
    }
  }

  /**
   * Assign role to user
   * PUT /api/users/:id/role
   */
  async assignRole(req, res) {
    try {
      const { id } = req.params;
      const { role, adminScope } = req.body;
      const currentUser = req.user;

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Check permissions using enhanced role hierarchy
      const roleHierarchy = {
        super_admin: ['super_admin', 'state_admin', 'district_admin', 'area_admin', 'unit_admin', 'project_coordinator', 'scheme_coordinator', 'beneficiary'],
        state_admin: ['district_admin', 'area_admin', 'unit_admin', 'project_coordinator', 'scheme_coordinator', 'beneficiary'],
        district_admin: ['area_admin', 'unit_admin', 'beneficiary'],
        area_admin: ['unit_admin', 'beneficiary'],
        unit_admin: ['beneficiary']
      };

      const allowedRoles = roleHierarchy[currentUser.role] || [];
      if (!allowedRoles.includes(role)) {
        return res.status(403).json({
          success: false,
          message: 'You are not authorized to assign this role'
        });
      }

      // Set default admin scope based on role
      const authService = require('../services/authService');
      const defaultScope = authService.getDefaultAdminScope(role);

      // Update user role and scope
      user.role = role;
      user.adminScope = {
        ...defaultScope,
        ...adminScope // Override with provided scope if any
      };
      user.updatedBy = currentUser._id;

      await user.save();

      const updatedUser = await User.findById(id)
        .populate('adminScope.regions', 'name type code')
        .populate('adminScope.projects', 'name code')
        .populate('adminScope.schemes', 'name code')
        .select('-password -otp');

      res.status(200).json({
        success: true,
        message: 'Role assigned successfully',
        data: { user: updatedUser }
      });
    } catch (error) {
      console.error('❌ Assign Role Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to assign role'
      });
    }
  }

  /**
   * Helper method to check if current user can manage target user
   */
  async canManageUser(currentUser, targetUser) {
    // Super admin and state admin can manage everyone
    if (currentUser.role === 'super_admin' || currentUser.role === 'state_admin') return true;

    // Users can manage themselves
    if (currentUser._id.toString() === targetUser._id.toString()) return true;

    // Check role hierarchy
    const roleHierarchy = {
      district_admin: ['area_admin', 'unit_admin', 'beneficiary'],
      area_admin: ['unit_admin', 'beneficiary'],
      unit_admin: ['beneficiary']
    };

    const managableRoles = roleHierarchy[currentUser.role] || [];
    if (!managableRoles.includes(targetUser.role)) return false;

    // Check regional access
    if (!targetUser.adminScope?.regions) return true;

    return targetUser.adminScope.regions.some(regionId =>
      currentUser.adminScope?.regions?.some(userRegion =>
        userRegion.toString() === regionId.toString()
      )
    );
  }
}

module.exports = new UserController();