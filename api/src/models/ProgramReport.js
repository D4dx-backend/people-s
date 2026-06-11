const mongoose = require('mongoose');
const franchisePlugin = require('../utils/franchisePlugin');

/**
 * Program Report
 *
 * A program/event post uploaded by an area coordinator (unit / area / district
 * admin) describing a program that took place in their area.
 *
 * Each report carries a title, the news/description text, an optional scheme
 * tag (so admins can group reports by scheme), the coordinator's location/area,
 * and up to 5 photos (compressed via sharp before upload to the CDN).
 */

const MAX_PHOTOS = 5;

const photoSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true
  },
  key: {
    type: String,
    required: true
  },
  fileName: {
    type: String,
    required: true
  },
  mimetype: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    default: 0
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

const programReportSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [300, 'Title cannot exceed 300 characters']
  },
  // The news / description content of the program
  news: {
    type: String,
    trim: true,
    maxlength: [5000, 'News cannot exceed 5000 characters']
  },
  // Optional scheme this program is related to (used for grouping in admin)
  scheme: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Scheme'
  },
  // The location (district / area / unit) the program belongs to.
  // Auto-derived from the coordinator's scope; can be overridden manually.
  location: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location'
  },
  // Up to MAX_PHOTOS images uploaded to the CDN (compressed before upload)
  photos: {
    type: [photoSchema],
    validate: {
      validator: (arr) => !arr || arr.length <= MAX_PHOTOS,
      message: `A program report can have at most ${MAX_PHOTOS} photos`
    },
    default: []
  },
  // The coordinator who uploaded the report
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Submitter reference is required']
  },
  // Role at the time of submission
  submitterRole: {
    type: String,
    enum: ['unit_admin', 'area_admin', 'district_admin', 'area_president']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

programReportSchema.plugin(franchisePlugin);
programReportSchema.index({ submittedBy: 1 });
programReportSchema.index({ scheme: 1 });
programReportSchema.index({ location: 1 });
programReportSchema.index({ createdAt: -1 });

programReportSchema.statics.MAX_PHOTOS = MAX_PHOTOS;

module.exports = mongoose.model('ProgramReport', programReportSchema);
