const Video = require('../models/Video');
const { uploadToSpaces, deleteFromSpaces } = require('../utils/s3Upload');
const { buildFranchiseReadFilter } = require('../utils/franchiseFilterHelper');

exports.getPublic = async (req, res) => {
  try {
    const filter = { status: 'active', ...buildFranchiseReadFilter(req) };
    if (req.query.category) filter.category = req.query.category;
    if (req.query.featured === 'true') filter.featured = true;
    const videos = await Video.find(filter).sort({ order: 1, createdAt: -1 }).select('-createdBy -updatedBy');
    res.json({ success: true, data: videos });
  } catch (error) {
    console.error('Get public videos error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch videos', error: error.message });
  }
};

exports.getAll = async (req, res) => {
  try {
    const filter = buildFranchiseReadFilter(req);
    if (req.query.status) filter.status = req.query.status;
    if (req.query.category) filter.category = req.query.category;
    const videos = await Video.find(filter).sort({ order: 1, createdAt: -1 });
    res.json({ success: true, data: videos });
  } catch (error) {
    console.error('Get all videos error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch videos', error: error.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { title, description, videoUrl, category, featured, order, status } = req.body;
    if (!title || !videoUrl) {
      return res.status(400).json({ success: false, message: 'Title and video URL are required' });
    }
    let thumbnailUrl = '';
    let thumbnailKey = '';
    if (req.file) {
      const uploadResult = await uploadToSpaces(req.file, 'videos');
      thumbnailUrl = uploadResult.fileUrl;
      thumbnailKey = uploadResult.key;
    }
    const video = new Video({
      title,
      description,
      videoUrl,
      thumbnailUrl,
      thumbnailKey,
      category: category || 'general',
      featured: featured === 'true' || featured === true,
      order: order || 0,
      status: status || 'active',
      createdBy: req.user.id,
      franchise: req.franchiseId || null
    });
    await video.save();
    res.status(201).json({ success: true, data: video, message: 'Video created successfully' });
  } catch (error) {
    console.error('Create video error:', error);
    res.status(500).json({ success: false, message: 'Failed to create video', error: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const video = await Video.findOne({ _id: req.params.id, ...buildFranchiseReadFilter(req) });
    if (!video) return res.status(404).json({ success: false, message: 'Video not found' });
    const { title, description, videoUrl, category, featured, order, status } = req.body;
    if (title !== undefined) video.title = title;
    if (description !== undefined) video.description = description;
    if (videoUrl !== undefined) video.videoUrl = videoUrl;
    if (category !== undefined) video.category = category;
    if (featured !== undefined) video.featured = featured === 'true' || featured === true;
    if (order !== undefined) video.order = order;
    if (status !== undefined) video.status = status;
    if (req.file) {
      if (video.thumbnailKey) await deleteFromSpaces(video.thumbnailKey).catch(() => {});
      const uploadResult = await uploadToSpaces(req.file, 'videos');
      video.thumbnailUrl = uploadResult.fileUrl;
      video.thumbnailKey = uploadResult.key;
    }
    video.updatedBy = req.user.id;
    await video.save();
    res.json({ success: true, data: video, message: 'Video updated successfully' });
  } catch (error) {
    console.error('Update video error:', error);
    res.status(500).json({ success: false, message: 'Failed to update video', error: error.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const video = await Video.findOneAndDelete({ _id: req.params.id, ...buildFranchiseReadFilter(req) });
    if (!video) return res.status(404).json({ success: false, message: 'Video not found' });
    if (video.thumbnailKey) await deleteFromSpaces(video.thumbnailKey).catch(() => {});
    res.json({ success: true, message: 'Video deleted successfully' });
  } catch (error) {
    console.error('Delete video error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete video', error: error.message });
  }
};
