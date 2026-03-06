const ApplicationConfig = require('../models/ApplicationConfig');
const ResponseHelper = require('../utils/responseHelper');
const orgConfig = require('../config/orgConfig');
const Franchise = require('../models/Franchise');
const franchiseCache = require('../utils/franchiseCache');
const path = require('path');
const fs = require('fs');
const { buildFranchiseReadFilter, buildFranchiseMatchStage, getWriteFranchiseId } = require('../utils/franchiseFilterHelper');

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
      // ── Franchise-aware config lookup ───────────────────────────────────
      const franchiseFilter = buildFranchiseReadFilter(req);

      const configs = await ApplicationConfig.find({
        scope: 'global',
        isEditable: true,
        ...franchiseFilter
      }).select('category key value label dataType -_id');
      
      // Transform to nested object structure
      const configMap = configs.reduce((acc, config) => {
        if (!acc[config.category]) {
          acc[config.category] = {};
        }
        acc[config.category][config.key] = config.value;
        return acc;
      }, {});

      // ── Org branding: prefer franchise DB record over orgConfig env fallback
      let brandingOrg;
      if (req.franchiseId) {
        try {
          // Try cache first for performance
          let franchise = await franchiseCache.getFranchiseBranding(req.franchiseId);
          if (!franchise) {
            franchise = await Franchise.findById(req.franchiseId).select(
              'slug displayName erpTitle erpSubtitle tagline defaultTheme customTheme settings'
            ).lean();
            if (franchise) await franchiseCache.getFranchiseBranding(req.franchiseId); // prime cache
          }

          if (franchise) {
            const s = franchise.settings || {};
            brandingOrg = {
              key: franchise.slug,
              displayName: franchise.displayName,
              erpTitle: franchise.erpTitle || franchise.displayName,
              erpSubtitle: franchise.erpSubtitle || orgConfig.erpSubtitle,
              tagline: franchise.tagline || '',
              regNumber: s.regNumber || '',
              email: s.contactEmail || '',
              supportEmail: s.supportEmail || '',
              paymentsEmail: s.paymentsEmail || '',
              phone: s.contactPhone || '',
              address: s.address || '',
              website: s.websiteUrl || '',
              websiteUrl: s.websiteUrl || '',
              defaultTheme: franchise.defaultTheme || 'blue',
              customTheme: franchise.customTheme || null,
              copyrightText: `© ${new Date().getFullYear()} ${s.copyrightHolder || franchise.displayName}. All rights reserved.`,
              logoUrl: franchise.logoUrl || `/assets/logo-placeholder.png`,
              footerText: s.footerText || '',
            };
          }
        } catch (brandingErr) {
          console.error('⚠ Failed to load franchise branding:', brandingErr.message);
        }
      }

      // Fallback to orgConfig (env-based) if no franchise branding found
      if (!brandingOrg) {
        brandingOrg = {
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
      }

      configMap.org = brandingOrg;

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
      const config = await ApplicationConfig.findOne({ _id: req.params.id, ...buildFranchiseReadFilter(req) })
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
      
      const config = await ApplicationConfig.findOne({ _id: req.params.id, franchise: req.franchiseId });
      
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
          const config = await ApplicationConfig.findOne({ _id: id, franchise: req.franchiseId });
          
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
      const config = await ApplicationConfig.findOne({ _id: req.params.id, franchise: req.franchiseId });
      
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

  /**
   * Get per-franchise integrations config (DXing SMS + SMTP Email)
   * GET /api/config/integrations
   * Access: super_admin of the franchise only
   *
   * Returns values MASKED for security — actual secrets are never sent to client.
   * A non-empty "*****" means a value IS saved; empty string means NOT configured.
   */
  getIntegrationsConfig = async (req, res) => {
    try {
      if (!req.franchiseId) {
        return ResponseHelper.error(res, 'Franchise context required', 400);
      }

      // Explicitly fetch the sensitive fields that are select:false by default
      const franchise = await Franchise.findById(req.franchiseId)
        .select('settings.smsConfig settings.emailConfig')
        .lean();

      if (!franchise) {
        return ResponseHelper.error(res, 'Franchise not found', 404);
      }

      const sms   = franchise.settings?.smsConfig   || {};
      const email = franchise.settings?.emailConfig || {};

      // Mask actual credential values — just indicate whether they are set
      const mask = (v) => (v ? '*****' : '');

      return ResponseHelper.success(res, {
        smsConfig: {
          dxingApiKey:    mask(sms.dxingApiKey),
          dxingApiSecret: mask(sms.dxingApiSecret),
          enabled:        !!sms.enabled,
          isConfigured:   !!(sms.dxingApiKey && sms.dxingApiSecret),
        },
        emailConfig: {
          smtpHost: email.smtpHost || '',
          smtpPort: email.smtpPort || '',
          smtpUser: email.smtpUser || '',
          smtpPass: mask(email.smtpPass),
          enabled:  !!email.enabled,
          isConfigured: !!(email.smtpHost && email.smtpUser && email.smtpPass),
        },
      }, 'Integrations config retrieved');
    } catch (error) {
      console.error('Error fetching integrations config:', error);
      return ResponseHelper.error(res, 'Failed to fetch integrations config', 500, error.message);
    }
  }

  /**
   * Update per-franchise integrations config (DXing SMS + SMTP Email)
   * PUT /api/config/integrations
   * Access: super_admin of the franchise only
   *
   * Omitting a field (undefined) keeps the existing value.
   * Sending empty string ("") clears the field.
   */
  updateIntegrationsConfig = async (req, res) => {
    try {
      if (!req.franchiseId) {
        return ResponseHelper.error(res, 'Franchise context required', 400);
      }

      const { smsConfig, emailConfig } = req.body;

      const update = {};

      if (smsConfig !== undefined) {
        if (smsConfig.dxingApiKey    !== undefined) update['settings.smsConfig.dxingApiKey']    = smsConfig.dxingApiKey;
        if (smsConfig.dxingApiSecret !== undefined) update['settings.smsConfig.dxingApiSecret'] = smsConfig.dxingApiSecret;
        if (smsConfig.enabled        !== undefined) update['settings.smsConfig.enabled']        = !!smsConfig.enabled;
      }

      if (emailConfig !== undefined) {
        if (emailConfig.smtpHost !== undefined) update['settings.emailConfig.smtpHost'] = emailConfig.smtpHost;
        if (emailConfig.smtpPort !== undefined) update['settings.emailConfig.smtpPort'] = Number(emailConfig.smtpPort) || 587;
        if (emailConfig.smtpUser !== undefined) update['settings.emailConfig.smtpUser'] = emailConfig.smtpUser;
        if (emailConfig.smtpPass !== undefined) update['settings.emailConfig.smtpPass'] = emailConfig.smtpPass;
        if (emailConfig.enabled  !== undefined) update['settings.emailConfig.enabled']  = !!emailConfig.enabled;
      }

      if (Object.keys(update).length === 0) {
        return ResponseHelper.error(res, 'No fields to update', 400);
      }

      // Use the native MongoDB collection directly to bypass Mongoose's
      // path-collision error when writing nested dot-notation paths into a
      // sub-document that also has select:false fields registered at the
      // parent schema level (e.g. settings.smsConfig vs settings.smsConfig.dxingApiKey).
      const mongoose = require('mongoose');
      await Franchise.collection.updateOne(
        { _id: new mongoose.Types.ObjectId(req.franchiseId.toString()) },
        { $set: update }
      );
      const franchise = await Franchise.findById(req.franchiseId);

      if (!franchise) {
        return ResponseHelper.error(res, 'Franchise not found', 404);
      }

      // Invalidate cache so service picks up new credentials on next request
      franchiseCache.invalidateFranchise(franchise);

      return ResponseHelper.success(res, { updated: true }, 'Integrations settings saved successfully');
    } catch (error) {
      console.error('Error updating integrations config:', error);
      return ResponseHelper.error(res, 'Failed to update integrations config', 500, error.message);
    }
  }
}

module.exports = new ApplicationConfigController();
