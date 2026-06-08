const mongoose = require('mongoose');
const franchisePlugin = require('../utils/franchisePlugin');
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
    },
    imageUrl: { type: String, default: '' },
    imageKey: { type: String, default: '' }
  },

  // Hero Section (overlay text on top of banner slider)
  hero: {
    title: { type: String, default: '' },
    subtitle: { type: String, default: '' },
    ctaText: { type: String, default: '' },
    ctaLink: { type: String, default: '' },
    secondaryCtaText: { type: String, default: '' },
    secondaryCtaLink: { type: String, default: '' }
  },

  // Vision / Mission / Values
  vision: {
    title: { type: String, default: 'Our Vision' },
    description: { type: String, default: '' }
  },
  mission: {
    title: { type: String, default: 'Our Mission' },
    description: { type: String, default: '' }
  },
  values: [{
    title: { type: String, default: '' },
    description: { type: String, default: '' },
    icon: { type: String, default: 'heart' },
    order: { type: Number, default: 0 }
  }],

  // Donation / Giving info (account, UPI, payment button)
  donation: {
    enabled: { type: Boolean, default: false },
    heading: { type: String, default: '' },
    description: { type: String, default: '' },
    accountName: { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    bankName: { type: String, default: '' },
    ifsc: { type: String, default: '' },
    upiId: { type: String, default: '' },
    paymentLink: { type: String, default: '' },
    qrImageUrl: { type: String, default: '' },
    qrImageKey: { type: String, default: '' }
  },

  // SEO metadata for the public site
  seo: {
    title: { type: String, default: '' },
    description: { type: String, default: '' },
    keywords: { type: [String], default: [] },
    ogImageUrl: { type: String, default: '' },
    ogImageKey: { type: String, default: '' }
  },

  // Footer
  footer: {
    description: { type: String, default: '' },
    copyrightText: { type: String, default: '' },
    links: [{
      label: { type: String, default: '' },
      url: { type: String, default: '' },
      order: { type: Number, default: 0 }
    }]
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

websiteSettingsSchema.plugin(franchisePlugin);

module.exports = mongoose.model('WebsiteSettings', websiteSettingsSchema);
