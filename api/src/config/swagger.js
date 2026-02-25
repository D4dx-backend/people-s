const swaggerJsdoc = require('swagger-jsdoc');

const orgConfig = require('./orgConfig');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: `${orgConfig.erpTitle} - Complete API Documentation`,
      version: '1.0.0',
      description: `
# ${orgConfig.erpTitle} System API

Complete API documentation for ${orgConfig.erpTitle} system serving all user roles.

## Authentication Endpoints by Role

### 1. Super Admin & State Admin
- **Base URL:** \`/api/auth\`
- **Roles:** \`super_admin\`, \`state_admin\`
- **OTP Purpose:** \`login\`

### 2. Regional Admins (District, Area, Unit)
- **Base URL:** \`/api/regional-admin/auth\`
- **Roles:** \`district_admin\`, \`area_admin\`, \`unit_admin\`
- **OTP Purpose:** \`admin-login\`

### 3. Beneficiaries
- **Base URL:** \`/api/beneficiary/auth\`
- **Roles:** \`beneficiary\`
- **OTP Purpose:** \`beneficiary-login\`

## Static OTP (Development Mode)
- OTP: **123456**
- Valid for: **10 minutes**

## Authentication Flow
1. Send OTP to phone number
2. Verify OTP and receive JWT token
3. Use token in Authorization header: \`Bearer <token>\`
      `,
      contact: {
        name: orgConfig.erpTitle,
        email: orgConfig.supportEmail
      },
      license: {
        name: 'Private',
        url: '#'
      }
    },
    servers: [
      {
        url: (() => {
          // Prefer SWAGGER_SERVER_URL, fallback to FRONTEND_URL, but require at least one
          const swaggerUrl = process.env.SWAGGER_SERVER_URL;
          const frontendUrl = process.env.FRONTEND_URL?.replace(/\/$/, '');
          if (!swaggerUrl && !frontendUrl) {
            throw new Error('Either SWAGGER_SERVER_URL or FRONTEND_URL environment variable must be set for Swagger documentation');
          }
          return swaggerUrl || frontendUrl;
        })(),
        description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server'
      }
    ],
    tags: [
      {
        name: 'Admin Authentication',
        description: 'Authentication for Super Admin and State Admin (via /api/auth endpoints)'
      },
      {
        name: 'Authentication',
        description: 'Beneficiary authentication endpoints (OTP-based login via /api/beneficiary/auth)'
      },
      {
        name: 'Profile',
        description: 'Beneficiary profile management'
      },
      {
        name: 'Schemes',
        description: 'Browse and view available schemes'
      },
      {
        name: 'Applications',
        description: 'Submit and manage applications'
      },
      {
        name: 'Tracking',
        description: 'Track application status'
      },
      {
        name: 'Regional Admin - Auth',
        description: 'Regional admin authentication for Unit, Area, and District Admins (via /api/regional-admin/auth)'
      },
      {
        name: 'Regional Admin - Applications',
        description: 'Application management for regional admins'
      },
      {
        name: 'Regional Admin - Dashboard',
        description: 'Dashboard and statistics for regional admins'
      },
      {
        name: 'Mobile API',
        description: 'Mobile-optimized APIs for districts, areas, and units with filtering capabilities'
      },
      {
        name: 'Locations',
        description: 'Location management endpoints for cascading selection (District > Area > Unit) used in profile updates and regional filtering'
      },
      {
        name: 'Users',
        description: 'User management - CRUD operations, role assignment, status management'
      },
      {
        name: 'Beneficiaries',
        description: 'Beneficiary admin management - CRUD, verification, export'
      },
      {
        name: 'Application Management',
        description: 'Admin application management - review, approval, stages, committee decisions'
      },
      {
        name: 'Projects',
        description: 'Project management - CRUD, progress tracking, status updates'
      },
      {
        name: 'Donors',
        description: 'Donor management and analytics'
      },
      {
        name: 'Donations',
        description: 'Donation tracking and receipt management'
      },
      {
        name: 'Donor Follow-ups',
        description: 'Donor follow-up scheduling and reminder management'
      },
      {
        name: 'Payments',
        description: 'Payment processing and receipt generation'
      },
      {
        name: 'Recurring Payments',
        description: 'Recurring payment schedules and budget forecasting'
      },
      {
        name: 'Budget',
        description: 'Budget analytics and financial reporting'
      },
      {
        name: 'Interviews',
        description: 'Interview scheduling and completion tracking'
      },
      {
        name: 'Reports',
        description: 'Report generation and field verification'
      },
      {
        name: 'Dashboard',
        description: 'Dashboard widgets and analytics'
      },
      {
        name: 'RBAC',
        description: 'Role-based access control - roles, permissions, assignments'
      },
      {
        name: 'SMS',
        description: 'SMS messaging and templates'
      },
      {
        name: 'Notifications',
        description: 'Push notification management'
      },
      {
        name: 'File Upload',
        description: 'File upload and management'
      },
      {
        name: 'Master Data',
        description: 'Master data configuration'
      },
      {
        name: 'Form Configuration',
        description: 'Dynamic form builder and configuration'
      },
      {
        name: 'Activity Logs',
        description: 'Activity audit logs and user tracking'
      },
      {
        name: 'Login Logs',
        description: 'Login event tracking and suspicious activity detection'
      },
      {
        name: 'Error Logs',
        description: 'Error monitoring and resolution tracking'
      },
      {
        name: 'Application Config',
        description: 'Application configuration settings'
      },
      {
        name: 'Website',
        description: 'Website settings and CMS'
      },
      {
        name: 'News & Events',
        description: 'News and events content management'
      },
      {
        name: 'Brochures',
        description: 'Brochure management and download tracking'
      },
      {
        name: 'Partners',
        description: 'Partner management'
      },
      {
        name: 'Banners',
        description: 'Banner management'
      },
      {
        name: 'Speech',
        description: 'Speech-to-text transcription'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT token received from login'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            message: {
              type: 'string',
              example: 'Error message'
            },
            error: {
              type: 'string',
              example: 'Detailed error information'
            }
          }
        },
        Success: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            message: {
              type: 'string',
              example: 'Success message'
            },
            data: {
              type: 'object'
            }
          }
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: '507f1f77bcf86cd799439011'
            },
            name: {
              type: 'string',
              example: 'Mohammed Ali'
            },
            phone: {
              type: 'string',
              example: '9876543210'
            },
            role: {
              type: 'string',
              example: 'beneficiary'
            },
            isVerified: {
              type: 'boolean',
              example: true
            },
            profile: {
              type: 'object',
              properties: {
                dateOfBirth: {
                  type: 'string',
                  format: 'date',
                  example: '1990-01-15'
                },
                gender: {
                  type: 'string',
                  enum: ['male', 'female', 'other'],
                  example: 'male'
                },
                location: {
                  type: 'object',
                  properties: {
                    district: {
                      type: 'string',
                      example: '507f1f77bcf86cd799439011'
                    },
                    area: {
                      type: 'string',
                      example: '507f1f77bcf86cd799439012'
                    },
                    unit: {
                      type: 'string',
                      example: '507f1f77bcf86cd799439013'
                    }
                  }
                }
              }
            }
          }
        },
        Scheme: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439011'
            },
            name: {
              type: 'string',
              example: 'Educational Assistance'
            },
            description: {
              type: 'string',
              example: 'Financial support for students'
            },
            category: {
              type: 'string',
              example: 'Education'
            },
            priority: {
              type: 'number',
              example: 1
            },
            benefits: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  example: 'financial'
                },
                amount: {
                  type: 'number',
                  example: 50000
                },
                frequency: {
                  type: 'string',
                  example: 'one-time'
                },
                description: {
                  type: 'string',
                  example: 'Up to ₹50,000 for educational expenses'
                }
              }
            },
            eligibility: {
              type: 'object',
              properties: {
                incomeLimit: {
                  type: 'number',
                  example: 100000
                },
                ageRange: {
                  type: 'object',
                  properties: {
                    min: {
                      type: 'number',
                      example: 18
                    },
                    max: {
                      type: 'number',
                      example: 60
                    }
                  }
                },
                gender: {
                  type: 'string',
                  example: 'any'
                }
              }
            },
            canApply: {
              type: 'boolean',
              example: true
            },
            hasApplied: {
              type: 'boolean',
              example: false
            },
            daysRemaining: {
              type: 'number',
              example: 45
            }
          }
        },
        Application: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439011'
            },
            applicationId: {
              type: 'string',
              example: 'APP20250000001'
            },
            applicationNumber: {
              type: 'string',
              example: 'APP20250000001'
            },
            scheme: {
              type: 'object',
              properties: {
                _id: {
                  type: 'string',
                  example: '507f1f77bcf86cd799439012'
                },
                name: {
                  type: 'string',
                  example: 'Educational Assistance'
                },
                category: {
                  type: 'string',
                  example: 'Education'
                }
              }
            },
            status: {
              type: 'string',
              enum: ['pending', 'under_review', 'approved', 'rejected', 'completed', 'cancelled'],
              example: 'pending'
            },
            submittedAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-11-17T10:30:00.000Z'
            },
            requestedAmount: {
              type: 'number',
              example: 50000
            },
            approvedAmount: {
              type: 'number',
              example: 45000
            }
          }
        },
        Location: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439011'
            },
            name: {
              type: 'string',
              example: 'Malappuram'
            },
            code: {
              type: 'string',
              example: 'MLP'
            },
            type: {
              type: 'string',
              enum: ['state', 'district', 'area', 'unit'],
              example: 'district'
            },
            parent: {
              type: 'string',
              example: '507f1f77bcf86cd799439010'
            }
          }
        },
        Pagination: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            data: {
              type: 'array',
              items: {
                type: 'object'
              }
            },
            pagination: {
              type: 'object',
              properties: {
                total: {
                  type: 'integer',
                  example: 100
                },
                page: {
                  type: 'integer',
                  example: 1
                },
                limit: {
                  type: 'integer',
                  example: 10
                },
                pages: {
                  type: 'integer',
                  example: 10
                }
              }
            }
          }
        },
        Beneficiary: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439011'
            },
            name: {
              type: 'string',
              example: 'Aisha Mohammed'
            },
            phone: {
              type: 'string',
              example: '9876543210'
            },
            state: {
              type: 'string',
              example: '507f1f77bcf86cd799439010'
            },
            district: {
              type: 'string',
              example: '507f1f77bcf86cd799439011'
            },
            area: {
              type: 'string',
              example: '507f1f77bcf86cd799439012'
            },
            unit: {
              type: 'string',
              example: '507f1f77bcf86cd799439013'
            },
            status: {
              type: 'string',
              enum: ['active', 'inactive', 'blocked'],
              example: 'active'
            },
            isVerified: {
              type: 'boolean',
              example: true
            }
          }
        },
        Project: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439011'
            },
            name: {
              type: 'string',
              example: 'Educational Support Program 2025'
            },
            code: {
              type: 'string',
              example: 'PRJ-2025-001'
            },
            category: {
              type: 'string',
              enum: ['education', 'healthcare', 'housing', 'welfare', 'emergency', 'infrastructure', 'livelihood', 'other'],
              example: 'education'
            },
            status: {
              type: 'string',
              enum: ['draft', 'active', 'on_hold', 'completed', 'cancelled', 'archived'],
              example: 'active'
            },
            budget: {
              type: 'object',
              properties: {
                total: {
                  type: 'number',
                  example: 1000000
                },
                utilized: {
                  type: 'number',
                  example: 450000
                }
              }
            }
          }
        },
        Donor: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439011'
            },
            name: {
              type: 'string',
              example: 'Ibrahim Ahmed'
            },
            email: {
              type: 'string',
              example: 'ibrahim@example.com'
            },
            phone: {
              type: 'string',
              example: '9876543210'
            },
            type: {
              type: 'string',
              enum: ['individual', 'corporate', 'trust', 'institution', 'anonymous'],
              example: 'individual'
            },
            category: {
              type: 'string',
              enum: ['regular', 'major', 'recurring', 'one_time', 'legacy'],
              example: 'regular'
            }
          }
        },
        Donation: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439011'
            },
            donationNumber: {
              type: 'string',
              example: 'DON-2025-001234'
            },
            donor: {
              type: 'string',
              example: '507f1f77bcf86cd799439012'
            },
            amount: {
              type: 'number',
              example: 50000
            },
            method: {
              type: 'string',
              enum: ['cash', 'cheque', 'bank_transfer', 'upi', 'card', 'online', 'other'],
              example: 'upi'
            },
            status: {
              type: 'string',
              enum: ['pending', 'received', 'verified', 'receipted', 'rejected', 'refunded'],
              example: 'received'
            },
            date: {
              type: 'string',
              format: 'date-time',
              example: '2025-11-17T10:30:00.000Z'
            }
          }
        },
        Payment: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439011'
            },
            paymentNumber: {
              type: 'string',
              example: 'PAY-2025-001234'
            },
            application: {
              type: 'string',
              example: '507f1f77bcf86cd799439012'
            },
            amount: {
              type: 'number',
              example: 50000
            },
            type: {
              type: 'string',
              enum: ['full', 'partial', 'installment', 'advance', 'recurring'],
              example: 'full'
            },
            method: {
              type: 'string',
              enum: ['cash', 'cheque', 'bank_transfer', 'upi', 'other'],
              example: 'bank_transfer'
            },
            status: {
              type: 'string',
              enum: ['pending', 'approved', 'processing', 'completed', 'failed', 'cancelled', 'refunded'],
              example: 'completed'
            }
          }
        },
        Role: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439011'
            },
            name: {
              type: 'string',
              example: 'district_admin'
            },
            displayName: {
              type: 'string',
              example: 'District Administrator'
            },
            type: {
              type: 'string',
              enum: ['system', 'custom'],
              example: 'system'
            },
            level: {
              type: 'integer',
              example: 3
            },
            permissions: {
              type: 'array',
              items: {
                type: 'string'
              },
              example: ['507f1f77bcf86cd799439012']
            }
          }
        },
        Permission: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439011'
            },
            name: {
              type: 'string',
              example: 'users.read.regional'
            },
            module: {
              type: 'string',
              example: 'users'
            },
            category: {
              type: 'string',
              example: 'read'
            },
            description: {
              type: 'string',
              example: 'View users within regional scope'
            }
          }
        },
        Interview: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439011'
            },
            application: {
              type: 'string',
              example: '507f1f77bcf86cd799439012'
            },
            scheduledDate: {
              type: 'string',
              format: 'date',
              example: '2025-11-20'
            },
            scheduledTime: {
              type: 'string',
              example: '10:00'
            },
            type: {
              type: 'string',
              enum: ['in_person', 'virtual'],
              example: 'in_person'
            },
            status: {
              type: 'string',
              enum: ['scheduled', 'completed', 'cancelled', 'rescheduled'],
              example: 'scheduled'
            }
          }
        },
        Notification: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439011'
            },
            title: {
              type: 'string',
              example: 'Application Approved'
            },
            message: {
              type: 'string',
              example: 'Your application has been approved'
            },
            type: {
              type: 'string',
              enum: ['info', 'success', 'warning', 'error', 'announcement'],
              example: 'success'
            },
            isRead: {
              type: 'boolean',
              example: false
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-11-17T10:30:00.000Z'
            }
          }
        }
      }
    },
    paths: {
      '/api/auth/send-otp': {
        post: {
          tags: ['Admin Authentication'],
          summary: 'Send OTP for Super Admin and State Admin login',
          description: 'Sends OTP to Super Admin or State Admin for authentication. Use this endpoint for top-level administrators only.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['phone'],
                  properties: {
                    phone: {
                      type: 'string',
                      pattern: '^[6-9]\\d{9}$',
                      example: '9999999999',
                      description: '10-digit Indian mobile number'
                    },
                    purpose: {
                      type: 'string',
                      enum: ['login', 'registration', 'phone_verification'],
                      default: 'login',
                      description: 'Purpose of OTP'
                    }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'OTP sent successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'OTP sent successfully' },
                      data: {
                        type: 'object',
                        properties: {
                          phone: { type: 'string', example: '9999999999' },
                          expiresIn: { type: 'number', example: 10 },
                          staticOTP: { type: 'string', example: '123456' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/auth/verify-otp': {
        post: {
          tags: ['Admin Authentication'],
          summary: 'Verify OTP and login as Super Admin or State Admin',
          description: 'Verifies OTP and returns JWT token for Super Admin or State Admin authentication.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['phone', 'otp'],
                  properties: {
                    phone: { type: 'string', example: '9999999999' },
                    otp: { type: 'string', minLength: 6, maxLength: 6, example: '123456' },
                    purpose: {
                      type: 'string',
                      enum: ['login', 'registration', 'phone_verification'],
                      default: 'login'
                    }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Login successful',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'Login successful' },
                      data: {
                        type: 'object',
                        properties: {
                          user: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              name: { type: 'string', example: 'Super Administrator' },
                              phone: { type: 'string', example: '9999999999' },
                              role: { type: 'string', enum: ['super_admin', 'state_admin'], example: 'super_admin' }
                            }
                          },
                          tokens: {
                            type: 'object',
                            properties: {
                              accessToken: { type: 'string' },
                              refreshToken: { type: 'string' }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/beneficiary/auth/send-otp': {
        post: {
          tags: ['Authentication'],
          summary: 'Send OTP for login/registration',
          description: 'Sends a 6-digit OTP to the beneficiary\'s mobile number via WhatsApp. If the user doesn\'t exist, a new beneficiary account is created automatically.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['phone'],
                  properties: {
                    phone: {
                      type: 'string',
                      pattern: '^[6-9]\\d{9}$',
                      example: '9876543210',
                      description: '10-digit Indian mobile number'
                    }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'OTP sent successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'OTP sent successfully' },
                      data: {
                        type: 'object',
                        properties: {
                          phone: { type: 'string', example: '9876543210' },
                          expiresIn: { type: 'number', example: 10 },
                          messageId: { type: 'string', example: 'msg_12345' },
                          deliveryMethod: { type: 'string', example: 'whatsapp' },
                          staticOTP: { type: 'string', example: '123456' }
                        }
                      }
                    }
                  }
                }
              }
            },
            '400': {
              description: 'Invalid phone number',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' }
                }
              }
            }
          }
        }
      },
      '/api/beneficiary/auth/verify-otp': {
        post: {
          tags: ['Authentication'],
          summary: 'Verify OTP and login',
          description: 'Verifies the OTP sent to the beneficiary\'s mobile number and returns a JWT token for authentication.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['phone', 'otp'],
                  properties: {
                    phone: { type: 'string', example: '9876543210' },
                    otp: { type: 'string', minLength: 6, maxLength: 6, example: '123456' }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Login successful',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'Login successful' },
                      data: {
                        type: 'object',
                        properties: {
                          user: { $ref: '#/components/schemas/User' },
                          token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/beneficiary/auth/profile': {
        get: {
          tags: ['Profile'],
          summary: 'Get beneficiary profile',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': {
              description: 'Profile retrieved successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          user: { $ref: '#/components/schemas/User' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        put: {
          tags: ['Profile'],
          summary: 'Update beneficiary profile',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', example: 'Mohammed Ali Khan' },
                    profile: {
                      type: 'object',
                      properties: {
                        dateOfBirth: { type: 'string', format: 'date', example: '1990-01-15' },
                        gender: { type: 'string', enum: ['male', 'female', 'other'], example: 'male' }
                      }
                    }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Profile updated successfully'
            }
          }
        }
      },
      '/api/beneficiary/schemes': {
        get: {
          tags: ['Schemes'],
          summary: 'Get available schemes',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              in: 'query',
              name: 'category',
              schema: { type: 'string' },
              description: 'Filter by category'
            },
            {
              in: 'query',
              name: 'search',
              schema: { type: 'string' },
              description: 'Search schemes'
            }
          ],
          responses: {
            '200': {
              description: 'Schemes retrieved successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          schemes: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/Scheme' }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/beneficiary/schemes/{id}': {
        get: {
          tags: ['Schemes'],
          summary: 'Get scheme details with dynamic form configuration',
          description: 'Returns complete scheme details including dynamic form configuration for application submission. The formConfiguration object contains all fields, validation rules, and structure needed to render the application form dynamically in the mobile app.',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              in: 'path',
              name: 'id',
              required: true,
              schema: { type: 'string' },
              description: 'Scheme ID',
              example: '507f1f77bcf86cd799439011'
            }
          ],
          responses: {
            '200': {
              description: 'Scheme details with form configuration retrieved successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'Scheme details retrieved successfully' },
                      data: {
                        type: 'object',
                        properties: {
                          scheme: {
                            type: 'object',
                            properties: {
                              _id: { type: 'string', example: '507f1f77bcf86cd799439011' },
                              name: { type: 'string', example: 'Educational Assistance' },
                              description: { type: 'string', example: 'Financial support for students' },
                              category: { type: 'string', example: 'Education' },
                              benefits: {
                                type: 'object',
                                properties: {
                                  amount: { type: 'number', example: 50000 },
                                  type: { type: 'string', example: 'financial' },
                                  description: { type: 'string', example: 'Up to ₹50,000' }
                                }
                              },
                              eligibility: {
                                type: 'object',
                                properties: {
                                  incomeLimit: { type: 'number', example: 100000 },
                                  ageRange: {
                                    type: 'object',
                                    properties: {
                                      min: { type: 'number', example: 18 },
                                      max: { type: 'number', example: 35 }
                                    }
                                  }
                                }
                              },
                              formConfiguration: {
                                type: 'object',
                                description: 'Dynamic form configuration for application submission',
                                properties: {
                                  title: { 
                                    type: 'string', 
                                    example: 'Educational Assistance Application',
                                    description: 'Form title to display'
                                  },
                                  description: { 
                                    type: 'string', 
                                    example: 'Please fill all required fields accurately',
                                    description: 'Form instructions'
                                  },
                                  pages: {
                                    type: 'array',
                                    description: 'Array of form pages for multi-page forms',
                                    items: {
                                      type: 'object',
                                      properties: {
                                        title: { 
                                          type: 'string', 
                                          example: 'Personal Information',
                                          description: 'Page title'
                                        },
                                        fields: {
                                          type: 'array',
                                          description: 'Array of form fields for this page',
                                          items: {
                                            type: 'object',
                                            properties: {
                                              id: { 
                                                type: 'string', 
                                                example: 'field_1',
                                                description: 'Unique field identifier (use this as key in formData)'
                                              },
                                              label: { 
                                                type: 'string', 
                                                example: 'Full Name',
                                                description: 'Field label to display'
                                              },
                                              type: { 
                                                type: 'string', 
                                                enum: ['text', 'number', 'date', 'select', 'radio', 'checkbox', 'textarea', 'file'],
                                                example: 'text',
                                                description: 'Input field type'
                                              },
                                              required: { 
                                                type: 'boolean', 
                                                example: true,
                                                description: 'Whether field is mandatory'
                                              },
                                              placeholder: {
                                                type: 'string',
                                                example: 'Enter your full name'
                                              },
                                              helpText: {
                                                type: 'string',
                                                example: 'As per official documents'
                                              },
                                              validation: {
                                                type: 'object',
                                                description: 'Validation rules for the field',
                                                properties: {
                                                  minLength: { type: 'number', example: 2 },
                                                  maxLength: { type: 'number', example: 100 },
                                                  min: { type: 'number', example: 1000 },
                                                  max: { type: 'number', example: 50000 },
                                                  pattern: { type: 'string', example: '^[a-zA-Z ]+$' },
                                                  message: { type: 'string', example: 'Please enter a valid name' }
                                                }
                                              },
                                              options: {
                                                type: 'array',
                                                description: 'Options for select/radio/checkbox fields',
                                                items: {
                                                  type: 'object',
                                                  properties: {
                                                    value: { type: 'string', example: 'male' },
                                                    label: { type: 'string', example: 'Male' }
                                                  }
                                                }
                                              },
                                              accept: {
                                                type: 'array',
                                                description: 'Accepted file types for file fields',
                                                items: { type: 'string' },
                                                example: ['pdf', 'jpg', 'png']
                                              }
                                            }
                                          },
                                          example: [
                                            {
                                              id: 'field_1',
                                              label: 'Full Name',
                                              type: 'text',
                                              required: true,
                                              validation: { minLength: 2, maxLength: 100 }
                                            },
                                            {
                                              id: 'field_2',
                                              label: 'Date of Birth',
                                              type: 'date',
                                              required: true
                                            },
                                            {
                                              id: 'field_3',
                                              label: 'Gender',
                                              type: 'select',
                                              required: true,
                                              options: [
                                                { value: 'male', label: 'Male' },
                                                { value: 'female', label: 'Female' }
                                              ]
                                            },
                                            {
                                              id: 'field_12',
                                              label: 'Requested Amount',
                                              type: 'number',
                                              required: true,
                                              validation: { min: 1000, max: 50000 }
                                            }
                                          ]
                                        }
                                      }
                                    }
                                  },
                                  confirmationMessage: { 
                                    type: 'string', 
                                    example: 'Thank you for your application. We will review it shortly.',
                                    description: 'Message to show after successful submission'
                                  }
                                }
                              },
                              canApply: { 
                                type: 'boolean', 
                                example: true,
                                description: 'Whether user can apply for this scheme'
                              },
                              hasApplied: { 
                                type: 'boolean', 
                                example: false,
                                description: 'Whether user has already applied'
                              },
                              daysRemaining: { 
                                type: 'number', 
                                example: 45,
                                description: 'Days remaining before application deadline'
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            '404': {
              description: 'Scheme not found or form configuration not available',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: false },
                      message: { type: 'string', example: 'Application form is not available for this scheme' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/beneficiary/applications': {
        get: {
          tags: ['Applications'],
          summary: 'Get my applications',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              in: 'query',
              name: 'status',
              schema: { type: 'string' },
              description: 'Filter by status'
            },
            {
              in: 'query',
              name: 'page',
              schema: { type: 'integer', default: 1 }
            },
            {
              in: 'query',
              name: 'limit',
              schema: { type: 'integer', default: 10 }
            }
          ],
          responses: {
            '200': {
              description: 'Applications retrieved successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          applications: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/Application' }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        post: {
          tags: ['Applications'],
          summary: 'Submit new application with dynamic form data',
          description: 'Submit application for a scheme using the dynamic form data. The formData object should contain key-value pairs where keys are field IDs from the form configuration (e.g., field_1, field_2) and values are the user inputs. Get the form configuration from GET /api/beneficiary/schemes/{id} endpoint first.',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['schemeId', 'formData'],
                  properties: {
                    schemeId: { 
                      type: 'string', 
                      example: '507f1f77bcf86cd799439011',
                      description: 'ID of the scheme to apply for'
                    },
                    formData: {
                      type: 'object',
                      description: 'Dynamic form data with field IDs as keys. Field IDs come from the formConfiguration in scheme details. Match the field types and validation rules.',
                      additionalProperties: true,
                      example: {
                        field_1: 'Mohammed Ali Khan',
                        field_2: '1990-01-15',
                        field_3: 'male',
                        field_4: '9876543210',
                        field_5: '1234 5678 9012',
                        field_6: 'Green Villa, MG Road',
                        field_7: 'Malappuram',
                        field_8: '673001',
                        field_9: 'Ali Khan',
                        field_10: 'Fatima Khan',
                        field_11: 5,
                        field_12: 50000,
                        field_13: 'Farmer',
                        field_14: 80000
                      }
                    },
                    documents: {
                      type: 'array',
                      description: 'Array of uploaded document references (upload files first using file upload API)',
                      items: {
                        type: 'object',
                        properties: {
                          type: {
                            type: 'string',
                            example: 'aadhaar',
                            description: 'Document type identifier'
                          },
                          url: {
                            type: 'string',
                            example: 'https://storage.baithuzzakath.org/docs/aadhaar_123.pdf',
                            description: 'URL of uploaded document'
                          },
                          fileName: {
                            type: 'string',
                            example: 'aadhaar_card.pdf',
                            description: 'Original file name'
                          }
                        }
                      }
                    }
                  }
                },
                examples: {
                  completeApplication: {
                    summary: 'Complete application example',
                    value: {
                      schemeId: '507f1f77bcf86cd799439011',
                      formData: {
                        field_1: 'Mohammed Ali Khan',
                        field_2: '1990-01-15',
                        field_3: 'male',
                        field_4: '9876543210',
                        field_5: '1234 5678 9012',
                        field_12: 50000
                      },
                      documents: [
                        {
                          type: 'aadhaar',
                          url: 'https://storage.example.com/aadhaar.pdf',
                          fileName: 'aadhaar_card.pdf'
                        },
                        {
                          type: 'income_certificate',
                          url: 'https://storage.example.com/income.pdf',
                          fileName: 'income_certificate.pdf'
                        }
                      ]
                    }
                  },
                  minimalApplication: {
                    summary: 'Minimal application (required fields only)',
                    value: {
                      schemeId: '507f1f77bcf86cd799439011',
                      formData: {
                        field_1: 'Mohammed Ali',
                        field_2: '1990-01-15',
                        field_3: 'male',
                        field_12: 30000
                      }
                    }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Application submitted successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          application: { $ref: '#/components/schemas/Application' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/beneficiary/track/{applicationId}': {
        get: {
          tags: ['Tracking'],
          summary: 'Track application status',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              in: 'path',
              name: 'applicationId',
              required: true,
              schema: { type: 'string' },
              description: 'Application number (e.g., APP20250000001)'
            }
          ],
          responses: {
            '200': {
              description: 'Application tracking retrieved',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          application: { $ref: '#/components/schemas/Application' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/beneficiary/stats': {
        get: {
          tags: ['Applications'],
          summary: 'Get application statistics',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': {
              description: 'Statistics retrieved',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          stats: {
                            type: 'object',
                            properties: {
                              total: { type: 'integer', example: 15 },
                              pending: { type: 'integer', example: 3 },
                              approved: { type: 'integer', example: 8 },
                              totalApprovedAmount: { type: 'number', example: 450000 }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/regional-admin/auth/send-otp': {
        post: {
          tags: ['Regional Admin - Auth'],
          summary: 'Send OTP for regional admin login',
          description: 'Sends OTP to unit admin, area admin, or district admin for login. Only users with admin roles can login through this endpoint.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['phone'],
                  properties: {
                    phone: {
                      type: 'string',
                      pattern: '^[6-9]\\d{9}$',
                      example: '9876543210',
                      description: '10-digit Indian mobile number of the admin'
                    }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'OTP sent successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'OTP sent successfully' },
                      data: {
                        type: 'object',
                        properties: {
                          phone: { type: 'string', example: '9876543210' },
                          role: { type: 'string', enum: ['unit_admin', 'area_admin', 'district_admin'], example: 'area_admin' },
                          expiresIn: { type: 'number', example: 10 },
                          staticOTP: { type: 'string', example: '123456' }
                        }
                      }
                    }
                  }
                }
              }
            },
            '404': {
              description: 'No admin account found'
            }
          }
        }
      },
      '/api/regional-admin/auth/verify-otp': {
        post: {
          tags: ['Regional Admin - Auth'],
          summary: 'Verify OTP and login regional admin',
          description: 'Verifies OTP and returns JWT token for regional admin authentication.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['phone', 'otp'],
                  properties: {
                    phone: { type: 'string', example: '9876543210' },
                    otp: { type: 'string', minLength: 6, maxLength: 6, example: '123456' }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Login successful',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'Login successful' },
                      data: {
                        type: 'object',
                        properties: {
                          user: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              name: { type: 'string', example: 'Admin Name' },
                              phone: { type: 'string', example: '9876543210' },
                              role: { type: 'string', enum: ['unit_admin', 'area_admin', 'district_admin'], example: 'area_admin' },
                              location: {
                                type: 'object',
                                properties: {
                                  district: { type: 'object', properties: { _id: { type: 'string' }, name: { type: 'string' }, code: { type: 'string' } } },
                                  area: { type: 'object', properties: { _id: { type: 'string' }, name: { type: 'string' }, code: { type: 'string' } } },
                                  unit: { type: 'object', properties: { _id: { type: 'string' }, name: { type: 'string' }, code: { type: 'string' } } }
                                }
                              }
                            }
                          },
                          token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/regional-admin/auth/profile': {
        get: {
          tags: ['Regional Admin - Auth'],
          summary: 'Get regional admin profile',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': {
              description: 'Profile retrieved successfully'
            }
          }
        }
      },
      '/api/regional-admin/applications': {
        get: {
          tags: ['Regional Admin - Applications'],
          summary: 'Get applications for regional admin',
          description: 'Returns applications filtered by admin\'s location. Unit admin sees unit applications, area admin sees area applications, district admin sees district applications. All admins have READ-ONLY access. Applications include populated district, area, and unit location details.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
            { in: 'query', name: 'limit', schema: { type: 'integer', default: 10 } },
            { in: 'query', name: 'status', schema: { type: 'string', enum: ['pending', 'under_review', 'approved', 'rejected', 'completed'] } },
            { in: 'query', name: 'scheme', schema: { type: 'string' }, description: 'Filter by scheme ID' },
            { in: 'query', name: 'search', schema: { type: 'string' }, description: 'Search by application number' },
            { in: 'query', name: 'sortBy', schema: { type: 'string', enum: ['createdAt', 'applicationNumber', 'status', 'requestedAmount'], default: 'createdAt' } },
            { in: 'query', name: 'sortOrder', schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' } }
          ],
          responses: {
            '200': {
              description: 'Applications retrieved successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          applications: { type: 'array', items: { $ref: '#/components/schemas/Application' } },
                          pagination: {
                            type: 'object',
                            properties: {
                              current: { type: 'integer', example: 1 },
                              pages: { type: 'integer', example: 5 },
                              total: { type: 'integer', example: 47 },
                              limit: { type: 'integer', example: 10 }
                            }
                          },
                          statistics: {
                            type: 'object',
                            properties: {
                              total: { type: 'integer', example: 47 },
                              pending: { type: 'integer', example: 10 },
                              under_review: { type: 'integer', example: 8 },
                              approved: { type: 'integer', example: 20 },
                              rejected: { type: 'integer', example: 5 },
                              completed: { type: 'integer', example: 4 }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/regional-admin/applications/{id}': {
        get: {
          tags: ['Regional Admin - Applications'],
          summary: 'Get application details',
          description: 'Get detailed information about a specific application. Admin must have access to the application\'s location.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'id', required: true, schema: { type: 'string' }, description: 'Application ID' }
          ],
          responses: {
            '200': {
              description: 'Application details retrieved',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          application: { $ref: '#/components/schemas/Application' }
                        }
                      }
                    }
                  }
                }
              }
            },
            '403': {
              description: 'Access denied - application not in admin\'s region'
            },
            '404': {
              description: 'Application not found'
            }
          }
        }
      },
      '/api/regional-admin/applications/{id}/status': {
        put: {
          tags: ['Regional Admin - Applications'],
          summary: 'Update application status (AREA ADMIN ONLY)',
          description: 'Update the status of an application. Only AREA ADMIN can approve, reject, or mark applications under review. Unit and district admins have read-only access.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { in: 'path', name: 'id', required: true, schema: { type: 'string' }, description: 'Application ID' }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['status'],
                  properties: {
                    status: {
                      type: 'string',
                      enum: ['under_review', 'approved', 'rejected'],
                      description: 'New status for the application'
                    },
                    comments: {
                      type: 'string',
                      maxLength: 1000,
                      description: 'Comments or reason for status change',
                      example: 'Application verified and approved'
                    },
                    approvedAmount: {
                      type: 'number',
                      minimum: 0,
                      description: 'Approved amount (required when approving)',
                      example: 45000
                    }
                  }
                },
                examples: {
                  approve: {
                    summary: 'Approve application',
                    value: {
                      status: 'approved',
                      approvedAmount: 45000,
                      comments: 'Application verified and approved'
                    }
                  },
                  reject: {
                    summary: 'Reject application',
                    value: {
                      status: 'rejected',
                      comments: 'Does not meet eligibility criteria'
                    }
                  },
                  review: {
                    summary: 'Mark under review',
                    value: {
                      status: 'under_review',
                      comments: 'Documents under verification'
                    }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Application status updated successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'Application approved successfully' },
                      data: {
                        type: 'object',
                        properties: {
                          application: {
                            type: 'object',
                            properties: {
                              _id: { type: 'string' },
                              applicationNumber: { type: 'string', example: 'APP20250000001' },
                              status: { type: 'string', example: 'approved' },
                              approvedAmount: { type: 'number', example: 45000 }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            '403': {
              description: 'Only area admins can update application status'
            }
          }
        }
      },
      '/api/regional-admin/dashboard/stats': {
        get: {
          tags: ['Regional Admin - Dashboard'],
          summary: 'Get dashboard statistics',
          description: 'Get application statistics and metrics for the admin\'s region. Statistics are filtered based on admin role and location.',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': {
              description: 'Dashboard statistics retrieved',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          applications: {
                            type: 'object',
                            properties: {
                              total: { type: 'integer', example: 150 },
                              pending: { type: 'integer', example: 30 },
                              under_review: { type: 'integer', example: 25 },
                              approved: { type: 'integer', example: 80 },
                              rejected: { type: 'integer', example: 10 },
                              completed: { type: 'integer', example: 5 },
                              totalRequested: { type: 'number', example: 7500000 },
                              totalApproved: { type: 'number', example: 6000000 }
                            }
                          },
                          schemes: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                schemeName: { type: 'string', example: 'Educational Assistance' },
                                category: { type: 'string', example: 'Education' },
                                count: { type: 'integer', example: 45 },
                                totalApproved: { type: 'number', example: 2250000 }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/mobile/districts': {
        get: {
          tags: ['Mobile API'],
          summary: 'Get all districts (Mobile API)',
          description: 'Get a full list of districts optimized for mobile applications. Supports search, filtering, and pagination.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { in: 'query', name: 'search', schema: { type: 'string' }, description: 'Search by district name or code' },
            { in: 'query', name: 'isActive', schema: { type: 'boolean', default: true }, description: 'Filter by active status' },
            { in: 'query', name: 'page', schema: { type: 'integer', default: 1, minimum: 1 } },
            { in: 'query', name: 'limit', schema: { type: 'integer', default: 1000, minimum: 1, maximum: 10000 }, description: 'Number of items per page (default: 1000 for full list)' },
            { in: 'query', name: 'sort', schema: { type: 'string', enum: ['name', 'code', 'createdAt'], default: 'name' } },
            { in: 'query', name: 'order', schema: { type: 'string', enum: ['asc', 'desc'], default: 'asc' } }
          ],
          responses: {
            '200': {
              description: 'Districts retrieved successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'Districts retrieved successfully' },
                      data: {
                        type: 'object',
                        properties: {
                          districts: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                _id: { type: 'string', example: '507f1f77bcf86cd799439011' },
                                name: { type: 'string', example: 'Malappuram' },
                                code: { type: 'string', example: 'MALAPPURAM' },
                                type: { type: 'string', example: 'district' },
                                isActive: { type: 'boolean', example: true },
                                coordinates: {
                                  type: 'object',
                                  properties: {
                                    latitude: { type: 'number' },
                                    longitude: { type: 'number' }
                                  }
                                },
                                contactPerson: {
                                  type: 'object',
                                  properties: {
                                    name: { type: 'string' },
                                    phone: { type: 'string' },
                                    email: { type: 'string' }
                                  }
                                }
                              }
                            }
                          },
                          pagination: {
                            type: 'object',
                            properties: {
                              page: { type: 'integer', example: 1 },
                              limit: { type: 'integer', example: 1000 },
                              total: { type: 'integer', example: 14 },
                              pages: { type: 'integer', example: 1 }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/mobile/areas': {
        get: {
          tags: ['Mobile API'],
          summary: 'Get all areas (Mobile API)',
          description: 'Get a full list of areas optimized for mobile applications. Can filter by district. Supports search, filtering, and pagination.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { in: 'query', name: 'district', schema: { type: 'string' }, description: 'Filter by district ID' },
            { in: 'query', name: 'search', schema: { type: 'string' }, description: 'Search by area name or code' },
            { in: 'query', name: 'isActive', schema: { type: 'boolean', default: true }, description: 'Filter by active status' },
            { in: 'query', name: 'page', schema: { type: 'integer', default: 1, minimum: 1 } },
            { in: 'query', name: 'limit', schema: { type: 'integer', default: 1000, minimum: 1, maximum: 10000 }, description: 'Number of items per page (default: 1000 for full list)' },
            { in: 'query', name: 'sort', schema: { type: 'string', enum: ['name', 'code', 'createdAt'], default: 'name' } },
            { in: 'query', name: 'order', schema: { type: 'string', enum: ['asc', 'desc'], default: 'asc' } }
          ],
          responses: {
            '200': {
              description: 'Areas retrieved successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'Areas retrieved successfully' },
                      data: {
                        type: 'object',
                        properties: {
                          areas: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                _id: { type: 'string', example: '507f1f77bcf86cd799439012' },
                                name: { type: 'string', example: 'Tirur' },
                                code: { type: 'string', example: 'TRR' },
                                type: { type: 'string', example: 'area' },
                                parent: {
                                  type: 'object',
                                  properties: {
                                    _id: { type: 'string' },
                                    name: { type: 'string', example: 'Malappuram' },
                                    code: { type: 'string', example: 'MALAPPURAM' },
                                    type: { type: 'string', example: 'district' }
                                  }
                                },
                                isActive: { type: 'boolean', example: true },
                                coordinates: {
                                  type: 'object',
                                  properties: {
                                    latitude: { type: 'number' },
                                    longitude: { type: 'number' }
                                  }
                                },
                                contactPerson: {
                                  type: 'object',
                                  properties: {
                                    name: { type: 'string' },
                                    phone: { type: 'string' },
                                    email: { type: 'string' }
                                  }
                                }
                              }
                            }
                          },
                          pagination: {
                            type: 'object',
                            properties: {
                              page: { type: 'integer', example: 1 },
                              limit: { type: 'integer', example: 1000 },
                              total: { type: 'integer', example: 50 },
                              pages: { type: 'integer', example: 1 }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/mobile/units': {
        get: {
          tags: ['Mobile API'],
          summary: 'Get all units (Mobile API)',
          description: 'Get a full list of units optimized for mobile applications. Can filter by district or area. Supports search, filtering, and pagination.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { in: 'query', name: 'district', schema: { type: 'string' }, description: 'Filter by district ID (returns all units in that district)' },
            { in: 'query', name: 'area', schema: { type: 'string' }, description: 'Filter by area ID (takes priority over district)' },
            { in: 'query', name: 'search', schema: { type: 'string' }, description: 'Search by unit name or code' },
            { in: 'query', name: 'isActive', schema: { type: 'boolean', default: true }, description: 'Filter by active status' },
            { in: 'query', name: 'page', schema: { type: 'integer', default: 1, minimum: 1 } },
            { in: 'query', name: 'limit', schema: { type: 'integer', default: 1000, minimum: 1, maximum: 10000 }, description: 'Number of items per page (default: 1000 for full list)' },
            { in: 'query', name: 'sort', schema: { type: 'string', enum: ['name', 'code', 'createdAt'], default: 'name' } },
            { in: 'query', name: 'order', schema: { type: 'string', enum: ['asc', 'desc'], default: 'asc' } }
          ],
          responses: {
            '200': {
              description: 'Units retrieved successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'Units retrieved successfully' },
                      data: {
                        type: 'object',
                        properties: {
                          units: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                _id: { type: 'string', example: '507f1f77bcf86cd799439013' },
                                name: { type: 'string', example: 'Tirur West' },
                                code: { type: 'string', example: 'TRR_W' },
                                type: { type: 'string', example: 'unit' },
                                parent: {
                                  type: 'object',
                                  properties: {
                                    _id: { type: 'string' },
                                    name: { type: 'string', example: 'Tirur' },
                                    code: { type: 'string', example: 'TRR' },
                                    type: { type: 'string', example: 'area' }
                                  }
                                },
                                isActive: { type: 'boolean', example: true },
                                coordinates: {
                                  type: 'object',
                                  properties: {
                                    latitude: { type: 'number' },
                                    longitude: { type: 'number' }
                                  }
                                },
                                contactPerson: {
                                  type: 'object',
                                  properties: {
                                    name: { type: 'string' },
                                    phone: { type: 'string' },
                                    email: { type: 'string' }
                                  }
                                }
                              }
                            }
                          },
                          pagination: {
                            type: 'object',
                            properties: {
                              page: { type: 'integer', example: 1 },
                              limit: { type: 'integer', example: 1000 },
                              total: { type: 'integer', example: 200 },
                              pages: { type: 'integer', example: 1 }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  apis: [
    './src/routes/*.js',
    './src/docs/swagger/*.yaml'
  ]
};

const specs = swaggerJsdoc(options);

module.exports = specs;
