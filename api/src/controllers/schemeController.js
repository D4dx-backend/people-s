const { Scheme, Project, Location } = require('../models');
const ResponseHelper = require('../utils/responseHelper');
const formConfigurationController = require('./formConfigurationController');
const { updateApplicationsDistributionTimeline } = require('./applicationController');

class SchemeController {
  /**
   * Get all schemes with filtering and pagination
   * GET /api/schemes
   */
  async getSchemes(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        category,
        project,
        priority,
        search
      } = req.query;

      // Build filter query
      const filter = {};
      
      if (status) filter.status = status;
      if (category) filter.category = category;
      if (project) filter.project = project;
      if (priority) filter.priority = priority;
      
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { code: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }

      // Apply regional access control
      if (req.user.role !== 'super_admin' && req.user.role !== 'state_admin') {
        const userRegions = req.user.adminScope?.regions || [];
        if (userRegions.length > 0) {
          // Include schemes with no target regions (applicable to all) or schemes in user's regions
          const regionalFilter = [
            { targetRegions: { $size: 0 } }, // Schemes applicable to all regions
            { targetRegions: { $in: userRegions } } // Schemes in user's regions
          ];
          
          // Merge with existing $or filter if present
          if (filter.$or) {
            filter.$and = [
              { $or: filter.$or },
              { $or: regionalFilter }
            ];
            delete filter.$or;
          } else {
            filter.$or = regionalFilter;
          }
        }
      }

      const skip = (page - 1) * limit;

      // Multi-tenant: restrict to current franchise
      if (req.franchiseId) filter.franchise = req.franchiseId;
      
      const schemes = await Scheme.find(filter)
        .populate('project', 'name code description')
        .populate('targetRegions', 'name type code')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Scheme.countDocuments(filter);

      return ResponseHelper.success(res, {
        schemes,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('❌ Get Schemes Error:', error);
      return ResponseHelper.error(res, 'Failed to fetch schemes', 500);
    }
  }

  /**
   * Get scheme by ID
   * GET /api/schemes/:id
   */
  async getSchemeById(req, res) {
    try {
      const { id } = req.params;

      const scheme = await Scheme.findOne({ _id: id, franchise: req.franchiseId })
        .populate('project', 'name code description coordinator')
        .populate('targetRegions', 'name type code parent')
        .populate('createdBy', 'name email profile')
        .populate('updatedBy', 'name email');

      if (!scheme) {
        return ResponseHelper.error(res, 'Scheme not found', 404);
      }

      // Check access permissions
      if (!scheme.canUserAccess(req.user)) {
        return ResponseHelper.error(res, 'Access denied to this scheme', 403);
      }

      return ResponseHelper.success(res, { scheme });
    } catch (error) {
      console.error('❌ Get Scheme Error:', error);
      return ResponseHelper.error(res, 'Failed to fetch scheme', 500);
    }
  }

  /**
   * Create new scheme
   * POST /api/schemes
   */
  async createScheme(req, res) {
    try {
      const schemeData = {
        ...req.body,
        createdBy: req.user._id,
        franchise: req.franchiseId || null  // Multi-tenant
      };

      // Validate project exists
      if (schemeData.project) {
        const project = await Project.findOne({ _id: schemeData.project, franchise: req.franchiseId });
        if (!project) {
          return ResponseHelper.error(res, 'Invalid project specified', 400);
        }
      }

      // Validate target regions exist (if provided)
      if (schemeData.targetRegions && schemeData.targetRegions.length > 0) {
        const regions = await Location.find({ _id: { $in: schemeData.targetRegions } });
        if (regions.length !== schemeData.targetRegions.length) {
          return ResponseHelper.error(res, 'One or more invalid target regions specified', 400);
        }
      } else {
        // If no target regions specified, make it applicable to all regions
        schemeData.targetRegions = [];
      }

      // Apply default configurations if not provided
      if (!schemeData.distributionTimeline || schemeData.distributionTimeline.length === 0) {
        schemeData.distributionTimeline = [
          {
            description: "Initial Payment (First Installment)",
            percentage: 50,
            daysFromApproval: 7,
            requiresVerification: true,
            notes: "First installment after approval"
          },
          {
            description: "Progress Payment (Second Installment)",
            percentage: 30,
            daysFromApproval: 60,
            requiresVerification: true,
            notes: "Payment after progress verification"
          },
          {
            description: "Final Payment (Completion)",
            percentage: 20,
            daysFromApproval: 120,
            requiresVerification: true,
            notes: "Final payment upon completion"
          }
        ];
      }

      if (!schemeData.statusStages || schemeData.statusStages.length === 0) {
        schemeData.statusStages = [
          {
            name: "Application Received",
            description: "Initial application submission and registration",
            order: 1,
            isRequired: true,
            allowedRoles: ['super_admin', 'state_admin', 'district_admin', 'area_admin', 'unit_admin'],
            autoTransition: true,
            transitionConditions: "Automatically set when application is submitted"
          },
          {
            name: "Document Verification",
            description: "Verification of submitted documents and eligibility",
            order: 2,
            isRequired: true,
            allowedRoles: ['super_admin', 'state_admin', 'district_admin', 'area_admin', 'unit_admin'],
            autoTransition: false,
            transitionConditions: ""
          },
          {
            name: "Field Verification",
            description: "Physical verification and field assessment",
            order: 3,
            isRequired: false,
            allowedRoles: ['super_admin', 'state_admin', 'district_admin', 'area_admin', 'unit_admin'],
            autoTransition: false,
            transitionConditions: ""
          },
          {
            name: "Interview Process",
            description: "Beneficiary interview and assessment",
            order: 4,
            isRequired: schemeData.applicationSettings?.requiresInterview || false,
            allowedRoles: ['super_admin', 'state_admin', 'district_admin', 'area_admin', 'unit_admin', 'scheme_coordinator'],
            autoTransition: false,
            transitionConditions: ""
          },
          {
            name: "Final Review",
            description: "Final review and decision making",
            order: 5,
            isRequired: true,
            allowedRoles: ['super_admin', 'state_admin', 'district_admin', 'area_admin'],
            autoTransition: false,
            transitionConditions: ""
          },
          {
            name: "Approved",
            description: "Application approved for disbursement",
            order: 6,
            isRequired: true,
            allowedRoles: ['super_admin', 'state_admin', 'district_admin', 'area_admin'],
            autoTransition: false,
            transitionConditions: ""
          },
          {
            name: "Disbursement",
            description: "Money disbursement to beneficiary",
            order: 7,
            isRequired: true,
            allowedRoles: ['super_admin', 'state_admin', 'district_admin', 'area_admin'],
            autoTransition: false,
            transitionConditions: ""
          },
          {
            name: "Completed",
            description: "Application process completed successfully",
            order: 8,
            isRequired: true,
            allowedRoles: ['super_admin', 'state_admin', 'district_admin', 'area_admin'],
            autoTransition: true,
            transitionConditions: "Automatically set when all disbursements are complete"
          }
        ];
      }

      const scheme = new Scheme(schemeData);
      await scheme.save();

      const populatedScheme = await Scheme.findOne({ _id: scheme._id, franchise: req.franchiseId })
        .populate('project', 'name code description')
        .populate('targetRegions', 'name type code')
        .populate('createdBy', 'name email');

      return ResponseHelper.success(res, { scheme: populatedScheme }, 'Scheme created successfully', 201);
    } catch (error) {
      console.error('❌ Create Scheme Error:', error);
      
      if (error.code === 11000) {
        return ResponseHelper.error(res, 'Scheme code already exists', 400);
      }
      
      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(err => err.message);
        return ResponseHelper.error(res, messages.join(', '), 400);
      }
      
      return ResponseHelper.error(res, 'Failed to create scheme', 500);
    }
  }

  /**
   * Update scheme
   * PUT /api/schemes/:id
   */
  async updateScheme(req, res) {
    try {
      const { id } = req.params;
      const updateData = {
        ...req.body,
        updatedBy: req.user._id
      };

      const scheme = await Scheme.findOne({ _id: id, franchise: req.franchiseId });
      if (!scheme) {
        return ResponseHelper.error(res, 'Scheme not found', 404);
      }

      // Check access permissions
      if (!scheme.canUserAccess(req.user)) {
        return ResponseHelper.error(res, 'Access denied to this scheme', 403);
      }

      // Validate project if being updated
      if (updateData.project) {
        const project = await Project.findOne({ _id: updateData.project, franchise: req.franchiseId });
        if (!project) {
          return ResponseHelper.error(res, 'Invalid project specified', 400);
        }
      }

      // Validate target regions if being updated
      if (updateData.targetRegions && updateData.targetRegions.length > 0) {
        const regions = await Location.find({ _id: { $in: updateData.targetRegions } });
        if (regions.length !== updateData.targetRegions.length) {
          return ResponseHelper.error(res, 'One or more invalid target regions specified', 400);
        }
      } else if (updateData.targetRegions !== undefined) {
        // If explicitly set to empty, make it applicable to all regions
        updateData.targetRegions = [];
      }

      // Check if distribution timeline is being updated
      const isDistributionTimelineUpdated = updateData.distributionTimeline && 
        JSON.stringify(updateData.distributionTimeline) !== JSON.stringify(scheme.distributionTimeline);

      Object.assign(scheme, updateData);
      await scheme.save();

      // If distribution timeline was updated, update all related applications
      if (isDistributionTimelineUpdated && updateData.distributionTimeline) {
        console.log(`Distribution timeline updated for scheme ${scheme._id}, updating related applications...`);
        
        // Update applications in the background (don't wait for completion)
        updateApplicationsDistributionTimeline(scheme._id, updateData.distributionTimeline, req.user._id)
          .then(result => {
            console.log(`Applications update result for scheme ${scheme._id}:`, result);
          })
          .catch(error => {
            console.error(`Error updating applications for scheme ${scheme._id}:`, error);
          });
      }

      const populatedScheme = await Scheme.findOne({ _id: scheme._id, franchise: req.franchiseId })
        .populate('project', 'name code description')
        .populate('targetRegions', 'name type code')
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email');

      return ResponseHelper.success(res, { scheme: populatedScheme }, 'Scheme updated successfully');
    } catch (error) {
      console.error('❌ Update Scheme Error:', error);
      
      if (error.code === 11000) {
        return ResponseHelper.error(res, 'Scheme code already exists', 400);
      }
      
      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(err => err.message);
        return ResponseHelper.error(res, messages.join(', '), 400);
      }
      
      return ResponseHelper.error(res, 'Failed to update scheme', 500);
    }
  }

  /**
   * Delete scheme
   * DELETE /api/schemes/:id
   */
  async deleteScheme(req, res) {
    try {
      const { id } = req.params;

      const scheme = await Scheme.findOne({ _id: id, franchise: req.franchiseId });
      if (!scheme) {
        return ResponseHelper.error(res, 'Scheme not found', 404);
      }

      // Check access permissions
      if (!scheme.canUserAccess(req.user)) {
        return ResponseHelper.error(res, 'Access denied to this scheme', 403);
      }

      // Check if scheme has applications (prevent deletion if has applications)
      if (scheme.statistics.totalApplications > 0) {
        return ResponseHelper.error(res, 'Cannot delete scheme with existing applications', 400);
      }

      await Scheme.findOneAndDelete({ _id: id, franchise: req.franchiseId });

      return ResponseHelper.success(res, null, 'Scheme deleted successfully');
    } catch (error) {
      console.error('❌ Delete Scheme Error:', error);
      return ResponseHelper.error(res, 'Failed to delete scheme', 500);
    }
  }

  /**
   * Get scheme statistics
   * GET /api/schemes/stats
   */
  async getSchemeStats(req, res) {
    try {
      // Build filter based on user access
      const filter = {};
      if (req.user.role !== 'super_admin' && req.user.role !== 'state_admin') {
        const userRegions = req.user.adminScope?.regions || [];
        if (userRegions.length > 0) {
          // Include schemes with no target regions (applicable to all) or schemes in user's regions
          filter.$or = [
            { targetRegions: { $size: 0 } }, // Schemes applicable to all regions
            { targetRegions: { $in: userRegions } } // Schemes in user's regions
          ];
        }
      }

      const stats = await Scheme.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalSchemes: { $sum: 1 },
            totalBudget: { $sum: '$budget.total' },
            totalAllocated: { $sum: '$budget.allocated' },
            totalSpent: { $sum: '$budget.spent' },
            activeSchemes: {
              $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
            },
            totalApplications: { $sum: '$statistics.totalApplications' },
            totalBeneficiaries: { $sum: '$statistics.totalBeneficiaries' },
            totalAmountDisbursed: { $sum: '$statistics.totalAmountDisbursed' }
          }
        }
      ]);

      const categoryStats = await Scheme.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            totalBudget: { $sum: '$budget.total' },
            totalBeneficiaries: { $sum: '$statistics.totalBeneficiaries' }
          }
        }
      ]);

      const statusStats = await Scheme.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      return ResponseHelper.success(res, {
        overview: stats[0] || {
          totalSchemes: 0,
          totalBudget: 0,
          totalAllocated: 0,
          totalSpent: 0,
          activeSchemes: 0,
          totalApplications: 0,
          totalBeneficiaries: 0,
          totalAmountDisbursed: 0
        },
        byCategory: categoryStats,
        byStatus: statusStats
      });
    } catch (error) {
      console.error('❌ Get Scheme Stats Error:', error);
      return ResponseHelper.error(res, 'Failed to fetch scheme statistics', 500);
    }
  }

  /**
   * Get active schemes for applications
   * GET /api/schemes/active
   */
  async getActiveSchemes(req, res) {
    try {
      const filter = {
        status: 'active',
        'applicationSettings.startDate': { $lte: new Date() },
        'applicationSettings.endDate': { $gte: new Date() }
      };

      // Apply regional access control
      if (req.user.role !== 'super_admin' && req.user.role !== 'state_admin') {
        const userRegions = req.user.adminScope?.regions || [];
        if (userRegions.length > 0) {
          // Include schemes with no target regions (applicable to all) or schemes in user's regions
          filter.$or = [
            { targetRegions: { $size: 0 } }, // Schemes applicable to all regions
            { targetRegions: { $in: userRegions } } // Schemes in user's regions
          ];
        }
      }

      const schemes = await Scheme.find(filter)
        .populate('project', 'name code')
        .populate('targetRegions', 'name type code')
        .select('name code description category benefits eligibility applicationSettings statistics')
        .sort({ 'applicationSettings.endDate': 1 });

      return ResponseHelper.success(res, { schemes });
    } catch (error) {
      console.error('❌ Get Active Schemes Error:', error);
      return ResponseHelper.error(res, 'Failed to fetch active schemes', 500);
    }
  }

  /**
   * Get form configuration for a scheme
   * GET /api/schemes/:id/form-config
   */
  async getFormConfiguration(req, res) {
    // Delegate to FormConfiguration controller
    req.params.schemeId = req.params.id;
    return formConfigurationController.getFormConfiguration(req, res);
  }

  /**
   * Update form configuration for a scheme
   * PUT /api/schemes/:id/form-config
   */
  async updateFormConfiguration(req, res) {
    // Delegate to FormConfiguration controller
    req.params.schemeId = req.params.id;
    return formConfigurationController.updateFormConfiguration(req, res);
  }

  /**
   * Update distribution timeline for all applications of a scheme
   * POST /api/schemes/:id/update-applications-timeline
   */
  async updateApplicationsTimeline(req, res) {
    try {
      const { id } = req.params;

      const scheme = await Scheme.findOne({ _id: id, franchise: req.franchiseId });
      if (!scheme) {
        return ResponseHelper.error(res, 'Scheme not found', 404);
      }

      // Check access permissions
      if (!scheme.canUserAccess(req.user)) {
        return ResponseHelper.error(res, 'Access denied to this scheme', 403);
      }

      if (!scheme.distributionTimeline || scheme.distributionTimeline.length === 0) {
        return ResponseHelper.error(res, 'No distribution timeline configured for this scheme', 400);
      }

      console.log(`Manual timeline update requested for scheme ${id} by user ${req.user._id}`);

      // Update all related applications
      const result = await updateApplicationsDistributionTimeline(
        scheme._id, 
        scheme.distributionTimeline, 
        req.user._id
      );

      if (result.success) {
        return ResponseHelper.success(res, {
          updated: result.updated,
          failed: result.failed,
          total: result.total,
          details: result.results
        }, `Successfully updated ${result.updated} applications out of ${result.total}`);
      } else {
        return ResponseHelper.error(res, result.error || 'Failed to update applications', 500);
      }
    } catch (error) {
      console.error('❌ Update Applications Timeline Error:', error);
      return ResponseHelper.error(res, 'Failed to update applications timeline', 500);
    }
  }
}

module.exports = new SchemeController();