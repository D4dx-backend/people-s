/**
 * Strict Environment Variable Validation
 * 
 * This module validates all required environment variables at startup.
 * Application will fail fast if any required variable is missing.
 * 
 * NO FALLBACK VALUES - All configuration must come from environment variables.
 */

const requiredEnvVars = {
  // Core Application
  NODE_ENV: 'Application environment (development, production, test)',
  PORT: 'Server port number',
  
  // Database
  MONGODB_URI: 'MongoDB connection URI',
  
  // JWT Authentication
  JWT_SECRET: 'JWT secret key for token signing',
  JWT_EXPIRE: 'JWT token expiration time (e.g., 7d)',
  JWT_REFRESH_EXPIRE: 'JWT refresh token expiration time (e.g., 30d)',
  
  // Frontend URL
  FRONTEND_URL: 'Frontend application URL',
  
  // File Upload
  UPLOAD_PATH: 'Local file upload directory path',
  MAX_FILE_SIZE: 'Maximum file size in bytes',
  ALLOWED_FILE_TYPES: 'Comma-separated list of allowed file types',
  
  // Logging
  LOG_LEVEL: 'Logging level (error, warn, info, debug)',
  LOG_FILE: 'Log file path',
};

const optionalEnvVars = {
  // API Version
  API_VERSION: 'API version (defaults to v1 if not set)',
  
  // Test Database (only required in test environment)
  MONGODB_TEST_URI: 'MongoDB test connection URI',
  
  // DXing SMS Service
  DXING_API_KEY: 'DXing SMS API key',
  DXING_BASE_URL: 'DXing SMS base URL',
  DXING_SENDER_ID: 'DXing SMS sender ID',
  DXING_OTP_TEMPLATE_ID: 'DXing OTP template ID',
  DXING_NOTIFICATION_TEMPLATE_ID: 'DXing notification template ID',
  
  // DXing WhatsApp
  DXING_WHATSAPP_ENABLED: 'Enable DXing WhatsApp service (true/false)',
  DXING_WHATSAPP_SEND_PATH: 'DXing WhatsApp send endpoint path',
  DXING_WHATSAPP_TEMPLATE_ID: 'DXing WhatsApp template ID',
  DXING_secret: 'DXing WhatsApp secret',
  DXING_Account: 'DXing WhatsApp account',
  
  // Email Service
  SMTP_HOST: 'SMTP server hostname',
  SMTP_PORT: 'SMTP server port',
  SMTP_USER: 'SMTP username',
  SMTP_PASS: 'SMTP password',
  
  // DigitalOcean Spaces / S3
  SPACES_ENDPOINT: 'DigitalOcean Spaces endpoint',
  SPACES_ACCESS_KEY_ID: 'DigitalOcean Spaces access key ID',
  SPACES_SECRET_ACCESS_KEY: 'DigitalOcean Spaces secret access key',
  SPACES_BUCKET_NAME: 'DigitalOcean Spaces bucket name',
  REGION: 'AWS/DigitalOcean region',
  
  // OTP Configuration
  USE_STATIC_OTP: 'Use static OTP for development (true/false)',
  STATIC_OTP: 'Static OTP value (only if USE_STATIC_OTP=true)',
  OTP_EXPIRY_MINUTES: 'OTP expiration time in minutes',
  USE_WHATSAPP_OTP: 'Use WhatsApp OTP (true/false)',
  WHATSAPP_ENABLED: 'Enable WhatsApp service (true/false)',
  SMS_ENABLED: 'Enable SMS service (true/false)',
  MAX_OTP_ATTEMPTS: 'Maximum OTP attempts per day',
  OTP_RATE_LIMIT_SECONDS: 'Minimum interval between OTP requests in seconds',

  // Multi-Org Configuration
  ORG_NAME: 'Organization key (baithuzzakath or people_foundation)',
  ORG_DISPLAY_NAME: 'Override org display name',
  ORG_EMAIL: 'Override org contact email',
  ORG_PHONE: 'Override org phone number',
  ORG_WEBSITE: 'Override org website display string',
  ORG_WEBSITE_URL: 'Override org full website URL',
  ORG_ADDRESS: 'Override org address',
  ORG_LOGO_FILENAME: 'Override org logo filename',
  ORG_DEFAULT_THEME: 'Override default theme (blue, green, purple)',
};

/**
 * Validate required environment variables
 * @throws {Error} If any required variable is missing
 */
function validateRequiredEnvVars() {
  const missing = [];
  const errors = [];

  // Check required variables
  for (const [varName, description] of Object.entries(requiredEnvVars)) {
    const value = process.env[varName];
    
    if (!value || value.trim() === '') {
      missing.push({ varName, description });
    }
  }

  // Check conditional requirements
  if (process.env.NODE_ENV === 'test' && !process.env.MONGODB_TEST_URI) {
    missing.push({
      varName: 'MONGODB_TEST_URI',
      description: 'MongoDB test connection URI (required in test environment)'
    });
  }

  // Validate specific formats
  if (process.env.PORT && isNaN(parseInt(process.env.PORT))) {
    errors.push(`PORT must be a valid number, got: ${process.env.PORT}`);
  }

  if (process.env.MAX_FILE_SIZE && isNaN(parseInt(process.env.MAX_FILE_SIZE))) {
    errors.push(`MAX_FILE_SIZE must be a valid number, got: ${process.env.MAX_FILE_SIZE}`);
  }

  if (process.env.SMTP_PORT && isNaN(parseInt(process.env.SMTP_PORT))) {
    errors.push(`SMTP_PORT must be a valid number, got: ${process.env.SMTP_PORT}`);
  }

  // Validate NODE_ENV
  const validEnvs = ['development', 'production', 'test'];
  if (process.env.NODE_ENV && !validEnvs.includes(process.env.NODE_ENV)) {
    errors.push(`NODE_ENV must be one of: ${validEnvs.join(', ')}, got: ${process.env.NODE_ENV}`);
  }

  // Validate boolean values
  const booleanVars = [
    'DXING_WHATSAPP_ENABLED',
    'USE_STATIC_OTP',
    'USE_WHATSAPP_OTP',
    'WHATSAPP_ENABLED',
    'SMS_ENABLED'
  ];

  for (const varName of booleanVars) {
    const value = process.env[varName];
    if (value && value !== 'true' && value !== 'false') {
      errors.push(`${varName} must be 'true' or 'false', got: ${value}`);
    }
  }

  // CRITICAL: Validate production OTP configuration
  if (process.env.NODE_ENV === 'production') {
    // In production, static OTP must be disabled
    if (process.env.USE_STATIC_OTP === 'true') {
      errors.push('SECURITY ERROR: USE_STATIC_OTP=true is not allowed in production mode. Static OTP is automatically disabled for security.');
    }
    
    // In production, at least one real OTP service must be enabled
    const hasWhatsAppOTP = process.env.USE_WHATSAPP_OTP === 'true' && process.env.WHATSAPP_ENABLED === 'true';
    const hasSMSOTP = process.env.SMS_ENABLED === 'true';
    
    if (!hasWhatsAppOTP && !hasSMSOTP) {
      errors.push('PRODUCTION CONFIGURATION ERROR: No real OTP service enabled in production mode. Please set USE_WHATSAPP_OTP=true or SMS_ENABLED=true. Static OTP is not allowed in production.');
    }
  }

  // Build error message
  if (missing.length > 0 || errors.length > 0) {
    let errorMessage = '\n❌ ENVIRONMENT VARIABLE VALIDATION FAILED\n';
    errorMessage += '='.repeat(60) + '\n\n';

    if (missing.length > 0) {
      errorMessage += 'Missing Required Environment Variables:\n';
      errorMessage += '-'.repeat(60) + '\n';
      missing.forEach(({ varName, description }) => {
        errorMessage += `  ✗ ${varName}\n`;
        errorMessage += `    ${description}\n\n`;
      });
    }

    if (errors.length > 0) {
      errorMessage += 'Environment Variable Validation Errors:\n';
      errorMessage += '-'.repeat(60) + '\n';
      errors.forEach(error => {
        errorMessage += `  ✗ ${error}\n`;
      });
      errorMessage += '\n';
    }

    errorMessage += '='.repeat(60) + '\n';
    errorMessage += 'Please set all required environment variables before starting the application.\n';
    errorMessage += 'No fallback values are allowed for security and configuration clarity.\n';

    throw new Error(errorMessage);
  }
}

/**
 * Get environment variable value (strict, no fallback)
 * @param {string} varName - Environment variable name
 * @param {string} description - Description for error message
 * @returns {string} Environment variable value
 * @throws {Error} If variable is not set
 */
function getEnvVar(varName, description) {
  const value = process.env[varName];
  
  if (!value || value.trim() === '') {
    throw new Error(
      `Required environment variable ${varName} is not set. ${description || ''}`
    );
  }
  
  return value;
}

/**
 * Get optional environment variable value
 * @param {string} varName - Environment variable name
 * @param {string} defaultValue - Default value (only for truly optional vars)
 * @returns {string|undefined} Environment variable value or undefined
 */
function getOptionalEnvVar(varName, defaultValue = undefined) {
  const value = process.env[varName];
  return value && value.trim() !== '' ? value : defaultValue;
}

/**
 * Validate and log environment configuration
 */
function validateAndLog() {
  console.log('\n🔍 Validating environment variables...\n');
  
  try {
    validateRequiredEnvVars();
    console.log('✅ All required environment variables are set\n');
    
    // Log configuration summary (without sensitive values)
    console.log('📋 Configuration Summary:');
    console.log('-'.repeat(60));
    console.log(`  Environment: ${process.env.NODE_ENV}`);
    console.log(`  Port: ${process.env.PORT}`);
    console.log(`  Frontend URL: ${process.env.FRONTEND_URL}`);
    console.log(`  MongoDB URI: ${process.env.MONGODB_URI ? '✓ Set' : '✗ Missing'}`);
    console.log(`  JWT Secret: ${process.env.JWT_SECRET ? '✓ Set' : '✗ Missing'}`);
    console.log(`  Upload Path: ${process.env.UPLOAD_PATH}`);
    console.log(`  Max File Size: ${process.env.MAX_FILE_SIZE} bytes`);
    console.log(`  Log Level: ${process.env.LOG_LEVEL}`);
    console.log('-'.repeat(60));
    console.log('');
    
  } catch (error) {
    console.error(error.message);
    console.error('\n💥 Application startup aborted due to missing/invalid configuration.\n');
    process.exit(1);
  }
}

module.exports = {
  validateRequiredEnvVars,
  validateAndLog,
  getEnvVar,
  getOptionalEnvVar,
  requiredEnvVars,
  optionalEnvVars
};
