const mongoose = require('mongoose');
const franchisePlugin = require('../utils/franchisePlugin');

const fieldSchema = new mongoose.Schema({
  id: {
    type: Number,
    required: true
  },
  label: {
    type: String,
    required: [true, 'Field label is required'],
    trim: true,
    maxlength: [200, 'Field label cannot exceed 200 characters']
  },
  type: {
    type: String,
    required: [true, 'Field type is required'],
    enum: ['text', 'email', 'phone', 'number', 'date', 'datetime', 'textarea', 'select', 'radio', 'checkbox', 'file', 'url', 'password', 'title', 'html', 'group', 'page', 'row', 'column', 'dropdown', 'multiselect', 'yesno', 'time']
  },
  required: {
    type: Boolean,
    default: false
  },
  enabled: {
    type: Boolean,
    default: true
  },
  placeholder: {
    type: String,
    maxlength: [500, 'Placeholder cannot exceed 500 characters']
  },
  helpText: {
    type: String,
    maxlength: [1000, 'Help text cannot exceed 1000 characters']
  },
  options: [{
    type: String,
    maxlength: [200, 'Option text cannot exceed 200 characters']
  }],
  validation: {
    pattern: String,
    minLength: Number,
    maxLength: Number,
    min: Number,
    max: Number,
    customMessage: String
  },
  columns: {
    type: Number,
    min: 1,
    default: 12
  },
  columnTitles: [{
    type: String,
    maxlength: [200, 'Column title cannot exceed 200 characters']
  }],
  rows: {
    type: Number,
    min: 1
  },
  rowTitles: [{
    type: String,
    maxlength: [200, 'Row title cannot exceed 200 characters']
  }],
  conditionalLogic: {
    field: Number,
    operator: {
      type: String,
      enum: ['equals', 'not_equals', 'contains', 'not_contains', 'greater_than', 'less_than', 'is_empty', 'is_not_empty']
    },
    value: String,
    action: {
      type: String,
      enum: ['show', 'hide', 'require', 'optional'],
      default: 'show'
    }
  },
  // Scoring configuration for eligibility calculation
  scoring: {
    enabled: {
      type: Boolean,
      default: false
    },
    maxPoints: {
      type: Number,
      min: 0,
      default: 0
    },
    scoringRules: [{
      condition: {
        type: String,
        enum: ['equals', 'not_equals', 'greater_than', 'less_than', 'between', 'contains', 'is_not_empty', 'is_uploaded', 'before', 'after', 'includes'],
        required: true
      },
      value: {
        type: String,
        default: ''
      },
      value2: {
        type: String // For 'between' condition (second boundary)
      },
      points: {
        type: Number,
        required: true,
        min: 0
      }
    }]
  }
}, { _id: false });

const pageSchema = new mongoose.Schema({
  id: {
    type: Number,
    required: true
  },
  title: {
    type: String,
    required: [true, 'Page title is required'],
    trim: true,
    maxlength: [200, 'Page title cannot exceed 200 characters']
  },
  description: {
    type: String,
    maxlength: [1000, 'Page description cannot exceed 1000 characters']
  },
  fields: [fieldSchema],
  order: {
    type: Number,
    default: 0
  },
  conditionalLogic: {
    field: Number,
    operator: {
      type: String,
      enum: ['equals', 'not_equals', 'contains', 'not_contains', 'greater_than', 'less_than', 'is_empty', 'is_not_empty']
    },
    value: String
  }
}, { _id: false });

const formConfigurationSchema = new mongoose.Schema({
  // Reference to the scheme this form belongs to
  scheme: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Scheme',
    required: [true, 'Scheme reference is required']
  },

  // Renewal Form Flag
  isRenewalForm: {
    type: Boolean,
    default: false
  },

  // Parent Form Configuration (for renewal forms linked to the original)
  parentFormConfiguration: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FormConfiguration',
    default: null
  },
  
  // Basic Form Information
  title: {
    type: String,
    required: [true, 'Form title is required'],
    trim: true,
    maxlength: [300, 'Form title cannot exceed 300 characters']
  },
  description: {
    type: String,
    maxlength: [2000, 'Form description cannot exceed 2000 characters']
  },
  
  // Form Settings
  enabled: {
    type: Boolean,
    default: true
  },
  emailNotifications: {
    type: Boolean,
    default: true
  },
  allowDrafts: {
    type: Boolean,
    default: true
  },
  requiresReview: {
    type: Boolean,
    default: true
  },
  autoSubmit: {
    type: Boolean,
    default: false
  },
  
  // Form Structure
  pages: [pageSchema],
  
  // Styling and Appearance
  theme: {
    primaryColor: {
      type: String,
      default: '#3b82f6'
    },
    backgroundColor: {
      type: String,
      default: '#ffffff'
    },
    fontFamily: {
      type: String,
      default: 'Inter'
    },
    customCSS: String
  },
  
  // Submission Settings
  submissionSettings: {
    confirmationMessage: {
      type: String,
      default: 'Thank you for your application. We will review it and get back to you soon.'
    },
    redirectUrl: String,
    emailTemplate: String,
    notificationEmails: [String]
  },
  
  // Form Analytics
  analytics: {
    totalViews: {
      type: Number,
      default: 0
    },
    totalSubmissions: {
      type: Number,
      default: 0
    },
    completionRate: {
      type: Number,
      default: 0
    },
    averageTimeToComplete: {
      type: Number,
      default: 0
    }
  },
  
  // Scoring Configuration (form-level settings)
  scoringConfig: {
    enabled: {
      type: Boolean,
      default: false
    },
    minimumThreshold: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    autoRejectBelowThreshold: {
      type: Boolean,
      default: false
    },
    showScoreToAdmin: {
      type: Boolean,
      default: true
    }
  },

  // Version Control
  version: {
    type: Number,
    default: 1
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  publishedAt: Date,
  
  // Audit Trail
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lastModified: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
// Franchise multi-tenancy
formConfigurationSchema.plugin(franchisePlugin);
formConfigurationSchema.index({ scheme: 1, isRenewalForm: 1, franchise: 1 }, { unique: true });
formConfigurationSchema.index({ enabled: 1 });
formConfigurationSchema.index({ isPublished: 1 });
formConfigurationSchema.index({ createdBy: 1 });
formConfigurationSchema.index({ lastModified: -1 });

// Virtual for total fields count
formConfigurationSchema.virtual('totalFields').get(function() {
  return this.pages.reduce((total, page) => total + page.fields.length, 0);
});

// Virtual for required fields count
formConfigurationSchema.virtual('requiredFields').get(function() {
  return this.pages.reduce((total, page) => 
    total + page.fields.filter(field => field.required).length, 0);
});

// Virtual for total max scoring points
formConfigurationSchema.virtual('totalMaxPoints').get(function() {
  if (!this.scoringConfig?.enabled) return 0;
  return this.pages.reduce((total, page) => 
    total + page.fields.reduce((fieldTotal, field) => 
      fieldTotal + (field.scoring?.enabled ? (field.scoring.maxPoints || 0) : 0), 0), 0);
});

// Virtual for form URL
formConfigurationSchema.virtual('formUrl').get(function() {
  return `/apply/${this.scheme}`;
});

// Method to get default form configuration for a scheme
formConfigurationSchema.statics.getDefaultConfiguration = function(scheme, userId) {
  return {
    scheme: scheme._id,
    title: `${scheme.name} Application Form`,
    description: `Application form for ${scheme.name} scheme. Please fill out all required fields to submit your application.`,
    enabled: true,
    emailNotifications: true,
    allowDrafts: true,
    requiresReview: true,
    pages: [
      {
        id: 1,
        title: "Personal Information",
        description: "Please provide your basic personal details",
        fields: [
          {
            id: 1,
            label: "Full Name",
            type: "text",
            required: true,
            enabled: true,
            placeholder: "Enter your full name as per official documents",
            validation: {
              minLength: 2,
              maxLength: 100,
              customMessage: "Please enter your full name (2-100 characters)"
            }
          },
          {
            id: 2,
            label: "Email Address",
            type: "email",
            required: true,
            enabled: true,
            placeholder: "your@email.com",
            helpText: "We'll use this email to communicate with you about your application"
          },
          {
            id: 3,
            label: "Phone Number",
            type: "phone",
            required: true,
            enabled: true,
            placeholder: "+91 XXXXXXXXXX",
            validation: {
              pattern: "^[+]?[0-9]{10,15}$",
              customMessage: "Please enter a valid phone number"
            }
          },
          {
            id: 4,
            label: "Date of Birth",
            type: "date",
            required: true,
            enabled: true,
            helpText: "Your date of birth as per official documents"
          }
        ],
        order: 1
      },
      {
        id: 2,
        title: "Application Details",
        description: "Please provide details about your application",
        fields: [
          {
            id: 5,
            label: "Purpose of Application",
            type: "textarea",
            required: true,
            enabled: true,
            placeholder: "Please describe the purpose of your application and how it aligns with the scheme objectives",
            validation: {
              minLength: 50,
              maxLength: 1000,
              customMessage: "Please provide a detailed description (50-1000 characters)"
            }
          },
          {
            id: 6,
            label: "Supporting Documents",
            type: "file",
            required: false,
            enabled: true,
            helpText: "Upload any supporting documents (PDF, JPG, PNG - Max 5MB each)"
          }
        ],
        order: 2
      }
    ],
    createdBy: userId,
    updatedBy: userId,
    version: 1
  };
};

// Method to validate form structure
formConfigurationSchema.methods.validateFormStructure = function() {
  const errors = [];
  
  // Check if form has at least one page
  if (!this.pages || this.pages.length === 0) {
    errors.push('Form must have at least one page');
  }
  
  // Validate each page
  this.pages.forEach((page, pageIndex) => {
    if (!page.title) {
      errors.push(`Page ${pageIndex + 1} must have a title`);
    }
    
    if (!page.fields || page.fields.length === 0) {
      errors.push(`Page ${pageIndex + 1} must have at least one field`);
    }
    
    // Validate fields
    page.fields.forEach((field, fieldIndex) => {
      if (!field.label) {
        errors.push(`Page ${pageIndex + 1}, Field ${fieldIndex + 1} must have a label`);
      }
      
      if (!field.type) {
        errors.push(`Page ${pageIndex + 1}, Field ${fieldIndex + 1} must have a type`);
      }
      
      // Validate select/radio fields have options
      if (['select', 'radio', 'checkbox'].includes(field.type) && 
          (!field.options || field.options.length === 0)) {
        errors.push(`Page ${pageIndex + 1}, Field ${fieldIndex + 1} (${field.type}) must have options`);
      }
    });
  });
  
  return errors;
};

// Method to increment analytics
formConfigurationSchema.methods.incrementViews = function() {
  this.analytics.totalViews += 1;
  return this.save();
};

formConfigurationSchema.methods.incrementSubmissions = function() {
  this.analytics.totalSubmissions += 1;
  this.analytics.completionRate = this.analytics.totalViews > 0 
    ? (this.analytics.totalSubmissions / this.analytics.totalViews) * 100 
    : 0;
  return this.save();
};

// Pre-save middleware
formConfigurationSchema.pre('save', function(next) {
  // Update lastModified timestamp
  this.lastModified = new Date();
  
  // Validate form structure
  const validationErrors = this.validateFormStructure();
  if (validationErrors.length > 0) {
    return next(new Error(`Form validation failed: ${validationErrors.join(', ')}`));
  }
  
  // Ensure page and field IDs are unique
  const pageIds = this.pages.map(p => p.id);
  const fieldIds = this.pages.flatMap(p => p.fields.map(f => f.id));
  
  if (new Set(pageIds).size !== pageIds.length) {
    return next(new Error('Page IDs must be unique'));
  }
  
  if (new Set(fieldIds).size !== fieldIds.length) {
    return next(new Error('Field IDs must be unique across all pages'));
  }
  
  next();
});

// Post-save middleware to update scheme's form status
formConfigurationSchema.post('save', async function(doc) {
  try {
    const Scheme = mongoose.model('Scheme');
    if (doc.isRenewalForm) {
      await Scheme.findByIdAndUpdate(doc.scheme, {
        'renewalSettings.renewalFormConfigured': true
      });
    } else {
      await Scheme.findByIdAndUpdate(doc.scheme, {
        hasFormConfiguration: true,
        formConfigurationUpdated: new Date()
      });
    }
  } catch (error) {
    console.error('Error updating scheme form status:', error);
  }
});

module.exports = mongoose.model('FormConfiguration', formConfigurationSchema);