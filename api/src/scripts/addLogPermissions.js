/**
 * Script to add Login Log, Error Log, and Activity Log permissions
 * and assign them to super_admin & state_admin roles.
 *
 * Run with: node src/scripts/addLogPermissions.js
 */

const mongoose = require('mongoose');
const Role = require('../models/Role');
const Permission = require('../models/Permission');
require('dotenv').config();

const logPermissions = [
  // ── Activity Log Permissions ──
  {
    name: 'activity_logs.read',
    displayName: 'View Activity Logs',
    description: 'View activity / audit logs for the system',
    module: 'activity_logs',
    category: 'read',
    scope: 'global',
    resource: 'activity_log',
    action: 'read'
  },
  {
    name: 'activity_logs.export',
    displayName: 'Export Activity Logs',
    description: 'Export activity logs as CSV / JSON',
    module: 'activity_logs',
    category: 'export',
    scope: 'global',
    resource: 'activity_log',
    action: 'export'
  },

  // ── Login Log Permissions ──
  {
    name: 'login_logs.read',
    displayName: 'View Login Logs',
    description: 'View login / authentication event logs',
    module: 'login_logs',
    category: 'read',
    scope: 'global',
    resource: 'login_log',
    action: 'read'
  },
  {
    name: 'login_logs.export',
    displayName: 'Export Login Logs',
    description: 'Export login logs as CSV / JSON',
    module: 'login_logs',
    category: 'export',
    scope: 'global',
    resource: 'login_log',
    action: 'export'
  },
  {
    name: 'login_logs.delete',
    displayName: 'Delete Login Logs',
    description: 'Clean up / delete old login logs',
    module: 'login_logs',
    category: 'delete',
    scope: 'global',
    resource: 'login_log',
    action: 'delete'
  },

  // ── Error Log Permissions ──
  {
    name: 'error_logs.read',
    displayName: 'View Error Logs',
    description: 'View application error logs',
    module: 'error_logs',
    category: 'read',
    scope: 'global',
    resource: 'error_log',
    action: 'read'
  },
  {
    name: 'error_logs.manage',
    displayName: 'Manage Error Logs',
    description: 'Mark errors as resolved, add resolution notes',
    module: 'error_logs',
    category: 'update',
    scope: 'global',
    resource: 'error_log',
    action: 'update'
  },
  {
    name: 'error_logs.export',
    displayName: 'Export Error Logs',
    description: 'Export error logs as CSV / JSON',
    module: 'error_logs',
    category: 'export',
    scope: 'global',
    resource: 'error_log',
    action: 'export'
  },
  {
    name: 'error_logs.delete',
    displayName: 'Delete Error Logs',
    description: 'Clean up / delete old error logs',
    module: 'error_logs',
    category: 'delete',
    scope: 'global',
    resource: 'error_log',
    action: 'delete'
  }
];

// Roles that should receive ALL log permissions
const ROLES_FULL_ACCESS = ['super_admin', 'state_admin'];

async function addLogPermissions() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // 1. Create permissions if they don't exist
    const permissionIds = [];

    for (const permData of logPermissions) {
      let permission = await Permission.findOne({ name: permData.name });

      if (!permission) {
        permission = await Permission.create(permData);
        console.log(`✅ Created permission: ${permission.name}`);
      } else {
        console.log(`⏭️  Permission already exists: ${permission.name}`);
      }
      permissionIds.push(permission._id);
    }

    // 2. Assign to roles
    for (const roleName of ROLES_FULL_ACCESS) {
      const role = await Role.findOne({ name: roleName });
      if (!role) {
        console.log(`⚠️  Role "${roleName}" not found – skipping`);
        continue;
      }

      const currentIds = role.permissions.map(p => p.toString());
      let added = 0;

      for (const permId of permissionIds) {
        if (!currentIds.includes(permId.toString())) {
          role.permissions.push(permId);
          added++;
        }
      }

      if (added > 0) {
        await role.save();
        console.log(`✅ Added ${added} log permission(s) to "${roleName}"`);
      } else {
        console.log(`⏭️  "${roleName}" already has all log permissions`);
      }
    }

    // 3. Summary
    console.log('\n📊 Log Permissions Summary');
    console.log('='.repeat(50));
    for (const roleName of ROLES_FULL_ACCESS) {
      const role = await Role.findOne({ name: roleName })
        .populate('permissions', 'name module');
      if (!role) continue;

      const logPerms = role.permissions.filter(p =>
        ['activity_logs', 'login_logs', 'error_logs'].includes(p.module)
      );
      console.log(`\n${roleName} (${logPerms.length} log perms):`);
      logPerms.forEach(p => console.log(`  • ${p.name}`));
    }

    console.log('\n✅ Done!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

addLogPermissions();
