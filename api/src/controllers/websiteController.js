const WebsiteSettings = require('../models/WebsiteSettings');
const ResponseHelper = require('../utils/responseHelper');
const orgConfig = require('../config/orgConfig');

class WebsiteController {
  /**
   * Get website settings
   * GET /api/website/settings
   */
  async getSettings(req, res) {
    try {
      let settings = await WebsiteSettings.findOne({ franchise: req.franchiseId }).populate('updatedBy', 'name');
      
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
      const settings = await WebsiteSettings.findOne({ franchise: req.franchiseId })
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
      let { aboutUs, counts, contactDetails, socialMedia } = req.body;
      const userId = req.user._id;

      // Parse JSON strings if they come from FormData
      if (typeof aboutUs === 'string') {
        aboutUs = JSON.parse(aboutUs);
      }
      if (typeof counts === 'string') {
        counts = JSON.parse(counts);
      }
      if (typeof contactDetails === 'string') {
        contactDetails = JSON.parse(contactDetails);
      }
      if (typeof socialMedia === 'string') {
        socialMedia = JSON.parse(socialMedia);
      }

      let settings = await WebsiteSettings.findOne({ franchise: req.franchiseId });
      
      if (!settings) {
        settings = new WebsiteSettings({ franchise: req.franchiseId || null });
      }

      // Update fields
      if (aboutUs) settings.aboutUs = aboutUs;
      if (counts) settings.counts = counts;
      if (contactDetails) settings.contactDetails = contactDetails;
      if (socialMedia) settings.socialMedia = socialMedia;
      
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
}

module.exports = new WebsiteController();
