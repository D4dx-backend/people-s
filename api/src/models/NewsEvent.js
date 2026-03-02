const mongoose = require('mongoose');
const franchisePlugin = require('../utils/franchisePlugin');

const newsEventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },

  description: {
    type: String,
    required: [true, 'Description is required'],
    maxlength: [5000, 'Description cannot exceed 5000 characters']
  },

  category: {
    type: String,
    enum: ['news', 'event', 'announcement', 'success_story'],
    default: 'news'
  },

  imageUrl: {
    type: String,
    required: [true, 'Image is required']
  },

  imageKey: {
    type: String,
    required: true
  },

  publishDate: {
    type: Date,
    default: Date.now
  },

  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'published'
  },

  featured: {
    type: Boolean,
    default: false
  },

  views: {
    type: Number,
    default: 0
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

newsEventSchema.index({ status: 1, publishDate: -1 });
newsEventSchema.plugin(franchisePlugin);
newsEventSchema.index({ category: 1 });

module.exports = mongoose.model('NewsEvent', newsEventSchema);
