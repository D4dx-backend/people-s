const mongoose = require('mongoose');
const franchisePlugin = require('../utils/franchisePlugin');

const partnerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Partner name is required'],
    trim: true
  },
  logoUrl: {
    type: String,
    required: [true, 'Logo URL is required']
  },
  logoKey: {
    type: String,
    required: true
  },
  link: {
    type: String,
    trim: true
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

// Indexes
partnerSchema.plugin(franchisePlugin);
partnerSchema.index({ status: 1, order: 1 });

module.exports = mongoose.model('Partner', partnerSchema);
