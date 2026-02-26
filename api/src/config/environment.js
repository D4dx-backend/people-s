const dotenv = require('dotenv');
dotenv.config();

const { getEnvVar, getOptionalEnvVar } = require('./validateEnv');

/**
 * Environment Configuration
 * 
 * STRICT MODE: All required values must come from environment variables.
 * No fallback defaults are allowed for security and configuration clarity.
 */

module.exports = {
  // Core Application (REQUIRED)
  NODE_ENV: getEnvVar('NODE_ENV', 'Application environment'),
  PORT: parseInt(getEnvVar('PORT', 'Server port number'), 10),
  API_VERSION: getOptionalEnvVar('API_VERSION', 'v1'),
  
  // Database (REQUIRED)
  MONGODB_URI: getEnvVar('MONGODB_URI', 'MongoDB connection URI'),
  MONGODB_TEST_URI: getOptionalEnvVar('MONGODB_TEST_URI'),
  
  // JWT Authentication (REQUIRED)
  JWT_SECRET: getEnvVar('JWT_SECRET', 'JWT secret key'),
  JWT_EXPIRE: getEnvVar('JWT_EXPIRE', 'JWT token expiration'),
  JWT_REFRESH_EXPIRE: getEnvVar('JWT_REFRESH_EXPIRE', 'JWT refresh token expiration'),
  
  // DXing SMS Service (OPTIONAL)
  DXING_API_KEY: getOptionalEnvVar('DXING_API_KEY'),
  DXING_BASE_URL: getOptionalEnvVar('DXING_BASE_URL'),
  DXING_SENDER_ID: getOptionalEnvVar('DXING_SENDER_ID'),
  DXING_OTP_TEMPLATE_ID: getOptionalEnvVar('DXING_OTP_TEMPLATE_ID'),
  DXING_NOTIFICATION_TEMPLATE_ID: getOptionalEnvVar('DXING_NOTIFICATION_TEMPLATE_ID'),

  // DXing WhatsApp (OPTIONAL)
  DXING_WHATSAPP_ENABLED: process.env.DXING_WHATSAPP_ENABLED === 'true',
  DXING_WHATSAPP_SEND_PATH: getOptionalEnvVar('DXING_WHATSAPP_SEND_PATH'),
  DXING_WHATSAPP_TEMPLATE_ID: getOptionalEnvVar('DXING_WHATSAPP_TEMPLATE_ID'),
  
  // Email Service (OPTIONAL)
  SMTP_HOST: getOptionalEnvVar('SMTP_HOST'),
  SMTP_PORT: getOptionalEnvVar('SMTP_PORT') ? parseInt(getOptionalEnvVar('SMTP_PORT'), 10) : undefined,
  SMTP_USER: getOptionalEnvVar('SMTP_USER'),
  SMTP_PASS: getOptionalEnvVar('SMTP_PASS'),
  
  // File Upload (REQUIRED)
  UPLOAD_PATH: getEnvVar('UPLOAD_PATH', 'File upload directory path'),
  MAX_FILE_SIZE: parseInt(getEnvVar('MAX_FILE_SIZE', 'Maximum file size in bytes'), 10),
  ALLOWED_FILE_TYPES: getEnvVar('ALLOWED_FILE_TYPES', 'Allowed file types'),
  
  // Frontend URL (REQUIRED)
  FRONTEND_URL: getEnvVar('FRONTEND_URL', 'Frontend application URL'),
  
  // Google Cloud Speech-to-Text (OPTIONAL)
  GOOGLE_SPEECH_API_KEY: getOptionalEnvVar('GOOGLE_SPEECH_API_KEY'),
  
  // Logging (REQUIRED)
  LOG_LEVEL: getEnvVar('LOG_LEVEL', 'Logging level'),
  LOG_FILE: getEnvVar('LOG_FILE', 'Log file path'),

  // Organization Identity (OPTIONAL — defaults managed by orgConfig.js)
  ORG_NAME: getOptionalEnvVar('ORG_NAME', 'people_foundation'),

  // ── Multi-Tenant / Franchise configuration ────────────────────────────────
  // BASE_DOMAIN: Root domain used for subdomain franchise detection.
  //   e.g. 'peopleerp.com' → people.peopleerp.com resolves to slug 'people'
  //   Leave empty in development (use X-Franchise-Slug header instead).
  BASE_DOMAIN: getOptionalEnvVar('BASE_DOMAIN'),

  // CORS_ORIGINS: Comma-separated list of explicitly allowed origins.
  //   Wildcards are supported via BASE_DOMAIN matching.
  //   e.g. 'https://admin.peopleerp.com,http://localhost:5173'
  CORS_ORIGINS: getOptionalEnvVar('CORS_ORIGINS'),

  // FRANCHISE_STRICT: When 'true', franchise plugin throws on missing franchise filter
  //   (instead of just warning). Recommended for production.
  FRANCHISE_STRICT: process.env.FRANCHISE_STRICT === 'true',
};