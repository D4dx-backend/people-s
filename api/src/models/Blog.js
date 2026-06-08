const mongoose = require('mongoose');
const franchisePlugin = require('../utils/franchisePlugin');

const blogSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    trim: true,
    lowercase: true,
    index: true
  },
  author: {
    type: String,
    trim: true,
    default: ''
  },
  excerpt: {
    type: String,
    trim: true,
    default: ''
  },
  content: {
    type: String,
    required: true
  },
  coverImageUrl: {
    type: String,
    default: ''
  },
  coverImageKey: {
    type: String,
    default: ''
  },
  category: {
    type: String,
    trim: true,
    default: 'general'
  },
  tags: {
    type: [String],
    default: []
  },
  featured: {
    type: Boolean,
    default: false
  },
  publishDate: {
    type: Date,
    default: Date.now
  },
  views: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
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

blogSchema.plugin(franchisePlugin);
blogSchema.index({ status: 1, publishDate: -1 });

// Auto-generate a slug from the title when not provided
blogSchema.pre('validate', function generateSlug(next) {
  if (!this.slug && this.title) {
    this.slug = this.title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 120);
  }
  next();
});

module.exports = mongoose.model('Blog', blogSchema);
