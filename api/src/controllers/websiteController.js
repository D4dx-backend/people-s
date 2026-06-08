const WebsiteSettings = require('../models/WebsiteSettings');
const ResponseHelper = require('../utils/responseHelper');
const orgConfig = require('../config/orgConfig');
const { buildFranchiseReadFilter, buildFranchiseMatchStage, getWriteFranchiseId } = require('../utils/franchiseFilterHelper');
const { uploadToSpaces, deleteFromSpaces } = require('../utils/s3Upload');

class WebsiteController {
  /**
   * Get website settings
   * GET /api/website/settings
   */
  async getSettings(req, res) {
    try {
      let settings = await WebsiteSettings.findOne({ ...buildFranchiseReadFilter(req) }).populate('updatedBy', 'name');
      
      // Create default settings if none exist
      if (!settings) {
        settings = await WebsiteSettings.create({
          franchise: req.franchiseId || null,
          aboutUs: {
            title: `About ${orgConfig.erpTitle}`,
            description: orgConfig.tagline
          },
          counts: [],
          contactDetails: {},
          socialMedia: {}
        });
      }

      return ResponseHelper.success(res, { settings }, 'Settings retrieved successfully');
    } catch (error) {
      console.error('❌ Get Settings Error:', error);
      return ResponseHelper.error(res, error.message, 500);
    }
  }

  /**
   * Get public settings (no authentication required)
   * GET /api/website/public-settings
   */
  async getPublicSettings(req, res) {
    try {
      const settings = await WebsiteSettings.findOne({ ...buildFranchiseReadFilter(req) })
        .select('-updatedBy -__v -createdAt -updatedAt');
      
      if (!settings) {
        return ResponseHelper.success(res, {
          settings: {
            aboutUs: {},
            counts: [],
            contactDetails: {},
            socialMedia: {}
          }
        }, 'Settings retrieved successfully');
      }

      return ResponseHelper.success(res, { settings }, 'Settings retrieved successfully');
    } catch (error) {
      console.error('❌ Get Public Settings Error:', error);
      return ResponseHelper.error(res, error.message, 500);
    }
  }

  /**
   * Update website settings
   * PUT /api/website/settings
   */
  async updateSettings(req, res) {
    try {
      let { aboutUs, counts, contactDetails, socialMedia, hero, vision, mission, values, donation, seo, footer } = req.body;
      const userId = req.user._id;

      // Parse JSON strings if they come from FormData
      const parseMaybe = (val) => (typeof val === 'string' ? JSON.parse(val) : val);
      aboutUs = parseMaybe(aboutUs);
      counts = parseMaybe(counts);
      contactDetails = parseMaybe(contactDetails);
      socialMedia = parseMaybe(socialMedia);
      hero = parseMaybe(hero);
      vision = parseMaybe(vision);
      mission = parseMaybe(mission);
      values = parseMaybe(values);
      donation = parseMaybe(donation);
      seo = parseMaybe(seo);
      footer = parseMaybe(footer);

      // Normalize seo.keywords to an array (accept array or comma-separated string)
      if (seo && seo.keywords !== undefined) {
        if (Array.isArray(seo.keywords)) {
          seo.keywords = seo.keywords.map((k) => String(k).trim()).filter(Boolean);
        } else if (typeof seo.keywords === 'string') {
          seo.keywords = seo.keywords.split(',').map((k) => k.trim()).filter(Boolean);
        } else {
          seo.keywords = [];
        }
      }

      let settings = await WebsiteSettings.findOne({ franchise: req.franchiseId });
      
      if (!settings) {
        settings = new WebsiteSettings({ franchise: req.franchiseId || null });
      }

      // Update fields — merge aboutUs to preserve imageUrl/imageKey set via the dedicated upload endpoint
      if (aboutUs) settings.aboutUs = { ...(settings.aboutUs?.toObject ? settings.aboutUs.toObject() : settings.aboutUs || {}), ...aboutUs };
      if (counts) settings.counts = counts;
      if (contactDetails) settings.contactDetails = contactDetails;
      if (socialMedia) settings.socialMedia = socialMedia;
      if (hero) settings.hero = hero;
      if (vision) settings.vision = vision;
      if (mission) settings.mission = mission;
      if (values) settings.values = values;
      if (donation) settings.donation = donation;
      if (seo) settings.seo = seo;
      if (footer) settings.footer = footer;
      
      settings.updatedBy = userId;
      await settings.save();

      settings = await settings.populate('updatedBy', 'name');

      return ResponseHelper.success(res, { settings }, 'Settings updated successfully');
    } catch (error) {
      console.error('❌ Update Settings Error:', error);
      return ResponseHelper.error(res, error.message, 500);
    }
  }

  /**
   * Add counter
   * POST /api/website/settings/counter
   */
  async addCounter(req, res) {
    try {
      const { title, count, icon } = req.body;
      const userId = req.user._id;

      let settings = await WebsiteSettings.findOne({ franchise: req.franchiseId });
      if (!settings) {
        settings = new WebsiteSettings({ franchise: req.franchiseId || null });
      }

      const maxOrder = settings.counts.length > 0 
        ? Math.max(...settings.counts.map(c => c.order)) 
        : 0;

      settings.counts.push({
        title,
        count: count || 0,
        icon: icon || 'users',
        order: maxOrder + 1
      });

      settings.updatedBy = userId;
      await settings.save();

      return ResponseHelper.success(res, { settings }, 'Counter added successfully');
    } catch (error) {
      console.error('❌ Add Counter Error:', error);
      return ResponseHelper.error(res, error.message, 500);
    }
  }

  /**
   * Update counter
   * PUT /api/website/settings/counter/:id
   */
  async updateCounter(req, res) {
    try {
      const { id } = req.params;
      const { title, count, icon, order } = req.body;
      const userId = req.user._id;

      const settings = await WebsiteSettings.findOne({ franchise: req.franchiseId });
      if (!settings) {
        return ResponseHelper.error(res, 'Settings not found', 404);
      }

      const counter = settings.counts.id(id);
      if (!counter) {
        return ResponseHelper.error(res, 'Counter not found', 404);
      }

      if (title) counter.title = title;
      if (count !== undefined) counter.count = count;
      if (icon) counter.icon = icon;
      if (order !== undefined) counter.order = order;

      settings.updatedBy = userId;
      await settings.save();

      return ResponseHelper.success(res, { settings }, 'Counter updated successfully');
    } catch (error) {
      console.error('❌ Update Counter Error:', error);
      return ResponseHelper.error(res, error.message, 500);
    }
  }

  /**
   * Delete counter
   * DELETE /api/website/settings/counter/:id
   */
  async deleteCounter(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user._id;

      const settings = await WebsiteSettings.findOne({ franchise: req.franchiseId });
      if (!settings) {
        return ResponseHelper.error(res, 'Settings not found', 404);
      }

      settings.counts.pull(id);
      settings.updatedBy = userId;
      await settings.save();

      return ResponseHelper.success(res, { settings }, 'Counter deleted successfully');
    } catch (error) {
      console.error('❌ Delete Counter Error:', error);
      return ResponseHelper.error(res, error.message, 500);
    }
  }
  /**
   * Upload About Us image
   * PUT /api/website/settings/about-image
   */
  async uploadAboutImage(req, res) {
    try {
      if (!req.file) {
        return ResponseHelper.error(res, 'Image file is required', 400);
      }

      let settings = await WebsiteSettings.findOne({ franchise: req.franchiseId });
      if (!settings) {
        settings = new WebsiteSettings({ franchise: req.franchiseId || null });
      }

      // Delete old image from S3 if exists
      if (settings.aboutUs?.imageKey) {
        await deleteFromSpaces(settings.aboutUs.imageKey).catch(() => {});
      }

      // Upload new image
      const uploadResult = await uploadToSpaces(req.file, 'website/about');
      if (!uploadResult.success) {
        return ResponseHelper.error(res, 'Failed to upload image to storage', 500);
      }

      // Merge into existing aboutUs (preserve title/description)
      const existing = settings.aboutUs?.toObject ? settings.aboutUs.toObject() : (settings.aboutUs || {});
      settings.aboutUs = { ...existing, imageUrl: uploadResult.fileUrl, imageKey: uploadResult.key };
      settings.updatedBy = req.user._id;
      await settings.save();

      return ResponseHelper.success(res, { imageUrl: uploadResult.fileUrl, imageKey: uploadResult.key }, 'About image updated successfully');
    } catch (error) {
      console.error('❌ Upload About Image Error:', error);
      return ResponseHelper.error(res, error.message, 500);
    }
  }
}

module.exports = new WebsiteController();
