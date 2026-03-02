const Banner = require('../models/Banner');
const { uploadToSpaces, deleteFromSpaces } = require('../utils/s3Upload');

// Get all banners (admin)
exports.getAllBanners = async (req, res) => {
  try {
    const bannerFilter = req.franchiseId ? { franchise: req.franchiseId } : {};
    const banners = await Banner.find(bannerFilter)
      .sort({ order: 1, createdAt: -1 })
      .populate('createdBy updatedBy', 'name email');
    
    res.json({
      success: true,
      data: banners
    });
  } catch (error) {
    console.error('Get all banners error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch banners',
      error: error.message
    });
  }
};

// Get active banners (public)
exports.getPublicBanners = async (req, res) => {
  try {
    const bannerFilter = { status: 'active', ...(req.franchiseId && { franchise: req.franchiseId }) };
    const banners = await Banner.find(bannerFilter)
      .sort({ order: 1, createdAt: -1 })
      .select('-createdBy -updatedBy');
    
    res.json({
      success: true,
      data: banners
    });
  } catch (error) {
    console.error('Get public banners error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch banners',
      error: error.message
    });
  }
};

// Get banner by ID
exports.getBannerById = async (req, res) => {
  try {
    const banner = await Banner.findOne({ _id: req.params.id, franchise: req.franchiseId })
      .populate('createdBy updatedBy', 'name email');
    
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }
    
    res.json({
      success: true,
      data: banner
    });
  } catch (error) {
    console.error('Get banner error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch banner',
      error: error.message
    });
  }
};

// Create banner
exports.createBanner = async (req, res) => {
  try {
    const { title, description, link, order, status } = req.body;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Banner image is required'
      });
    }

    // Validate file size (5MB)
    if (req.file.size > 5 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        message: 'Image size must be less than 5MB'
      });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Only JPG, PNG and WebP images are allowed'
      });
    }

    // Upload image to Spaces
    const uploadResult = await uploadToSpaces(req.file, 'banners');

    const banner = new Banner({
      title,
      description,
      imageUrl: uploadResult.url,
      imageKey: uploadResult.key,
      link,
      order: order || 0,
      status: status || 'active',
      createdBy: req.user.id,
      franchise: req.franchiseId || null  // Multi-tenant
    });

    await banner.save();

    res.status(201).json({
      success: true,
      message: 'Banner created successfully',
      data: banner
    });
  } catch (error) {
    console.error('Create banner error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create banner',
      error: error.message
    });
  }
};

// Update banner
exports.updateBanner = async (req, res) => {
  try {
    const { title, description, link, order, status } = req.body;
    const banner = await Banner.findOne({ _id: req.params.id, franchise: req.franchiseId });

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }

    // Update basic fields
    if (title) banner.title = title;
    if (description !== undefined) banner.description = description;
    if (link !== undefined) banner.link = link;
    if (order !== undefined) banner.order = order;
    if (status) banner.status = status;

    // Handle image update
    if (req.file) {
      // Validate file size (5MB)
      if (req.file.size > 5 * 1024 * 1024) {
        return res.status(400).json({
          success: false,
          message: 'Image size must be less than 5MB'
        });
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({
          success: false,
          message: 'Only JPG, PNG and WebP images are allowed'
        });
      }

      // Delete old image
      if (banner.imageKey) {
        await deleteFromSpaces(banner.imageKey);
      }

      // Upload new image
      const uploadResult = await uploadToSpaces(req.file, 'banners');
      banner.imageUrl = uploadResult.url;
      banner.imageKey = uploadResult.key;
    }

    banner.updatedBy = req.user.id;
    await banner.save();

    res.json({
      success: true,
      message: 'Banner updated successfully',
      data: banner
    });
  } catch (error) {
    console.error('Update banner error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update banner',
      error: error.message
    });
  }
};

// Delete banner
exports.deleteBanner = async (req, res) => {
  try {
    const banner = await Banner.findOne({ _id: req.params.id, franchise: req.franchiseId });

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }

    // Delete image from Spaces
    if (banner.imageKey) {
      await deleteFromSpaces(banner.imageKey);
    }

    await banner.deleteOne();

    res.json({
      success: true,
      message: 'Banner deleted successfully'
    });
  } catch (error) {
    console.error('Delete banner error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete banner',
      error: error.message
    });
  }
};
