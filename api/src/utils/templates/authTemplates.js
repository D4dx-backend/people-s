/**
 * Authentication SMS Templates
 */
class AuthTemplates {
  static getTemplates() {
    return {
      otp_login: {
        template: "Dear {name}, your OTP for People's Foundation ERP login is {otp}. Valid for {validity}. Do not share with anyone. - PFERP",
        variables: ['name', 'otp', 'validity'],
        category: 'transactional',
        dltTemplateId: 'DLT_TEMPLATE_OTP_LOGIN'
      },
      
      otp_registration: {
        template: "Dear {name}, your OTP for People's Foundation ERP registration is {otp}. Valid for {validity}. Do not share with anyone. - PFERP",
        variables: ['name', 'otp', 'validity'],
        category: 'transactional',
        dltTemplateId: 'DLT_TEMPLATE_OTP_REG'
      },
      
      otp_password_reset: {
        template: 'Dear {name}, your OTP for password reset is {otp}. Valid for {validity}. Do not share with anyone. - BZKRLA',
        variables: ['name', 'otp', 'validity'],
        category: 'transactional',
        dltTemplateId: 'DLT_TEMPLATE_OTP_RESET'
      },
      
      welcome_user: {
        template: "Welcome to People's Foundation ERP, {name}! Your account has been created successfully. Login with your registered mobile number. - PFERP",
        variables: ['name'],
        category: 'promotional',
        dltTemplateId: 'DLT_TEMPLATE_WELCOME'
      },
      
      account_activated: {
        template: "Dear {name}, your People's Foundation ERP account has been activated successfully. You can now access all services. - PFERP",
        variables: ['name'],
        category: 'transactional',
        dltTemplateId: 'DLT_TEMPLATE_ACTIVATED'
      },
      
      account_deactivated: {
        template: "Dear {name}, your People's Foundation ERP account has been deactivated. Reason: {reason}. Contact support for assistance. - PFERP",
        variables: ['name', 'reason'],
        category: 'transactional',
        dltTemplateId: 'DLT_TEMPLATE_DEACTIVATED'
      }
    };
  }
}

module.exports = AuthTemplates;