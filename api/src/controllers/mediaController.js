const MediaCoverage = require('../models/MediaCoverage');
const { uploadToSpaces, deleteFromSpaces } = require('../utils/s3Upload');
const { buildFranchiseReadFilter } = require('../utils/franchiseFilterHelper');

exports.getPublic = async (req, res) => {
  try {
    const filter = { status: 'active', ...buildFranchiseReadFilter(req) };
    const items = await MediaCoverage.find(filter)
      .sort({ order: 1, publishDate: -1 })
      .select('-createdBy -updatedBy');
    res.json({ success: true, data: items });
  } catch (error) {
    console.error('Get public media error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch media', error: error.message });
  }
};

exports.getAll = async (req, res) => {
  try {
    const filter = buildFranchiseReadFilter(req);
    if (req.query.status) filter.status = req.query.status;
    const items = await MediaCoverage.find(filter).sort({ order: 1, publishDate: -1 });
    res.json({ success: true, data: items });
  } catch (error) {
    console.error('Get all media error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch media', error: error.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { title, source, link, publishDate, order, status } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'Title is required' });
    let imageUrl = '';
    let imageKey = '';
    if (req.file) {
      const uploadResult = await uploadToSpaces(req.file, 'media');
      imageUrl = uploadResult.fileUrl;
      imageKey = uploadResult.key;
    }
    const item = new MediaCoverage({
      title,
      source,
      link,
      imageUrl,
      imageKey,
      publishDate: publishDate || Date.now(),
      order: order || 0,
      status: status || 'active',
      createdBy: req.user.id,
      franchise: req.franchiseId || null
    });
    await item.save();
    res.status(201).json({ success: true, data: item, message: 'Media item created successfully' });
  } catch (error) {
    console.error('Create media error:', error);
    res.status(500).json({ success: false, message: 'Failed to create media item', error: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const item = await MediaCoverage.findOne({ _id: req.params.id, ...buildFranchiseReadFilter(req) });
    if (!item) return res.status(404).json({ success: false, message: 'Media item not found' });
    const { title, source, link, publishDate, order, status } = req.body;
    if (title !== undefined) item.title = title;
    if (source !== undefined) item.source = source;
    if (link !== undefined) item.link = link;
    if (publishDate !== undefined) item.publishDate = publishDate;
    if (order !== undefined) item.order = order;
    if (status !== undefined) item.status = status;
    if (req.file) {
      if (item.imageKey) await deleteFromSpaces(item.imageKey).catch(() => {});
      const uploadResult = await uploadToSpaces(req.file, 'media');
      item.imageUrl = uploadResult.fileUrl;
      item.imageKey = uploadResult.key;
    }
    item.updatedBy = req.user.id;
    await item.save();
    res.json({ success: true, data: item, message: 'Media item updated successfully' });
  } catch (error) {
    console.error('Update media error:', error);
    res.status(500).json({ success: false, message: 'Failed to update media item', error: error.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const item = await MediaCoverage.findOneAndDelete({ _id: req.params.id, ...buildFranchiseReadFilter(req) });
    if (!item) return res.status(404).json({ success: false, message: 'Media item not found' });
    if (item.imageKey) await deleteFromSpaces(item.imageKey).catch(() => {});
    res.json({ success: true, message: 'Media item deleted successfully' });
  } catch (error) {
    console.error('Delete media error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete media item', error: error.message });
  }
};
