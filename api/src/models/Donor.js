const mongoose = require('mongoose');
const franchisePlugin = require('../utils/franchisePlugin');

const donorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    required: true,
    trim: true,
    match: [/^[+]?[\d\s\-()]{10,15}$/, 'Please enter a valid phone number']
  },
  type: {
    type: String,
    enum: ['individual', 'corporate', 'foundation', 'trust', 'ngo'],
    default: 'individual'
  },
  category: {
    type: String,
    enum: ['regular', 'patron', 'major', 'corporate', 'recurring'],
    default: 'regular'
  },
  address: {
    street: String,
    city: String,
    state: String,
    country: { type: String, default: 'India' },
    pincode: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  preferredPrograms: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project'
  }],
  preferredSchemes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Scheme'
  }],
  donationPreferences: {
    frequency: {
      type: String,
      enum: ['one-time', 'monthly', 'quarterly', 'half_yearly', 'yearly', 'custom'],
      default: 'one-time'
    },
    customIntervalDays: {
      type: Number,
      min: 1,
      default: null
    },
    preferredAmount: {
      type: Number,
      min: 0
    },
    preferredMethod: {
      type: String,
      enum: ['upi', 'bank_transfer', 'card', 'cash', 'cheque'],
      default: 'upi'
    },
    anonymousDonation: {
      type: Boolean,
      default: false
    }
  },
  taxDetails: {
    panNumber: {
      type: String,
      uppercase: true,
      match: [/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Please enter a valid PAN number']
    },
    gstNumber: String,
    taxExemptionCertificate: String
  },
  communicationPreferences: {
    email: { type: Boolean, default: true },
    sms: { type: Boolean, default: true },
    whatsapp: { type: Boolean, default: false },
    newsletter: { type: Boolean, default: true },
    donationReceipts: { type: Boolean, default: true }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'blocked', 'pending_verification'],
    default: 'active'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationDate: Date,
  tags: [String],
  notes: String,
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Donation statistics (calculated fields)
  donationStats: {
    totalDonated: { type: Number, default: 0 },
    donationCount: { type: Number, default: 0 },
    averageDonation: { type: Number, default: 0 },
    firstDonation: Date,
    lastDonation: Date,
    largestDonation: { type: Number, default: 0 },
    currentYearDonations: { type: Number, default: 0 },
    lastYearDonations: { type: Number, default: 0 }
  },
  // Follow-up status (denormalized for quick queries)
  followUpStatus: {
    type: String,
    enum: ['active', 'pending_reminder', 'overdue', 'lapsed', 'no_followup'],
    default: 'no_followup'
  },
  nextExpectedDonation: {
    type: Date,
    default: null
  },
  engagementScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },

  // Engagement tracking
  engagement: {
    lastContact: Date,
    contactCount: { type: Number, default: 0 },
    eventAttendance: { type: Number, default: 0 },
    referrals: { type: Number, default: 0 },
    socialMediaEngagement: {
      facebook: String,
      twitter: String,
      linkedin: String,
      instagram: String
    }
  },
  // Metadata
  source: {
    type: String,
    enum: ['website', 'event', 'referral', 'social_media', 'direct', 'campaign', 'other'],
    default: 'website'
  },
  sourceDetails: String,
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

// Indexes for better performance
donorSchema.index({ email: 1 });
donorSchema.index({ phone: 1 });
donorSchema.index({ 'donationStats.totalDonated': -1 });
donorSchema.index({ 'donationStats.lastDonation': -1 });
donorSchema.index({ followUpStatus: 1 });
donorSchema.index({ nextExpectedDonation: 1 });
donorSchema.index({ status: 1 });
donorSchema.index({ type: 1 });
donorSchema.index({ category: 1 });
donorSchema.index({ createdAt: -1 });
donorSchema.index({ name: 'text', email: 'text', phone: 'text' });

// Virtual for full address
donorSchema.virtual('fullAddress').get(function() {
  if (!this.address) return '';
  const parts = [
    this.address.street,
    this.address.city,
    this.address.state,
    this.address.pincode,
    this.address.country
  ].filter(Boolean);
  return parts.join(', ');
});

// Virtual for donation frequency description
donorSchema.virtual('donationFrequencyText').get(function() {
  const frequencies = {
    'one-time': 'One-time',
    'monthly': 'Monthly',
    'quarterly': 'Quarterly',
    'yearly': 'Yearly'
  };
  return frequencies[this.donationPreferences?.frequency] || 'One-time';
});

// Pre-save middleware to update category based on donation amount and preferences
donorSchema.pre('save', function(next) {
  // If donor has a recurring frequency set, mark as recurring
  const freq = this.donationPreferences?.frequency;
  if (freq && freq !== 'one-time') {
    this.category = 'recurring';
  } else if (this.donationStats.totalDonated >= 1000000) {
    this.category = 'major';
  } else if (this.donationStats.totalDonated >= 100000) {
    this.category = 'patron';
  } else if (this.type === 'corporate' || this.type === 'foundation' || this.type === 'trust') {
    this.category = 'corporate';
  } else {
    this.category = 'regular';
  }
  next();
});

// Static method to update donation stats
donorSchema.statics.updateDonationStats = async function(donorId) {
  const Payment = mongoose.model('Payment');
  
  const stats = await Payment.aggregate([
    {
      $match: {
        donor: mongoose.Types.ObjectId(donorId),
        type: 'donation',
        status: 'completed'
      }
    },
    {
      $group: {
        _id: null,
        totalDonated: { $sum: '$amount' },
        donationCount: { $sum: 1 },
        averageDonation: { $avg: '$amount' },
        firstDonation: { $min: '$createdAt' },
        lastDonation: { $max: '$createdAt' },
        largestDonation: { $max: '$amount' }
      }
    }
  ]);

  const currentYear = new Date().getFullYear();
  const currentYearStats = await Payment.aggregate([
    {
      $match: {
        donor: mongoose.Types.ObjectId(donorId),
        type: 'donation',
        status: 'completed',
        createdAt: {
          $gte: new Date(currentYear, 0, 1),
          $lt: new Date(currentYear + 1, 0, 1)
        }
      }
    },
    {
      $group: {
        _id: null,
        currentYearDonations: { $sum: '$amount' }
      }
    }
  ]);

  const lastYearStats = await Payment.aggregate([
    {
      $match: {
        donor: mongoose.Types.ObjectId(donorId),
        type: 'donation',
        status: 'completed',
        createdAt: {
          $gte: new Date(currentYear - 1, 0, 1),
          $lt: new Date(currentYear, 0, 1)
        }
      }
    },
    {
      $group: {
        _id: null,
        lastYearDonations: { $sum: '$amount' }
      }
    }
  ]);

  const donationStats = stats[0] || {};
  const currentYearAmount = currentYearStats[0]?.currentYearDonations || 0;
  const lastYearAmount = lastYearStats[0]?.lastYearDonations || 0;

  await this.findByIdAndUpdate(donorId, {
    donationStats: {
      totalDonated: donationStats.totalDonated || 0,
      donationCount: donationStats.donationCount || 0,
      averageDonation: donationStats.averageDonation || 0,
      firstDonation: donationStats.firstDonation,
      lastDonation: donationStats.lastDonation,
      largestDonation: donationStats.largestDonation || 0,
      currentYearDonations: currentYearAmount,
      lastYearDonations: lastYearAmount
    }
  });
};

// Instance method to get donation history
donorSchema.methods.getDonationHistory = function(limit = 10) {
  const Payment = mongoose.model('Payment');
  return Payment.find({
    donor: this._id,
    type: 'donation',
    status: 'completed'
  })
    .populate('project', 'name code')
    .populate('scheme', 'name code')
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Franchise multi-tenancy — compound unique: same email can exist in different franchises
donorSchema.plugin(franchisePlugin);
donorSchema.index({ email: 1, franchise: 1 }, { unique: true });

module.exports = mongoose.model('Donor', donorSchema);