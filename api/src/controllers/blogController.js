const Blog = require('../models/Blog');
const { uploadToSpaces, deleteFromSpaces } = require('../utils/s3Upload');
const { buildFranchiseReadFilter } = require('../utils/franchiseFilterHelper');

exports.getPublic = async (req, res) => {
  try {
    const filter = { status: 'published', ...buildFranchiseReadFilter(req) };
    if (req.query.category) filter.category = req.query.category;
    if (req.query.featured === 'true') filter.featured = true;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;
    const [blogs, total] = await Promise.all([
      Blog.find(filter).sort({ publishDate: -1 }).skip(skip).limit(limit).select('-content -createdBy -updatedBy'),
      Blog.countDocuments(filter)
    ]);
    res.json({ success: true, data: blogs, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error('Get public blogs error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch blogs', error: error.message });
  }
};

exports.getPublicBySlug = async (req, res) => {
  try {
    const blog = await Blog.findOneAndUpdate(
      { slug: req.params.slug, status: 'published', ...buildFranchiseReadFilter(req) },
      { $inc: { views: 1 } },
      { new: true }
    ).select('-createdBy -updatedBy');
    if (!blog) return res.status(404).json({ success: false, message: 'Blog not found' });
    res.json({ success: true, data: blog });
  } catch (error) {
    console.error('Get blog by slug error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch blog', error: error.message });
  }
};

exports.getAll = async (req, res) => {
  try {
    const filter = buildFranchiseReadFilter(req);
    if (req.query.status) filter.status = req.query.status;
    if (req.query.category) filter.category = req.query.category;
    const blogs = await Blog.find(filter).sort({ publishDate: -1 }).select('-content');
    res.json({ success: true, data: blogs });
  } catch (error) {
    console.error('Get all blogs error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch blogs', error: error.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const blog = await Blog.findOne({ _id: req.params.id, ...buildFranchiseReadFilter(req) });
    if (!blog) return res.status(404).json({ success: false, message: 'Blog not found' });
    res.json({ success: true, data: blog });
  } catch (error) {
    console.error('Get blog error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch blog', error: error.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { title, author, excerpt, content, category, tags, featured, publishDate, status } = req.body;
    if (!title || !content) {
      return res.status(400).json({ success: false, message: 'Title and content are required' });
    }
    let coverImageUrl = '';
    let coverImageKey = '';
    if (req.file) {
      const uploadResult = await uploadToSpaces(req.file, 'blogs');
      coverImageUrl = uploadResult.fileUrl;
      coverImageKey = uploadResult.key;
    }
    let parsedTags = tags;
    if (typeof tags === 'string') {
      try { parsedTags = JSON.parse(tags); } catch { parsedTags = tags.split(',').map(t => t.trim()).filter(Boolean); }
    }
    const blog = new Blog({
      title,
      author,
      excerpt,
      content,
      category: category || 'general',
      tags: parsedTags || [],
      featured: featured === 'true' || featured === true,
      publishDate: publishDate || Date.now(),
      status: status || 'draft',
      coverImageUrl,
      coverImageKey,
      createdBy: req.user.id,
      franchise: req.franchiseId || null
    });
    await blog.save();
    res.status(201).json({ success: true, data: blog, message: 'Blog created successfully' });
  } catch (error) {
    console.error('Create blog error:', error);
    res.status(500).json({ success: false, message: 'Failed to create blog', error: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const blog = await Blog.findOne({ _id: req.params.id, ...buildFranchiseReadFilter(req) });
    if (!blog) return res.status(404).json({ success: false, message: 'Blog not found' });
    const { title, author, excerpt, content, category, tags, featured, publishDate, status } = req.body;
    if (title !== undefined) blog.title = title;
    if (author !== undefined) blog.author = author;
    if (excerpt !== undefined) blog.excerpt = excerpt;
    if (content !== undefined) blog.content = content;
    if (category !== undefined) blog.category = category;
    if (featured !== undefined) blog.featured = featured === 'true' || featured === true;
    if (publishDate !== undefined) blog.publishDate = publishDate;
    if (status !== undefined) blog.status = status;
    if (tags !== undefined) {
      let parsedTags = tags;
      if (typeof tags === 'string') {
        try { parsedTags = JSON.parse(tags); } catch { parsedTags = tags.split(',').map(t => t.trim()).filter(Boolean); }
      }
      blog.tags = parsedTags || [];
    }
    if (req.file) {
      if (blog.coverImageKey) await deleteFromSpaces(blog.coverImageKey).catch(() => {});
      const uploadResult = await uploadToSpaces(req.file, 'blogs');
      blog.coverImageUrl = uploadResult.fileUrl;
      blog.coverImageKey = uploadResult.key;
    }
    blog.updatedBy = req.user.id;
    await blog.save();
    res.json({ success: true, data: blog, message: 'Blog updated successfully' });
  } catch (error) {
    console.error('Update blog error:', error);
    res.status(500).json({ success: false, message: 'Failed to update blog', error: error.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const blog = await Blog.findOneAndDelete({ _id: req.params.id, ...buildFranchiseReadFilter(req) });
    if (!blog) return res.status(404).json({ success: false, message: 'Blog not found' });
    if (blog.coverImageKey) await deleteFromSpaces(blog.coverImageKey).catch(() => {});
    res.json({ success: true, message: 'Blog deleted successfully' });
  } catch (error) {
    console.error('Delete blog error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete blog', error: error.message });
  }
};
