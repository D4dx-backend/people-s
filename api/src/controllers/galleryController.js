const GalleryAlbum = require('../models/GalleryAlbum');
const { uploadToSpaces, deleteFromSpaces } = require('../utils/s3Upload');
const { buildFranchiseReadFilter } = require('../utils/franchiseFilterHelper');

// Public: active albums (optionally summarised)
exports.getPublic = async (req, res) => {
  try {
    const filter = { status: 'active', ...buildFranchiseReadFilter(req) };
    if (req.query.category) filter.category = req.query.category;
    const albums = await GalleryAlbum.find(filter)
      .sort({ order: 1, createdAt: -1 })
      .select('-createdBy -updatedBy');
    res.json({ success: true, data: albums });
  } catch (error) {
    console.error('Get public gallery error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch gallery', error: error.message });
  }
};

exports.getPublicById = async (req, res) => {
  try {
    const album = await GalleryAlbum.findOne({ _id: req.params.id, status: 'active', ...buildFranchiseReadFilter(req) })
      .select('-createdBy -updatedBy');
    if (!album) return res.status(404).json({ success: false, message: 'Album not found' });
    res.json({ success: true, data: album });
  } catch (error) {
    console.error('Get public album error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch album', error: error.message });
  }
};

exports.getAll = async (req, res) => {
  try {
    const filter = buildFranchiseReadFilter(req);
    if (req.query.status) filter.status = req.query.status;
    const albums = await GalleryAlbum.find(filter).sort({ order: 1, createdAt: -1 });
    res.json({ success: true, data: albums });
  } catch (error) {
    console.error('Get all albums error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch albums', error: error.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const album = await GalleryAlbum.findOne({ _id: req.params.id, ...buildFranchiseReadFilter(req) });
    if (!album) return res.status(404).json({ success: false, message: 'Album not found' });
    res.json({ success: true, data: album });
  } catch (error) {
    console.error('Get album error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch album', error: error.message });
  }
};

// Create album. Accepts uploaded images (field 'images') and optional cover (field 'cover')
exports.create = async (req, res) => {
  try {
    const { title, description, category, order, status } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'Title is required' });

    const files = req.files || {};
    const imageFiles = files.images || [];
    const coverFile = (files.cover && files.cover[0]) || null;

    const images = [];
    for (let i = 0; i < imageFiles.length; i++) {
      const uploadResult = await uploadToSpaces(imageFiles[i], 'gallery');
      images.push({ imageUrl: uploadResult.fileUrl, imageKey: uploadResult.key, order: i });
    }

    let coverImageUrl = '';
    let coverImageKey = '';
    if (coverFile) {
      const uploadResult = await uploadToSpaces(coverFile, 'gallery');
      coverImageUrl = uploadResult.fileUrl;
      coverImageKey = uploadResult.key;
    } else if (images.length > 0) {
      coverImageUrl = images[0].imageUrl;
    }

    const album = new GalleryAlbum({
      title,
      description,
      category: category || 'general',
      coverImageUrl,
      coverImageKey,
      images,
      order: order || 0,
      status: status || 'active',
      createdBy: req.user.id,
      franchise: req.franchiseId || null
    });
    await album.save();
    res.status(201).json({ success: true, data: album, message: 'Album created successfully' });
  } catch (error) {
    console.error('Create album error:', error);
    res.status(500).json({ success: false, message: 'Failed to create album', error: error.message });
  }
};

// Update album text fields, append new images, replace cover.
// removeImageIds (JSON array of subdoc ids) removes images.
exports.update = async (req, res) => {
  try {
    const album = await GalleryAlbum.findOne({ _id: req.params.id, ...buildFranchiseReadFilter(req) });
    if (!album) return res.status(404).json({ success: false, message: 'Album not found' });

    const { title, description, category, order, status } = req.body;
    if (title !== undefined) album.title = title;
    if (description !== undefined) album.description = description;
    if (category !== undefined) album.category = category;
    if (order !== undefined) album.order = order;
    if (status !== undefined) album.status = status;

    // Remove selected images
    let removeImageIds = req.body.removeImageIds;
    if (typeof removeImageIds === 'string') {
      try { removeImageIds = JSON.parse(removeImageIds); } catch { removeImageIds = []; }
    }
    if (Array.isArray(removeImageIds) && removeImageIds.length) {
      for (const img of album.images) {
        if (removeImageIds.includes(img._id.toString()) && img.imageKey) {
          await deleteFromSpaces(img.imageKey).catch(() => {});
        }
      }
      album.images = album.images.filter(img => !removeImageIds.includes(img._id.toString()));
    }

    const files = req.files || {};
    const imageFiles = files.images || [];
    let maxOrder = album.images.reduce((m, i) => Math.max(m, i.order || 0), -1);
    for (const f of imageFiles) {
      const uploadResult = await uploadToSpaces(f, 'gallery');
      maxOrder += 1;
      album.images.push({ imageUrl: uploadResult.fileUrl, imageKey: uploadResult.key, order: maxOrder });
    }

    const coverFile = (files.cover && files.cover[0]) || null;
    if (coverFile) {
      if (album.coverImageKey) await deleteFromSpaces(album.coverImageKey).catch(() => {});
      const uploadResult = await uploadToSpaces(coverFile, 'gallery');
      album.coverImageUrl = uploadResult.fileUrl;
      album.coverImageKey = uploadResult.key;
    } else if (!album.coverImageUrl && album.images.length > 0) {
      album.coverImageUrl = album.images[0].imageUrl;
    }

    album.updatedBy = req.user.id;
    await album.save();
    res.json({ success: true, data: album, message: 'Album updated successfully' });
  } catch (error) {
    console.error('Update album error:', error);
    res.status(500).json({ success: false, message: 'Failed to update album', error: error.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const album = await GalleryAlbum.findOneAndDelete({ _id: req.params.id, ...buildFranchiseReadFilter(req) });
    if (!album) return res.status(404).json({ success: false, message: 'Album not found' });
    const keys = album.images.map(i => i.imageKey).filter(Boolean);
    if (album.coverImageKey) keys.push(album.coverImageKey);
    for (const key of keys) await deleteFromSpaces(key).catch(() => {});
    res.json({ success: true, message: 'Album deleted successfully' });
  } catch (error) {
    console.error('Delete album error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete album', error: error.message });
  }
};
