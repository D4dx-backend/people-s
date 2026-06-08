const mongoose = require('mongoose');
const franchisePlugin = require('../utils/franchisePlugin');

const galleryImageSchema = new mongoose.Schema({
  imageUrl: {
    type: String,
    required: true
  },
  imageKey: {
    type: String,
    required: true
  },
  caption: {
    type: String,
    trim: true,
    default: ''
  },
  order: {
    type: Number,
    default: 0
  }
}, { _id: true });

const galleryAlbumSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  category: {
    type: String,
    trim: true,
    default: 'general'
  },
  coverImageUrl: {
    type: String,
    default: ''
  },
  coverImageKey: {
    type: String,
    default: ''
  },
  images: [galleryImageSchema],
  order: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

galleryAlbumSchema.plugin(franchisePlugin);
galleryAlbumSchema.index({ status: 1, order: 1 });

module.exports = mongoose.model('GalleryAlbum', galleryAlbumSchema);
