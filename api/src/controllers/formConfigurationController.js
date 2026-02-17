const { FormConfiguration, Scheme } = require('../models');
const ResponseHelper = require('../utils/responseHelper');

class FormConfigurationController {
  /**
   * Get form configuration for a scheme
   * GET /api/schemes/:schemeId/form-config
   */
  async getFormConfiguration(req, res) {
    try {
      const { schemeId } = req.params;

      console.log('🔍 getFormConfiguration called:', {
        schemeId,
        userId: req.user?._id,
        userRole: req.user?.role,
        userAdminScope: req.user?.adminScope
      });

      // First, verify the scheme exists and user has access
      const scheme = await Scheme.findById(schemeId);
      
      if (!scheme) {
        console.log('❌ Scheme not found:', schemeId);
        return ResponseHelper.error(res, 'Scheme not found', 404);
      }

      console.log('🔍 Scheme found:', {
        schemeId: scheme._id,
        schemeName: scheme.name,
        targetRegions: scheme.targetRegions,
        project: scheme.project
      });

      // For form config viewing (read-only), use more permissive access check
      // If user can view applications, they should be able to view form configs
      // This is because form config is metadata needed to display application data
      let canAccess = scheme.canUserAccess(req.user);
      console.log('🔍 [FORM-CONFIG] Initial canUserAccess result:', canAccess);
      console.log('🔍 [FORM-CONFIG] User role:', req.user.role);
      
      // SIMPLE FIX: If direct scheme access fails for unit/area/district admin,
      // check if they have ANY applications for this scheme in their scope
      // Since form config is read-only metadata, this is safe
      if (!canAccess && ['unit_admin', 'area_admin', 'district_admin'].includes(req.user.role)) {
        console.log('🔍 [FORM-CONFIG] Fallback check: Looking for applications in user scope');
        const Application = require('../models/Application');
        
        const userUnitId = req.user.adminScope?.unit || null;
        const userAreaId = req.user.adminScope?.area || null;
        const userDistrictId = req.user.adminScope?.district || null;
        const userRegions = req.user.adminScope?.regions || [];
        
        console.log('🔍 [FORM-CONFIG] User scope:', { 
          unit: userUnitId?.toString(), 
          area: userAreaId?.toString(), 
          district: userDistrictId?.toString(),
          regions: userRegions.map(r => r.toString())
        });
        
        // Build query - check if any application for this scheme matches user's scope
        const locationMatch = [];
        
        if (req.user.role === 'unit_admin' && userUnitId) {
          locationMatch.push({ unit: userUnitId });
        }
        if (req.user.role === 'area_admin' && userAreaId) {
          locationMatch.push({ area: userAreaId });
        }
        if (req.user.role === 'district_admin' && userDistrictId) {
          locationMatch.push({ district: userDistrictId });
        }
        
        // Add region matches
        if (userRegions.length > 0) {
          locationMatch.push(
            { unit: { $in: userRegions } },
            { area: { $in: userRegions } },
            { district: { $in: userRegions } }
          );
        }
        
        const query = { scheme: schemeId };
        if (locationMatch.length > 0) {
          query.$or = locationMatch;
        }
        
        console.log('🔍 [FORM-CONFIG] Query:', {
          scheme: query.scheme,
          hasLocationMatch: !!query.$or,
          locationMatchCount: query.$or?.length || 0
        });
        
        const foundApp = await Application.findOne(query).lean();
        
        if (foundApp) {
          canAccess = true;
          console.log('✅ [FORM-CONFIG] ACCESS GRANTED: Found matching application', foundApp._id);
        } else {
          console.log('❌ [FORM-CONFIG] No matching applications found');
        }
      }
      
      console.log('🔍 [FORM-CONFIG] Final canAccess:', canAccess);
      
      if (!canAccess) {
        console.log('❌ Access denied by canUserAccess check');
        return ResponseHelper.error(res, 'Access denied', 403);
      }

      // Try to find existing form configuration
      let formConfig = await FormConfiguration.findOne({ scheme: schemeId, isRenewalForm: { $ne: true } })
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email');

      // If no form configuration exists, return empty state
      if (!formConfig) {
        return ResponseHelper.success(res, { 
          formConfiguration: null,
          hasConfiguration: false,
          message: 'No form configuration found for this scheme.'
        });
      }

      return ResponseHelper.success(res, { 
        formConfiguration: formConfig,
        hasConfiguration: true
      });
    } catch (error) {
      console.error('❌ Get Form Configuration Error:', error);
      return ResponseHelper.error(res, 'Failed to fetch form configuration', 500);
    }
  }

  /**
   * Create or update form configuration for a scheme
   * PUT /api/schemes/:schemeId/form-config
   */
  async updateFormConfiguration(req, res) {
    try {
      const { schemeId } = req.params;
      const formData = req.body;

      // First, verify the scheme exists and user has access
      const scheme = await Scheme.findById(schemeId);
      
      if (!scheme) {
        return ResponseHelper.error(res, 'Scheme not found', 404);
      }

      // Check if user can access this scheme
      if (!scheme.canUserAccess(req.user)) {
        return ResponseHelper.error(res, 'Access denied', 403);
      }

      // Validate required fields
      if (!formData.title || !formData.description) {
        return ResponseHelper.error(res, 'Form title and description are required', 400);
      }

      if (!formData.pages || !Array.isArray(formData.pages) || formData.pages.length === 0) {
        return ResponseHelper.error(res, 'At least one page is required', 400);
      }

      // Try to find existing form configuration (non-renewal)
      let formConfig = await FormConfiguration.findOne({ scheme: schemeId, isRenewalForm: { $ne: true } });

      if (formConfig) {
        // Update existing configuration
        Object.assign(formConfig, {
          ...formData,
          scheme: schemeId,
          updatedBy: req.user._id,
          lastModified: new Date(),
          version: formConfig.version + 1
        });
      } else {
        // Create new configuration
        formConfig = new FormConfiguration({
          ...formData,
          scheme: schemeId,
          createdBy: req.user._id,
          updatedBy: req.user._id,
          version: 1
        });
      }

      await formConfig.save();

      // Populate user references for response
      await formConfig.populate('createdBy', 'name email');
      await formConfig.populate('updatedBy', 'name email');

      return ResponseHelper.success(res, { 
        message: 'Form configuration saved successfully',
        formConfiguration: formConfig 
      });
    } catch (error) {
      console.error('❌ Update Form Configuration Error:', error);
      
      // Handle validation errors
      if (error.name === 'ValidationError') {
        const validationErrors = Object.values(error.errors).map(err => err.message);
        return ResponseHelper.error(res, `Validation failed: ${validationErrors.join(', ')}`, 400);
      }
      
      // Handle custom validation errors from pre-save middleware
      if (error.message && error.message.includes('Form validation failed')) {
        return ResponseHelper.error(res, error.message, 400);
      }

      return ResponseHelper.error(res, 'Failed to save form configuration', 500);
    }
  }

  /**
   * Delete form configuration for a scheme
   * DELETE /api/schemes/:schemeId/form-config
   */
  async deleteFormConfiguration(req, res) {
    try {
      const { schemeId } = req.params;

      // First, verify the scheme exists and user has access
      const scheme = await Scheme.findById(schemeId);
      
      if (!scheme) {
        return ResponseHelper.error(res, 'Scheme not found', 404);
      }

      // Check if user can access this scheme
      if (!scheme.canUserAccess(req.user)) {
        return ResponseHelper.error(res, 'Access denied', 403);
      }

      // Find and delete the form configuration (non-renewal only)
      const formConfig = await FormConfiguration.findOneAndDelete({ scheme: schemeId, isRenewalForm: { $ne: true } });

      if (!formConfig) {
        return ResponseHelper.error(res, 'Form configuration not found', 404);
      }

      // Update scheme status
      await Scheme.findByIdAndUpdate(schemeId, {
        hasFormConfiguration: false,
        formConfigurationUpdated: null
      });

      return ResponseHelper.success(res, { 
        message: 'Form configuration deleted successfully' 
      });
    } catch (error) {
      console.error('❌ Delete Form Configuration Error:', error);
      return ResponseHelper.error(res, 'Failed to delete form configuration', 500);
    }
  }

  /**
   * Publish/Unpublish form configuration
   * PATCH /api/schemes/:schemeId/form-config/publish
   */
  async togglePublishStatus(req, res) {
    try {
      const { schemeId } = req.params;
      const { isPublished } = req.body;

      // First, verify the scheme exists and user has access
      const scheme = await Scheme.findById(schemeId);
      
      if (!scheme) {
        return ResponseHelper.error(res, 'Scheme not found', 404);
      }

      // Check if user can access this scheme
      if (!scheme.canUserAccess(req.user)) {
        return ResponseHelper.error(res, 'Access denied', 403);
      }

      // Find the form configuration (non-renewal)
      const formConfig = await FormConfiguration.findOne({ scheme: schemeId, isRenewalForm: { $ne: true } });

      if (!formConfig) {
        return ResponseHelper.error(res, 'Form configuration not found', 404);
      }

      // Update publish status
      formConfig.isPublished = isPublished;
      formConfig.publishedAt = isPublished ? new Date() : null;
      formConfig.updatedBy = req.user._id;

      await formConfig.save();

      return ResponseHelper.success(res, { 
        message: `Form configuration ${isPublished ? 'published' : 'unpublished'} successfully`,
        formConfiguration: formConfig 
      });
    } catch (error) {
      console.error('❌ Toggle Publish Status Error:', error);
      return ResponseHelper.error(res, 'Failed to update publish status', 500);
    }
  }

  /**
   * Get form configuration analytics
   * GET /api/schemes/:schemeId/form-config/analytics
   */
  async getFormAnalytics(req, res) {
    try {
      const { schemeId } = req.params;

      // First, verify the scheme exists and user has access
      const scheme = await Scheme.findById(schemeId);
      
      if (!scheme) {
        return ResponseHelper.error(res, 'Scheme not found', 404);
      }

      // Check if user can access this scheme
      if (!scheme.canUserAccess(req.user)) {
        return ResponseHelper.error(res, 'Access denied', 403);
      }

      // Find the form configuration (non-renewal)
      const formConfig = await FormConfiguration.findOne({ scheme: schemeId, isRenewalForm: { $ne: true } })
        .select('analytics totalFields requiredFields formUrl');

      if (!formConfig) {
        return ResponseHelper.error(res, 'Form configuration not found', 404);
      }

      return ResponseHelper.success(res, { 
        analytics: {
          ...formConfig.analytics,
          totalFields: formConfig.totalFields,
          requiredFields: formConfig.requiredFields,
          formUrl: formConfig.formUrl
        }
      });
    } catch (error) {
      console.error('❌ Get Form Analytics Error:', error);
      return ResponseHelper.error(res, 'Failed to fetch form analytics', 500);
    }
  }

  /**
   * Get all form configurations (for admin)
   * GET /api/form-configurations
   */
  async getAllFormConfigurations(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        enabled,
        published
      } = req.query;

      // Build filter query
      const filter = {};
      
      if (enabled !== undefined) filter.enabled = enabled === 'true';
      if (published !== undefined) filter.isPublished = published === 'true';
      
      if (search) {
        filter.$or = [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }

      const skip = (page - 1) * limit;
      
      const formConfigs = await FormConfiguration.find(filter)
        .populate('scheme', 'name code category status')
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email')
        .sort({ lastModified: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await FormConfiguration.countDocuments(filter);

      return ResponseHelper.success(res, {
        formConfigurations: formConfigs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('❌ Get All Form Configurations Error:', error);
      return ResponseHelper.error(res, 'Failed to fetch form configurations', 500);
    }
  }

  /**
   * Duplicate form configuration to another scheme
   * POST /api/schemes/:schemeId/form-config/duplicate
   */
  async duplicateFormConfiguration(req, res) {
    try {
      const { schemeId } = req.params;
      const { targetSchemeId } = req.body;

      if (!targetSchemeId) {
        return ResponseHelper.error(res, 'Target scheme ID is required', 400);
      }

      // Verify both schemes exist and user has access
      const [sourceScheme, targetScheme] = await Promise.all([
        Scheme.findById(schemeId),
        Scheme.findById(targetSchemeId)
      ]);

      if (!sourceScheme) {
        return ResponseHelper.error(res, 'Source scheme not found', 404);
      }

      if (!targetScheme) {
        return ResponseHelper.error(res, 'Target scheme not found', 404);
      }

      if (!sourceScheme.canUserAccess(req.user) || !targetScheme.canUserAccess(req.user)) {
        return ResponseHelper.error(res, 'Access denied', 403);
      }

      // Find source form configuration (non-renewal)
      const sourceFormConfig = await FormConfiguration.findOne({ scheme: schemeId, isRenewalForm: { $ne: true } });

      if (!sourceFormConfig) {
        return ResponseHelper.error(res, 'Source form configuration not found', 404);
      }

      // Check if target already has a form configuration
      const existingTargetConfig = await FormConfiguration.findOne({ scheme: targetSchemeId, isRenewalForm: { $ne: true } });
      if (existingTargetConfig) {
        return ResponseHelper.error(res, 'Target scheme already has a form configuration', 400);
      }

      // Create duplicate configuration
      const duplicateConfig = new FormConfiguration({
        ...sourceFormConfig.toObject(),
        _id: undefined,
        scheme: targetSchemeId,
        title: `${targetScheme.name} Application Form`,
        description: `Application form for ${targetScheme.name} scheme.`,
        createdBy: req.user._id,
        updatedBy: req.user._id,
        version: 1,
        isPublished: false,
        publishedAt: null,
        analytics: {
          totalViews: 0,
          totalSubmissions: 0,
          completionRate: 0,
          averageTimeToComplete: 0
        }
      });

      await duplicateConfig.save();

      return ResponseHelper.success(res, { 
        message: 'Form configuration duplicated successfully',
        formConfiguration: duplicateConfig 
      });
    } catch (error) {
      console.error('❌ Duplicate Form Configuration Error:', error);
      return ResponseHelper.error(res, 'Failed to duplicate form configuration', 500);
    }
  }

  /**
   * Get renewal form configuration for a scheme
   * GET /api/schemes/:schemeId/renewal-form-config
   */
  async getRenewalFormConfiguration(req, res) {
    try {
      const { schemeId } = req.params;

      const scheme = await Scheme.findById(schemeId);
      if (!scheme) {
        return ResponseHelper.error(res, 'Scheme not found', 404);
      }

      if (!scheme.renewalSettings?.isRenewable) {
        return ResponseHelper.error(res, 'This scheme does not support renewals', 400);
      }

      let formConfig = await FormConfiguration.findOne({ scheme: schemeId, isRenewalForm: true })
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email');

      if (!formConfig) {
        return ResponseHelper.success(res, {
          formConfiguration: null,
          hasConfiguration: false,
          message: 'No renewal form configuration found for this scheme.'
        });
      }

      return ResponseHelper.success(res, {
        formConfiguration: formConfig,
        hasConfiguration: true
      });
    } catch (error) {
      console.error('❌ Get Renewal Form Configuration Error:', error);
      return ResponseHelper.error(res, 'Failed to fetch renewal form configuration', 500);
    }
  }

  /**
   * Create or update renewal form configuration for a scheme
   * PUT /api/schemes/:schemeId/renewal-form-config
   */
  async updateRenewalFormConfiguration(req, res) {
    try {
      const { schemeId } = req.params;
      const formData = req.body;

      const scheme = await Scheme.findById(schemeId);
      if (!scheme) {
        return ResponseHelper.error(res, 'Scheme not found', 404);
      }

      if (!scheme.canUserAccess(req.user)) {
        return ResponseHelper.error(res, 'Access denied', 403);
      }

      if (!scheme.renewalSettings?.isRenewable) {
        return ResponseHelper.error(res, 'Enable renewal for this scheme first', 400);
      }

      if (!formData.title || !formData.description) {
        return ResponseHelper.error(res, 'Form title and description are required', 400);
      }

      if (!formData.pages || !Array.isArray(formData.pages) || formData.pages.length === 0) {
        return ResponseHelper.error(res, 'At least one page is required', 400);
      }

      // Find existing renewal form configuration
      let formConfig = await FormConfiguration.findOne({ scheme: schemeId, isRenewalForm: true });

      // Get the parent (original) form config reference
      const parentConfig = await FormConfiguration.findOne({ scheme: schemeId, isRenewalForm: { $ne: true } });

      if (formConfig) {
        Object.assign(formConfig, {
          ...formData,
          scheme: schemeId,
          isRenewalForm: true,
          parentFormConfiguration: parentConfig?._id || null,
          updatedBy: req.user._id,
          lastModified: new Date(),
          version: formConfig.version + 1
        });
      } else {
        formConfig = new FormConfiguration({
          ...formData,
          scheme: schemeId,
          isRenewalForm: true,
          parentFormConfiguration: parentConfig?._id || null,
          createdBy: req.user._id,
          updatedBy: req.user._id,
          version: 1
        });
      }

      await formConfig.save();

      await formConfig.populate('createdBy', 'name email');
      await formConfig.populate('updatedBy', 'name email');

      return ResponseHelper.success(res, {
        message: 'Renewal form configuration saved successfully',
        formConfiguration: formConfig
      });
    } catch (error) {
      console.error('❌ Update Renewal Form Configuration Error:', error);

      if (error.name === 'ValidationError') {
        const validationErrors = Object.values(error.errors).map(err => err.message);
        return ResponseHelper.error(res, `Validation failed: ${validationErrors.join(', ')}`, 400);
      }

      if (error.message && error.message.includes('Form validation failed')) {
        return ResponseHelper.error(res, error.message, 400);
      }

      return ResponseHelper.error(res, 'Failed to save renewal form configuration', 500);
    }
  }

  /**
   * Delete renewal form configuration for a scheme
   * DELETE /api/schemes/:schemeId/renewal-form-config
   */
  async deleteRenewalFormConfiguration(req, res) {
    try {
      const { schemeId } = req.params;

      const scheme = await Scheme.findById(schemeId);
      if (!scheme) {
        return ResponseHelper.error(res, 'Scheme not found', 404);
      }

      if (!scheme.canUserAccess(req.user)) {
        return ResponseHelper.error(res, 'Access denied', 403);
      }

      const formConfig = await FormConfiguration.findOneAndDelete({ scheme: schemeId, isRenewalForm: true });

      if (!formConfig) {
        return ResponseHelper.error(res, 'Renewal form configuration not found', 404);
      }

      await Scheme.findByIdAndUpdate(schemeId, {
        'renewalSettings.renewalFormConfigured': false
      });

      return ResponseHelper.success(res, {
        message: 'Renewal form configuration deleted successfully'
      });
    } catch (error) {
      console.error('❌ Delete Renewal Form Configuration Error:', error);
      return ResponseHelper.error(res, 'Failed to delete renewal form configuration', 500);
    }
  }
}

module.exports = new FormConfigurationController();