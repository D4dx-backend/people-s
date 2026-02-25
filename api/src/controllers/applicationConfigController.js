const ApplicationConfig = require('../models/ApplicationConfig');
const ResponseHelper = require('../utils/responseHelper');
const orgConfig = require('../config/orgConfig');
const path = require('path');
const fs = require('fs');

class ApplicationConfigController {
  /**
   * Get all application configurations (Admin only)
   * GET /api/config
   * Query params: ?category=theme
   */
  getAllConfigs = async (req, res) => {
    try {
      const { category } = req.query;
      const filter = category ? { category } : {};
      
      const configs = await ApplicationConfig.find(filter)
        .populate('updatedBy', 'name email')
        .sort({ category: 1, key: 1 });
      
      return ResponseHelper.success(
        res,
        { configs, count: configs.length },
        'Configurations retrieved successfully'
      );
    } catch (error) {
      console.error('Error fetching configurations:', error);
      return ResponseHelper.error(
        res,
        'Failed to fetch configurations',
        500,
        error.message
      );
    }
  }

  /**
   * Get public configurations (No auth required)
   * GET /api/config/public
   * Returns configs as nested object for easy consumption
   */
  getPublicConfigs = async (req, res) => {
    try {
      const configs = await ApplicationConfig.find({
        scope: 'global',
        isEditable: true
      }).select('category key value label dataType -_id');
      
      // Transform to nested object structure
      const configMap = configs.reduce((acc, config) => {
        if (!acc[config.category]) {
          acc[config.category] = {};
        }
        acc[config.category][config.key] = config.value;
        return acc;
      }, {});

      // Attach org branding (driven by ORG_NAME env var)
      configMap.org = {
        key: orgConfig.key,
        displayName: orgConfig.displayName,
        erpTitle: orgConfig.erpTitle,
        erpSubtitle: orgConfig.erpSubtitle,
        tagline: orgConfig.tagline,
        regNumber: orgConfig.regNumber,
        email: orgConfig.email,
        supportEmail: orgConfig.supportEmail,
        paymentsEmail: orgConfig.paymentsEmail,
        phone: orgConfig.phone,
        address: orgConfig.address,
        website: orgConfig.website,
        websiteUrl: orgConfig.websiteUrl,
        defaultTheme: orgConfig.defaultTheme,
        copyrightText: orgConfig.copyrightText,
        logoUrl: `/assets/${orgConfig.logoFilename}`,
        heroSubtext: orgConfig.heroSubtext,
        aboutText: orgConfig.aboutText,
        footerText: orgConfig.footerText,
        communityLabel: orgConfig.communityLabel,
        communityDescription: orgConfig.communityDescription,
      };

      return ResponseHelper.success(
        res,
        { config: configMap },
        'Public configurations retrieved successfully'
      );
    } catch (error) {
      console.error('Error fetching public configurations:', error);
      return ResponseHelper.error(
        res,
        'Failed to fetch public configurations',
        500,
        error.message
      );
    }
  }

  /**
   * Get single configuration by ID (Admin only)
   * GET /api/config/:id
   */
  getConfigById = async (req, res) => {
    try {
      const config = await ApplicationConfig.findById(req.params.id)
        .populate('updatedBy', 'name email');
      
      if (!config) {
        return ResponseHelper.error(res, 'Configuration not found', 404);
      }
      
      return ResponseHelper.success(
        res,
        { config },
        'Configuration retrieved successfully'
      );
    } catch (error) {
      console.error('Error fetching configuration:', error);
      return ResponseHelper.error(
        res,
        'Failed to fetch configuration',
        500,
        error.message
      );
    }
  }

  /**
   * Update single configuration (Admin only)
   * PUT /api/config/:id
   * Body: { value: any }
   */
  async updateConfig(req, res) {
    try {
      const { value } = req.body;
      
      if (value === undefined) {
        return ResponseHelper.error(res, 'Value is required', 400);
      }
      
      const config = await ApplicationConfig.findById(req.params.id);
      
      if (!config) {
        return ResponseHelper.error(res, 'Configuration not found', 404);
      }
      
      if (!config.isEditable) {
        return ResponseHelper.error(
          res,
          'This configuration is not editable',
          403
        );
      }
      
      // Validate value against dataType
      if (!this.validateValue(value, config.dataType)) {
        return ResponseHelper.error(
          res,
          `Invalid value type. Expected ${config.dataType}`,
          400
        );
      }
      
      // Validate against enum if provided
      if (config.validation?.enum && config.validation.enum.length > 0) {
        if (!config.validation.enum.includes(value)) {
          return ResponseHelper.error(
            res,
            `Invalid value. Must be one of: ${config.validation.enum.join(', ')}`,
            400
          );
        }
      }
      
      config.value = value;
      config.updatedBy = req.user._id;
      await config.save();
      
      await config.populate('updatedBy', 'name email');
      
      return ResponseHelper.success(
        res,
        { config },
        'Configuration updated successfully'
      );
    } catch (error) {
      console.error('Error updating configuration:', error);
      return ResponseHelper.error(
        res,
        'Failed to update configuration',
        500,
        error.message
      );
    }
  }

  /**
   * Bulk update configurations (Admin only)
   * PUT /api/config/bulk
   * Body: { configs: [{ id, value }, ...] }
   */
  bulkUpdateConfigs = async (req, res) => {
    try {
      const { configs } = req.body;
      
      if (!Array.isArray(configs) || configs.length === 0) {
        return ResponseHelper.error(
          res,
          'Configs array is required and must not be empty',
          400
        );
      }
      
      const updatedConfigs = [];
      const errors = [];
      
      for (const { id, value } of configs) {
        try {
          const config = await ApplicationConfig.findById(id);
          
          if (!config) {
            errors.push({ id, error: 'Configuration not found' });
            continue;
          }
          
          if (!config.isEditable) {
            errors.push({ id, error: 'Configuration is not editable' });
            continue;
          }
          
          if (!this.validateValue(value, config.dataType)) {
            errors.push({ id, error: `Invalid value type. Expected ${config.dataType}` });
            continue;
          }
          
          // Validate against enum if provided
          if (config.validation?.enum && config.validation.enum.length > 0) {
            if (!config.validation.enum.includes(value)) {
              errors.push({ 
                id, 
                error: `Invalid value. Must be one of: ${config.validation.enum.join(', ')}` 
              });
              continue;
            }
          }
          
          config.value = value;
          config.updatedBy = req.user._id;
          await config.save();
          
          updatedConfigs.push(config);
        } catch (error) {
          errors.push({ id, error: error.message });
        }
      }
      
      return ResponseHelper.success(
        res,
        { 
          configs: updatedConfigs,
          successCount: updatedConfigs.length,
          errorCount: errors.length,
          errors: errors.length > 0 ? errors : undefined
        },
        `Successfully updated ${updatedConfigs.length} configuration(s)`
      );
    } catch (error) {
      console.error('Error bulk updating configurations:', error);
      return ResponseHelper.error(
        res,
        'Failed to bulk update configurations',
        500,
        error.message
      );
    }
  }

  /**
   * Create new configuration (Admin only)
   * POST /api/config
   */
  createConfig = async (req, res) => {
    try {
      const configData = req.body;
      configData.updatedBy = req.user._id;
      
      const config = await ApplicationConfig.create(configData);
      await config.populate('updatedBy', 'name email');
      
      return ResponseHelper.success(
        res,
        { config },
        'Configuration created successfully',
        201
      );
    } catch (error) {
      console.error('Error creating configuration:', error);
      
      if (error.code === 11000) {
        return ResponseHelper.error(
          res,
          'Configuration with this category and key already exists',
          409
        );
      }
      
      return ResponseHelper.error(
        res,
        'Failed to create configuration',
        500,
        error.message
      );
    }
  }

  /**
   * Delete configuration (Admin only)
   * DELETE /api/config/:id
   */
  deleteConfig = async (req, res) => {
    try {
      const config = await ApplicationConfig.findById(req.params.id);
      
      if (!config) {
        return ResponseHelper.error(res, 'Configuration not found', 404);
      }
      
      if (!config.isEditable) {
        return ResponseHelper.error(
          res,
          'This configuration cannot be deleted',
          403
        );
      }
      
      await config.deleteOne();
      
      return ResponseHelper.success(
        res,
        { id: req.params.id },
        'Configuration deleted successfully'
      );
    } catch (error) {
      console.error('Error deleting configuration:', error);
      return ResponseHelper.error(
        res,
        'Failed to delete configuration',
        500,
        error.message
      );
    }
  }

  /**
   * Helper method to validate value against dataType
   */
  validateValue(value, dataType) {
    switch (dataType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      default:
        return true;
    }
  }

  /**
   * Upload organization logo
   * POST /api/config/logo
   * Accepts a PNG/JPG/SVG file, saves to api/src/assets/ as the org's logo
   */
  uploadLogo = async (req, res) => {
    try {
      if (!req.file) {
        return ResponseHelper.error(res, 'No logo file provided', 400);
      }

      const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
      if (!allowedMimes.includes(req.file.mimetype)) {
        // Clean up uploaded file
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return ResponseHelper.error(res, 'Only PNG, JPG, SVG, and WebP images are allowed', 400);
      }

      // Max 2MB
      if (req.file.size > 2 * 1024 * 1024) {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return ResponseHelper.error(res, 'Logo file must be under 2MB', 400);
      }

      const assetsDir = path.join(__dirname, '../assets');
      const destPath = path.join(assetsDir, orgConfig.logoFilename);

      // Ensure assets directory exists
      if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
      }

      // Copy uploaded file to assets directory (overwrite existing)
      fs.copyFileSync(req.file.path, destPath);

      // Clean up the multer temp file
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

      return ResponseHelper.success(
        res,
        { logoUrl: `/assets/${orgConfig.logoFilename}` },
        'Logo uploaded successfully'
      );
    } catch (error) {
      console.error('Error uploading logo:', error);
      // Clean up temp file on error
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return ResponseHelper.error(
        res,
        'Failed to upload logo',
        500,
        error.message
      );
    }
  }
}

module.exports = new ApplicationConfigController();
