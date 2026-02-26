const NewsEvent = require('../models/NewsEvent');
const ResponseHelper = require('../utils/responseHelper');
const { uploadToSpaces, deleteFromSpaces, extractKeyFromUrl } = require('../utils/s3Upload');

class NewsEventController {
  /**
   * Get all news/events
   * GET /api/news-events
   */
  async getAll(req, res) {
    try {
      const { page = 1, limit = 10, status, category, featured } = req.query;
      const skip = (page - 1) * limit;

      const query = {};
      if (status) query.status = status;
      if (category) query.category = category;
      if (featured !== undefined) query.featured = featured === 'true';

      // Multi-tenant: restrict to current franchise
      if (req.franchiseId) query.franchise = req.franchiseId;

      const newsEvents = await NewsEvent.find(query)
        .populate('createdBy', 'name')
        .populate('updatedBy', 'name')
        .sort({ publishDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await NewsEvent.countDocuments(query);

      return ResponseHelper.success(res, {
        newsEvents,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }, 'News/Events retrieved successfully');
    } catch (error) {
      console.error('❌ Get News/Events Error:', error);
      return ResponseHelper.error(res, error.message, 500);
    }
  }

  /**
   * Get public news/events (published only)
   * GET /api/news-events/public
   */
  async getPublic(req, res) {
    try {
      const { page = 1, limit = 10, category } = req.query;
      const skip = (page - 1) * limit;

      const query = { status: 'published' };
      if (category) query.category = category;

      const newsEvents = await NewsEvent.find(query)
        .select('-createdBy -updatedBy -__v')
        .sort({ publishDate: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await NewsEvent.countDocuments(query);

      return ResponseHelper.success(res, {
        newsEvents,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }, 'News/Events retrieved successfully');
    } catch (error) {
      console.error('❌ Get Public News/Events Error:', error);
      return ResponseHelper.error(res, error.message, 500);
    }
  }

  /**
   * Get single news/event
   * GET /api/news-events/:id
   */
  async getById(req, res) {
    try {
      const { id } = req.params;
      
      const newsEvent = await NewsEvent.findOne({ _id: id, franchise: req.franchiseId })
        .populate('createdBy', 'name')
        .populate('updatedBy', 'name');

      if (!newsEvent) {
        return ResponseHelper.error(res, 'News/Event not found', 404);
      }

      // Increment views
      newsEvent.views += 1;
      await newsEvent.save();

      return ResponseHelper.success(res, { newsEvent }, 'News/Event retrieved successfully');
    } catch (error) {
      console.error('❌ Get News/Event Error:', error);
      return ResponseHelper.error(res, error.message, 500);
    }
  }

  /**
   * Create news/event
   * POST /api/news-events
   */
  async create(req, res) {
    try {
      const { title, description, category, status, featured, publishDate } = req.body;
      const userId = req.user._id;

      // Check if file is uploaded
      if (!req.file) {
        return ResponseHelper.error(res, 'Image is required', 400);
      }

      // Upload image to Spaces
      const uploadResult = await uploadToSpaces(req.file, 'news-events', {
        optimizeImage: true,
        maxWidth: 1200,
        quality: 85
      });

      const newsEvent = await NewsEvent.create({
        title,
        description,
        category: category || 'news',
        status: status || 'published',
        featured: featured === 'true',
        publishDate: publishDate || Date.now(),
        imageUrl: uploadResult.fileUrl,
        imageKey: uploadResult.key,
        createdBy: userId,
        franchise: req.franchiseId || null  // Multi-tenant
      });

      await newsEvent.populate('createdBy', 'name');

      return ResponseHelper.success(res, { newsEvent }, 'News/Event created successfully', 201);
    } catch (error) {
      console.error('❌ Create News/Event Error:', error);
      return ResponseHelper.error(res, error.message, 500);
    }
  }

  /**
   * Update news/event
   * PUT /api/news-events/:id
   */
  async update(req, res) {
    try {
      const { id } = req.params;
      const { title, description, category, status, featured, publishDate } = req.body;
      const userId = req.user._id;

      const newsEvent = await NewsEvent.findOne({ _id: id, franchise: req.franchiseId });
      if (!newsEvent) {
        return ResponseHelper.error(res, 'News/Event not found', 404);
      }

      // Update image if new file uploaded
      if (req.file) {
        // Delete old image
        if (newsEvent.imageKey) {
          await deleteFromSpaces(newsEvent.imageKey);
        }

        // Upload new image
        const uploadResult = await uploadToSpaces(req.file, 'news-events', {
          optimizeImage: true,
          maxWidth: 1200,
          quality: 85
        });

        newsEvent.imageUrl = uploadResult.fileUrl;
        newsEvent.imageKey = uploadResult.key;
      }

      // Update fields
      if (title) newsEvent.title = title;
      if (description) newsEvent.description = description;
      if (category) newsEvent.category = category;
      if (status) newsEvent.status = status;
      if (featured !== undefined) newsEvent.featured = featured === 'true';
      if (publishDate) newsEvent.publishDate = publishDate;
      
      newsEvent.updatedBy = userId;
      await newsEvent.save();

      await newsEvent.populate([
        { path: 'createdBy', select: 'name' },
        { path: 'updatedBy', select: 'name' }
      ]);

      return ResponseHelper.success(res, { newsEvent }, 'News/Event updated successfully');
    } catch (error) {
      console.error('❌ Update News/Event Error:', error);
      return ResponseHelper.error(res, error.message, 500);
    }
  }

  /**
   * Delete news/event
   * DELETE /api/news-events/:id
   */
  async delete(req, res) {
    try {
      const { id } = req.params;

      const newsEvent = await NewsEvent.findOne({ _id: id, franchise: req.franchiseId });
      if (!newsEvent) {
        return ResponseHelper.error(res, 'News/Event not found', 404);
      }

      // Delete image from Spaces
      if (newsEvent.imageKey) {
        await deleteFromSpaces(newsEvent.imageKey);
      }

      await NewsEvent.findOneAndDelete({ _id: id, franchise: req.franchiseId });

      return ResponseHelper.success(res, null, 'News/Event deleted successfully');
    } catch (error) {
      console.error('❌ Delete News/Event Error:', error);
      return ResponseHelper.error(res, error.message, 500);
    }
  }
}

module.exports = new NewsEventController();
