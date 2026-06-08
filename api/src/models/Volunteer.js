const mongoose = require('mongoose');
const franchisePlugin = require('../utils/franchisePlugin');

const volunteerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    default: ''
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  area: {
    type: String,
    trim: true,
    default: ''
  },
  interest: {
    type: String,
    trim: true,
    default: ''
  },
  message: {
    type: String,
    trim: true,
    default: ''
  },
  status: {
    type: String,
    enum: ['new', 'contacted', 'active', 'rejected', 'archived'],
    default: 'new'
  },
  ipAddress: {
    type: String,
    default: ''
  },
  handledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

volunteerSchema.plugin(franchisePlugin);
volunteerSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Volunteer', volunteerSchema);
