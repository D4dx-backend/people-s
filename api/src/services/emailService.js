const nodemailer = require('nodemailer');
const config = require('../config/environment');
const orgConfig = require('../config/orgConfig');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  /**
   * Initialize email transporter
   */
  async initializeTransporter() {
    try {
      this.transporter = nodemailer.createTransport({
        host: config.SMTP_HOST,
        port: config.SMTP_PORT,
        secure: config.SMTP_PORT === 465, // true for 465, false for other ports
        auth: {
          user: config.SMTP_USER,
          pass: config.SMTP_PASS
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      // Verify connection
      await this.transporter.verify();
      console.log('✅ Email service initialized successfully');
    } catch (error) {
      console.error('❌ Email service initialization failed:', error);
    }
  }

  /**
   * Send single email
   * @param {Object} emailData - Email data
   * @returns {Promise<Object>} Send result
   */
  async sendEmail(emailData) {
    try {
      const {
        to,
        subject,
        text,
        html,
        attachments = [],
        from = config.SMTP_USER
      } = emailData;

      if (!this.transporter) {
        throw new Error('Email transporter not initialized');
      }

      const mailOptions = {
        from: `"${orgConfig.emailSenderName}" <${from}>`,
        to,
        subject,
        text,
        html,
        attachments
      };

      const result = await this.transporter.sendMail(mailOptions);

      return {
        success: true,
        messageId: result.messageId,
        response: result.response,
        message: 'Email sent successfully'
      };
    } catch (error) {
      console.error('❌ Email send error:', error);
      return {
        success: false,
        error: error.message,
        errorCode: 'EMAIL_SEND_FAILED'
      };
    }
  }

  /**
   * Send bulk emails
   * @param {Array} emails - Array of email data
   * @returns {Promise<Array>} Send results
   */
  async sendBulkEmails(emails) {
    try {
      const results = [];

      for (const emailData of emails) {
        const result = await this.sendEmail(emailData);
        results.push(result);

        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      return results;
    } catch (error) {
      console.error('❌ Bulk email send error:', error);
      throw error;
    }
  }

  /**
   * Send OTP email
   * @param {string} email - Recipient email
   * @param {string} otp - OTP code
   * @param {string} name - Recipient name
   * @returns {Promise<Object>} Send result
   */
  async sendOTPEmail(email, otp, name = 'User') {
    const subject = `Your OTP for ${orgConfig.erpTitle}`;
    const html = this.getOTPTemplate(name, otp);
    const text = `Dear ${name}, your OTP for ${orgConfig.erpTitle} is ${otp}. Valid for 10 minutes. Do not share with anyone.`;

    return await this.sendEmail({
      to: email,
      subject,
      text,
      html
    });
  }

  /**
   * Send welcome email
   * @param {string} email - Recipient email
   * @param {string} name - Recipient name
   * @param {Object} userData - User data
   * @returns {Promise<Object>} Send result
   */
  async sendWelcomeEmail(email, name, userData = {}) {
    const subject = `Welcome to ${orgConfig.erpTitle}`;
    const html = this.getWelcomeTemplate(name, userData);
    const text = `Welcome to ${orgConfig.erpTitle}, ${name}! Your account has been created successfully.`;

    return await this.sendEmail({
      to: email,
      subject,
      text,
      html
    });
  }

  /**
   * Send application status email
   * @param {string} email - Recipient email
   * @param {string} name - Recipient name
   * @param {Object} applicationData - Application data
   * @returns {Promise<Object>} Send result
   */
  async sendApplicationStatusEmail(email, name, applicationData) {
    const { status, applicationNumber, amount, reason } = applicationData;

    let subject, html, text;

    switch (status) {
      case 'submitted':
        subject = 'Application Submitted Successfully';
        html = this.getApplicationSubmittedTemplate(name, applicationData);
        text = `Dear ${name}, your application ${applicationNumber} has been submitted successfully.`;
        break;

      case 'approved':
        subject = 'Application Approved - Congratulations!';
        html = this.getApplicationApprovedTemplate(name, applicationData);
        text = `Congratulations ${name}! Your application ${applicationNumber} has been approved for ₹${amount}.`;
        break;

      case 'rejected':
        subject = 'Application Status Update';
        html = this.getApplicationRejectedTemplate(name, applicationData);
        text = `Dear ${name}, your application ${applicationNumber} has been rejected. Reason: ${reason}`;
        break;

      default:
        subject = 'Application Status Update';
        html = this.getGenericStatusTemplate(name, applicationData);
        text = `Dear ${name}, your application ${applicationNumber} status has been updated to ${status}.`;
    }

    return await this.sendEmail({
      to: email,
      subject,
      text,
      html
    });
  }

  /**
   * Send payment notification email
   * @param {string} email - Recipient email
   * @param {string} name - Recipient name
   * @param {Object} paymentData - Payment data
   * @returns {Promise<Object>} Send result
   */
  async sendPaymentNotificationEmail(email, name, paymentData) {
    const subject = 'Payment Processed Successfully';
    const html = this.getPaymentTemplate(name, paymentData);
    const text = `Dear ${name}, payment of ₹${paymentData.amount} has been processed to your account.`;

    return await this.sendEmail({
      to: email,
      subject,
      text,
      html
    });
  }

  /**
   * Get OTP email template
   * @param {string} name - Recipient name
   * @param {string} otp - OTP code
   * @returns {string} HTML template
   */
  getOTPTemplate(name, otp) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>OTP Verification</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px 20px; background: #f9fafb; }
            .otp-box { background: white; border: 2px solid #2563eb; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
            .otp-code { font-size: 32px; font-weight: bold; color: #2563eb; letter-spacing: 5px; }
            .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
            .warning { background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>${orgConfig.erpTitle}</h1>
                <p>OTP Verification</p>
            </div>
            
            <div class="content">
                <h2>Hello ${name},</h2>
                <p>You have requested an OTP for verification. Please use the following code:</p>
                
                <div class="otp-box">
                    <div class="otp-code">${otp}</div>
                    <p><strong>Valid for 10 minutes</strong></p>
                </div>
                
                <div class="warning">
                    <strong>Security Notice:</strong> Do not share this OTP with anyone. Our team will never ask for your OTP over phone or email.
                </div>
                
                <p>If you didn't request this OTP, please ignore this email or contact our support team.</p>
            </div>
            
            <div class="footer">
                <p>${orgConfig.copyrightText}</p>
                <p>This is an automated email. Please do not reply to this message.</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  /**
   * Get welcome email template
   * @param {string} name - Recipient name
   * @param {Object} userData - User data
   * @returns {string} HTML template
   */
  getWelcomeTemplate(name, userData) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to ${orgConfig.erpTitle}</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #059669; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px 20px; background: #f0fdf4; }
            .welcome-box { background: white; padding: 25px; border-radius: 8px; margin: 20px 0; }
            .button { display: inline-block; background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 15px 0; }
            .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Welcome to ${orgConfig.erpTitle}</h1>
                <p>Your account has been created successfully</p>
            </div>
            
            <div class="content">
                <div class="welcome-box">
                    <h2>Hello ${name}!</h2>
                    <p>Welcome to ${orgConfig.erpTitle} - ${orgConfig.welcomeEmailText}.</p>
                    
                    <p><strong>Your Account Details:</strong></p>
                    <ul>
                        <li>Name: ${name}</li>
                        <li>Role: ${userData.role || 'Beneficiary'}</li>
                        <li>Phone: ${userData.phone || 'Not provided'}</li>
                    </ul>
                    
                    <p>You can now:</p>
                    <ul>
                        <li>Submit applications for various schemes</li>
                        <li>Track your application status</li>
                        <li>Receive real-time notifications</li>
                        <li>Access your dashboard</li>
                    </ul>
                    
                    <div style="text-align: center;">
                        <a href="${config.FRONTEND_URL}/login" class="button">Login to Your Account</a>
                    </div>
                </div>
            </div>
            
            <div class="footer">
                <p>${orgConfig.copyrightText}</p>
                <p>Need help? Contact our support team at ${orgConfig.supportEmail}</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  /**
   * Get application approved template
   * @param {string} name - Recipient name
   * @param {Object} applicationData - Application data
   * @returns {string} HTML template
   */
  getApplicationApprovedTemplate(name, applicationData) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Application Approved</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #059669; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px 20px; background: #f0fdf4; }
            .approval-box { background: white; padding: 25px; border-radius: 8px; margin: 20px 0; border-left: 5px solid #059669; }
            .amount { font-size: 24px; font-weight: bold; color: #059669; text-align: center; margin: 15px 0; }
            .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🎉 Congratulations!</h1>
                <p>Your Application has been Approved</p>
            </div>
            
            <div class="content">
                <div class="approval-box">
                    <h2>Dear ${name},</h2>
                    <p>We are pleased to inform you that your application has been <strong>approved</strong>!</p>
                    
                    <p><strong>Application Details:</strong></p>
                    <ul>
                        <li>Application Number: <strong>${applicationData.applicationNumber}</strong></li>
                        <li>Scheme: ${applicationData.schemeName || 'N/A'}</li>
                        <li>Approved Date: ${new Date().toLocaleDateString()}</li>
                    </ul>
                    
                    <div class="amount">
                        Approved Amount: ₹${applicationData.amount}
                    </div>
                    
                    <p><strong>Next Steps:</strong></p>
                    <ul>
                        <li>Your payment will be processed within 7-10 working days</li>
                        <li>You will receive SMS and email notifications about payment status</li>
                        <li>Funds will be transferred to your registered bank account</li>
                    </ul>
                    
                    <p>Thank you for choosing ${orgConfig.erpTitle}. We are committed to serving you better.</p>
                </div>
            </div>
            
            <div class="footer">
                <p>${orgConfig.copyrightText}</p>
                <p>For queries, contact us at ${orgConfig.supportEmail}</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  /**
   * Get payment notification template
   * @param {string} name - Recipient name
   * @param {Object} paymentData - Payment data
   * @returns {string} HTML template
   */
  getPaymentTemplate(name, paymentData) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Processed</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px 20px; background: #eff6ff; }
            .payment-box { background: white; padding: 25px; border-radius: 8px; margin: 20px 0; border-left: 5px solid #2563eb; }
            .amount { font-size: 24px; font-weight: bold; color: #2563eb; text-align: center; margin: 15px 0; }
            .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>💰 Payment Processed</h1>
                <p>Your payment has been successfully processed</p>
            </div>
            
            <div class="content">
                <div class="payment-box">
                    <h2>Dear ${name},</h2>
                    <p>Your payment has been successfully processed and transferred to your bank account.</p>
                    
                    <div class="amount">
                        Amount: ₹${paymentData.amount}
                    </div>
                    
                    <p><strong>Payment Details:</strong></p>
                    <ul>
                        <li>Payment ID: <strong>${paymentData.paymentNumber}</strong></li>
                        <li>Application Number: ${paymentData.applicationNumber}</li>
                        <li>Transaction Date: ${new Date().toLocaleDateString()}</li>
                        <li>Bank Account: ****${paymentData.accountNumber?.slice(-4) || 'XXXX'}</li>
                        <li>Payment Method: ${paymentData.method || 'Bank Transfer'}</li>
                    </ul>
                    
                    <p>The amount should reflect in your bank account within 24-48 hours. If you don't receive the amount within this timeframe, please contact our support team.</p>
                    
                    <p>Thank you for using ${orgConfig.erpTitle} services.</p>
                </div>
            </div>
            
            <div class="footer">
                <p>${orgConfig.copyrightText}</p>
                <p>For payment queries, contact us at ${orgConfig.paymentsEmail}</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  /**
   * Get application submitted template
   * @param {string} name - Recipient name
   * @param {Object} applicationData - Application data
   * @returns {string} HTML template
   */
  getApplicationSubmittedTemplate(name, applicationData) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Application Submitted</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #0891b2; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px 20px; background: #f0f9ff; }
            .info-box { background: white; padding: 25px; border-radius: 8px; margin: 20px 0; }
            .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>✅ Application Submitted</h1>
                <p>Your application has been received successfully</p>
            </div>
            
            <div class="content">
                <div class="info-box">
                    <h2>Dear ${name},</h2>
                    <p>Thank you for submitting your application. We have received it successfully and it is now under review.</p>
                    
                    <p><strong>Application Details:</strong></p>
                    <ul>
                        <li>Application Number: <strong>${applicationData.applicationNumber}</strong></li>
                        <li>Scheme: ${applicationData.schemeName || 'N/A'}</li>
                        <li>Submitted Date: ${new Date().toLocaleDateString()}</li>
                        <li>Status: Under Review</li>
                    </ul>
                    
                    <p><strong>What happens next?</strong></p>
                    <ol>
                        <li>Initial review by our team (2-3 working days)</li>
                        <li>Field verification (if required)</li>
                        <li>Final approval process</li>
                        <li>Payment processing (if approved)</li>
                    </ol>
                    
                    <p>You will receive regular updates about your application status via SMS and email. You can also track your application status by logging into your account.</p>
                </div>
            </div>
            
            <div class="footer">
                <p>${orgConfig.copyrightText}</p>
                <p>Track your application at ${config.FRONTEND_URL}/applications</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  /**
   * Get application rejected template
   * @param {string} name - Recipient name
   * @param {Object} applicationData - Application data
   * @returns {string} HTML template
   */
  getApplicationRejectedTemplate(name, applicationData) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Application Status Update</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px 20px; background: #fef2f2; }
            .info-box { background: white; padding: 25px; border-radius: 8px; margin: 20px 0; border-left: 5px solid #dc2626; }
            .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Application Status Update</h1>
                <p>Important information about your application</p>
            </div>
            
            <div class="content">
                <div class="info-box">
                    <h2>Dear ${name},</h2>
                    <p>We regret to inform you that your application could not be approved at this time.</p>
                    
                    <p><strong>Application Details:</strong></p>
                    <ul>
                        <li>Application Number: <strong>${applicationData.applicationNumber}</strong></li>
                        <li>Scheme: ${applicationData.schemeName || 'N/A'}</li>
                        <li>Review Date: ${new Date().toLocaleDateString()}</li>
                    </ul>
                    
                    <p><strong>Reason for rejection:</strong></p>
                    <p style="background: #fee2e2; padding: 15px; border-radius: 6px;">${applicationData.reason || 'Please contact our support team for detailed information.'}</p>
                    
                    <p><strong>Next Steps:</strong></p>
                    <ul>
                        <li>Review the rejection reason carefully</li>
                        <li>Address the mentioned issues</li>
                        <li>You may reapply after resolving the concerns</li>
                        <li>Contact our support team for guidance</li>
                    </ul>
                    
                    <p>We encourage you to address the mentioned issues and reapply. Our team is here to help you through the process.</p>
                </div>
            </div>
            
            <div class="footer">
                <p>${orgConfig.copyrightText}</p>
                <p>Need assistance? Contact us at ${orgConfig.supportEmail}</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  /**
   * Get generic status template
   * @param {string} name - Recipient name
   * @param {Object} applicationData - Application data
   * @returns {string} HTML template
   */
  getGenericStatusTemplate(name, applicationData) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Application Status Update</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #6366f1; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px 20px; background: #f8fafc; }
            .info-box { background: white; padding: 25px; border-radius: 8px; margin: 20px 0; }
            .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Application Status Update</h1>
                <p>Your application status has been updated</p>
            </div>
            
            <div class="content">
                <div class="info-box">
                    <h2>Dear ${name},</h2>
                    <p>This is to inform you that your application status has been updated.</p>
                    
                    <p><strong>Application Details:</strong></p>
                    <ul>
                        <li>Application Number: <strong>${applicationData.applicationNumber}</strong></li>
                        <li>Current Status: <strong>${applicationData.status}</strong></li>
                        <li>Updated Date: ${new Date().toLocaleDateString()}</li>
                    </ul>
                    
                    <p>You can log into your account to view detailed information about your application and track its progress.</p>
                </div>
            </div>
            
            <div class="footer">
                <p>${orgConfig.copyrightText}</p>
                <p>Login to your account at ${config.FRONTEND_URL}/login</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  /**
   * Test email service
   * @returns {Promise<Object>} Test result
   */
  async testConnection() {
    try {
      if (!this.transporter) {
        throw new Error('Email transporter not initialized');
      }

      await this.transporter.verify();

      return {
        success: true,
        message: 'Email service is working correctly',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        message: 'Email service connection failed',
        error: error.message
      };
    }
  }
}

module.exports = new EmailService();