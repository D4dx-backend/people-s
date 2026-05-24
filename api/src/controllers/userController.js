const { User, Location, Project, Scheme, Role, UserRole, UserFranchise } = require('../models');
const authService = require('../services/authService');
const notificationService = require('../services/notificationService');
const ResponseHelper = require('../utils/responseHelper');
const { buildFranchiseReadFilter, buildFranchiseMatchStage, getWriteFranchiseId } = require('../utils/franchiseFilterHelper');

/**
 * Enrich user objects with district/area/unit from adminScope.regions or UserFranchise.
 * Handles legacy users created before the separate district/area/unit fields were in use,
 * where the location was stored only in adminScope.regions[0].
 */
async function enrichUsersWithLocationScope(users, franchiseId) {
  if (!users || users.length === 0) return [];

  // Convert Mongoose docs to plain objects (preserving virtuals like 'id')
  const plain = users.map(u => (u.toObject ? u.toObject({ virtuals: true }) : u));

  // Step 1: Derive district/area/unit from regions[0] where role implies it
  for (const u of plain) {
    if (!u.adminScope) continue;
    const r0 = u.adminScope.regions?.[0];
    if (!r0) continue;
    if (u.role === 'district_admin' && !u.adminScope.district) {
      u.adminScope.district = r0;
    } else if (u.role === 'area_admin' && !u.adminScope.area) {
      u.adminScope.area = r0;
    } else if (['unit_admin', 'area_president'].includes(u.role) && !u.adminScope.unit) {
      u.adminScope.unit = r0;
    }
  }

  // Step 2: For users still missing location info, fall back to UserFranchise records
  const stillMissing = plain.filter(u =>
    ['district_admin', 'area_admin', 'unit_admin', 'area_president'].includes(u.role) &&
    !u.adminScope?.district
  );

  if (stillMissing.length > 0) {
    const missingIds = stillMissing.map(u => u._id);
    const ufQuery = { user: { $in: missingIds }, isActive: true };
    if (franchiseId) ufQuery.franchise = franchiseId;

    const memberships = await UserFranchise.find(ufQuery)
      .populate('adminScope.district', 'name type code')
      .populate('adminScope.area', 'name type code')
      .populate('adminScope.unit', 'name type code')
      .lean();

    // Map userId -> first membership that has any location data
    const membershipMap = {};
    for (const m of memberships) {
      const uid = m.user.toString();
      if (!membershipMap[uid] && (m.adminScope?.district || m.adminScope?.area || m.adminScope?.unit || m.adminScope?.regions?.length)) {
        membershipMap[uid] = m;
      }
    }

    for (const u of plain) {
      const m = membershipMap[u._id.toString()];
      if (!m?.adminScope) continue;
      if (!u.adminScope) u.adminScope = {};
      if (!u.adminScope.district && m.adminScope.district) u.adminScope.district = m.adminScope.district;
      if (!u.adminScope.area && m.adminScope.area) u.adminScope.area = m.adminScope.area;
      if (!u.adminScope.unit && m.adminScope.unit) u.adminScope.unit = m.adminScope.unit;
      if (!u.adminScope.regions?.length && m.adminScope.regions?.length) u.adminScope.regions = m.adminScope.regions;
      // Last resort: try regions[0] from UserFranchise
      if (!u.adminScope.district && m.adminScope.regions?.length > 0 && u.role === 'district_admin') {
        u.adminScope.district = m.adminScope.regions[0];
      }
    }
  }

  return plain;
}

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
        district,
        area,
        unit,
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
      // ── Role filter ─────────────────────────────────────────────────────
      // When in franchise context, filter by UserFranchise.role so that users
      // with multiple roles (e.g. district_admin + area_admin) appear correctly
      // in every role they hold — not just their User.role (primary role).
      let roleFilteredViaFranchise = false;
      if (role && req.franchiseId) {
        // Build a UserFranchise sub-query for role + location filters
        const ufQuery = { franchise: req.franchiseId, role, isActive: true };

        // Location filters applied to UserFranchise.adminScope instead of User.adminScope
        if (district) ufQuery['adminScope.district'] = district;
        if (area)     ufQuery['adminScope.area']     = area;
        if (unit)     ufQuery['adminScope.unit']     = unit;

        console.log('🔍 [getUsers] UserFranchise role query:', JSON.stringify(ufQuery));
        const roleFilteredIds = await UserFranchise.find(ufQuery).distinct('user');
        // Merge with any existing _id filter (e.g. from the regional scope above)
        if (query._id) {
          const existing = query._id.$in.map(String);
          query._id = { $in: roleFilteredIds.filter(id => existing.includes(String(id))) };
        } else {
          query._id = { $in: roleFilteredIds };
        }
        roleFilteredViaFranchise = true;
      } else if (role) {
        // Non-franchise context: fall back to User.role
        query.role = role;
      }

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

      // Location-specific filters (district / area / unit) on User.adminScope
      // Only apply if we didn't already handle them through UserFranchise above
      if (!roleFilteredViaFranchise) {
        if (district) {
          query.$or = [
            { 'adminScope.district': district },
            { 'profile.location.district': district }
          ];
        }
        if (area) {
          const areaConditions = [
            { 'adminScope.area': area },
            { 'profile.location.area': area }
          ];
          if (query.$or) {
            query.$and = [...(query.$and || []), { $or: query.$or }, { $or: areaConditions }];
            delete query.$or;
          } else {
            query.$or = areaConditions;
          }
        }
        if (unit) {
          const unitConditions = [
            { 'adminScope.unit': unit },
            { 'profile.location.unit': unit }
          ];
          if (query.$or) {
            query.$and = [...(query.$and || []), { $or: query.$or }, { $or: unitConditions }];
            delete query.$or;
          } else {
            query.$or = unitConditions;
          }
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

      const franchiseReadFilter = buildFranchiseReadFilter(req);
      if (Object.keys(franchiseReadFilter).length > 0) {
        const franchiseUserIds = await UserFranchise.find({ ...franchiseReadFilter, isActive: true }).distinct('user');
        if (query._id) {
          // Intersect: keep only IDs that satisfy both the role filter AND the franchise read scope
          const existing = query._id.$in.map(String);
          query._id = { $in: franchiseUserIds.filter(id => existing.includes(String(id))) };
        } else {
          query._id = { $in: franchiseUserIds };
        }
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

      // Enrich users: fill in missing district/area/unit from regions or UserFranchise
      const enrichedUsers = await enrichUsersWithLocationScope(users, req.franchiseId);

      res.status(200).json({
        success: true,
        data: {
          users: enrichedUsers,
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
        data: { user: (await enrichUsersWithLocationScope([user], req.franchiseId))[0] }
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
        super_admin: ['super_admin', 'state_admin', 'district_admin', 'area_admin', 'unit_admin', 'area_president', 'project_coordinator', 'scheme_coordinator', 'beneficiary'],
        state_admin: ['district_admin', 'area_admin', 'unit_admin', 'area_president', 'project_coordinator', 'scheme_coordinator', 'beneficiary'],
        district_admin: ['area_admin', 'unit_admin', 'area_president', 'beneficiary'],
        area_admin: ['unit_admin', 'area_president', 'beneficiary'],
        unit_admin: ['beneficiary'],
        area_president: ['beneficiary'],
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
          const existingMembership = await UserFranchise.findOne({ user: user._id, franchise: req.franchiseId, role: userData.role });
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
          district_admin: ['area_admin', 'unit_admin', 'area_president', 'beneficiary'],
          area_admin: ['unit_admin', 'area_president', 'beneficiary']
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
        .populate('adminScope.district', 'name type code')
        .populate('adminScope.area', 'name type code')
        .populate('adminScope.unit', 'name type code')
        .populate('adminScope.projects', 'name code')
        .populate('adminScope.schemes', 'name code')
        .select('-password -otp');

      // Sync adminScope changes to UserFranchise record if operating in franchise context
      if (req.franchiseId && updates.adminScope) {
        try {
          await UserFranchise.updateOne(
            { user: id, franchise: req.franchiseId, isActive: true },
            { $set: { adminScope: updatedUser.adminScope } }
          );
        } catch (ufErr) {
          console.warn('⚠️ Failed to sync adminScope to UserFranchise:', ufErr.message);
        }
      }

      res.status(200).json({
        success: true,
        message: 'User updated successfully',
        data: { user: (await enrichUsersWithLocationScope([updatedUser], req.franchiseId))[0] }
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

      // ── Franchise scoping ────────────────────────────────────────────────
      // Only count users that belong to this franchise
      let franchiseScopedIds = null;
      const franchiseReadFilter = buildFranchiseReadFilter(req);
      if (Object.keys(franchiseReadFilter).length > 0) {
        franchiseScopedIds = await UserFranchise.find({
          ...franchiseReadFilter,
          isActive: true,
        }).distinct('user');
      }

      // ── Base match query ─────────────────────────────────────────────────
      let matchQuery = {};

      // Apply franchise scope
      if (franchiseScopedIds !== null) {
        matchQuery._id = { $in: franchiseScopedIds };
      }

      // Apply region scope for non-super/state admins
      if (currentUser.role !== 'super_admin' && currentUser.role !== 'state_admin') {
        if (currentUser.adminScope?.regions?.length > 0) {
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
        super_admin: ['super_admin', 'state_admin', 'district_admin', 'area_admin', 'unit_admin', 'area_president', 'project_coordinator', 'scheme_coordinator', 'beneficiary'],
        state_admin: ['district_admin', 'area_admin', 'unit_admin', 'area_president', 'project_coordinator', 'scheme_coordinator', 'beneficiary'],
        district_admin: ['area_admin', 'unit_admin', 'area_president', 'beneficiary'],
        area_admin: ['unit_admin', 'area_president', 'beneficiary'],
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
      district_admin: ['area_admin', 'unit_admin', 'area_president', 'beneficiary'],
      area_admin: ['unit_admin', 'area_president', 'beneficiary'],
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

  /**
   * GET /api/users/subordinates
   * Returns all subordinate admin accounts visible to the caller.
   *
   * Hierarchy:
   *   state_admin    → district/area/unit/area_president admins in the franchise
   *   district_admin → area/unit/area_president admins in the caller's district
   *   area_admin     → unit/area_president admins in the caller's area
   *   unit_admin     → 403 (no subordinates)
   *   area_president → 403 (no subordinates)
   */
  async getSubordinates(req, res) {
    try {
      const callerRole = req.userRole || req.user.role;
      const callerScope = req.user.adminScope || {};

      const SUBORDINATE_MAP = {
        state_admin:    ['district_admin', 'area_admin', 'unit_admin', 'area_president'],
        district_admin: ['area_admin', 'unit_admin', 'area_president'],
        area_admin:     ['unit_admin', 'area_president'],
      };

      const subordinateRoles = SUBORDINATE_MAP[callerRole];
      if (!subordinateRoles) {
        return ResponseHelper.error(res, 'You do not have subordinate admins.', 403);
      }

      // Fetch all UserFranchise docs in this franchise with the relevant roles
      const franchiseFilter = buildFranchiseReadFilter(req);
      const memberships = await UserFranchise.find({
        franchise: req.franchiseId,
        role: { $in: subordinateRoles },
        isActive: true,
      })
        .populate('user', 'name phone email profile isActive lastLogin')
        .populate('adminScope.district', 'name type')
        .populate('adminScope.area', 'name type')
        .populate('adminScope.unit', 'name type');

      // Scope filtering: district_admin sees only their district; area_admin sees only their area
      // NOTE: adminScope fields are now populated objects; extract _id for comparison
      const toId = (val) => val?._id ? String(val._id) : String(val ?? '');
      let filtered = memberships;

      if (callerRole === 'district_admin' && callerScope.district) {
        filtered = memberships.filter(m => {
          const s = m.adminScope;
          return (
            toId(s?.district) === String(callerScope.district) ||
            (s?.regions || []).some(r => toId(r) === String(callerScope.district))
          );
        });
      } else if (callerRole === 'area_admin' && callerScope.area) {
        filtered = memberships.filter(m => {
          const s = m.adminScope;
          return (
            toId(s?.area) === String(callerScope.area) ||
            toId(s?.unit) === String(callerScope.area) ||
            (s?.regions || []).some(r => toId(r) === String(callerScope.area))
          );
        });
      }

      const result = filtered.map(m => {
        // Determine the most specific location name based on role
        const scope = m.adminScope || {};
        let locationName = null;
        if (m.role === 'unit_admin') {
          locationName = scope.unit?.name || null;
        } else if (m.role === 'area_admin' || m.role === 'area_president') {
          locationName = scope.area?.name || null;
        } else if (m.role === 'district_admin') {
          locationName = scope.district?.name || null;
        }

        return {
          userId:       m.user?._id,
          name:         m.user?.name,
          phone:        m.user?.phone,
          email:        m.user?.email,
          role:         m.role,
          adminScope:   m.adminScope,
          locationName,
          isActive:     m.user?.isActive,
          lastLogin:    m.user?.lastLogin,
          membershipId: m._id,
        };
      });

      return ResponseHelper.success(res, { subordinates: result, total: result.length });
    } catch (error) {
      console.error('❌ getSubordinates Error:', error);
      return ResponseHelper.error(res, 'Failed to fetch subordinates', 500);
    }
  }

  /**
   * GET /api/users/:id/roles
   * List all UserFranchise memberships for a user in the current franchise.
   */
  async getUserRoles(req, res) {
    try {
      const { id } = req.params;
      if (!req.franchiseId) {
        return res.status(400).json({ success: false, message: 'Franchise context required' });
      }
      const memberships = await UserFranchise.find({ user: id, franchise: req.franchiseId, isActive: true })
        .populate('adminScope.district', 'name code')
        .populate('adminScope.area', 'name code')
        .populate('adminScope.unit', 'name code')
        .sort({ createdAt: 1 });
      return ResponseHelper.success(res, { roles: memberships });
    } catch (error) {
      console.error('❌ getUserRoles Error:', error);
      return ResponseHelper.error(res, 'Failed to fetch user roles', 500);
    }
  }

  /**
   * GET /api/users/:id/franchise-memberships
   * Returns all franchises a user belongs to (active memberships), grouped by franchise.
   * Used by the frontend to show cross-franchise scope picker when adding roles.
   */
  async getUserFranchiseMemberships(req, res) {
    try {
      const { id } = req.params;
      const memberships = await UserFranchise.find({ user: id, isActive: true })
        .populate('franchise', 'displayName slug logoUrl')
        .sort({ createdAt: 1 });

      // Group by franchise
      const franchiseMap = new Map();
      for (const m of memberships) {
        if (!m.franchise) continue;
        const fid = String(m.franchise._id);
        if (!franchiseMap.has(fid)) {
          franchiseMap.set(fid, {
            id: fid,
            displayName: m.franchise.displayName,
            slug: m.franchise.slug,
            logoUrl: m.franchise.logoUrl,
            roles: [],
          });
        }
        franchiseMap.get(fid).roles.push(m.role);
      }

      return ResponseHelper.success(res, { franchises: Array.from(franchiseMap.values()) });
    } catch (error) {
      console.error('❌ getUserFranchiseMemberships Error:', error);
      return ResponseHelper.error(res, 'Failed to fetch franchise memberships', 500);
    }
  }

  /**
   * POST /api/users/:id/roles
   * Add a new role (UserFranchise membership) to an existing user.
   * Body: { role, adminScope?, franchiseIds? }
   *   franchiseIds: optional array of franchise IDs to apply to (defaults to current franchise)
   */
  async addUserRole(req, res) {
    try {
      const { id } = req.params;
      const { role, adminScope, franchiseIds } = req.body;
      const currentUser = req.user;

      // Role hierarchy check
      const roleHierarchy = {
        super_admin:    ['super_admin', 'state_admin', 'district_admin', 'area_admin', 'unit_admin', 'area_president', 'project_coordinator', 'scheme_coordinator', 'beneficiary'],
        state_admin:    ['district_admin', 'area_admin', 'unit_admin', 'area_president', 'project_coordinator', 'scheme_coordinator', 'beneficiary'],
        district_admin: ['area_admin', 'unit_admin', 'area_president', 'beneficiary'],
        area_admin:     ['unit_admin', 'area_president', 'beneficiary'],
        unit_admin:     ['beneficiary'],
        area_president: ['beneficiary'],
      };
      const allowedRoles = roleHierarchy[currentUser.role] || [];
      if (!allowedRoles.includes(role)) {
        return res.status(403).json({ success: false, message: `Not authorized to assign role: ${role}` });
      }

      const targetUser = await User.findById(id);
      if (!targetUser) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      if (targetUser.role === 'beneficiary') {
        return res.status(400).json({ success: false, message: 'Cannot assign admin roles to a beneficiary' });
      }

      // Determine which franchises to apply to
      let targetFranchiseIds = [];
      if (franchiseIds && Array.isArray(franchiseIds) && franchiseIds.length > 0) {
        targetFranchiseIds = franchiseIds;
      } else if (req.franchiseId) {
        targetFranchiseIds = [req.franchiseId];
      } else {
        return res.status(400).json({ success: false, message: 'Franchise context required' });
      }

      const results = [];
      for (const fid of targetFranchiseIds) {
        // Upsert: find existing membership (any active/inactive), update or create
        const existing = await UserFranchise.findOne({ user: id, franchise: fid, role });
        if (existing) {
          existing.isActive = true;
          existing.adminScope = adminScope || existing.adminScope || authService.getDefaultAdminScope(role);
          existing.assignedBy = currentUser._id;
          await existing.save();
          results.push({ franchiseId: fid, action: 'updated', membership: existing });
        } else {
          const membership = await UserFranchise.create({
            user: id,
            franchise: fid,
            role,
            adminScope: adminScope || authService.getDefaultAdminScope(role),
            assignedBy: currentUser._id,
            isActive: true,
          });
          results.push({ franchiseId: fid, action: 'created', membership });
        }
      }

      const message = targetFranchiseIds.length > 1
        ? `Role added to ${targetFranchiseIds.length} franchises`
        : 'Role added successfully';
      return res.status(201).json({ success: true, message, data: { results } });
    } catch (error) {
      console.error('❌ addUserRole Error:', error);
      if (error.code === 11000) {
        // Race condition — treat as success (already exists)
        return res.status(200).json({ success: true, message: 'Role already exists', data: {} });
      }
      return ResponseHelper.error(res, 'Failed to add role', 500);
    }
  }

  /**
   * DELETE /api/users/:id/roles/:role
   * Deactivate a UserFranchise membership (remove a role from a user).
   */
  async removeUserRole(req, res) {
    try {
      const { id, role } = req.params;
      const currentUser = req.user;

      if (!req.franchiseId) {
        return res.status(400).json({ success: false, message: 'Franchise context required' });
      }

      const roleHierarchy = {
        super_admin:    ['super_admin', 'state_admin', 'district_admin', 'area_admin', 'unit_admin', 'area_president', 'project_coordinator', 'scheme_coordinator', 'beneficiary'],
        state_admin:    ['district_admin', 'area_admin', 'unit_admin', 'area_president', 'project_coordinator', 'scheme_coordinator', 'beneficiary'],
        district_admin: ['area_admin', 'unit_admin', 'area_president', 'beneficiary'],
        area_admin:     ['unit_admin', 'area_president', 'beneficiary'],
        unit_admin:     ['beneficiary'],
        area_president: ['beneficiary'],
      };
      if (!(roleHierarchy[currentUser.role] || []).includes(role)) {
        return res.status(403).json({ success: false, message: `Not authorized to remove role: ${role}` });
      }

      const membership = await UserFranchise.findOne({ user: id, franchise: req.franchiseId, role, isActive: true });
      if (!membership) {
        return res.status(404).json({ success: false, message: 'Active role not found for this user' });
      }

      membership.isActive = false;
      await membership.save();

      return ResponseHelper.success(res, {}, 'Role removed successfully');
    } catch (error) {
      console.error('❌ removeUserRole Error:', error);
      return ResponseHelper.error(res, 'Failed to remove role', 500);
    }
  }
}

module.exports = new UserController();