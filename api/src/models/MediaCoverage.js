const mongoose = require('mongoose');
const franchisePlugin = require('../utils/franchisePlugin');

/**
 * MediaCoverage — press / media mentions shown on the public website
 * (e.g. newspaper clippings, news portal articles, TV coverage links).
 */
const mediaCoverageSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  source: {
    type: String,
    trim: true,
    default: ''
  },
  link: {
    type: String,
    trim: true,
    default: ''
  },
  imageUrl: {
    type: String,
    default: ''
  },
  imageKey: {
    type: String,
    default: ''
  },
  publishDate: {
    type: Date,
    default: Date.now
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

mediaCoverageSchema.plugin(franchisePlugin);
mediaCoverageSchema.index({ status: 1, order: 1, publishDate: -1 });

module.exports = mongoose.model('MediaCoverage', mediaCoverageSchema);
