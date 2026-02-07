/**
 * Migrate Users Script
 *
 * 1. Ensures locations exist (seeds if empty).
 * 2. Ensures one User per role: super_admin, state_admin, district_admin,
 *    area_admin, unit_admin, project_coordinator, scheme_coordinator, beneficiary.
 * 3. Ensures minimal Project and Scheme exist (for dashboard and coordinators).
 * 4. Initializes RBAC (permissions and roles) so sidebar menus work.
 * 5. Assigns RBAC roles to migrated users so admins see all menus.
 * 6. Optionally creates User (beneficiary) for each Beneficiary without a User.
 *
 * Run from api directory:
 *   node src/scripts/migrateUsers.js
 *   node src/scripts/migrateUsers.js --migrate-beneficiaries
 *
 * Or via npm (from api directory):
 *   npm run migrate:users
 *   npm run migrate:users -- --migrate-beneficiaries
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { User, Location, Project, Scheme, Beneficiary, Role, UserRole, Permission } = require('../models');
const SeedData = require('../utils/seedData');
const rbacService = require('../services/rbacService');

// One canonical phone per role (Indian 10-digit); used for upsert so re-run is safe
const ROLE_PHONES = {
  super_admin: '9876543200',
  state_admin: '9876543201',
  district_admin: '9876543202',
  area_admin: '9876543203',
  unit_admin: '9876543204',
  project_coordinator: '9876543205',
  scheme_coordinator: '9876543206',
  beneficiary: '9876543207'
};

const ROLE_EMAILS = {
  super_admin: 'superadmin@peoplefoundation.org',
  state_admin: 'admin@peoplefoundation.org',
  district_admin: 'district.tvm@peoplefoundation.org',
  area_admin: 'area.tvmcity@peoplefoundation.org',
  unit_admin: 'unit.pettah@peoplefoundation.org',
  project_coordinator: 'project.coord@peoplefoundation.org',
  scheme_coordinator: 'scheme.coord@peoplefoundation.org',
  beneficiary: 'beneficiary@peoplefoundation.org'
};

async function ensureLocations() {
  const count = await Location.countDocuments();
  if (count === 0) {
    console.log('📍 No locations found. Seeding locations first...');
    await SeedData.seedLocations();
    console.log('✅ Locations seeded.');
  } else {
    console.log('📍 Locations already exist.');
  }
}

async function ensureProjectAndScheme() {
  const project = await Project.findOne().limit(1);
  const scheme = await Scheme.findOne().limit(1);
  if (project) console.log('   Using existing project:', project.code);
  else console.log('   No project in DB; project_coordinator will have no projects assigned.');
  if (scheme) console.log('   Using existing scheme:', scheme.code);
  else console.log('   No scheme in DB; scheme_coordinator will have no schemes assigned.');
  return { project, scheme };
}

/**
 * Ensure RBAC system has permissions and roles (so sidebar menus work).
 * Idempotent: safe to run multiple times.
 */
async function ensureRBAC() {
  const permCount = await Permission.countDocuments();
  const roleCount = await Role.countDocuments();
  if (permCount > 0 && roleCount > 0) {
    console.log('🔐 RBAC already initialized (permissions and roles exist).');
    return;
  }
  console.log('🔐 Initializing RBAC (permissions and roles) for sidebar menus...');
  await rbacService.initializeRBAC();
  console.log('✅ RBAC initialized.');
}

/**
 * Assign UserRole to each migrated admin user so they get RBAC permissions (sidebar menus).
 * Skips users who already have an active UserRole for their role.
 */
async function assignUserRolesForMigratedUsers() {
  const adminRoles = [
    'super_admin',
    'state_admin',
    'district_admin',
    'area_admin',
    'unit_admin',
    'project_coordinator',
    'scheme_coordinator'
  ];
  const superAdmin = await User.findOne({ role: 'super_admin' });
  const assignedBy = superAdmin ? superAdmin._id : null;

  let assigned = 0;
  let skipped = 0;
  let errors = 0;

  for (const roleName of adminRoles) {
    const user = await User.findOne({ role: roleName });
    if (!user) continue;

    const role = await Role.findOne({ name: roleName });
    if (!role) {
      console.log(`   ⚠️  Role "${roleName}" not found; skip assigning to ${user.name}`);
      errors++;
      continue;
    }

    const existing = await UserRole.findOne({
      user: user._id,
      role: role._id,
      isActive: true
    });
    if (existing) {
      skipped++;
      continue;
    }

    try {
      await UserRole.create({
        user: user._id,
        role: role._id,
        assignedBy: assignedBy || user._id,
        assignmentReason: 'Auto-assigned during user migration (RBAC for sidebar menus)',
        isPrimary: true,
        approvalStatus: 'approved',
        isActive: true,
        scope: {}
      });
      console.log(`   ✅ Assigned role "${roleName}" to ${user.name}`);
      assigned++;
    } catch (err) {
      console.error(`   ❌ Failed to assign "${roleName}" to ${user.name}:`, err.message);
      errors++;
    }
  }

  console.log(`   RBAC assignments: ${assigned} created, ${skipped} already had role, ${errors} errors.`);
}

/**
 * Ensure at least one Project and one Scheme exist so dashboard and coordinators have data.
 * Uses state_admin user from this migration. Idempotent.
 */
async function ensureMinimalProjectAndScheme() {
  let created = 0;
  const stateAdmin = await User.findOne({ role: 'state_admin' });
  const kerala = await Location.findOne({ type: 'state', code: 'KL' });
  if (!stateAdmin || !kerala) return;

  if ((await Project.countDocuments()) === 0) {
    await Project.create({
      name: 'Sample Project',
      code: 'PROJ-001',
      description: 'Initial project created by migration',
      category: 'other',
      priority: 'medium',
      scope: 'state',
      targetRegions: [kerala._id],
      startDate: new Date(),
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      budget: { total: 0, allocated: 0, spent: 0 },
      coordinator: stateAdmin._id,
      status: 'active',
      createdBy: stateAdmin._id
    });
    console.log('   ✅ Created minimal project (PROJ-001).');
    created++;
  }
  const project = await Project.findOne().limit(1);
  if (!project) return;

  if ((await Scheme.countDocuments()) === 0) {
    const now = new Date();
    const oneYearLater = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    await Scheme.create({
      name: 'Sample Scheme',
      code: 'SCH-001',
      description: 'Initial scheme created by migration',
      category: 'other',
      priority: 'medium',
      status: 'active',
      project: project._id,
      targetRegions: [kerala._id],
      budget: { total: 0, allocated: 0, spent: 0 },
      benefits: { type: 'cash', amount: 0, frequency: 'one_time', description: 'Sample benefit' },
      applicationSettings: {
        startDate: now,
        endDate: oneYearLater,
        maxApplications: 1000,
        maxBeneficiaries: 100,
        requiresInterview: false,
        allowMultipleApplications: false
      },
      createdBy: stateAdmin._id
    });
    console.log('   ✅ Created minimal scheme (SCH-001).');
    created++;
  }
  if (created === 0) {
    console.log('   Projects and schemes already exist.');
  }

  // Assign first project/scheme to coordinators if they have none
  const proj = await Project.findOne().limit(1);
  const sch = await Scheme.findOne().limit(1);
  if (proj || sch) {
    const projCoord = await User.findOne({ role: 'project_coordinator' });
    const schemeCoord = await User.findOne({ role: 'scheme_coordinator' });
    if (projCoord && projCoord.adminScope && proj && (!projCoord.adminScope.projects || projCoord.adminScope.projects.length === 0)) {
      projCoord.adminScope.projects = [proj._id];
      await projCoord.save();
      console.log('   ✅ Assigned project to project_coordinator.');
    }
    if (schemeCoord && schemeCoord.adminScope && sch && (!schemeCoord.adminScope.schemes || schemeCoord.adminScope.schemes.length === 0)) {
      schemeCoord.adminScope.schemes = [sch._id];
      await schemeCoord.save();
      console.log('   ✅ Assigned scheme to scheme_coordinator.');
    }
  }
}

async function migrateRoleUsers() {
  const kerala = await Location.findOne({ type: 'state', code: 'KL' });
  const tvm = await Location.findOne({ type: 'district', code: 'TVM' });
  const tvmCity = await Location.findOne({ type: 'area', code: 'TVM_CITY' });
  const pettahUnit = await Location.findOne({ type: 'unit', code: 'TVM_CITY_PTH' });

  if (!kerala || !tvm || !tvmCity || !pettahUnit) {
    throw new Error('Required locations (Kerala, TVM, TVM_CITY, TVM_CITY_PTH) not found. Run location seed first.');
  }

  // Get project/scheme for coordinators (optional; assign if present)
  const { project, scheme } = await ensureProjectAndScheme();

  const roles = [
    'super_admin',
    'state_admin',
    'district_admin',
    'area_admin',
    'unit_admin',
    'project_coordinator',
    'scheme_coordinator',
    'beneficiary'
  ];

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const role of roles) {
    const phone = ROLE_PHONES[role];
    const email = ROLE_EMAILS[role];
    const existing = await User.findOne({ phone });

    const baseUser = {
      name: `Migration ${role.replace(/_/g, ' ')}`,
      phone,
      email: email || undefined,
      role,
      password: null,
      isVerified: true,
      isActive: true
    };

    if (role === 'super_admin') {
      Object.assign(baseUser, {
        adminScope: {
          level: 'super',
          permissions: {
            canCreateUsers: true,
            canManageProjects: true,
            canManageSchemes: true,
            canApproveApplications: true,
            canViewReports: true,
            canManageFinances: true
          }
        }
      });
    } else if (role === 'state_admin') {
      Object.assign(baseUser, {
        adminScope: {
          level: 'state',
          regions: [kerala._id],
          permissions: {
            canCreateUsers: true,
            canManageProjects: true,
            canManageSchemes: true,
            canApproveApplications: true,
            canViewReports: true,
            canManageFinances: true
          }
        }
      });
    } else if (role === 'district_admin') {
      Object.assign(baseUser, {
        adminScope: {
          level: 'district',
          district: tvm._id,
          regions: [tvm._id],
          permissions: {
            canCreateUsers: true,
            canManageProjects: false,
            canManageSchemes: false,
            canApproveApplications: true,
            canViewReports: true,
            canManageFinances: false
          }
        }
      });
    } else if (role === 'area_admin') {
      Object.assign(baseUser, {
        adminScope: {
          level: 'area',
          district: tvm._id,
          area: tvmCity._id,
          regions: [tvmCity._id],
          permissions: {
            canCreateUsers: true,
            canManageProjects: false,
            canManageSchemes: false,
            canApproveApplications: true,
            canViewReports: true,
            canManageFinances: false
          }
        }
      });
    } else if (role === 'unit_admin') {
      Object.assign(baseUser, {
        adminScope: {
          level: 'unit',
          district: tvm._id,
          area: tvmCity._id,
          unit: pettahUnit._id,
          regions: [pettahUnit._id],
          permissions: {
            canCreateUsers: false,
            canManageProjects: false,
            canManageSchemes: false,
            canApproveApplications: true,
            canViewReports: true,
            canManageFinances: false
          }
        }
      });
    } else if (role === 'project_coordinator') {
      Object.assign(baseUser, {
        adminScope: {
          level: 'project',
          projects: project ? [project._id] : [],
          permissions: {
            canCreateUsers: false,
            canManageProjects: true,
            canManageSchemes: false,
            canApproveApplications: false,
            canViewReports: true,
            canManageFinances: false
          }
        }
      });
    } else if (role === 'scheme_coordinator') {
      Object.assign(baseUser, {
        adminScope: {
          level: 'scheme',
          schemes: scheme ? [scheme._id] : [],
          permissions: {
            canCreateUsers: false,
            canManageProjects: false,
            canManageSchemes: true,
            canApproveApplications: false,
            canViewReports: true,
            canManageFinances: false
          }
        }
      });
    }
    // beneficiary: no adminScope required

    if (existing) {
      if (existing.role === role) {
        skipped++;
        console.log(`   ⏭️  ${role}: already exists (${phone})`);
      } else {
        existing.role = baseUser.role;
        existing.name = baseUser.name;
        if (baseUser.email) existing.email = baseUser.email;
        if (baseUser.adminScope) existing.adminScope = baseUser.adminScope;
        await existing.save();
        updated++;
        console.log(`   🔄 ${role}: updated existing user (${phone})`);
      }
    } else {
      await User.create(baseUser);
      created++;
      console.log(`   ✅ ${role}: created (${phone})`);
    }
  }

  return { created, updated, skipped };
}

async function migrateBeneficiariesToUsers() {
  const beneficiaries = await Beneficiary.find();
  let created = 0;
  let skipped = 0;

  for (const b of beneficiaries) {
    const existing = await User.findOne({ phone: b.phone });
    if (existing) {
      if (existing.role === 'beneficiary') {
        skipped++;
        continue;
      }
      // Same phone but different role: leave as-is, don't overwrite
      skipped++;
      continue;
    }
    await User.create({
      name: b.name,
      phone: b.phone,
      role: 'beneficiary',
      password: null,
      isVerified: !!b.isVerified,
      isActive: true,
      profile: {
        location: {
          district: b.district,
          area: b.area,
          unit: b.unit
        }
      }
    });
    created++;
    console.log(`   ✅ Beneficiary → User: ${b.phone} (${b.name})`);
  }
  return { created, skipped };
}

async function run() {
  const migrateBeneficiaries = process.argv.includes('--migrate-beneficiaries');

  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      console.error('❌ MONGODB_URI is not set. Set it in .env or environment.');
      process.exit(1);
    }

    console.log('🔄 Migrating users into the database...\n');
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB\n');

    console.log('📋 Step 1: Ensuring locations exist...');
    await ensureLocations();
    console.log('');

    console.log('📋 Step 2: Ensuring one user per role (super_admin → beneficiary)...');
    const { created, updated, skipped } = await migrateRoleUsers();
    console.log('');
    console.log('   Summary: created %d, updated %d, skipped %d', created, updated, skipped);
    console.log('');

    console.log('📋 Step 3: Ensuring minimal project and scheme (for coordinators and dashboard)...');
    await ensureMinimalProjectAndScheme();
    console.log('');

    console.log('📋 Step 4: Ensuring RBAC (permissions and roles) for sidebar menus...');
    await ensureRBAC();
    console.log('');

    console.log('📋 Step 5: Assigning RBAC roles to migrated users (so admin sees all menus)...');
    await assignUserRolesForMigratedUsers();
    console.log('');

    if (migrateBeneficiaries) {
      console.log('📋 Step 6: Creating User (beneficiary) for each Beneficiary without a User...');
      const bResult = await migrateBeneficiariesToUsers();
      console.log('   Beneficiary→User: created %d, skipped %d', bResult.created, bResult.skipped);
      console.log('');
    } else {
      console.log('💡 Tip: Run with --migrate-beneficiaries to create User accounts for all Beneficiary records.');
      console.log('');
    }

    const total = await User.countDocuments();
    const byRole = await User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } } ]);
    console.log('📊 Total users in database: %d', total);
    console.log('   By role:');
    byRole.forEach(({ _id, count }) => console.log('     %s: %d', _id, count));
    console.log('');
    console.log('✅ User migration completed successfully.');
    console.log('');
    console.log('📋 Migrated role users (login via OTP with these phones):');
    Object.entries(ROLE_PHONES).forEach(([role, phone]) => {
      console.log('   %s: %s', role.padEnd(22), phone);
    });

    await mongoose.connection.close();
    console.log('\n✅ Database connection closed.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

run();
