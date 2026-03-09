const Joi = require('joi');
const { validationResult } = require('express-validator');

/**
 * Express-validator middleware to check validation results
 */
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(error => ({
        field: error.path || error.param,
        message: error.msg,
        value: error.value
      }))
    });
  }
  next();
};

/**
 * Validation middleware factory
 * @param {Object} schema - Joi validation schema
 * @param {string} property - Request property to validate (body, params, query)
 * @returns {Function} Express middleware
 */
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    // Clean up empty strings and empty arrays for optional fields before validation
    if (req[property] && typeof req[property] === 'object') {
      // Convert empty strings to undefined for optional fields
      if (req[property].coordinator === '') {
        delete req[property].coordinator;
      }
      // Convert empty arrays to undefined for optional array fields
      if (Array.isArray(req[property].targetRegions) && req[property].targetRegions.length === 0) {
        delete req[property].targetRegions;
      }
    }

    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      console.error('❌ Validation Error:', {
        path: req.path,
        method: req.method,
        errors: errors,
        receivedData: req[property]
      });

      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    // Replace request property with validated and sanitized value
    req[property] = value;
    next();
  };
};

// Common validation schemas
const commonSchemas = {
  // MongoDB ObjectId validation
  objectId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).message('Invalid ID format'),
  
  // Phone number validation (Indian)
  phone: Joi.string().pattern(/^[6-9]\d{9}$/).message('Invalid Indian mobile number'),
  
  // Email validation
  email: Joi.string().email().lowercase(),
  
  // Password validation
  password: Joi.string().min(6).max(128).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .message('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  
  // Date validation
  date: Joi.date().iso(),
  
  // Pagination
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sort: Joi.string().default('createdAt'),
    order: Joi.string().valid('asc', 'desc').default('desc')
  })
};

// Authentication validation schemas
const authSchemas = {
  // OTP request
  otpRequest: Joi.object({
    phone: commonSchemas.phone.required(),
    purpose: Joi.string().valid('login', 'registration', 'reset_password').default('login')
  }),

  // OTP verification
  otpVerify: Joi.object({
    phone: commonSchemas.phone.required(),
    otp: Joi.string().length(6).pattern(/^\d+$/).required(),
    purpose: Joi.string().valid('login', 'registration', 'reset_password').default('login')
  }),

  // User registration
  register: Joi.object({
    tempUserId: commonSchemas.objectId.required(),
    name: Joi.string().trim().min(2).max(100).required(),
    email: commonSchemas.email.required(),
    password: commonSchemas.password.required(),
    role: Joi.string().valid('beneficiary', 'unit_admin', 'area_admin', 'district_admin').default('beneficiary'),
    profile: Joi.object({
      dateOfBirth: commonSchemas.date,
      gender: Joi.string().valid('male', 'female', 'other'),
      address: Joi.object({
        street: Joi.string().trim(),
        area: Joi.string().trim(),
        district: Joi.string().trim(),
        state: Joi.string().trim().default('Kerala'),
        pincode: Joi.string().pattern(/^\d{6}$/)
      })
    }).default({})
  }),

  // Password change
  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: commonSchemas.password.required(),
    confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
      .messages({ 'any.only': 'Passwords do not match' })
  }),

  // Password reset
  resetPassword: Joi.object({
    phone: commonSchemas.phone.required(),
    otp: Joi.string().length(6).pattern(/^\d+$/).required(),
    newPassword: commonSchemas.password.required(),
    confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
  }),

  // Refresh token
  refreshToken: Joi.object({
    refreshToken: Joi.string().required()
  })
};

// User validation schemas
const userSchemas = {
  // Create user
  create: Joi.object({
    name: Joi.string().trim().min(2).max(100).required(),
    email: commonSchemas.email.optional().allow('', null),
    phone: commonSchemas.phone.required(),
    password: commonSchemas.password.optional().allow('', null),
    role: Joi.string().valid(
      'super_admin', 'state_admin', 'project_coordinator', 'scheme_coordinator', 
      'district_admin', 'area_admin', 'unit_admin', 'beneficiary'
    ).required(),
    isActive: Joi.boolean().default(true),
    adminScope: Joi.object({
      level: Joi.string().valid('super', 'state', 'district', 'area', 'unit', 'project', 'scheme'),
      regions: Joi.array().items(commonSchemas.objectId),
      district: commonSchemas.objectId,
      area: commonSchemas.objectId,
      unit: commonSchemas.objectId,
      projects: Joi.array().items(commonSchemas.objectId),
      schemes: Joi.array().items(commonSchemas.objectId)
    }).when('role', {
      is: Joi.string().valid('district_admin', 'area_admin', 'unit_admin', 'project_coordinator', 'scheme_coordinator'),
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
    profile: Joi.object({
      dateOfBirth: commonSchemas.date,
      gender: Joi.string().valid('male', 'female', 'other'),
      address: Joi.object({
        street: Joi.string().trim(),
        area: Joi.string().trim(),
        district: Joi.string().trim(),
        state: Joi.string().trim().default('Kerala'),
        pincode: Joi.string().pattern(/^\d{6}$/)
      })
    }).default({})
  }),

  // Update user
  update: Joi.object({
    name: Joi.string().trim().min(2).max(100),
    email: commonSchemas.email,
    phone: commonSchemas.phone,
    role: Joi.string().valid(
      'state_admin', 'project_coordinator', 'scheme_coordinator', 
      'district_admin', 'area_admin', 'unit_admin', 'beneficiary'
    ),
    isActive: Joi.boolean(),
    profile: Joi.object({
      dateOfBirth: commonSchemas.date,
      gender: Joi.string().valid('male', 'female', 'other'),
      address: Joi.object({
        street: Joi.string().trim(),
        area: Joi.string().trim(),
        district: Joi.string().trim(),
        state: Joi.string().trim(),
        pincode: Joi.string().pattern(/^\d{6}$/)
      })
    }),
    adminScope: Joi.object({
      level: Joi.string().valid('state', 'district', 'area', 'unit', 'project', 'scheme'),
      regions: Joi.array().items(commonSchemas.objectId),
      projects: Joi.array().items(commonSchemas.objectId),
      schemes: Joi.array().items(commonSchemas.objectId)
    })
  }).min(1),

  // User query filters
  query: Joi.object({
    role: Joi.string().valid(
      'super_admin', 'state_admin', 'project_coordinator', 'scheme_coordinator', 
      'district_admin', 'area_admin', 'unit_admin', 'beneficiary'
    ),
    isActive: Joi.boolean(),
    region: commonSchemas.objectId,
    search: Joi.string().trim().min(2).max(100)
  }).concat(commonSchemas.pagination)
};

// Project validation schemas
const projectSchemas = {
  // Create project
  create: Joi.object({
    name: Joi.string().trim().min(2).max(200).required(),
    code: Joi.string().trim().uppercase().pattern(/^[A-Z0-9_-]+$/).required(),
    description: Joi.string().trim().min(10).max(2000).required(),
    category: Joi.string().valid(
      'education', 'healthcare', 'housing', 'livelihood', 
      'emergency_relief', 'infrastructure', 'social_welfare', 'other'
    ).required(),
    priority: Joi.string().valid('low', 'medium', 'high', 'critical').default('medium'),
    scope: Joi.string().valid('state', 'district', 'area', 'unit', 'multi_region').optional().default('state'),
    targetRegions: Joi.array().items(commonSchemas.objectId).optional(),
    startDate: commonSchemas.date.required(),
    endDate: commonSchemas.date.greater(Joi.ref('startDate')).required(),
    budget: Joi.object({
      total: Joi.number().positive().required(),
      allocated: Joi.number().min(0).optional(),
      spent: Joi.number().min(0).optional(),
      currency: Joi.string().default('INR')
    }).required(),
    coordinator: commonSchemas.objectId.optional(),
    targetBeneficiaries: Joi.object({
      estimated: Joi.number().integer().min(0)
    })
  }),

  // Update project
  update: Joi.object({
    name: Joi.string().trim().min(2).max(200),
    description: Joi.string().trim().min(10).max(2000),
    category: Joi.string().valid(
      'education', 'healthcare', 'housing', 'livelihood', 
      'emergency_relief', 'infrastructure', 'social_welfare', 'other'
    ),
    priority: Joi.string().valid('low', 'medium', 'high', 'critical'),
    endDate: commonSchemas.date,
    budget: Joi.object({
      total: Joi.number().positive(),
      allocated: Joi.number().min(0),
      spent: Joi.number().min(0)
    }),
    status: Joi.string().valid('draft', 'approved', 'active', 'on_hold', 'completed', 'cancelled'),
    targetBeneficiaries: Joi.object({
      estimated: Joi.number().integer().min(0)
    })
  }).min(1),

  // Project query filters
  query: Joi.object({
    category: Joi.string().valid(
      'education', 'healthcare', 'housing', 'livelihood', 
      'emergency_relief', 'infrastructure', 'social_welfare', 'other'
    ),
    status: Joi.string().valid('draft', 'approved', 'active', 'on_hold', 'completed', 'cancelled'),
    coordinator: commonSchemas.objectId,
    region: commonSchemas.objectId,
    search: Joi.string().trim().min(2).max(100)
  }).concat(commonSchemas.pagination)
};

// Application validation schemas
const applicationSchemas = {
  // Create application
  create: Joi.object({
    beneficiary: commonSchemas.objectId.required(),
    project: commonSchemas.objectId.required(),
    scheme: commonSchemas.objectId.required(),
    applicationData: Joi.object().required(),
    requestedAmount: Joi.number().positive().required(),
    priority: Joi.string().valid('low', 'medium', 'high', 'critical').default('medium'),
    urgency: Joi.string().valid('normal', 'urgent', 'emergency').default('normal')
  }),

  // Update application
  update: Joi.object({
    applicationData: Joi.object(),
    requestedAmount: Joi.number().positive(),
    priority: Joi.string().valid('low', 'medium', 'high', 'critical'),
    urgency: Joi.string().valid('normal', 'urgent', 'emergency'),
    status: Joi.string().valid(
      'draft', 'submitted', 'under_review', 'field_verification', 
      'interview_scheduled', 'interview_completed', 'approved', 
      'rejected', 'on_hold', 'cancelled', 'disbursed', 'completed'
    )
  }).min(1),

  // Application query filters
  query: Joi.object({
    status: Joi.string().valid(
      'draft', 'submitted', 'under_review', 'field_verification', 
      'interview_scheduled', 'interview_completed', 'approved', 
      'rejected', 'on_hold', 'cancelled', 'disbursed', 'completed'
    ),
    project: commonSchemas.objectId,
    scheme: commonSchemas.objectId,
    beneficiary: commonSchemas.objectId,
    priority: Joi.string().valid('low', 'medium', 'high', 'critical'),
    urgency: Joi.string().valid('normal', 'urgent', 'emergency'),
    dateFrom: commonSchemas.date,
    dateTo: commonSchemas.date,
    search: Joi.string().trim().min(2).max(100)
  }).concat(commonSchemas.pagination),

  // Workflow action
  workflowAction: Joi.object({
    action: Joi.string().valid('forward', 'approve', 'reject', 'hold', 'return').required(),
    comments: Joi.string().trim().min(5).max(1000).required(),
    approvedAmount: Joi.number().positive().when('action', {
      is: 'approve',
      then: Joi.required(),
      otherwise: Joi.forbidden()
    }),
    returnToLevel: Joi.string().valid('unit', 'area', 'district').when('action', {
      is: 'return',
      then: Joi.required(),
      otherwise: Joi.forbidden()
    })
  })
};

// Beneficiary validation schemas
const beneficiarySchemas = {
  // Create beneficiary
  create: Joi.object({
    personalInfo: Joi.object({
      firstName: Joi.string().trim().min(2).max(50).required(),
      lastName: Joi.string().trim().min(2).max(50).required(),
      fatherName: Joi.string().trim().max(100),
      motherName: Joi.string().trim().max(100),
      dateOfBirth: commonSchemas.date.required(),
      gender: Joi.string().valid('male', 'female', 'other').required(),
      maritalStatus: Joi.string().valid('single', 'married', 'divorced', 'widowed').required(),
      religion: Joi.string().trim(),
      caste: Joi.string().trim(),
      category: Joi.string().valid('general', 'obc', 'sc', 'st', 'other').default('general')
    }).required(),
    
    contact: Joi.object({
      phone: commonSchemas.phone.required(),
      alternatePhone: commonSchemas.phone,
      email: commonSchemas.email,
      preferredLanguage: Joi.string().valid('malayalam', 'english', 'hindi').default('malayalam')
    }).required(),
    
    address: Joi.object({
      current: Joi.object({
        houseNumber: Joi.string().trim(),
        streetName: Joi.string().trim(),
        locality: Joi.string().trim(),
        landmark: Joi.string().trim(),
        village: Joi.string().trim(),
        post: Joi.string().trim(),
        pincode: Joi.string().pattern(/^\d{6}$/).required(),
        district: commonSchemas.objectId.required(),
        state: Joi.string().trim().default('Kerala')
      }).required(),
      permanent: Joi.object({
        sameAsCurrent: Joi.boolean().default(true)
      }).default({ sameAsCurrent: true })
    }).required(),
    
    financial: Joi.object({
      monthlyIncome: Joi.number().min(0).required(),
      incomeSource: Joi.string().valid(
        'agriculture', 'business', 'employment', 'daily_wages', 'pension', 'other', 'unemployed'
      ).required(),
      employmentDetails: Joi.string().valid(
        'government', 'private', 'self_employed', 'unemployed', 'retired', 'student'
      ).default('unemployed'),
      bankAccount: Joi.object({
        accountNumber: Joi.string().required(),
        ifscCode: Joi.string().pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/).required(),
        bankName: Joi.string().required(),
        branchName: Joi.string().required(),
        accountHolderName: Joi.string().required()
      }).required()
    }).required(),
    
    family: Joi.object({
      totalMembers: Joi.number().integer().min(1).required(),
      dependents: Joi.number().integer().min(0).default(0)
    }).required()
  }),

  // Update beneficiary
  update: Joi.object({
    personalInfo: Joi.object({
      firstName: Joi.string().trim().min(2).max(50),
      lastName: Joi.string().trim().min(2).max(50),
      fatherName: Joi.string().trim().max(100),
      motherName: Joi.string().trim().max(100),
      dateOfBirth: commonSchemas.date,
      gender: Joi.string().valid('male', 'female', 'other'),
      maritalStatus: Joi.string().valid('single', 'married', 'divorced', 'widowed'),
      religion: Joi.string().trim(),
      caste: Joi.string().trim(),
      category: Joi.string().valid('general', 'obc', 'sc', 'st', 'other')
    }),
    contact: Joi.object({
      phone: commonSchemas.phone,
      alternatePhone: commonSchemas.phone,
      email: commonSchemas.email,
      preferredLanguage: Joi.string().valid('malayalam', 'english', 'hindi')
    }),
    financial: Joi.object({
      monthlyIncome: Joi.number().min(0),
      incomeSource: Joi.string().valid(
        'agriculture', 'business', 'employment', 'daily_wages', 'pension', 'other', 'unemployed'
      ),
      employmentDetails: Joi.string().valid(
        'government', 'private', 'self_employed', 'unemployed', 'retired', 'student'
      ),
      bankAccount: Joi.object({
        accountNumber: Joi.string(),
        ifscCode: Joi.string().pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/),
        bankName: Joi.string(),
        branchName: Joi.string(),
        accountHolderName: Joi.string()
      })
    })
  }).min(1),

  // Beneficiary query filters
  query: Joi.object({
    status: Joi.string().valid('active', 'inactive', 'blacklisted', 'deceased'),
    district: commonSchemas.objectId,
    verificationStatus: Joi.string().valid('pending', 'in_progress', 'verified', 'rejected'),
    search: Joi.string().trim().min(2).max(100)
  }).concat(commonSchemas.pagination)
};

// Notification validation schemas
const notificationSchemas = {
  // Send notification
  send: Joi.object({
    type: Joi.string().valid('sms', 'email', 'push', 'in_app').required(),
    recipient: Joi.alternatives().try(
      commonSchemas.objectId,
      Joi.object({
        phone: commonSchemas.phone,
        email: commonSchemas.email,
        name: Joi.string().trim()
      })
    ).required(),
    title: Joi.string().trim().min(1).max(200).required(),
    message: Joi.string().trim().min(1).max(1000).required(),
    category: Joi.string().valid(
      'application_status', 'payment', 'reminder', 'announcement', 'alert', 'system', 'marketing'
    ).default('general'),
    priority: Joi.string().valid('low', 'medium', 'high', 'critical').default('medium'),
    variables: Joi.object().default({}),
    templateId: Joi.string()
  }),

  // Send bulk notification
  sendBulk: Joi.object({
    type: Joi.string().valid('sms', 'email', 'push').required(),
    recipients: Joi.array().items(
      Joi.alternatives().try(
        commonSchemas.objectId,
        Joi.object({
          phone: commonSchemas.phone,
          email: commonSchemas.email,
          name: Joi.string().trim()
        })
      )
    ).min(1).required(),
    title: Joi.string().trim().min(1).max(200).required(),
    message: Joi.string().trim().min(1).max(1000).required(),
    category: Joi.string().valid(
      'application_status', 'payment', 'reminder', 'announcement', 'alert', 'system', 'marketing'
    ).default('general'),
    priority: Joi.string().valid('low', 'medium', 'high', 'critical').default('medium'),
    variables: Joi.object().default({})
  }),

  // Send targeted notification
  sendTargeted: Joi.object({
    type: Joi.string().valid('sms', 'email', 'push', 'in_app').required(),
    title: Joi.string().trim().min(1).max(200).required(),
    message: Joi.string().trim().min(1).max(1000).required(),
    targeting: Joi.object({
      userRoles: Joi.array().items(Joi.string().valid(
        'state_admin', 'project_coordinator', 'scheme_coordinator', 
        'district_admin', 'area_admin', 'unit_admin', 'beneficiary'
      )),
      regions: Joi.array().items(commonSchemas.objectId),
      projects: Joi.array().items(commonSchemas.objectId),
      schemes: Joi.array().items(commonSchemas.objectId)
    }).required(),
    category: Joi.string().valid(
      'application_status', 'payment', 'reminder', 'announcement', 'alert', 'system', 'marketing'
    ).default('general'),
    priority: Joi.string().valid('low', 'medium', 'high', 'critical').default('medium'),
    variables: Joi.object().default({})
  })
};

module.exports = {
  validate,
  validateRequest,
  commonSchemas,
  authSchemas,
  userSchemas,
  projectSchemas,
  applicationSchemas,
  beneficiarySchemas,
  notificationSchemas
};