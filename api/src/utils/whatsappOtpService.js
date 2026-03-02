const axios = require('axios');
const orgConfig = require('../config/orgConfig');

/**
 * DXing WhatsApp OTP Service
 * Handles WhatsApp-based OTP sending using DXing API
 * 
 * Features:
 * - Send OTP via WhatsApp
 * - Phone number validation (E.164 format)
 * - Message delivery status tracking
 * - Support for all user roles (admin, beneficiary, etc.)
 * - Rate limiting and error handling
 */

const { getOptionalEnvVar } = require('../config/validateEnv');

class WhatsAppOTPService {
  constructor() {
    // DXing API Configuration from environment variables
    // Support both DXING_secret (new) and DXING_API_KEY (existing)
    // Both must come from environment - no fallbacks
    this.apiSecret = getOptionalEnvVar('DXING_secret') || getOptionalEnvVar('DXING_API_KEY');
    this.account = getOptionalEnvVar('DXING_Account');
    
    // Base URL must come from environment
    const baseURL = getOptionalEnvVar('DXING_WHATSAPP_BASE_URL');
    if (!baseURL) {
      throw new Error('DXING_WHATSAPP_BASE_URL environment variable is required for WhatsApp OTP service');
    }
    this.baseURL = baseURL;
    
    // Validate credentials on initialization
    this.validateCredentials();
  }

  /**
   * Validate DXing credentials
   * @throws {Error} If credentials are missing
   */
  validateCredentials() {
    if (!this.apiSecret || !this.account) {
      throw new Error('DXing WhatsApp credentials are not configured. Please set DXING_secret and DXING_Account in .env file');
    }
  }

  /**
   * Format phone number to E.164 format
   * Converts Indian mobile numbers (10 digits) to international format
   * @param {string} phone - Phone number (10 digits or E.164 format)
   * @returns {string} E.164 formatted phone number
   */
  formatPhoneNumber(phone) {
    // Remove any non-digit characters
    const cleaned = phone.replace(/\D/g, '');
    
    // If already in E.164 format (starts with 91 and has 12 digits)
    if (cleaned.startsWith('91') && cleaned.length === 12) {
      return `+${cleaned}`;
    }
    
    // If 10-digit Indian number, add country code
    if (cleaned.length === 10 && /^[6-9]/.test(cleaned)) {
      return `+91${cleaned}`;
    }
    
    // If already has + prefix
    if (phone.startsWith('+')) {
      return phone;
    }
    
    throw new Error('Invalid phone number format. Please provide a valid 10-digit Indian mobile number or E.164 format');
  }

  /**
   * Validate Indian mobile number
   * @param {string} phone - Phone number
   * @returns {boolean} True if valid
   */
  validatePhoneNumber(phone) {
    const cleaned = phone.replace(/\D/g, '');
    
    // Valid 10-digit Indian mobile (starts with 6-9)
    if (cleaned.length === 10 && /^[6-9]\d{9}$/.test(cleaned)) {
      return true;
    }
    
    // Valid E.164 format for Indian number
    if (cleaned.length === 12 && cleaned.startsWith('91') && /^91[6-9]\d{9}$/.test(cleaned)) {
      return true;
    }
    
    return false;
  }

  /**
   * Generate OTP
   * @param {number} length - OTP length (default: 6)
   * @returns {string} Generated OTP
   */
  generateOTP(length = 6) {
    const digits = '0123456789';
    let otp = '';
    
    for (let i = 0; i < length; i++) {
      otp += digits[Math.floor(Math.random() * digits.length)];
    }
    
    return otp;
  }

  /**
   * Create WhatsApp OTP message
   * @param {string} otp - OTP code
   * @param {string} name - Recipient name (optional)
   * @param {string} purpose - OTP purpose (login, registration, verification)
   * @returns {string} Formatted message
   */
  createOTPMessage(otp, name = 'User', purpose = 'login') {
    const purposeText = {
      login: 'login to',
      registration: 'register on',
      phone_verification: 'verify your phone on',
      password_reset: 'reset your password on'
    };

    const action = purposeText[purpose] || 'authenticate on';
    
    return `🔐 *${orgConfig.erpTitle}*\n\n` +
           `Dear ${name},\n\n` +
           `Your OTP to ${action} ${orgConfig.erpTitle} is:\n\n` +
           `*${otp}*\n\n` +
           `⏰ Valid for 10 minutes\n` +
           `🔒 Do not share with anyone\n\n` +
           `If you didn't request this, please ignore this message.\n\n` +
           `- Team ${orgConfig.erpTitle}`;
  }

  /**
   * Send OTP via WhatsApp
   * @param {string} phone - Recipient phone number
   * @param {string} otp - OTP code
   * @param {Object} options - Additional options
   * @param {string} options.name - Recipient name
   * @param {string} options.purpose - OTP purpose (login, registration, etc.)
   * @param {number} options.priority - Message priority (1=high, 2=normal)
   * @returns {Promise<Object>} Send result
   */
  async sendOTP(phone, otp, options = {}) {
    try {
      const {
        name = 'User',
        purpose = 'login',
        priority = 1
      } = options;

      // Validate phone number
      if (!this.validatePhoneNumber(phone)) {
        return {
          success: false,
          error: 'Invalid phone number format',
          errorCode: 'INVALID_PHONE'
        };
      }

      // Format phone number to E.164
      const formattedPhone = this.formatPhoneNumber(phone);
      
      // Create OTP message
      const message = this.createOTPMessage(otp, name, purpose);

      // Prepare API payload
      const payload = {
        secret: this.apiSecret,
        account: this.account,
        recipient: formattedPhone,
        type: 'text',
        message: message,
        priority: priority
      };

      console.log(`📱 Sending WhatsApp OTP to ${formattedPhone}...`);

      // Send WhatsApp message via DXing API
      const response = await axios.post(
        `${this.baseURL}/send/whatsapp`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      // Check response status
      if (response.data.status === 200) {
        console.log(`✅ WhatsApp OTP sent successfully - MessageID: ${response.data.data?.messageId}`);
        
        return {
          success: true,
          messageId: response.data.data?.messageId,
          message: 'OTP sent successfully via WhatsApp',
          recipient: formattedPhone,
          timestamp: new Date().toISOString()
        };
      } else {
        console.error(`❌ WhatsApp API Error: ${response.data.message}`);
        
        return {
          success: false,
          error: response.data.message || 'Failed to send WhatsApp message',
          errorCode: 'WHATSAPP_API_ERROR'
        };
      }

    } catch (error) {
      console.error('❌ WhatsApp OTP Service Error:', error);
      
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to send WhatsApp OTP',
        errorCode: error.response?.data?.status || 'WHATSAPP_SEND_FAILED',
        details: error.response?.data || null
      };
    }
  }

  /**
   * Get message delivery status
   * @param {string} messageId - Message ID from send response
   * @returns {Promise<Object>} Delivery status
   */
  async getMessageStatus(messageId) {
    try {
      const payload = {
        secret: this.apiSecret,
        id: messageId,
        type: 'sent'
      };

      const response = await axios.get(
        `${this.baseURL}/get/wa.message`,
        {
          params: payload,
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      if (response.data.status === 200) {
        return {
          success: true,
          messageId: messageId,
          status: response.data.data?.status,
          recipient: response.data.data?.recipient,
          created: response.data.data?.created,
          message: response.data.message
        };
      } else {
        return {
          success: false,
          error: response.data.message || 'Failed to get message status',
          errorCode: 'STATUS_CHECK_FAILED'
        };
      }

    } catch (error) {
      console.error('❌ Failed to get message status:', error);
      
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to check message status',
        errorCode: 'STATUS_API_ERROR'
      };
    }
  }

  /**
   * Send custom WhatsApp message
   * @param {string} phone - Recipient phone number
   * @param {string} message - Message text
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Send result
   */
  async sendMessage(phone, message, options = {}) {
    try {
      const { priority = 2 } = options;

      // Validate phone number
      if (!this.validatePhoneNumber(phone)) {
        return {
          success: false,
          error: 'Invalid phone number format',
          errorCode: 'INVALID_PHONE'
        };
      }

      // Format phone number
      const formattedPhone = this.formatPhoneNumber(phone);

      // Prepare API payload
      const payload = {
        secret: this.apiSecret,
        account: this.account,
        recipient: formattedPhone,
        type: 'text',
        message: message,
        priority: priority
      };

      // Send WhatsApp message
      const response = await axios.post(
        `${this.baseURL}/send/whatsapp`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      if (response.data.status === 200) {
        return {
          success: true,
          messageId: response.data.data?.messageId,
          message: 'Message sent successfully via WhatsApp',
          recipient: formattedPhone
        };
      } else {
        return {
          success: false,
          error: response.data.message || 'Failed to send WhatsApp message',
          errorCode: 'WHATSAPP_API_ERROR'
        };
      }

    } catch (error) {
      console.error('❌ WhatsApp Message Service Error:', error);
      
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        errorCode: 'WHATSAPP_SEND_FAILED'
      };
    }
  }

  /**
   * Test WhatsApp connection
   * @returns {Promise<Object>} Test result
   */
  async testConnection() {
    try {
      console.log('🧪 Testing WhatsApp API connection...');
      
      // Validate credentials
      this.validateCredentials();
      
      console.log('✅ WhatsApp credentials validated');
      console.log(`   - Account: ${this.account?.substring(0, 20)}...`);
      console.log(`   - Secret: ${this.apiSecret?.substring(0, 20)}...`);
      
      return {
        success: true,
        message: 'WhatsApp service is configured and ready',
        account: this.account,
        baseURL: this.baseURL
      };
      
    } catch (error) {
      console.error('❌ WhatsApp connection test failed:', error);
      
      return {
        success: false,
        error: error.message,
        errorCode: 'CONNECTION_TEST_FAILED'
      };
    }
  }
}

// Export singleton instance
module.exports = new WhatsAppOTPService();
