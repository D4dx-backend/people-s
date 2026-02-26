const mongoose = require('mongoose');
const franchisePlugin = require('../utils/franchisePlugin');

const enquiryReportSchema = new mongoose.Schema({
  // Basic Information
  reportNumber: {
    type: String,
    required: [true, 'Report number is required']
  },
  
  // References
  application: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Application',
    required: [true, 'Application is required']
  },
  beneficiary: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Beneficiary',
    required: [true, 'Beneficiary is required']
  },
  
  // Field Officer Information
  fieldOfficer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Field officer is required']
  },
  
  // Visit Information
  visitDetails: {
    scheduledDate: {
      type: Date,
      required: [true, 'Scheduled date is required']
    },
    actualDate: {
      type: Date,
      required: [true, 'Actual visit date is required']
    },
    startTime: String,
    endTime: String,
    duration: Number, // in minutes
    visitType: {
      type: String,
      enum: ['initial', 'follow_up', 'verification', 'monitoring'],
      default: 'initial'
    }
  },
  
  // Location and GPS
  location: {
    address: {
      type: String,
      required: [true, 'Visit address is required']
    },
    gpsCoordinates: {
      latitude: {
        type: Number,
        required: [true, 'GPS latitude is required']
      },
      longitude: {
        type: Number,
        required: [true, 'GPS longitude is required']
      },
      accuracy: Number
    },
    landmark: String,
    accessibilityNotes: String
  },
  
  // Beneficiary Verification
  beneficiaryVerification: {
    present: {
      type: Boolean,
      required: [true, 'Beneficiary presence is required']
    },
    identityVerified: {
      type: Boolean,
      default: false
    },
    identityDocuments: [{
      type: {
        type: String,
        enum: ['aadhaar', 'pan', 'voter_id', 'driving_license', 'passport', 'other']
      },
      number: String,
      verified: Boolean,
      notes: String
    }],
    familyMembersPresent: [{
      name: String,
      relation: String,
      age: Number,
      verified: Boolean
    }],
    alternateContact: {
      name: String,
      phone: String,
      relation: String,
      verified: Boolean
    }
  },
  
  // Housing Assessment
  housingAssessment: {
    houseType: {
      type: String,
      enum: ['pucca', 'semi_pucca', 'kutcha', 'temporary', 'rented', 'shared']
    },
    condition: {
      type: String,
      enum: ['excellent', 'good', 'fair', 'poor', 'dilapidated']
    },
    rooms: {
      total: Number,
      bedrooms: Number,
      kitchen: Boolean,
      bathroom: Boolean,
      toilet: Boolean
    },
    facilities: {
      electricity: {
        available: Boolean,
        connection: {
          type: String,
          enum: ['legal', 'illegal', 'none']
        }
      },
      water: {
        source: {
          type: String,
          enum: ['piped', 'well', 'borewell', 'public_tap', 'tanker', 'other']
        },
        quality: {
          type: String,
          enum: ['good', 'fair', 'poor']
        }
      },
      sanitation: {
        type: {
          type: String,
          enum: ['individual_toilet', 'shared_toilet', 'public_toilet', 'open_defecation']
        },
        condition: String
      },
      cooking: {
        fuel: {
          type: String,
          enum: ['lpg', 'kerosene', 'wood', 'coal', 'biogas', 'electric']
        },
        ventilation: Boolean
      }
    },
    ownership: {
      status: {
        type: String,
        enum: ['owned', 'rented', 'family_owned', 'government_quarters', 'encroached']
      },
      documents: [{
        type: String,
        verified: Boolean
      }],
      monthlyRent: Number
    }
  },
  
  // Financial Assessment
  financialAssessment: {
    incomeVerification: {
      primaryIncome: {
        source: String,
        amount: Number,
        verified: Boolean,
        documents: [String]
      },
      secondaryIncome: [{
        source: String,
        amount: Number,
        verified: Boolean
      }],
      familyIncome: {
        total: Number,
        verified: Boolean,
        discrepancy: String
      }
    },
    assets: {
      land: {
        owned: Boolean,
        area: Number,
        type: String,
        value: Number
      },
      vehicles: [{
        type: String,
        model: String,
        year: Number,
        value: Number
      }],
      livestock: [{
        type: String,
        count: Number,
        value: Number
      }],
      appliances: [{
        item: String,
        condition: String,
        value: Number
      }],
      jewelry: {
        estimated: Number,
        notes: String
      },
      bankAccounts: [{
        bank: String,
        accountType: String,
        balance: Number,
        verified: Boolean
      }]
    },
    expenses: {
      monthly: {
        food: Number,
        housing: Number,
        education: Number,
        healthcare: Number,
        transport: Number,
        utilities: Number,
        other: Number,
        total: Number
      },
      debts: [{
        creditor: String,
        amount: Number,
        monthlyPayment: Number,
        purpose: String
      }]
    }
  },
  
  // Social Assessment
  socialAssessment: {
    familyStructure: {
      headOfFamily: String,
      dependents: Number,
      elderlyMembers: Number,
      disabledMembers: Number,
      workingMembers: Number
    },
    education: {
      childrenInSchool: Number,
      dropouts: Number,
      reasons: String,
      educationExpenses: Number
    },
    health: {
      chronicIllness: [{
        member: String,
        condition: String,
        treatment: String,
        monthlyExpense: Number
      }],
      disabilities: [{
        member: String,
        type: String,
        severity: String,
        support: String
      }],
      insurance: {
        hasInsurance: Boolean,
        type: String,
        coverage: Number
      }
    },
    socialConnections: {
      communityParticipation: String,
      supportNetwork: String,
      socialIssues: String
    }
  },
  
  // Need Assessment
  needAssessment: {
    primaryNeed: {
      type: String,
      description: String,
      urgency: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical']
      }
    },
    secondaryNeeds: [{
      type: String,
      description: String,
      priority: Number
    }],
    requestedAmount: {
      amount: Number,
      justification: String,
      breakdown: [{
        item: String,
        cost: Number,
        quantity: Number
      }]
    },
    alternativeSolutions: [{
      solution: String,
      feasibility: String,
      cost: Number
    }]
  },
  
  // Photos and Evidence
  photos: [{
    type: {
      type: String,
      enum: ['house_exterior', 'house_interior', 'family', 'documents', 'assets', 'other']
    },
    url: String,
    caption: String,
    gpsLocation: {
      latitude: Number,
      longitude: Number
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Observations and Findings
  observations: {
    generalObservations: {
      type: String,
      required: [true, 'General observations are required']
    },
    discrepancies: [{
      field: String,
      applicationValue: String,
      actualValue: String,
      explanation: String
    }],
    redFlags: [{
      issue: String,
      severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical']
      },
      description: String
    }],
    positiveIndicators: [{
      indicator: String,
      description: String
    }]
  },
  
  // Recommendations
  recommendations: {
    eligibility: {
      status: {
        type: String,
        enum: ['eligible', 'not_eligible', 'conditional'],
        required: [true, 'Eligibility status is required']
      },
      reasoning: {
        type: String,
        required: [true, 'Eligibility reasoning is required']
      }
    },
    amountRecommendation: {
      recommended: {
        type: Number,
        required: [true, 'Recommended amount is required']
      },
      justification: {
        type: String,
        required: [true, 'Amount justification is required']
      },
      conditions: [String]
    },
    additionalSupport: [{
      type: String,
      description: String,
      referral: String
    }],
    followUpRequired: {
      required: Boolean,
      timeline: String,
      purpose: String
    }
  },
  
  // Verification Status
  verification: {
    status: {
      type: String,
      enum: ['draft', 'submitted', 'reviewed', 'approved', 'rejected'],
      default: 'draft'
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewedAt: Date,
    reviewComments: String,
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: Date
  },
  
  // Quality Scores
  qualityScores: {
    completeness: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    accuracy: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    timeliness: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    overall: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    }
  },
  
  // Audit Trail
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
enquiryReportSchema.index({ reportNumber: 1 });
enquiryReportSchema.index({ application: 1 });
enquiryReportSchema.index({ beneficiary: 1 });
enquiryReportSchema.index({ fieldOfficer: 1 });
enquiryReportSchema.index({ 'visitDetails.actualDate': 1 });
enquiryReportSchema.index({ 'verification.status': 1 });
enquiryReportSchema.index({ 'recommendations.eligibility.status': 1 });

// Virtual for visit duration in hours
enquiryReportSchema.virtual('visitDurationHours').get(function() {
  if (!this.visitDetails.duration) return 0;
  return Math.round((this.visitDetails.duration / 60) * 100) / 100;
});

// Virtual for overall quality score
enquiryReportSchema.virtual('overallQuality').get(function() {
  const scores = this.qualityScores;
  const average = (scores.completeness + scores.accuracy + scores.timeliness) / 3;
  return Math.round(average);
});

// Pre-save middleware to generate report number
enquiryReportSchema.pre('save', async function(next) {
  if (this.isNew && !this.reportNumber) {
    try {
      const year = new Date().getFullYear();
      const month = String(new Date().getMonth() + 1).padStart(2, '0');
      
      // Count reports for current month
      const count = await this.constructor.countDocuments({
        createdAt: {
          $gte: new Date(year, new Date().getMonth(), 1),
          $lt: new Date(year, new Date().getMonth() + 1, 1)
        }
      });
      
      // Format: ENQ_YYYY_MM_SEQUENCE
      const sequence = String(count + 1).padStart(4, '0');
      this.reportNumber = `ENQ_${year}_${month}_${sequence}`;
      
      next();
    } catch (error) {
      next(error);
    }
  } else {
    next();
  }
});

// Pre-save middleware to calculate quality scores
enquiryReportSchema.pre('save', function(next) {
  // Calculate completeness score
  let completenessScore = 0;
  const requiredFields = [
    'visitDetails.actualDate',
    'location.gpsCoordinates.latitude',
    'location.gpsCoordinates.longitude',
    'beneficiaryVerification.present',
    'observations.generalObservations',
    'recommendations.eligibility.status',
    'recommendations.eligibility.reasoning',
    'recommendations.amountRecommendation.recommended',
    'recommendations.amountRecommendation.justification'
  ];
  
  requiredFields.forEach(field => {
    const value = field.split('.').reduce((obj, key) => obj && obj[key], this);
    if (value !== undefined && value !== null && value !== '') {
      completenessScore += (100 / requiredFields.length);
    }
  });
  
  this.qualityScores.completeness = Math.round(completenessScore);
  
  // Calculate timeliness score (based on how quickly report was submitted after visit)
  if (this.visitDetails.actualDate && this.createdAt) {
    const daysDiff = Math.ceil((this.createdAt - this.visitDetails.actualDate) / (1000 * 60 * 60 * 24));
    let timelinessScore = 100;
    
    if (daysDiff > 1) timelinessScore = Math.max(0, 100 - (daysDiff - 1) * 10);
    this.qualityScores.timeliness = Math.round(timelinessScore);
  }
  
  // Calculate overall score
  this.qualityScores.overall = Math.round(
    (this.qualityScores.completeness + this.qualityScores.accuracy + this.qualityScores.timeliness) / 3
  );
  
  next();
});

// Method to add photo
enquiryReportSchema.methods.addPhoto = function(type, url, caption, gpsLocation) {
  this.photos.push({
    type,
    url,
    caption,
    gpsLocation,
    timestamp: new Date()
  });
  
  return this.save();
};

// Method to add discrepancy
enquiryReportSchema.methods.addDiscrepancy = function(field, applicationValue, actualValue, explanation) {
  this.observations.discrepancies.push({
    field,
    applicationValue,
    actualValue,
    explanation
  });
  
  return this.save();
};

// Method to calculate distance from application address
enquiryReportSchema.methods.calculateDistanceFromApplication = async function() {
  const application = await mongoose.model('Application')
    .findById(this.application)
    .populate('beneficiary');
  
  if (!application || !application.beneficiary.address.current.coordinates) {
    return null;
  }
  
  const appLat = application.beneficiary.address.current.coordinates.latitude;
  const appLng = application.beneficiary.address.current.coordinates.longitude;
  const visitLat = this.location.gpsCoordinates.latitude;
  const visitLng = this.location.gpsCoordinates.longitude;
  
  // Haversine formula to calculate distance
  const R = 6371; // Earth's radius in kilometers
  const dLat = (visitLat - appLat) * Math.PI / 180;
  const dLng = (visitLng - appLng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(appLat * Math.PI / 180) * Math.cos(visitLat * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return Math.round(distance * 1000); // Return distance in meters
};

// Static method to get reports by field officer
enquiryReportSchema.statics.getByFieldOfficer = function(fieldOfficerId, filters = {}) {
  return this.find({ fieldOfficer: fieldOfficerId, ...filters })
    .populate('application', 'applicationNumber status')
    .populate('beneficiary', 'personalInfo contact')
    .sort({ 'visitDetails.actualDate': -1 });
};

// Static method to get pending reports
enquiryReportSchema.statics.getPendingReports = function(filters = {}) {
  return this.find({ 
    'verification.status': { $in: ['draft', 'submitted'] },
    ...filters 
  })
    .populate('fieldOfficer', 'name email')
    .populate('application', 'applicationNumber')
    .sort({ 'visitDetails.scheduledDate': 1 });
};

// Franchise multi-tenancy — compound unique per franchise
enquiryReportSchema.plugin(franchisePlugin);
enquiryReportSchema.index({ reportNumber: 1, franchise: 1 }, { unique: true });

module.exports = mongoose.model('EnquiryReport', enquiryReportSchema);