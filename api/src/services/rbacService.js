const { Role, Permission, UserRole, User } = require('../models');

class RBACService {
  /**
   * Initialize RBAC system with default roles and permissions
   */
  async initializeRBAC() {
    try {
      console.log('🔐 Initializing RBAC system...');
      
      // Create system permissions first
      await this.createSystemPermissions();
      
      // Create system roles
      await this.createSystemRoles();
      
      console.log('✅ RBAC system initialized successfully');
    } catch (error) {
      console.error('❌ RBAC initialization failed:', error);
      throw error;
    }
  }

  /**
   * Create all system permissions
   */
  async createSystemPermissions() {
    const systemPermissions = [
      // User Management Permissions
      {
        name: 'users.create',
        displayName: 'Create Users',
        description: 'Create new user accounts',
        module: 'users',
        category: 'create',
        resource: 'user',
        action: 'create',
        scope: 'regional',
        securityLevel: 'confidential'
      },
      {
        name: 'users.read.all',
        displayName: 'View All Users',
        description: 'View all user accounts in the system',
        module: 'users',
        category: 'read',
        resource: 'user',
        action: 'read',
        scope: 'global',
        securityLevel: 'internal'
      },
      {
        name: 'users.read.regional',
        displayName: 'View Regional Users',
        description: 'View users within assigned regions',
        module: 'users',
        category: 'read',
        resource: 'user',
        action: 'read',
        scope: 'regional',
        securityLevel: 'internal'
      },
      {
        name: 'users.read.own',
        displayName: 'View Own Profile',
        description: 'View own user profile',
        module: 'users',
        category: 'read',
        resource: 'user',
        action: 'read',
        scope: 'own',
        securityLevel: 'public'
      },
      {
        name: 'users.update.all',
        displayName: 'Update All Users',
        description: 'Update any user account',
        module: 'users',
        category: 'update',
        resource: 'user',
        action: 'update',
        scope: 'global',
        securityLevel: 'restricted'
      },
      {
        name: 'users.update.regional',
        displayName: 'Update Regional Users',
        description: 'Update users within assigned regions',
        module: 'users',
        category: 'update',
        resource: 'user',
        action: 'update',
        scope: 'regional',
        securityLevel: 'confidential'
      },
      {
        name: 'users.update.own',
        displayName: 'Update Own Profile',
        description: 'Update own user profile',
        module: 'users',
        category: 'update',
        resource: 'user',
        action: 'update',
        scope: 'own',
        securityLevel: 'public'
      },
      {
        name: 'users.delete',
        displayName: 'Delete Users',
        description: 'Delete user accounts',
        module: 'users',
        category: 'delete',
        resource: 'user',
        action: 'delete',
        scope: 'regional',
        securityLevel: 'restricted',
        auditRequired: true
      },

      // Role Management Permissions
      {
        name: 'roles.create',
        displayName: 'Create Roles',
        description: 'Create new custom roles',
        module: 'roles',
        category: 'create',
        resource: 'role',
        action: 'create',
        scope: 'global',
        securityLevel: 'restricted'
      },
      {
        name: 'roles.read',
        displayName: 'View Roles',
        description: 'View role definitions',
        module: 'roles',
        category: 'read',
        resource: 'role',
        action: 'read',
        scope: 'global',
        securityLevel: 'internal'
      },
      {
        name: 'roles.update',
        displayName: 'Update Roles',
        description: 'Modify role definitions',
        module: 'roles',
        category: 'update',
        resource: 'role',
        action: 'update',
        scope: 'global',
        securityLevel: 'restricted'
      },
      {
        name: 'roles.delete',
        displayName: 'Delete Roles',
        description: 'Delete custom roles',
        module: 'roles',
        category: 'delete',
        resource: 'role',
        action: 'delete',
        scope: 'global',
        securityLevel: 'restricted',
        auditRequired: true
      },
      {
        name: 'roles.assign',
        displayName: 'Assign Roles',
        description: 'Assign roles to users',
        module: 'roles',
        category: 'manage',
        resource: 'role',
        action: 'assign',
        scope: 'regional',
        securityLevel: 'confidential'
      },

      // Permission Management
      {
        name: 'permissions.read',
        displayName: 'View Permissions',
        description: 'View permission definitions',
        module: 'permissions',
        category: 'read',
        resource: 'permission',
        action: 'read',
        scope: 'global',
        securityLevel: 'internal'
      },
      {
        name: 'permissions.manage',
        displayName: 'Manage Permissions',
        description: 'Create, update, and delete permissions',
        module: 'permissions',
        category: 'manage',
        resource: 'permission',
        action: 'manage',
        scope: 'global',
        securityLevel: 'top_secret'
      },

      // Beneficiary Management
      {
        name: 'beneficiaries.create',
        displayName: 'Create Beneficiaries',
        description: 'Register new beneficiaries',
        module: 'beneficiaries',
        category: 'create',
        resource: 'beneficiary',
        action: 'create',
        scope: 'regional',
        securityLevel: 'internal'
      },
      {
        name: 'beneficiaries.read.all',
        displayName: 'View All Beneficiaries',
        description: 'View all beneficiary records',
        module: 'beneficiaries',
        category: 'read',
        resource: 'beneficiary',
        action: 'read',
        scope: 'global',
        securityLevel: 'confidential'
      },
      {
        name: 'beneficiaries.read.regional',
        displayName: 'View Regional Beneficiaries',
        description: 'View beneficiaries within assigned regions',
        module: 'beneficiaries',
        category: 'read',
        resource: 'beneficiary',
        action: 'read',
        scope: 'regional',
        securityLevel: 'internal'
      },
      {
        name: 'beneficiaries.read.own',
        displayName: 'View Own Profile',
        description: 'View own beneficiary profile',
        module: 'beneficiaries',
        category: 'read',
        resource: 'beneficiary',
        action: 'read',
        scope: 'own',
        securityLevel: 'public'
      },
      {
        name: 'beneficiaries.update.regional',
        displayName: 'Update Regional Beneficiaries',
        description: 'Update beneficiary records within assigned regions',
        module: 'beneficiaries',
        category: 'update',
        resource: 'beneficiary',
        action: 'update',
        scope: 'regional',
        securityLevel: 'internal'
      },
      {
        name: 'beneficiaries.update.own',
        displayName: 'Update Own Profile',
        description: 'Update own beneficiary profile',
        module: 'beneficiaries',
        category: 'update',
        resource: 'beneficiary',
        action: 'update',
        scope: 'own',
        securityLevel: 'public'
      },

      // Application Management
      {
        name: 'applications.create',
        displayName: 'Create Applications',
        description: 'Submit new applications',
        module: 'applications',
        category: 'create',
        resource: 'application',
        action: 'create',
        scope: 'own',
        securityLevel: 'internal'
      },
      {
        name: 'applications.read.all',
        displayName: 'View All Applications',
        description: 'View all applications in the system',
        module: 'applications',
        category: 'read',
        resource: 'application',
        action: 'read',
        scope: 'global',
        securityLevel: 'confidential'
      },
      {
        name: 'applications.read.regional',
        displayName: 'View Regional Applications',
        description: 'View applications within assigned regions',
        module: 'applications',
        category: 'read',
        resource: 'application',
        action: 'read',
        scope: 'regional',
        securityLevel: 'internal'
      },
      {
        name: 'applications.read.own',
        displayName: 'View Own Applications',
        description: 'View own submitted applications',
        module: 'applications',
        category: 'read',
        resource: 'application',
        action: 'read',
        scope: 'own',
        securityLevel: 'public'
      },
      {
        name: 'applications.update.regional',
        displayName: 'Update Regional Applications',
        description: 'Update applications within assigned regions',
        module: 'applications',
        category: 'update',
        resource: 'application',
        action: 'update',
        scope: 'regional',
        securityLevel: 'internal'
      },
      {
        name: 'applications.approve',
        displayName: 'Approve Applications',
        description: 'Approve or reject applications',
        module: 'applications',
        category: 'approve',
        resource: 'application',
        action: 'approve',
        scope: 'regional',
        securityLevel: 'confidential',
        auditRequired: true
      },

      // Project Management
      {
        name: 'projects.create',
        displayName: 'Create Projects',
        description: 'Create new projects',
        module: 'projects',
        category: 'create',
        resource: 'project',
        action: 'create',
        scope: 'global',
        securityLevel: 'confidential'
      },
      {
        name: 'projects.read.all',
        displayName: 'View All Projects',
        description: 'View all projects',
        module: 'projects',
        category: 'read',
        resource: 'project',
        action: 'read',
        scope: 'global',
        securityLevel: 'internal'
      },
      {
        name: 'projects.read.assigned',
        displayName: 'View Assigned Projects',
        description: 'View assigned projects only',
        module: 'projects',
        category: 'read',
        resource: 'project',
        action: 'read',
        scope: 'project',
        securityLevel: 'internal'
      },
      {
        name: 'projects.update.all',
        displayName: 'Update All Projects',
        description: 'Update any project',
        module: 'projects',
        category: 'update',
        resource: 'project',
        action: 'update',
        scope: 'global',
        securityLevel: 'confidential'
      },
      {
        name: 'projects.update.assigned',
        displayName: 'Update Assigned Projects',
        description: 'Update assigned projects only',
        module: 'projects',
        category: 'update',
        resource: 'project',
        action: 'update',
        scope: 'project',
        securityLevel: 'internal'
      },
      {
        name: 'projects.manage',
        displayName: 'Manage Projects',
        description: 'Full project management capabilities',
        module: 'projects',
        category: 'manage',
        resource: 'project',
        action: 'manage',
        scope: 'global',
        securityLevel: 'restricted'
      },

      // Scheme Management
      {
        name: 'schemes.create',
        displayName: 'Create Schemes',
        description: 'Create new schemes',
        module: 'schemes',
        category: 'create',
        resource: 'scheme',
        action: 'create',
        scope: 'global',
        securityLevel: 'confidential'
      },
      {
        name: 'schemes.read.all',
        displayName: 'View All Schemes',
        description: 'View all schemes',
        module: 'schemes',
        category: 'read',
        resource: 'scheme',
        action: 'read',
        scope: 'global',
        securityLevel: 'internal'
      },
      {
        name: 'schemes.read.assigned',
        displayName: 'View Assigned Schemes',
        description: 'View assigned schemes only',
        module: 'schemes',
        category: 'read',
        resource: 'scheme',
        action: 'read',
        scope: 'scheme',
        securityLevel: 'internal'
      },
      {
        name: 'schemes.update.assigned',
        displayName: 'Update Assigned Schemes',
        description: 'Update assigned schemes only',
        module: 'schemes',
        category: 'update',
        resource: 'scheme',
        action: 'update',
        scope: 'scheme',
        securityLevel: 'internal'
      },
      {
        name: 'schemes.manage',
        displayName: 'Manage Schemes',
        description: 'Full scheme management capabilities',
        module: 'schemes',
        category: 'manage',
        resource: 'scheme',
        action: 'manage',
        scope: 'global',
        securityLevel: 'restricted'
      },

      // Reports and Analytics
      // Basic Reports CRUD
      {
        name: 'reports.read',
        displayName: 'View Reports',
        description: 'View application reports',
        module: 'reports',
        category: 'read',
        resource: 'report',
        action: 'read',
        scope: 'regional',
        securityLevel: 'internal'
      },
      {
        name: 'reports.create',
        displayName: 'Create Reports',
        description: 'Create new application reports',
        module: 'reports',
        category: 'create',
        resource: 'report',
        action: 'create',
        scope: 'regional',
        securityLevel: 'internal'
      },
      {
        name: 'reports.update',
        displayName: 'Update Reports',
        description: 'Update existing reports',
        module: 'reports',
        category: 'update',
        resource: 'report',
        action: 'update',
        scope: 'regional',
        securityLevel: 'internal'
      },
      {
        name: 'reports.delete',
        displayName: 'Delete Reports',
        description: 'Delete reports',
        module: 'reports',
        category: 'delete',
        resource: 'report',
        action: 'delete',
        scope: 'regional',
        securityLevel: 'internal'
      },
      {
        name: 'reports.read.all',
        displayName: 'View All Reports',
        description: 'Access all system reports',
        module: 'reports',
        category: 'read',
        resource: 'report',
        action: 'read',
        scope: 'global',
        securityLevel: 'confidential'
      },
      {
        name: 'reports.read.regional',
        displayName: 'View Regional Reports',
        description: 'Access regional reports',
        module: 'reports',
        category: 'read',
        resource: 'report',
        action: 'read',
        scope: 'regional',
        securityLevel: 'internal'
      },
      {
        name: 'reports.export',
        displayName: 'Export Reports',
        description: 'Export reports to various formats',
        module: 'reports',
        category: 'export',
        resource: 'report',
        action: 'export',
        scope: 'regional',
        securityLevel: 'confidential',
        auditRequired: true
      },

      // Financial Management
      {
        name: 'finances.read.all',
        displayName: 'View All Financial Data',
        description: 'Access all financial information',
        module: 'finances',
        category: 'read',
        resource: 'finance',
        action: 'read',
        scope: 'global',
        securityLevel: 'restricted'
      },
      {
        name: 'finances.read.regional',
        displayName: 'View Regional Financial Data',
        description: 'Access regional financial information',
        module: 'finances',
        category: 'read',
        resource: 'finance',
        action: 'read',
        scope: 'regional',
        securityLevel: 'confidential'
      },
      {
        name: 'finances.manage',
        displayName: 'Manage Finances',
        description: 'Full financial management capabilities',
        module: 'finances',
        category: 'manage',
        resource: 'finance',
        action: 'manage',
        scope: 'global',
        securityLevel: 'top_secret',
        auditRequired: true
      },

      // Donor Management
      {
        name: 'donors.create',
        displayName: 'Create Donors',
        description: 'Register new donors',
        module: 'donors',
        category: 'create',
        resource: 'donor',
        action: 'create',
        scope: 'regional',
        securityLevel: 'internal'
      },
      {
        name: 'donors.read',
        displayName: 'View Donors',
        description: 'View donor information',
        module: 'donors',
        category: 'read',
        resource: 'donor',
        action: 'read',
        scope: 'regional',
        securityLevel: 'internal'
      },
      {
        name: 'donors.read.regional',
        displayName: 'View Regional Donors',
        description: 'View donors within assigned regions',
        module: 'donors',
        category: 'read',
        resource: 'donor',
        action: 'read',
        scope: 'regional',
        securityLevel: 'internal'
      },
      {
        name: 'donors.read.all',
        displayName: 'View All Donors',
        description: 'View all donor records',
        module: 'donors',
        category: 'read',
        resource: 'donor',
        action: 'read',
        scope: 'global',
        securityLevel: 'confidential'
      },
      {
        name: 'donors.update.regional',
        displayName: 'Update Regional Donors',
        description: 'Update donor records within assigned regions',
        module: 'donors',
        category: 'update',
        resource: 'donor',
        action: 'update',
        scope: 'regional',
        securityLevel: 'internal'
      },
      {
        name: 'donors.delete',
        displayName: 'Delete Donors',
        description: 'Delete donor records',
        module: 'donors',
        category: 'delete',
        resource: 'donor',
        action: 'delete',
        scope: 'regional',
        securityLevel: 'confidential',
        auditRequired: true
      },
      {
        name: 'donors.verify',
        displayName: 'Verify Donors',
        description: 'Verify donor information',
        module: 'donors',
        category: 'verify',
        resource: 'donor',
        action: 'verify',
        scope: 'regional',
        securityLevel: 'confidential',
        auditRequired: true
      },



      // Communication Management
      {
        name: 'communications.send',
        displayName: 'Send Communications',
        description: 'Send communications to donors and beneficiaries',
        module: 'communications',
        category: 'send',
        resource: 'communication',
        action: 'send',
        scope: 'regional',
        securityLevel: 'internal',
        auditRequired: true
      },

      // System Administration
      {
        name: 'settings.read',
        displayName: 'View System Settings',
        description: 'View system configuration',
        module: 'settings',
        category: 'read',
        resource: 'setting',
        action: 'read',
        scope: 'global',
        securityLevel: 'internal'
      },
      {
        name: 'settings.update',
        displayName: 'Update System Settings',
        description: 'Modify system configuration',
        module: 'settings',
        category: 'update',
        resource: 'setting',
        action: 'update',
        scope: 'global',
        securityLevel: 'top_secret',
        auditRequired: true
      },
      {
        name: 'audit.read',
        displayName: 'View Audit Logs',
        description: 'Access system audit logs',
        module: 'audit',
        category: 'read',
        resource: 'audit',
        action: 'read',
        scope: 'global',
        securityLevel: 'restricted',
        auditRequired: true
      },

      // Form Builder Permissions
      {
        name: 'forms.create',
        displayName: 'Create Forms',
        description: 'Create new dynamic forms',
        module: 'forms',
        category: 'create',
        resource: 'form',
        action: 'create',
        scope: 'global',
        securityLevel: 'confidential'
      },
      {
        name: 'forms.read',
        displayName: 'View Forms',
        description: 'View form configurations',
        module: 'forms',
        category: 'read',
        resource: 'form',
        action: 'read',
        scope: 'global',
        securityLevel: 'internal'
      },
      {
        name: 'forms.update',
        displayName: 'Update Forms',
        description: 'Modify form configurations',
        module: 'forms',
        category: 'update',
        resource: 'form',
        action: 'update',
        scope: 'global',
        securityLevel: 'confidential'
      },
      {
        name: 'forms.delete',
        displayName: 'Delete Forms',
        description: 'Delete form configurations',
        module: 'forms',
        category: 'delete',
        resource: 'form',
        action: 'delete',
        scope: 'global',
        securityLevel: 'restricted',
        auditRequired: true
      },
      {
        name: 'forms.manage',
        displayName: 'Manage Forms',
        description: 'Full form management capabilities',
        module: 'forms',
        category: 'manage',
        resource: 'form',
        action: 'manage',
        scope: 'global',
        securityLevel: 'restricted'
      },

      // Location Management
      {
        name: 'locations.create',
        displayName: 'Create Locations',
        description: 'Create new location entries',
        module: 'locations',
        category: 'create',
        resource: 'location',
        action: 'create',
        scope: 'global',
        securityLevel: 'internal'
      },
      {
        name: 'locations.read',
        displayName: 'View Locations',
        description: 'View location data',
        module: 'locations',
        category: 'read',
        resource: 'location',
        action: 'read',
        scope: 'global',
        securityLevel: 'public'
      },
      {
        name: 'locations.update',
        displayName: 'Update Locations',
        description: 'Modify location data',
        module: 'locations',
        category: 'update',
        resource: 'location',
        action: 'update',
        scope: 'global',
        securityLevel: 'internal'
      },
      {
        name: 'locations.delete',
        displayName: 'Delete Locations',
        description: 'Delete location entries',
        module: 'locations',
        category: 'delete',
        resource: 'location',
        action: 'delete',
        scope: 'global',
        securityLevel: 'confidential',
        auditRequired: true
      },

      // Dashboard and Analytics
      {
        name: 'dashboard.read.all',
        displayName: 'View All Dashboard Data',
        description: 'Access comprehensive dashboard analytics',
        module: 'dashboard',
        category: 'read',
        resource: 'dashboard',
        action: 'read',
        scope: 'global',
        securityLevel: 'internal'
      },
      {
        name: 'dashboard.read.regional',
        displayName: 'View Regional Dashboard',
        description: 'Access regional dashboard data',
        module: 'dashboard',
        category: 'read',
        resource: 'dashboard',
        action: 'read',
        scope: 'regional',
        securityLevel: 'internal'
      },

      // System Debugging and Monitoring
      {
        name: 'system.debug',
        displayName: 'System Debugging',
        description: 'Access system debugging tools',
        module: 'system',
        category: 'debug',
        resource: 'system',
        action: 'debug',
        scope: 'global',
        securityLevel: 'top_secret'
      },
      {
        name: 'system.monitor',
        displayName: 'System Monitoring',
        description: 'Monitor system performance and health',
        module: 'system',
        category: 'monitor',
        resource: 'system',
        action: 'monitor',
        scope: 'global',
        securityLevel: 'restricted'
      },

      // Document Management
      {
        name: 'documents.create',
        displayName: 'Create Documents',
        description: 'Upload and create documents',
        module: 'documents',
        category: 'create',
        resource: 'document',
        action: 'create',
        scope: 'regional',
        securityLevel: 'internal'
      },
      {
        name: 'documents.read.all',
        displayName: 'View All Documents',
        description: 'Access all documents in the system',
        module: 'documents',
        category: 'read',
        resource: 'document',
        action: 'read',
        scope: 'global',
        securityLevel: 'confidential'
      },
      {
        name: 'documents.read.regional',
        displayName: 'View Regional Documents',
        description: 'Access documents within assigned regions',
        module: 'documents',
        category: 'read',
        resource: 'document',
        action: 'read',
        scope: 'regional',
        securityLevel: 'internal'
      },
      {
        name: 'documents.update',
        displayName: 'Update Documents',
        description: 'Modify document metadata and content',
        module: 'documents',
        category: 'update',
        resource: 'document',
        action: 'update',
        scope: 'regional',
        securityLevel: 'internal'
      },
      {
        name: 'documents.delete',
        displayName: 'Delete Documents',
        description: 'Remove documents from the system',
        module: 'documents',
        category: 'delete',
        resource: 'document',
        action: 'delete',
        scope: 'regional',
        securityLevel: 'confidential',
        auditRequired: true
      },

      // Interview Management
      {
        name: 'interviews.schedule',
        displayName: 'Schedule Interviews',
        description: 'Schedule beneficiary interviews',
        module: 'interviews',
        category: 'schedule',
        resource: 'interview',
        action: 'schedule',
        scope: 'regional',
        securityLevel: 'internal'
      },
      {
        name: 'interviews.read',
        displayName: 'View Interviews',
        description: 'View scheduled interviews',
        module: 'interviews',
        category: 'read',
        resource: 'interview',
        action: 'read',
        scope: 'regional',
        securityLevel: 'internal'
      },
      {
        name: 'interviews.update',
        displayName: 'Update Interviews',
        description: 'Modify interview schedules and details',
        module: 'interviews',
        category: 'update',
        resource: 'interview',
        action: 'update',
        scope: 'regional',
        securityLevel: 'internal'
      },
      {
        name: 'interviews.cancel',
        displayName: 'Cancel Interviews',
        description: 'Cancel scheduled interviews',
        module: 'interviews',
        category: 'cancel',
        resource: 'interview',
        action: 'cancel',
        scope: 'regional',
        securityLevel: 'internal',
        auditRequired: true
      },

      // Activity Log Permissions
      {
        name: 'activity_logs.read',
        displayName: 'View Activity Logs',
        description: 'View activity / audit logs',
        module: 'activity_logs',
        category: 'read',
        resource: 'activity_log',
        action: 'read',
        scope: 'global',
        securityLevel: 'internal'
      },
      {
        name: 'activity_logs.export',
        displayName: 'Export Activity Logs',
        description: 'Export activity logs as CSV / JSON',
        module: 'activity_logs',
        category: 'export',
        resource: 'activity_log',
        action: 'export',
        scope: 'global',
        securityLevel: 'internal'
      },

      // Login Log Permissions
      {
        name: 'login_logs.read',
        displayName: 'View Login Logs',
        description: 'View login / authentication event logs',
        module: 'login_logs',
        category: 'read',
        resource: 'login_log',
        action: 'read',
        scope: 'global',
        securityLevel: 'confidential'
      },
      {
        name: 'login_logs.export',
        displayName: 'Export Login Logs',
        description: 'Export login logs as CSV / JSON',
        module: 'login_logs',
        category: 'export',
        resource: 'login_log',
        action: 'export',
        scope: 'global',
        securityLevel: 'confidential'
      },
      {
        name: 'login_logs.delete',
        displayName: 'Delete Login Logs',
        description: 'Clean up old login logs',
        module: 'login_logs',
        category: 'delete',
        resource: 'login_log',
        action: 'delete',
        scope: 'global',
        securityLevel: 'confidential'
      },

      // Error Log Permissions
      {
        name: 'error_logs.read',
        displayName: 'View Error Logs',
        description: 'View application error logs',
        module: 'error_logs',
        category: 'read',
        resource: 'error_log',
        action: 'read',
        scope: 'global',
        securityLevel: 'internal'
      },
      {
        name: 'error_logs.manage',
        displayName: 'Manage Error Logs',
        description: 'Mark errors as resolved',
        module: 'error_logs',
        category: 'update',
        resource: 'error_log',
        action: 'update',
        scope: 'global',
        securityLevel: 'internal'
      },
      {
        name: 'error_logs.export',
        displayName: 'Export Error Logs',
        description: 'Export error logs as CSV / JSON',
        module: 'error_logs',
        category: 'export',
        resource: 'error_log',
        action: 'export',
        scope: 'global',
        securityLevel: 'internal'
      },
      {
        name: 'error_logs.delete',
        displayName: 'Delete Error Logs',
        description: 'Clean up old error logs',
        module: 'error_logs',
        category: 'delete',
        resource: 'error_log',
        action: 'delete',
        scope: 'global',
        securityLevel: 'internal'
      },

      // Website Management Permissions
      {
        name: 'website.read',
        displayName: 'View Website Settings',
        description: 'View website management pages and settings',
        module: 'website',
        category: 'read',
        resource: 'website',
        action: 'read',
        scope: 'global',
        securityLevel: 'internal'
      },
      {
        name: 'website.write',
        displayName: 'Edit Website Settings',
        description: 'Create and update website content, banners, news, brochures, and partners',
        module: 'website',
        category: 'update',
        resource: 'website',
        action: 'update',
        scope: 'global',
        securityLevel: 'confidential'
      },
      {
        name: 'website.delete',
        displayName: 'Delete Website Content',
        description: 'Delete website banners, news, brochures, and partners',
        module: 'website',
        category: 'delete',
        resource: 'website',
        action: 'delete',
        scope: 'global',
        securityLevel: 'confidential'
      }
    ];

    // Create permissions if they don't exist
    for (const permissionData of systemPermissions) {
      const existingPermission = await Permission.findOne({ name: permissionData.name });
      if (!existingPermission) {
        await Permission.createSystemPermission(permissionData);
        console.log(`✅ Created permission: ${permissionData.name}`);
      }
    }
  }

  /**
   * Create system roles with predefined permissions
   */
  async createSystemRoles() {
    const systemRoles = [
      {
        name: 'super_admin',
        displayName: 'Super Administrator',
        description: 'Full system access with all permissions',
        level: 0,
        category: 'admin',
        scopeConfig: {
          allowedScopeLevels: ['super', 'state', 'district', 'area', 'unit', 'project', 'scheme'],
          defaultScopeLevel: 'super',
          allowMultipleScopes: true,
          maxScopes: 999
        },
        constraints: {
          maxUsers: 5,
          requiresApproval: true,
          isDeletable: false,
          isModifiable: false
        },
        isDefault: false,
        permissions: [] // Will be populated with all permissions
      },
      {
        name: 'state_admin',
        displayName: 'State Administrator',
        description: 'State-level administrative access',
        level: 1,
        category: 'admin',
        scopeConfig: {
          allowedScopeLevels: ['state', 'district', 'area', 'unit'],
          defaultScopeLevel: 'state',
          allowMultipleScopes: false,
          maxScopes: 1
        },
        constraints: {
          maxUsers: 10,
          requiresApproval: true,
          isDeletable: false,
          isModifiable: true
        },
        permissions: [
          // User Management - Full Access
          'users.create', 'users.read.all', 'users.read.regional', 'users.read.own',
          'users.update.all', 'users.update.regional', 'users.update.own', 'users.delete',
          
          // Role and Permission Management
          'roles.create', 'roles.read', 'roles.update', 'roles.delete', 'roles.assign',
          'permissions.read', 'permissions.manage',
          
          // Beneficiary Management - Full Access
          'beneficiaries.create', 'beneficiaries.read.all', 'beneficiaries.read.regional', 'beneficiaries.read.own',
          'beneficiaries.update.regional', 'beneficiaries.update.own',
          
          // Application Management - Full Access
          'applications.create', 'applications.read.all', 'applications.read.regional', 'applications.read.own',
          'applications.update.regional', 'applications.approve',
          
          // Project Management - Full Access
          'projects.create', 'projects.read.all', 'projects.read.assigned',
          'projects.update.all', 'projects.update.assigned', 'projects.manage',
          
          // Scheme Management - Full Access
          'schemes.create', 'schemes.read.all', 'schemes.read.assigned',
          'schemes.update.assigned', 'schemes.manage',
          
          // Reports and Analytics - Full Access
          'reports.read', 'reports.create', 'reports.update', 'reports.delete',
          'reports.read.all', 'reports.read.regional', 'reports.export',
          
          // Financial Management - Full Access
          'finances.read.all', 'finances.read.regional', 'finances.manage',
          
          // Donor Management - Full Access
          'donors.create', 'donors.read', 'donors.read.all', 'donors.read.regional',
          'donors.update.regional', 'donors.delete', 'donors.verify',
          
          // Donation Management - Full Access
          'donations.create', 'donations.read.all', 'donations.read.regional', 'donations.update.regional',
          
          // Communication Management
          'communications.send',
          
          // System Administration
          'settings.read', 'settings.update',
          'audit.read',
          
          // Form Builder - Full Access
          'forms.create', 'forms.read', 'forms.update', 'forms.delete', 'forms.manage',
          
          // Location Management - Full Access
          'locations.create', 'locations.read', 'locations.update', 'locations.delete',
          
          // Dashboard Access
          'dashboard.read.all', 'dashboard.read.regional',
          
          // System Monitoring
          'system.debug', 'system.monitor',
          
          // Document Management - Full Access
          'documents.create', 'documents.read.all', 'documents.read.regional',
          'documents.update', 'documents.delete',
          
          // Interview Management - Full Access
          'interviews.schedule', 'interviews.read', 'interviews.update', 'interviews.cancel',
          
          // Activity Logs
          'activity_logs.read', 'activity_logs.export',
          
          // Login Logs
          'login_logs.read', 'login_logs.export', 'login_logs.delete',
          
          // Error Logs
          'error_logs.read', 'error_logs.manage', 'error_logs.export', 'error_logs.delete',

          // Website Management
          'website.read', 'website.write', 'website.delete'
        ]
      },
      {
        name: 'district_admin',
        displayName: 'District Administrator',
        description: 'District-level administrative access',
        level: 2,
        category: 'admin',
        scopeConfig: {
          allowedScopeLevels: ['district', 'area', 'unit'],
          defaultScopeLevel: 'district',
          allowMultipleScopes: true,
          maxScopes: 5
        },
        constraints: {
          maxUsers: 50,
          requiresApproval: true,
          isDeletable: true,
          isModifiable: true
        },
        permissions: [
          'users.create', 'users.read.regional', 'users.update.regional',
          'roles.read', 'roles.assign',
          'permissions.read',
          'beneficiaries.create', 'beneficiaries.read.regional', 'beneficiaries.update.regional',
          'applications.read.regional', 'applications.update.regional', 'applications.approve',
          'projects.read.all', 'projects.read.assigned',
          'schemes.read.all', 'schemes.read.assigned',
          'reports.read.regional', 'reports.export',
          'dashboard.read.regional',
          'finances.read.regional',
          'donors.create', 'donors.read', 'donors.read.regional', 'donors.update.regional', 'donors.verify',
          'donations.create', 'donations.read.regional', 'donations.update.regional',
          'communications.send',
          'documents.create', 'documents.read.regional', 'documents.update',
          'interviews.schedule', 'interviews.read', 'interviews.update', 'interviews.cancel'
        ]
      },
      {
        name: 'area_admin',
        displayName: 'Area Administrator',
        description: 'Area-level coordinator with limited permissions to view and update applications within their jurisdiction',
        level: 3,
        category: 'admin',
        scopeConfig: {
          allowedScopeLevels: ['area'],
          defaultScopeLevel: 'area',
          allowMultipleScopes: false,
          maxScopes: 1
        },
        constraints: {
          maxUsers: 100,
          requiresApproval: false,
          isDeletable: true,
          isModifiable: true
        },
        permissions: [
          // Applications - View and update stage status only
          'applications.read.regional',
          'applications.update.regional',
          
          // Dashboard - View basic stats
          'dashboard.read.regional',
          
          // Reports - View application reports
          'reports.read',
          
          // Schemes - Read only to know what schemes are available
          'schemes.read.assigned',
          
          // Beneficiaries - Read only to view applicant details
          'beneficiaries.read.regional',
          
          // Financial and donor visibility for dashboard
          'finances.read.regional',
          'donors.read.regional',
          'users.read.regional'
        ]
      },
      {
        name: 'unit_admin',
        displayName: 'Unit Administrator',
        description: 'Unit-level administrative access',
        level: 4,
        category: 'admin',
        scopeConfig: {
          allowedScopeLevels: ['unit'],
          defaultScopeLevel: 'unit',
          allowMultipleScopes: true,
          maxScopes: 20
        },
        constraints: {
          maxUsers: 500,
          requiresApproval: false,
          isDeletable: true,
          isModifiable: true
        },
        permissions: [
          'users.read.regional',
          'roles.read',
          'permissions.read',
          'beneficiaries.create', 'beneficiaries.read.regional', 'beneficiaries.update.regional',
          'applications.read.regional', 'applications.update.regional', 'applications.approve',
          'projects.read.assigned',
          'schemes.read.assigned',
          'reports.read',
          'dashboard.read.regional',
          'finances.read.regional',
          'donors.read.regional'
        ]
      },
      {
        name: 'project_coordinator',
        displayName: 'Project Coordinator',
        description: 'Project-specific coordination and management',
        level: 5,
        category: 'coordinator',
        scopeConfig: {
          allowedScopeLevels: ['project'],
          defaultScopeLevel: 'project',
          allowMultipleScopes: true,
          maxScopes: 10
        },
        constraints: {
          maxUsers: 200,
          requiresApproval: false,
          isDeletable: true,
          isModifiable: true
        },
        permissions: [
          'users.read.regional',
          'beneficiaries.read.regional',
          'applications.read.regional', 'applications.update.regional',
          'projects.read.assigned', 'projects.update.assigned',
          'reports.read.regional'
        ]
      },
      {
        name: 'scheme_coordinator',
        displayName: 'Scheme Coordinator',
        description: 'Scheme-specific coordination and management',
        level: 5,
        category: 'coordinator',
        scopeConfig: {
          allowedScopeLevels: ['scheme'],
          defaultScopeLevel: 'scheme',
          allowMultipleScopes: true,
          maxScopes: 10
        },
        constraints: {
          maxUsers: 200,
          requiresApproval: false,
          isDeletable: true,
          isModifiable: true
        },
        permissions: [
          'users.read.regional',
          'beneficiaries.read.regional',
          'applications.read.regional', 'applications.update.regional',
          'schemes.read.assigned', 'schemes.update.assigned',
          'reports.read.regional'
        ]
      },
      {
        name: 'beneficiary',
        displayName: 'Beneficiary',
        description: 'End user with basic access to own data and applications',
        level: 6,
        category: 'beneficiary',
        scopeConfig: {
          allowedScopeLevels: ['unit'],
          defaultScopeLevel: 'unit',
          allowMultipleScopes: false,
          maxScopes: 1
        },
        constraints: {
          maxUsers: null, // Unlimited
          requiresApproval: false,
          isDeletable: true,
          isModifiable: false
        },
        isDefault: true,
        permissions: [
          'users.read.own', 'users.update.own',
          'beneficiaries.read.own', 'beneficiaries.update.own',
          'applications.create', 'applications.read.own',
          'projects.read.assigned',
          'schemes.read.assigned'
        ]
      }
    ];

    // Create roles with permissions
    for (const roleData of systemRoles) {
      const existingRole = await Role.findOne({ name: roleData.name });
      
      if (!existingRole) {
        // Get permission IDs
        const permissionIds = [];
        
        if (roleData.name === 'super_admin') {
          // Super admin gets all permissions
          const allPermissions = await Permission.find({ isActive: true });
          permissionIds.push(...allPermissions.map(p => p._id));
        } else {
          // Get specific permissions for this role
          for (const permissionName of roleData.permissions) {
            const permission = await Permission.findOne({ name: permissionName });
            if (permission) {
              permissionIds.push(permission._id);
            }
          }
        }
        
        const role = await Role.createSystemRole({
          ...roleData,
          permissions: permissionIds
        });
        
        console.log(`✅ Created role: ${roleData.name} with ${permissionIds.length} permissions`);
      } else {
        // Update existing role if it's modifiable or if it's a system role that needs permission updates
        const shouldUpdate = existingRole.type === 'system' && (existingRole.constraints.isModifiable !== false);
        
        if (shouldUpdate || existingRole.name === 'area_admin' || existingRole.name === 'district_admin' || existingRole.name === 'unit_admin') {
          const permissionIds = [];
          
          if (roleData.name === 'super_admin') {
            // Super admin gets all permissions
            const allPermissions = await Permission.find({ isActive: true });
            permissionIds.push(...allPermissions.map(p => p._id));
          } else {
            // Get specific permissions for this role
            for (const permissionName of roleData.permissions) {
              const permission = await Permission.findOne({ name: permissionName });
              if (permission) {
                permissionIds.push(permission._id);
              }
            }
          }
          
          // Update permissions if they've changed
          const currentPermissionIds = existingRole.permissions.map(p => p.toString()).sort();
          const newPermissionIds = permissionIds.map(p => p.toString()).sort();
          
          if (JSON.stringify(currentPermissionIds) !== JSON.stringify(newPermissionIds)) {
            existingRole.permissions = permissionIds;
            await existingRole.save();
            console.log(`🔄 Updated role: ${roleData.name} with ${permissionIds.length} permissions`);
          }
        }
      }
    }
  }

  /**
   * Assign role to user
   */
  async assignRole(userId, roleId, assignedBy, options = {}) {
    try {
      // Validate inputs
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const role = await Role.findById(roleId);
      if (!role || !role.isActive) {
        throw new Error('Role not found or inactive');
      }

      const assigner = await User.findById(assignedBy);
      if (!assigner) {
        throw new Error('Assigner not found');
      }

      // Check if assigner can assign this role
      if (!role.canBeAssignedBy(assigner)) {
        throw new Error('You do not have permission to assign this role');
      }

      // Check if role has reached user limit
      if (role.hasReachedUserLimit()) {
        throw new Error('Role has reached maximum user limit');
      }

      // Check if user already has this role
      const existingAssignment = await UserRole.findOne({
        user: userId,
        role: roleId,
        isActive: true
      });

      if (existingAssignment) {
        throw new Error('User already has this role assigned');
      }

      // Create role assignment
      const userRole = new UserRole({
        user: userId,
        role: roleId,
        assignedBy,
        assignmentReason: options.reason || 'Role assignment',
        scope: options.scope || {},
        validFrom: options.validFrom || new Date(),
        validUntil: options.validUntil || null,
        isPrimary: options.isPrimary || false,
        isTemporary: options.isTemporary || false,
        approvalStatus: role.constraints.requiresApproval ? 'pending' : 'approved'
      });

      await userRole.save();

      // Update role statistics
      await Role.findByIdAndUpdate(roleId, {
        $inc: { 
          'stats.totalUsers': 1,
          'stats.activeUsers': 1
        },
        'stats.lastAssigned': new Date()
      });

      return userRole;
    } catch (error) {
      console.error('❌ Role assignment failed:', error);
      throw error;
    }
  }

  /**
   * Remove role from user
   */
  async removeRole(userId, roleId, removedBy, reason = 'Role removal') {
    try {
      const userRole = await UserRole.findOne({
        user: userId,
        role: roleId,
        isActive: true
      });

      if (!userRole) {
        throw new Error('Role assignment not found');
      }

      // Revoke the role
      userRole.revoke(removedBy, reason);
      await userRole.save();

      // Update role statistics
      await Role.findByIdAndUpdate(roleId, {
        $inc: { 'stats.activeUsers': -1 }
      });

      return userRole;
    } catch (error) {
      console.error('❌ Role removal failed:', error);
      throw error;
    }
  }

  /**
   * Get user's effective permissions
   */
  async getUserPermissions(userId) {
    try {
      const User = require('../models/User');
      const Role = require('../models/Role');
      
      // First, try to get permissions from UserRole (advanced RBAC)
      const userRoles = await UserRole.getUserActiveRoles(userId);
      const allPermissions = new Set();

      if (userRoles && userRoles.length > 0) {
        // User has UserRole entries - use advanced RBAC
        for (const userRole of userRoles) {
          const permissions = await userRole.getEffectivePermissions();
          permissions.forEach(permission => allPermissions.add(permission));
        }
      } else {
        // Fallback: User doesn't have UserRole entries, use direct role field
        const user = await User.findById(userId);
        if (user && user.role) {
          const role = await Role.findOne({ name: user.role }).populate('permissions');
          if (role && role.permissions) {
            role.permissions.forEach(permission => {
              allPermissions.add(permission._id.toString());
            });
          }
        }
      }

      return Array.from(allPermissions);
    } catch (error) {
      console.error('❌ Failed to get user permissions:', error);
      throw error;
    }
  }

  /**
   * Check if user has specific permission
   */
  async hasPermission(userId, permissionName, context = {}) {
    try {
      // Super admin and state admin have all permissions - bypass check
      const User = require('../models/User');
      const user = await User.findById(userId).select('role');
      if (user && (user.role === 'super_admin' || user.role === 'state_admin')) {
        return true;
      }

      const permission = await Permission.findOne({ name: permissionName, isActive: true });
      if (!permission) {
        return false;
      }

      const userPermissions = await this.getUserPermissions(userId);
      const hasPermission = userPermissions.includes(permission._id.toString());

      if (!hasPermission) {
        return false;
      }

      // Validate permission conditions
      const validation = permission.validateConditions(context);
      return validation.valid;
    } catch (error) {
      console.error('❌ Permission check failed:', error);
      return false;
    }
  }

  /**
   * Create custom role
   */
  async createCustomRole(roleData, createdBy) {
    try {
      // Validate permission IDs
      if (roleData.permissions && roleData.permissions.length > 0) {
        const validPermissions = await Permission.find({
          _id: { $in: roleData.permissions },
          isActive: true
        });

        if (validPermissions.length !== roleData.permissions.length) {
          throw new Error('Some permissions are invalid or inactive');
        }
      }

      const role = new Role({
        ...roleData,
        type: 'custom',
        createdBy
      });

      await role.save();
      return role;
    } catch (error) {
      console.error('❌ Custom role creation failed:', error);
      throw error;
    }
  }

  /**
   * Update custom role
   */
  async updateCustomRole(roleId, updates, updatedBy) {
    try {
      const role = await Role.findById(roleId);
      if (!role) {
        throw new Error('Role not found');
      }

      if (role.type === 'system' && !role.constraints.isModifiable) {
        throw new Error('System roles cannot be modified');
      }

      // Validate permission IDs if provided
      if (updates.permissions) {
        const validPermissions = await Permission.find({
          _id: { $in: updates.permissions },
          isActive: true
        });

        if (validPermissions.length !== updates.permissions.length) {
          throw new Error('Some permissions are invalid or inactive');
        }
      }

      Object.assign(role, updates);
      role.updatedBy = updatedBy;
      await role.save();

      return role;
    } catch (error) {
      console.error('❌ Role update failed:', error);
      throw error;
    }
  }

  /**
   * Delete custom role
   */
  async deleteCustomRole(roleId, deletedBy) {
    try {
      const role = await Role.findById(roleId);
      if (!role) {
        throw new Error('Role not found');
      }

      if (role.type === 'system' || !role.constraints.isDeletable) {
        throw new Error('This role cannot be deleted');
      }

      // Check if role is assigned to any users
      const activeAssignments = await UserRole.countDocuments({
        role: roleId,
        isActive: true
      });

      if (activeAssignments > 0) {
        throw new Error('Cannot delete role that is assigned to users');
      }

      await Role.findByIdAndDelete(roleId);
      return true;
    } catch (error) {
      console.error('❌ Role deletion failed:', error);
      throw error;
    }
  }

  /**
   * Get role hierarchy
   */
  async getRoleHierarchy() {
    return await Role.getRoleHierarchy();
  }

  /**
   * Get permissions by module
   */
  async getPermissionsByModule(module) {
    return await Permission.getByModule(module);
  }

  /**
   * Cleanup expired role assignments
   */
  async cleanupExpiredAssignments() {
    return await UserRole.cleanupExpired();
  }
}

module.exports = new RBACService();