const mongoose = require('mongoose');
const franchisePlugin = require('../utils/franchisePlugin');

const videoSchema = new mongoose.Schema({
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
  // YouTube / Vimeo / external video URL
  videoUrl: {
    type: String,
    required: true,
    trim: true
  },
  // Optional custom thumbnail (else derived from YouTube on the client)
  thumbnailUrl: {
    type: String,
    default: ''
  },
  thumbnailKey: {
    type: String,
    default: ''
  },
  category: {
    type: String,
    trim: true,
    default: 'general'
  },
  featured: {
    type: Boolean,
    default: false
  },
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

videoSchema.plugin(franchisePlugin);
videoSchema.index({ status: 1, order: 1 });

module.exports = mongoose.model('Video', videoSchema);
