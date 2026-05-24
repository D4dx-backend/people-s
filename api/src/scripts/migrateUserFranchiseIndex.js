/**
 * Migration: Update UserFranchise unique index
 *
 * Old index: { user: 1, franchise: 1 }        — one role per user per franchise
 * New index: { user: 1, franchise: 1, role: 1 } — multiple roles per user per franchise
 *
 * Run: node api/src/scripts/migrateUserFranchiseIndex.js
 */

'use strict';

const mongoose = require('mongoose');
const path = require('path');

// Load env config
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const config = require('../config/environment');

async function run() {
  await mongoose.connect(config.MONGODB_URI || config.DB_URI);
  console.log('✅ Connected to MongoDB');

  const collection = mongoose.connection.collection('userfranchises');

  // ── 1. List existing indexes ──────────────────────────────────────────────
  const existingIndexes = await collection.indexes();
  console.log('Existing indexes:');
  existingIndexes.forEach(idx => console.log(' ', JSON.stringify(idx.key), idx.unique ? '(unique)' : ''));

  // ── 2. Drop old unique index on { user, franchise } if it exists ──────────
  const oldIndexName = existingIndexes.find(
    idx =>
      idx.unique &&
      Object.keys(idx.key).join(',') === 'user,franchise' &&
      !idx.key.role
  );

  if (oldIndexName) {
    console.log(`\nDropping old unique index "${oldIndexName.name}"…`);
    await collection.dropIndex(oldIndexName.name);
    console.log('  ✅ Old index dropped.');
  } else {
    console.log('\nOld unique index { user, franchise } not found (already migrated or never existed).');
  }

  // ── 3. Check for duplicate (user, franchise, role) triples ───────────────
  console.log('\nChecking for duplicate (user, franchise, role) combinations…');
  const duplicates = await collection.aggregate([
    {
      $group: {
        _id: { user: '$user', franchise: '$franchise', role: '$role' },
        count: { $sum: 1 },
        ids: { $push: '$_id' }
      }
    },
    { $match: { count: { $gt: 1 } } }
  ]).toArray();

  if (duplicates.length > 0) {
    console.warn(`  ⚠️  Found ${duplicates.length} duplicate (user, franchise, role) group(s). Keeping most recent, removing extras…`);
    for (const dup of duplicates) {
      // Sort ids descending (most recent last in insertion order is _id desc) and remove all but last
      const toDelete = dup.ids.slice(0, -1);
      await collection.deleteMany({ _id: { $in: toDelete } });
      console.log(`    Removed ${toDelete.length} duplicate(s) for`, JSON.stringify(dup._id));
    }
  } else {
    console.log('  ✅ No duplicates found.');
  }

  // ── 4. Create new unique index { user, franchise, role } ─────────────────
  console.log('\nCreating new unique index { user: 1, franchise: 1, role: 1 }…');
  await collection.createIndex(
    { user: 1, franchise: 1, role: 1 },
    { unique: true, name: 'user_franchise_role_unique' }
  );
  console.log('  ✅ New index created.');

  // ── 5. Verify ─────────────────────────────────────────────────────────────
  const updatedIndexes = await collection.indexes();
  console.log('\nFinal indexes:');
  updatedIndexes.forEach(idx => console.log(' ', JSON.stringify(idx.key), idx.unique ? '(unique)' : ''));

  await mongoose.disconnect();
  console.log('\n✅ Migration complete.');
}

run().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
