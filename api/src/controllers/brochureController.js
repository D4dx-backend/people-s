const Brochure = require('../models/Brochure');
const ResponseHelper = require('../utils/responseHelper');
const { uploadToSpaces, deleteFromSpaces } = require('../utils/s3Upload');
const { buildFranchiseReadFilter, buildFranchiseMatchStage, getWriteFranchiseId } = require('../utils/franchiseFilterHelper');

class BrochureController {
  /**
   * Get all brochures
   * GET /api/brochures
   */
  async getAll(req, res) {
    try {
      const { page = 1, limit = 10, status, category } = req.query;
      const skip = (page - 1) * limit;

      const query = {};
      if (status) query.status = status;
      if (category) query.category = category;

      Object.assign(query, buildFranchiseReadFilter(req));

      const brochures = await Brochure.find(query)
        .populate('createdBy', 'name')
        .populate('updatedBy', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Brochure.countDocuments(query);

      return ResponseHelper.success(res, {
        brochures,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }, 'Brochures retrieved successfully');
    } catch (error) {
      console.error('❌ Get Brochures Error:', error);
      return ResponseHelper.error(res, error.message, 500);
    }
  }

  /**
   * Get public brochures (active only)
   * GET /api/brochures/public
   */
  async getPublic(req, res) {
    try {
      const { page = 1, limit = 10, category } = req.query;
      const skip = (page - 1) * limit;

      const query = { status: 'active' };
      if (category) query.category = category;

      const brochures = await Brochure.find(query)
        .select('-createdBy -updatedBy -__v')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Brochure.countDocuments(query);

      return ResponseHelper.success(res, {
        brochures,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }, 'Brochures retrieved successfully');
    } catch (error) {
      console.error('❌ Get Public Brochures Error:', error);
      return ResponseHelper.error(res, error.message, 500);
    }
  }

  /**
   * Get single brochure
   * GET /api/brochures/:id
   */
  async getById(req, res) {
    try {
      const { id } = req.params;
      
      const brochure = await Brochure.findOne({ _id: id, ...buildFranchiseReadFilter(req) })
        .populate('createdBy', 'name')
        .populate('updatedBy', 'name');

      if (!brochure) {
        return ResponseHelper.error(res, 'Brochure not found', 404);
      }

      return ResponseHelper.success(res, { brochure }, 'Brochure retrieved successfully');
    } catch (error) {
      console.error('❌ Get Brochure Error:', error);
      return ResponseHelper.error(res, error.message, 500);
    }
  }

  /**
   * Create brochure
   * POST /api/brochures
   */
  async create(req, res) {
    try {
      const { title, description, category, status } = req.body;
      const userId = req.user._id;

      // Check if file is uploaded
      if (!req.file) {
        return ResponseHelper.error(res, 'File is required', 400);
      }

      // Validate file type (PDF only)
      if (req.file.mimetype !== 'application/pdf') {
        return ResponseHelper.error(res, 'Only PDF files are allowed', 400);
      }

      // Upload file to Spaces
      const uploadResult = await uploadToSpaces(req.file, 'brochures');

      const brochure = await Brochure.create({
        title,
        description,
        category: category || 'general',
        status: status || 'active',
        fileUrl: uploadResult.fileUrl,
        fileKey: uploadResult.key,
        fileName: req.file.originalname,
        fileSize: uploadResult.size,
        createdBy: userId,
        franchise: req.franchiseId || null  // Multi-tenant
      });

      await brochure.populate('createdBy', 'name');

      return ResponseHelper.success(res, { brochure }, 'Brochure created successfully', 201);
    } catch (error) {
      console.error('❌ Create Brochure Error:', error);
      return ResponseHelper.error(res, error.message, 500);
    }
  }

  /**
   * Update brochure
   * PUT /api/brochures/:id
   */
  async update(req, res) {
    try {
      const { id } = req.params;
      const { title, description, category, status } = req.body;
      const userId = req.user._id;

      const brochure = await Brochure.findOne({ _id: id, franchise: req.franchiseId });
      if (!brochure) {
        return ResponseHelper.error(res, 'Brochure not found', 404);
      }

      // Update file if new file uploaded
      if (req.file) {
        // Validate file type
        if (req.file.mimetype !== 'application/pdf') {
          return ResponseHelper.error(res, 'Only PDF files are allowed', 400);
        }

        // Delete old file
        if (brochure.fileKey) {
          await deleteFromSpaces(brochure.fileKey);
        }

        // Upload new file
        const uploadResult = await uploadToSpaces(req.file, 'brochures');

        brochure.fileUrl = uploadResult.fileUrl;
        brochure.fileKey = uploadResult.key;
        brochure.fileName = req.file.originalname;
        brochure.fileSize = uploadResult.size;
      }

      // Update fields
      if (title) brochure.title = title;
      if (description) brochure.description = description;
      if (category) brochure.category = category;
      if (status) brochure.status = status;
      
      brochure.updatedBy = userId;
      await brochure.save();

      await brochure.populate([
        { path: 'createdBy', select: 'name' },
        { path: 'updatedBy', select: 'name' }
      ]);

      return ResponseHelper.success(res, { brochure }, 'Brochure updated successfully');
    } catch (error) {
      console.error('❌ Update Brochure Error:', error);
      return ResponseHelper.error(res, error.message, 500);
    }
  }

  /**
   * Delete brochure
   * DELETE /api/brochures/:id
   */
  async delete(req, res) {
    try {
      const { id } = req.params;

      const brochure = await Brochure.findOne({ _id: id, franchise: req.franchiseId });
      if (!brochure) {
        return ResponseHelper.error(res, 'Brochure not found', 404);
      }

      // Delete file from Spaces
      if (brochure.fileKey) {
        await deleteFromSpaces(brochure.fileKey);
      }

      await Brochure.findOneAndDelete({ _id: id, franchise: req.franchiseId });

      return ResponseHelper.success(res, null, 'Brochure deleted successfully');
    } catch (error) {
      console.error('❌ Delete Brochure Error:', error);
      return ResponseHelper.error(res, error.message, 500);
    }
  }

  /**
   * Track brochure download
   * POST /api/brochures/:id/download
   */
  async trackDownload(req, res) {
    try {
      const { id } = req.params;

      const brochure = await Brochure.findOne({ _id: id, franchise: req.franchiseId });
      if (!brochure) {
        return ResponseHelper.error(res, 'Brochure not found', 404);
      }

      brochure.downloads += 1;
      await brochure.save();

      return ResponseHelper.success(res, { downloads: brochure.downloads }, 'Download tracked');
    } catch (error) {
      console.error('❌ Track Download Error:', error);
      return ResponseHelper.error(res, error.message, 500);
    }
  }
}

module.exports = new BrochureController();
