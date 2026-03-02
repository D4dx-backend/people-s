const { Project, User, Location, MasterData } = require('../models');
const ResponseHelper = require('../utils/responseHelper');

class ProjectController {
  /**
   * Get all projects with filtering and pagination
   * GET /api/projects
   */
  async getProjects(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        category,
        priority,
        scope,
        coordinator,
        search
      } = req.query;

      // Build filter query
      const filter = {};
      
      if (status) filter.status = status;
      if (category) filter.category = category;
      if (priority) filter.priority = priority;
      if (scope) filter.scope = scope;
      if (coordinator) filter.coordinator = coordinator;
      
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
          filter.targetRegions = { $in: userRegions };
        }
      }

      const skip = (page - 1) * limit;

      // Multi-tenant: restrict to current franchise
      if (req.franchiseId) filter.franchise = req.franchiseId;
      
      const projects = await Project.find(filter)
        .populate('coordinator', 'name email phone role')
        .populate('targetRegions', 'name type code')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Project.countDocuments(filter);

      return ResponseHelper.success(res, {
        projects,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('❌ Get Projects Error:', error);
      return ResponseHelper.error(res, 'Failed to fetch projects', 500);
    }
  }

  /**
   * Get project by ID
   * GET /api/projects/:id
   */
  async getProjectById(req, res) {
    try {
      const { id } = req.params;

      const project = await Project.findOne({ _id: id, franchise: req.franchiseId })
        .populate('coordinator', 'name email phone role profile')
        .populate('targetRegions', 'name type code parent')
        .populate('team.user', 'name email phone role')
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email');

      if (!project) {
        return ResponseHelper.error(res, 'Project not found', 404);
      }

      // Check access permissions
      if (!project.canUserAccess(req.user)) {
        return ResponseHelper.error(res, 'Access denied to this project', 403);
      }

      return ResponseHelper.success(res, { project });
    } catch (error) {
      console.error('❌ Get Project Error:', error);
      return ResponseHelper.error(res, 'Failed to fetch project', 500);
    }
  }

  /**
   * Create new project
   * POST /api/projects
   */
  async createProject(req, res) {
    try {
      const projectData = {
        ...req.body,
        createdBy: req.user._id,
        franchise: req.franchiseId || null  // Multi-tenant
      };

      // Validate coordinator exists
      if (projectData.coordinator) {
        const coordinator = await User.findById(projectData.coordinator);
        if (!coordinator) {
          return ResponseHelper.error(res, 'Invalid coordinator specified', 400);
        }
      }

      // Validate target regions exist
      if (projectData.targetRegions && projectData.targetRegions.length > 0) {
        const regions = await Location.find({ _id: { $in: projectData.targetRegions } });
        if (regions.length !== projectData.targetRegions.length) {
          return ResponseHelper.error(res, 'One or more invalid target regions specified', 400);
        }
      }

      // Apply default status configuration if not provided
      if (!projectData.statusConfiguration || !projectData.statusConfiguration.stages || projectData.statusConfiguration.stages.length === 0) {
        projectData.statusConfiguration = {
          stages: [
            {
              name: "Project Initiation",
              description: "Initial project setup, planning, and resource allocation",
              order: 1,
              isRequired: true,
              allowedRoles: ['super_admin', 'state_admin', 'project_coordinator'],
              estimatedDuration: 7
            },
            {
              name: "Planning & Design",
              description: "Detailed planning, design, and approval process",
              order: 2,
              isRequired: true,
              allowedRoles: ['super_admin', 'state_admin', 'project_coordinator'],
              estimatedDuration: 14
            },
            {
              name: "Implementation",
              description: "Active project implementation and execution",
              order: 3,
              isRequired: true,
              allowedRoles: ['super_admin', 'state_admin', 'project_coordinator', 'area_admin', 'unit_admin'],
              estimatedDuration: 90
            },
            {
              name: "Monitoring & Evaluation",
              description: "Progress monitoring and quality evaluation",
              order: 4,
              isRequired: true,
              allowedRoles: ['super_admin', 'state_admin', 'project_coordinator'],
              estimatedDuration: 30
            },
            {
              name: "Completion & Closure",
              description: "Project completion, documentation, and closure",
              order: 5,
              isRequired: true,
              allowedRoles: ['super_admin', 'state_admin', 'project_coordinator'],
              estimatedDuration: 7
            }
          ],
          enablePublicTracking: false,
          notificationSettings: {
            emailNotifications: true,
            smsNotifications: false
          }
        };
      }

      const project = new Project(projectData);
      await project.save();

      const populatedProject = await Project.findOne({ _id: project._id, franchise: req.franchiseId })
        .populate('coordinator', 'name email phone role')
        .populate('targetRegions', 'name type code')
        .populate('createdBy', 'name email');

      return ResponseHelper.success(res, { project: populatedProject }, 'Project created successfully', 201);
    } catch (error) {
      console.error('❌ Create Project Error:', error);
      
      if (error.code === 11000) {
        return ResponseHelper.error(res, 'Project code already exists', 400);
      }
      
      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(err => err.message);
        return ResponseHelper.error(res, messages.join(', '), 400);
      }
      
      return ResponseHelper.error(res, 'Failed to create project', 500);
    }
  }

  /**
   * Update project
   * PUT /api/projects/:id
   */
  async updateProject(req, res) {
    try {
      const { id } = req.params;
      const updateData = {
        ...req.body,
        updatedBy: req.user._id
      };

      const project = await Project.findOne({ _id: id, franchise: req.franchiseId });
      if (!project) {
        return ResponseHelper.error(res, 'Project not found', 404);
      }

      // Check access permissions
      if (!project.canUserAccess(req.user)) {
        return ResponseHelper.error(res, 'Access denied to this project', 403);
      }

      // Validate coordinator if being updated
      if (updateData.coordinator) {
        const coordinator = await User.findById(updateData.coordinator);
        if (!coordinator) {
          return ResponseHelper.error(res, 'Invalid coordinator specified', 400);
        }
      }

      // Validate target regions if being updated
      if (updateData.targetRegions && updateData.targetRegions.length > 0) {
        const regions = await Location.find({ _id: { $in: updateData.targetRegions } });
        if (regions.length !== updateData.targetRegions.length) {
          return ResponseHelper.error(res, 'One or more invalid target regions specified', 400);
        }
      }

      Object.assign(project, updateData);
      await project.save();

      const populatedProject = await Project.findOne({ _id: project._id, franchise: req.franchiseId })
        .populate('coordinator', 'name email phone role')
        .populate('targetRegions', 'name type code')
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email');

      return ResponseHelper.success(res, { project: populatedProject }, 'Project updated successfully');
    } catch (error) {
      console.error('❌ Update Project Error:', error);
      
      if (error.code === 11000) {
        return ResponseHelper.error(res, 'Project code already exists', 400);
      }
      
      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(err => err.message);
        return ResponseHelper.error(res, messages.join(', '), 400);
      }
      
      return ResponseHelper.error(res, 'Failed to update project', 500);
    }
  }

  /**
   * Delete project
   * DELETE /api/projects/:id
   */
  async deleteProject(req, res) {
    try {
      const { id } = req.params;

      const project = await Project.findOne({ _id: id, franchise: req.franchiseId });
      if (!project) {
        return ResponseHelper.error(res, 'Project not found', 404);
      }

      // Check access permissions
      if (!project.canUserAccess(req.user)) {
        return ResponseHelper.error(res, 'Access denied to this project', 403);
      }

      // Check if project can be deleted (no active applications, etc.)
      // This would need to be implemented based on business rules

      await Project.findOneAndDelete({ _id: id, franchise: req.franchiseId });

      return ResponseHelper.success(res, null, 'Project deleted successfully');
    } catch (error) {
      console.error('❌ Delete Project Error:', error);
      return ResponseHelper.error(res, 'Failed to delete project', 500);
    }
  }

  /**
   * Get project statistics
   * GET /api/projects/stats
   */
  async getProjectStats(req, res) {
    try {
      // Build filter based on user access
      const filter = {};
      if (req.user.role !== 'super_admin' && req.user.role !== 'state_admin') {
        const userRegions = req.user.adminScope?.regions || [];
        if (userRegions.length > 0) {
          filter.targetRegions = { $in: userRegions };
        }
      }

      const stats = await Project.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalProjects: { $sum: 1 },
            totalBudget: { $sum: '$budget.total' },
            totalAllocated: { $sum: '$budget.allocated' },
            totalSpent: { $sum: '$budget.spent' },
            activeProjects: {
              $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
            },
            completedProjects: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            totalBeneficiaries: { $sum: '$targetBeneficiaries.actual' }
          }
        }
      ]);

      const categoryStats = await Project.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            totalBudget: { $sum: '$budget.total' },
            totalBeneficiaries: { $sum: '$targetBeneficiaries.actual' }
          }
        }
      ]);

      const statusStats = await Project.aggregate([
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
          totalProjects: 0,
          totalBudget: 0,
          totalAllocated: 0,
          totalSpent: 0,
          activeProjects: 0,
          completedProjects: 0,
          totalBeneficiaries: 0
        },
        byCategory: categoryStats,
        byStatus: statusStats
      });
    } catch (error) {
      console.error('❌ Get Project Stats Error:', error);
      return ResponseHelper.error(res, 'Failed to fetch project statistics', 500);
    }
  }

  /**
   * Update project progress
   * PUT /api/projects/:id/progress
   */
  async updateProgress(req, res) {
    try {
      const { id } = req.params;
      const { milestones, percentage } = req.body;

      const project = await Project.findOne({ _id: id, franchise: req.franchiseId });
      if (!project) {
        return ResponseHelper.error(res, 'Project not found', 404);
      }

      // Check access permissions
      if (!project.canUserAccess(req.user)) {
        return ResponseHelper.error(res, 'Access denied to this project', 403);
      }

      if (milestones) {
        project.progress.milestones = milestones;
      }

      if (percentage !== undefined) {
        project.progress.percentage = percentage;
      }

      project.updatedBy = req.user._id;
      await project.save();

      return ResponseHelper.success(res, { project }, 'Project progress updated successfully');
    } catch (error) {
      console.error('❌ Update Progress Error:', error);
      return ResponseHelper.error(res, 'Failed to update project progress', 500);
    }
  }

  /**
   * Add status update to project
   * POST /api/projects/:id/status-update
   */
  async addStatusUpdate(req, res) {
    try {
      const { id } = req.params;
      const { stage, status, description, remarks, attachments } = req.body;

      const project = await Project.findOne({ _id: id, franchise: req.franchiseId });
      if (!project) {
        return ResponseHelper.error(res, 'Project not found', 404);
      }

      // Check access permissions
      if (!project.canUserAccess(req.user)) {
        return ResponseHelper.error(res, 'Access denied to this project', 403);
      }

      // Check if user role is allowed to update this stage
      const allowedRoles = ['super_admin', 'state_admin', 'district_admin', 'area_admin', 'unit_admin', 'project_coordinator', 'scheme_coordinator'];
      if (!allowedRoles.includes(req.user.role)) {
        return ResponseHelper.error(res, 'Access denied to update project status', 403);
      }

      // Add new status update
      const statusUpdate = {
        stage,
        status,
        description,
        remarks,
        attachments: attachments || [],
        updatedBy: req.user._id,
        updatedAt: new Date(),
        isVisible: true
      };

      project.statusUpdates.push(statusUpdate);
      project.updatedBy = req.user._id;
      await project.save();

      const populatedProject = await Project.findOne({ _id: project._id, franchise: req.franchiseId })
        .populate('statusUpdates.updatedBy', 'name email role')
        .populate('coordinator', 'name email phone role')
        .populate('targetRegions', 'name type code');

      return ResponseHelper.success(res, { project: populatedProject }, 'Status update added successfully');
    } catch (error) {
      console.error('❌ Add Status Update Error:', error);
      return ResponseHelper.error(res, 'Failed to add status update', 500);
    }
  }

  /**
   * Update existing status update
   * PUT /api/projects/:id/status-update/:updateId
   */
  async updateStatusUpdate(req, res) {
    try {
      const { id, updateId } = req.params;
      const { stage, status, description, remarks, attachments, isVisible } = req.body;

      const project = await Project.findOne({ _id: id, franchise: req.franchiseId });
      if (!project) {
        return ResponseHelper.error(res, 'Project not found', 404);
      }

      // Check access permissions
      if (!project.canUserAccess(req.user)) {
        return ResponseHelper.error(res, 'Access denied to this project', 403);
      }

      // Find the status update
      const statusUpdateIndex = project.statusUpdates.findIndex(
        update => update._id.toString() === updateId
      );

      if (statusUpdateIndex === -1) {
        return ResponseHelper.error(res, 'Status update not found', 404);
      }

      // Check if user can update this status update (only creator or admin)
      const statusUpdate = project.statusUpdates[statusUpdateIndex];
      if (statusUpdate.updatedBy.toString() !== req.user._id.toString() && 
          !['super_admin', 'state_admin'].includes(req.user.role)) {
        return ResponseHelper.error(res, 'Access denied to update this status update', 403);
      }

      // Update the status update
      if (stage !== undefined) statusUpdate.stage = stage;
      if (status !== undefined) statusUpdate.status = status;
      if (description !== undefined) statusUpdate.description = description;
      if (remarks !== undefined) statusUpdate.remarks = remarks;
      if (attachments !== undefined) statusUpdate.attachments = attachments;
      if (isVisible !== undefined) statusUpdate.isVisible = isVisible;
      
      statusUpdate.updatedAt = new Date();
      project.updatedBy = req.user._id;

      await project.save();

      const populatedProject = await Project.findOne({ _id: project._id, franchise: req.franchiseId })
        .populate('statusUpdates.updatedBy', 'name email role')
        .populate('coordinator', 'name email phone role')
        .populate('targetRegions', 'name type code');

      return ResponseHelper.success(res, { project: populatedProject }, 'Status update updated successfully');
    } catch (error) {
      console.error('❌ Update Status Update Error:', error);
      return ResponseHelper.error(res, 'Failed to update status update', 500);
    }
  }

  /**
   * Delete status update
   * DELETE /api/projects/:id/status-update/:updateId
   */
  async deleteStatusUpdate(req, res) {
    try {
      const { id, updateId } = req.params;

      const project = await Project.findOne({ _id: id, franchise: req.franchiseId });
      if (!project) {
        return ResponseHelper.error(res, 'Project not found', 404);
      }

      // Check access permissions
      if (!project.canUserAccess(req.user)) {
        return ResponseHelper.error(res, 'Access denied to this project', 403);
      }

      // Find the status update
      const statusUpdateIndex = project.statusUpdates.findIndex(
        update => update._id.toString() === updateId
      );

      if (statusUpdateIndex === -1) {
        return ResponseHelper.error(res, 'Status update not found', 404);
      }

      // Check if user can delete this status update (only creator or admin)
      const statusUpdate = project.statusUpdates[statusUpdateIndex];
      if (statusUpdate.updatedBy.toString() !== req.user._id.toString() && 
          !['super_admin', 'state_admin'].includes(req.user.role)) {
        return ResponseHelper.error(res, 'Access denied to delete this status update', 403);
      }

      // Remove the status update
      project.statusUpdates.splice(statusUpdateIndex, 1);
      project.updatedBy = req.user._id;

      await project.save();

      return ResponseHelper.success(res, null, 'Status update deleted successfully');
    } catch (error) {
      console.error('❌ Delete Status Update Error:', error);
      return ResponseHelper.error(res, 'Failed to delete status update', 500);
    }
  }

  /**
   * Get project status configuration
   * GET /api/projects/:id/status-configuration
   */
  async getStatusConfiguration(req, res) {
    try {
      const { id } = req.params;

      const project = await Project.findOne({ _id: id, franchise: req.franchiseId });
      if (!project) {
        return ResponseHelper.error(res, 'Project not found', 404);
      }

      // Check access permissions
      if (!project.canUserAccess(req.user)) {
        return ResponseHelper.error(res, 'Access denied to this project', 403);
      }

      // Get project-specific configuration or master data configuration
      let statusConfiguration = project.statusConfiguration;

      if (!statusConfiguration || !statusConfiguration.stages || statusConfiguration.stages.length === 0) {
        // Look for master data configuration
        const masterDataConfig = await MasterData.findOne({
          type: 'project_stages',
          status: 'active',
          $or: [
            { scope: 'global' },
            { scope: 'project_specific', targetProjects: project._id }
          ]
        }).sort({ scope: -1 }); // Prefer project-specific over global

        if (masterDataConfig && masterDataConfig.configuration.stages) {
          statusConfiguration = {
            stages: masterDataConfig.configuration.stages,
            enablePublicTracking: masterDataConfig.configuration.settings?.enablePublicTracking || false,
            notificationSettings: masterDataConfig.configuration.settings || {}
          };
        }
      }

      return ResponseHelper.success(res, { statusConfiguration });
    } catch (error) {
      console.error('❌ Get Status Configuration Error:', error);
      return ResponseHelper.error(res, 'Failed to fetch status configuration', 500);
    }
  }

  /**
   * Update project status configuration
   * PUT /api/projects/:id/status-configuration
   */
  async updateStatusConfiguration(req, res) {
    try {
      const { id } = req.params;
      const { stages, enablePublicTracking, notificationSettings } = req.body;

      const project = await Project.findOne({ _id: id, franchise: req.franchiseId });
      if (!project) {
        return ResponseHelper.error(res, 'Project not found', 404);
      }

      // Check access permissions (only admin roles can update configuration)
      if (!['super_admin', 'state_admin', 'district_admin'].includes(req.user.role)) {
        return ResponseHelper.error(res, 'Access denied to update project configuration', 403);
      }

      // Update status configuration
      project.statusConfiguration = {
        stages: stages || [],
        enablePublicTracking: enablePublicTracking || false,
        notificationSettings: notificationSettings || {}
      };

      project.updatedBy = req.user._id;
      await project.save();

      return ResponseHelper.success(res, { project }, 'Status configuration updated successfully');
    } catch (error) {
      console.error('❌ Update Status Configuration Error:', error);
      return ResponseHelper.error(res, 'Failed to update status configuration', 500);
    }
  }
}

module.exports = new ProjectController();