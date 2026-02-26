/**
 * Multi-Tenant Migration Script
 * ==============================
 * Backfills the `franchise` field on all existing documents in tenant-scoped
 * collections, assigning them to the "default" franchise (configurable).
 * Also creates UserFranchise records for all existing admin users.
 *
 * SAFE TO RUN MULTIPLE TIMES — only touches documents without franchise field,
 * and uses upsert for UserFranchise records.
 *
 * Prerequisites:
 *   1. Run seedFranchises first: npm run franchise:seed
 *   2. Set DEFAULT_FRANCHISE_SLUG env var (default: 'people')
 *
 * Usage:
 *   DEFAULT_FRANCHISE_SLUG=people node src/scripts/migrateToMultiTenant.js
 *   # or:
 *   npm run franchise:migrate
 */

require('dotenv').config();
const mongoose = require('mongoose');
const config = require('../config/environment');

// ── Collection names for tenant-scoped models ────────────────────────────────
// These match the Mongoose model → collection mappings.
// Location is intentionally excluded (global / shared).
const TENANT_COLLECTIONS = [
  'activitylogs',
  'applicationconfigs',
  'applications',
  'banners',
  'beneficiaries',
  'brochures',
  'counters',
  'dashboards',
  'donations',
  'donors',
  'donorfollowups',
  'enquiryreports',
  'errorlogs',
  'formconfigurations',
  'interviews',
  'loginlogs',
  'masterdatas',
  'newsevents',
  'notifications',
  'partners',
  'payments',
  'permissions',
  'projects',
  'recurringpayments',
  'reports',
  'roles',
  'schemes',
  'schemetargets',
  'userroles',
  'websitesettings',
];

// Admin roles that should get UserFranchise records (excludes 'beneficiary')
const ADMIN_ROLES = [
  'super_admin',
  'state_admin',
  'district_admin',
  'area_admin',
  'unit_admin',
  'project_coordinator',
  'data_entry',
  'viewer',
];

// ── Helpers ──────────────────────────────────────────────────────────────────

// Collections where seed already created franchise-scoped records —
// the old global docs must be removed rather than backfilled.
const SEED_MANAGED_COLLECTIONS = ['permissions', 'roles', 'websitesettings'];

async function backfillCollection(db, collectionName, franchiseId) {
  const collection = db.collection(collectionName);

  // Check if collection exists
  const collections = await db.listCollections({ name: collectionName }).toArray();
  if (collections.length === 0) {
    console.log(`  ⏭  Collection "${collectionName}" does not exist — skipping`);
    return { matched: 0, modified: 0 };
  }

  // For seed-managed collections, delete stale global records instead of backfilling
  // (the seed script already created proper franchise-scoped replacements)
  if (SEED_MANAGED_COLLECTIONS.includes(collectionName)) {
    const result = await collection.deleteMany({ franchise: { $exists: false } });
    if (result.deletedCount > 0) {
      console.log(`  🗑️  ${collectionName.padEnd(25)} deleted ${result.deletedCount} stale global record(s) (replaced by seed)`);
    }
    return { matched: 0, modified: 0 };
  }

  const result = await collection.updateMany(
    { franchise: { $exists: false } },
    { $set: { franchise: franchiseId } }
  );

  return { matched: result.matchedCount, modified: result.modifiedCount };
}

async function createUserFranchiseRecords(db, franchiseId, assignedByUserId) {
  const usersCol = db.collection('users');
  const ufCol    = db.collection('userfranchises');

  // Find all admin users (non-beneficiary, active)
  const adminUsers = await usersCol
    .find({ role: { $in: ADMIN_ROLES }, isActive: true })
    .toArray();

  console.log(`  👤 Found ${adminUsers.length} admin user(s) to migrate`);

  let created = 0;
  let skipped = 0;

  for (const user of adminUsers) {
    const existing = await ufCol.findOne({
      user: user._id,
      franchise: franchiseId,
    });

    if (existing) {
      skipped++;
      continue;
    }

    await ufCol.insertOne({
      _id: new mongoose.Types.ObjectId(),
      user: user._id,
      franchise: franchiseId,
      role: user.role,
      adminScope: user.adminScope || {},
      isActive: true,
      joinedAt: user.createdAt || new Date(),
      assignedBy: assignedByUserId || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    created++;
  }

  return { created, skipped };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function migrate() {
  const defaultSlug = process.env.DEFAULT_FRANCHISE_SLUG || 'people';

  console.log('🚀 Starting multi-tenant migration...');
  console.log(`   Default franchise slug: ${defaultSlug}\n`);

  // Connect
  await mongoose.connect(config.MONGODB_URI);
  const db = mongoose.connection.db;
  console.log(`✅ Connected to MongoDB\n`);

  // 1. Look up default franchise
  const franchisesCol = db.collection('franchises');
  const defaultFranchise = await franchisesCol.findOne({ slug: defaultSlug });
  if (!defaultFranchise) {
    console.error(`❌ Franchise with slug "${defaultSlug}" not found.`);
    console.error('   Run "npm run franchise:seed" first, then retry.');
    process.exit(1);
  }
  const franchiseId = defaultFranchise._id;
  console.log(`🏢 Default franchise: "${defaultFranchise.displayName}" (${franchiseId})\n`);

  // 2. Backfill tenant-scoped collections
  console.log('── Backfilling collections ──────────────────────────────────────');
  const summary = [];

  for (const collName of TENANT_COLLECTIONS) {
    const { matched, modified } = await backfillCollection(db, collName, franchiseId);
    summary.push({ collection: collName, matched, modified });
    if (matched > 0 || modified > 0) {
      console.log(`  ✅ ${collName.padEnd(25)} matched: ${matched}, modified: ${modified}`);
    } else {
      console.log(`  ⏭  ${collName.padEnd(25)} (already migrated or empty)`);
    }
  }

  // 3. Create UserFranchise records for existing admin users
  console.log('\n── Creating UserFranchise records ───────────────────────────────');
  const { created, skipped } = await createUserFranchiseRecords(db, franchiseId, null);
  console.log(`  ✅ UserFranchise: ${created} created, ${skipped} already existed`);

  // 4. Final report
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('✅ Migration complete!\n');

  const totalModified = summary.reduce((sum, s) => sum + s.modified, 0);
  console.log(`   Total documents updated: ${totalModified}`);
  console.log(`   UserFranchise records created: ${created}`);
  console.log(`   Default franchise ID: ${franchiseId}`);
  console.log('\n   🏁 The system is now franchise-aware for existing data.');
  console.log('   All new records will require franchise to be set at the API layer.');
  console.log('═══════════════════════════════════════════════════════════════\n');

  await mongoose.disconnect();
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
