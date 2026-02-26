const mongoose = require('mongoose');
const franchisePlugin = require('../utils/franchisePlugin');

const brochureSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },

  description: {
    type: String,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },

  category: {
    type: String,
    enum: ['general', 'scheme', 'project', 'report', 'guideline', 'other'],
    default: 'general'
  },

  fileUrl: {
    type: String,
    required: [true, 'File is required']
  },

  fileKey: {
    type: String,
    required: true
  },

  fileName: {
    type: String,
    required: true
  },

  fileSize: {
    type: Number,
    required: true
  },

  downloads: {
    type: Number,
    default: 0
  },

  status: {
    type: String,
    enum: ['active', 'archived'],
    default: 'active'
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

brochureSchema.index({ status: 1, createdAt: -1 });
brochureSchema.plugin(franchisePlugin);
brochureSchema.index({ category: 1 });

module.exports = mongoose.model('Brochure', brochureSchema);
