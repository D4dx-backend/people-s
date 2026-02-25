const mongoose = require('mongoose');
const orgConfig = require('../config/orgConfig');

const websiteSettingsSchema = new mongoose.Schema({
  // About Us Section
  aboutUs: {
    title: {
      type: String,
      default: function() { return `About ${orgConfig.erpTitle}`; }
    },
    description: {
      type: String,
      default: ''
    }
  },

  // Dynamic Stats Counters
  counts: [{
    title: {
      type: String,
      required: true
    },
    count: {
      type: Number,
      required: true,
      default: 0
    },
    icon: {
      type: String,
      default: 'users'
    },
    order: {
      type: Number,
      default: 0
    }
  }],

  // Contact Details
  contactDetails: {
    phone: {
      type: String,
      default: ''
    },
    email: {
      type: String,
      default: ''
    },
    address: {
      type: String,
      default: ''
    },
    whatsapp: {
      type: String,
      default: ''
    }
  },

  // Social Media Links
  socialMedia: {
    facebook: {
      type: String,
      default: ''
    },
    instagram: {
      type: String,
      default: ''
    },
    youtube: {
      type: String,
      default: ''
    },
    twitter: {
      type: String,
      default: ''
    },
    linkedin: {
      type: String,
      default: ''
    }
  },

  // Audit
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('WebsiteSettings', websiteSettingsSchema);
