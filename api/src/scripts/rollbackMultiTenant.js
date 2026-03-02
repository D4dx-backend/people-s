/**
 * Multi-Tenant Migration Rollback Script
 * ========================================
 * Removes the `franchise` field from all documents in tenant-scoped
 * collections and drops UserFranchise records created by the migration.
 *
 * ⚠️  WARNING: Destructive operation. Data will revert to single-tenant state.
 * Use only in development/staging. In production, prefer per-collection backups.
 *
 * Usage:
 *   node src/scripts/rollbackMultiTenant.js
 *   # or:
 *   npm run franchise:rollback
 */

require('dotenv').config();
const mongoose = require('mongoose');
const config = require('../config/environment');
const readline = require('readline');

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

async function confirm(question) {
  // Skip interactive prompt in CI/automation
  if (process.env.FORCE_ROLLBACK === 'true') return true;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'yes');
    });
  });
}

async function rollback() {
  console.log('⚠️  FRANCHISE MIGRATION ROLLBACK');
  console.log('   This will REMOVE all franchise fields from all documents.');
  console.log('   UserFranchise collection will be emptied.\n');

  const proceed = await confirm('Type "yes" to proceed, anything else to abort: ');
  if (!proceed) {
    console.log('❌ Rollback aborted.');
    process.exit(0);
  }

  await mongoose.connect(config.MONGODB_URI);
  const db = mongoose.connection.db;
  console.log('\n✅ Connected to MongoDB\n');

  // 1. Remove franchise field from all tenant collections
  console.log('── Removing franchise field ─────────────────────────────────────');
  let totalModified = 0;

  for (const collName of TENANT_COLLECTIONS) {
    const collections = await db.listCollections({ name: collName }).toArray();
    if (collections.length === 0) continue;

    const result = await db.collection(collName).updateMany(
      { franchise: { $exists: true } },
      { $unset: { franchise: '' } }
    );
    totalModified += result.modifiedCount;
    if (result.modifiedCount > 0) {
      console.log(`  ✅ ${collName.padEnd(25)} reverted: ${result.modifiedCount}`);
    }
  }

  // 2. Clear UserFranchise collection
  console.log('\n── Clearing UserFranchise collection ───────────────────────────');
  const ufResult = await db.collection('userfranchises').deleteMany({});
  console.log(`  ✅ Deleted ${ufResult.deletedCount} UserFranchise record(s)`);

  // 3. Note: Franchise and WebsiteSettings records are NOT removed by rollback
  //    (they contain config data; remove manually if needed)
  console.log('\n   ℹ️  Franchise and WebsiteSettings records were NOT removed.');
  console.log('   Remove them manually if a full reset is needed.');

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('✅ Rollback complete!');
  console.log(`   Total documents reverted: ${totalModified}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  await mongoose.disconnect();
}

rollback().catch(err => {
  console.error('❌ Rollback failed:', err);
  process.exit(1);
});
