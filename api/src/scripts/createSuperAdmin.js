/**
 * Bootstrap Platform Super Admin
 * 
 * Creates a god-mode admin (User.isSuperAdmin = true) and links them
 * to both 'bz' and 'people' franchises as super_admin.
 *
 * Usage: node src/scripts/createSuperAdmin.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const config = require('../config/environment');

const SUPER_ADMIN_PHONE = '8086619905';
const SUPER_ADMIN_NAME  = 'Platform Super Admin';

async function run() {
  await mongoose.connect(config.MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  const User          = require('../models/User');
  const UserFranchise = require('../models/UserFranchise');
  const Franchise     = require('../models/Franchise');

  const superScope = {
    level: 'super',
    permissions: {
      canCreateUsers: true,
      canManageProjects: true,
      canManageSchemes: true,
      canApproveApplications: true,
      canViewReports: true,
      canManageFinances: true,
    },
  };

  // ── 1. Create / upgrade the platform-level super admin user ──────────────
  let user = await User.findOne({ phone: SUPER_ADMIN_PHONE });
  if (user) {
    user.isSuperAdmin = true;
    user.isActive     = true;
    user.isVerified   = true;
    user.role         = 'super_admin';
    await user.save();
    console.log('✅ Updated existing user → Platform Super Admin');
    console.log('   ID   :', user._id.toString());
  } else {
    user = await User.create({
      name:         SUPER_ADMIN_NAME,
      phone:        SUPER_ADMIN_PHONE,
      role:         'super_admin',
      isSuperAdmin: true,
      isVerified:   true,
      isActive:     true,
      adminScope:   superScope,
    });
    console.log('✅ Created Platform Super Admin');
    console.log('   ID   :', user._id.toString());
  }

  // ── 2. Link to all franchises ─────────────────────────────────────────────
  const franchises = await Franchise.find({ slug: { $in: ['bz', 'people'] } });

  if (franchises.length === 0) {
    console.warn('\n⚠️  No franchises found — run `npm run franchise:seed` first');
    process.exit(1);
  }

  for (const f of franchises) {
    let membership = await UserFranchise.findOne({ user: user._id, franchise: f._id });
    if (membership) {
      membership.role       = 'super_admin';
      membership.isActive   = true;
      membership.adminScope = superScope;
      await membership.save();
      console.log(`✅ Updated membership → franchise: ${f.slug} (${f._id})`);
    } else {
      await UserFranchise.create({
        user:        user._id,
        franchise:   f._id,
        role:        'super_admin',
        isActive:    true,
        assignedBy:  user._id,
        adminScope:  superScope,
      });
      console.log(`✅ Created membership  → franchise: ${f.slug} (${f._id})`);
    }
  }

  console.log('\n════════════════════════════════════════════════');
  console.log('  Platform Super Admin (God Mode) is ready!');
  console.log('────────────────────────────────────────────────');
  console.log('  Login URL : http://localhost:8080/login');
  console.log('  Phone     :', SUPER_ADMIN_PHONE);
  console.log('  OTP       : 123456  (ENABLE_TEST_LOGIN=true)');
  console.log('  Access    : Both franchises (bz + people)');
  console.log('════════════════════════════════════════════════\n');

  process.exit(0);
}

run().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
