/**
 * Script to add export permissions for all data modules
 * and assign them to super_admin & state_admin roles.
 *
 * Run with: node src/scripts/addExportPermissions.js
 */

const mongoose = require('mongoose');
const Role = require('../models/Role');
const Permission = require('../models/Permission');
require('dotenv').config();

const exportPermissions = [
  // ── Payment Export ──
  {
    name: 'finances.export',
    displayName: 'Export Payments',
    description: 'Export payment data as CSV / JSON',
    module: 'finances',
    category: 'export',
    scope: 'global',
    resource: 'payment',
    action: 'export'
  },

  // ── Application Export ──
  {
    name: 'applications.export',
    displayName: 'Export Applications',
    description: 'Export application data as CSV / JSON',
    module: 'applications',
    category: 'export',
    scope: 'global',
    resource: 'application',
    action: 'export'
  },

  // ── Donor Export ──
  {
    name: 'donors.export',
    displayName: 'Export Donors',
    description: 'Export donor data as CSV / JSON',
    module: 'donors',
    category: 'export',
    scope: 'global',
    resource: 'donor',
    action: 'export'
  },

  // ── Donation Export ──
  {
    name: 'donations.export',
    displayName: 'Export Donations',
    description: 'Export donation data as CSV / JSON',
    module: 'donations',
    category: 'export',
    scope: 'global',
    resource: 'donation',
    action: 'export'
  },

  // ── User Export ──
  {
    name: 'users.export',
    displayName: 'Export Users',
    description: 'Export user data as CSV / JSON',
    module: 'users',
    category: 'export',
    scope: 'global',
    resource: 'user',
    action: 'export'
  },

  // ── Role Export ──
  {
    name: 'roles.export',
    displayName: 'Export Roles',
    description: 'Export role data as CSV / JSON',
    module: 'roles',
    category: 'export',
    scope: 'global',
    resource: 'role',
    action: 'export'
  },

  // ── Beneficiary Export ──
  {
    name: 'beneficiaries.export',
    displayName: 'Export Beneficiaries',
    description: 'Export beneficiary data as CSV / JSON',
    module: 'beneficiaries',
    category: 'export',
    scope: 'global',
    resource: 'beneficiary',
    action: 'export'
  },

  // ── Location Export ──
  {
    name: 'locations.export',
    displayName: 'Export Locations',
    description: 'Export location data as CSV / JSON',
    module: 'locations',
    category: 'export',
    scope: 'global',
    resource: 'location',
    action: 'export'
  },

  // ── Scheme Export ──
  {
    name: 'schemes.export',
    displayName: 'Export Schemes',
    description: 'Export scheme data as CSV / JSON',
    module: 'schemes',
    category: 'export',
    scope: 'global',
    resource: 'scheme',
    action: 'export'
  },

  // ── Project Export ──
  {
    name: 'projects.export',
    displayName: 'Export Projects',
    description: 'Export project data as CSV / JSON',
    module: 'projects',
    category: 'export',
    scope: 'global',
    resource: 'project',
    action: 'export'
  },

  // ── Partner Export ──
  {
    name: 'partners.export',
    displayName: 'Export Partners',
    description: 'Export partner data as CSV / JSON',
    module: 'partners',
    category: 'export',
    scope: 'global',
    resource: 'partner',
    action: 'export'
  }
];

// Roles that should receive ALL export permissions
const ROLES_FULL_ACCESS = ['super_admin', 'state_admin'];

async function addExportPermissions() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // 1. Create permissions if they don't exist
    const permissionIds = [];

    for (const permData of exportPermissions) {
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
        console.log(`✅ Added ${added} export permission(s) to "${roleName}"`);
      } else {
        console.log(`⏭️  "${roleName}" already has all export permissions`);
      }
    }

    // 3. Summary
    console.log('\n📊 Export Permissions Summary');
    console.log('='.repeat(50));
    for (const roleName of ROLES_FULL_ACCESS) {
      const role = await Role.findOne({ name: roleName })
        .populate('permissions', 'name module category');
      if (!role) continue;

      const expPerms = role.permissions.filter(p => p.category === 'export');
      console.log(`\n${roleName} (${expPerms.length} export perms):`);
      expPerms.forEach(p => console.log(`  • ${p.name}`));
    }

    console.log('\n✅ Done!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

addExportPermissions();
