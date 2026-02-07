/**
 * System SMS Templates
 */
class SystemTemplates {
  static getTemplates() {
    return {
      system_maintenance: {
        template: "Dear {name}, People's Foundation ERP system will be under maintenance from {startTime} to {endTime} on {date}. - PFERP",
        variables: ['name', 'startTime', 'endTime', 'date'],
        category: 'transactional',
        dltTemplateId: 'DLT_TEMPLATE_MAINTENANCE'
      },
      
      new_scheme_announcement: {
        template: 'Dear {name}, new scheme "{schemeName}" is now available. Check eligibility and apply online. - BZKRLA',
        variables: ['name', 'schemeName'],
        category: 'promotional',
        dltTemplateId: 'DLT_TEMPLATE_NEW_SCHEME'
      },
      
      policy_update: {
        template: "Dear {name}, important policy updates have been made to People's Foundation ERP services. Please review online. - PFERP",
        variables: ['name'],
        category: 'transactional',
        dltTemplateId: 'DLT_TEMPLATE_POLICY_UPDATE'
      },
      
      security_alert: {
        template: 'Security Alert: Dear {name}, suspicious activity detected on your account. If not you, please contact support immediately. - BZKRLA',
        variables: ['name'],
        category: 'transactional',
        dltTemplateId: 'DLT_TEMPLATE_SECURITY_ALERT'
      },
      
      emergency_alert: {
        template: 'EMERGENCY: Dear {name}, {alertMessage}. Please take immediate action. Contact: {contactNumber}. - BZKRLA',
        variables: ['name', 'alertMessage', 'contactNumber'],
        category: 'transactional',
        dltTemplateId: 'DLT_TEMPLATE_EMERGENCY'
      }
    };
  }
}

module.exports = SystemTemplates;