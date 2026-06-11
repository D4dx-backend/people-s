const mongoose = require('mongoose');
const franchisePlugin = require('../utils/franchisePlugin');

/**
 * Download
 * Admin-uploaded files made available to selected roles / locations.
 * Files live on DigitalOcean Spaces (public-read); we store the URL + key.
 * Access is resolved dynamically at fetch time against the requesting
 * user's franchise role and admin scope (no per-recipient state stored).
 */
const downloadSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  category: {
    type: String,
    trim: true,
    default: 'general'
  },

  // File metadata (file already uploaded via /api/upload)
  fileUrl: {
    type: String,
    required: [true, 'File URL is required']
  },
  fileKey: {
    type: String,
    required: [true, 'File key is required']
  },
  fileName: {
    type: String,
    required: true
  },
  mimetype: String,
  size: Number,

  // Access control
  targeting: {
    // Roles that may access this file. Empty = all authenticated admins.
    userRoles: [{
      type: String,
      enum: [
        'super_admin',
        'state_admin',
        'district_admin',
        'area_admin',
        'unit_admin',
        'area_president',
        'project_coordinator',
        'scheme_coordinator',
        'beneficiary'
      ]
    }],
    // Optional location scoping (district / area / unit / region ids).
    // Empty = no location restriction.
    locationIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location'
    }]
  },

  downloadCount: {
    type: Number,
    default: 0
  },

  isActive: {
    type: Boolean,
    default: true
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
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

downloadSchema.index({ 'targeting.userRoles': 1 });
downloadSchema.index({ 'targeting.locationIds': 1 });
downloadSchema.index({ isActive: 1, createdAt: -1 });

downloadSchema.plugin(franchisePlugin);

module.exports = mongoose.model('Download', downloadSchema);
