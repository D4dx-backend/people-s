/**
 * Backfill UserFranchise for Area Admins
 *
 * Creates UserFranchise records (for the target franchise) for the 84 area
 * admins that were already inserted into the User collection by
 * migrateAreaAdmins.js but are missing franchise membership.
 *
 * Safe to run multiple times — skips users that already have a record.
 *
 * Run from the api directory:
 *   node src/scripts/backfillAreaAdminFranchise.js
 *
 * Override the franchise slug if needed:
 *   DEFAULT_FRANCHISE_SLUG=peoples node src/scripts/backfillAreaAdminFranchise.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { User, UserFranchise } = require('../models');
const Franchise = require('../models/Franchise');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');

function normalizePhone(raw) {
  if (raw === null || raw === undefined) return null;
  const cleaned = String(raw).replace(/\s+/g, '').trim();
  return /^[6-9]\d{9}$/.test(cleaned) ? cleaned : null;
}

async function run() {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      console.error('MONGODB_URI is not set.');
      process.exit(1);
    }

    await mongoose.connect(uri);
    console.log('Connected to MongoDB\n');

    // ── 1. Resolve franchise ─────────────────────────────────────────────
    const slug = process.env.DEFAULT_FRANCHISE_SLUG || 'peoples';
    const franchiseDoc = await Franchise.findOne({ slug });
    if (!franchiseDoc) {
      console.error(`Franchise with slug "${slug}" not found.`);
      console.error('Available slugs can be checked with: db.franchises.find({}, {slug:1})');
      process.exit(1);
    }
    console.log(`Franchise : "${franchiseDoc.displayName}" (${franchiseDoc._id})\n`);

    // ── 2. Read JSON ─────────────────────────────────────────────────────
    const adminsJson = JSON.parse(
      fs.readFileSync(path.join(PROJECT_ROOT, 'area admins.json'), 'utf-8')
    );
    console.log(`Area admins in JSON : ${adminsJson.length}\n`);

    // ── 3. Backfill UserFranchise for each admin ─────────────────────────
    let created = 0;
    let skipped = 0;
    let notFound = 0;
    const missing = [];

    for (const admin of adminsJson) {
      const phone = normalizePhone(admin.Phone);
      const name  = (admin.Name || '').trim();

      if (!phone) {
        console.log('  SKIP (bad phone): %s', name);
        skipped++;
        continue;
      }

      const user = await User.findOne({ phone });
      if (!user) {
        console.log('  NOT FOUND in DB  : "%s" (%s)', name, phone);
        missing.push(`${name} (${phone})`);
        notFound++;
        continue;
      }

      const exists = await UserFranchise.findOne({
        user: user._id,
        franchise: franchiseDoc._id,
      });

      if (exists) {
        skipped++;
        continue;
      }

      await UserFranchise.create({
        user:       user._id,
        franchise:  franchiseDoc._id,
        role:       'area_admin',
        adminScope: user.adminScope || {},
        isActive:   true,
        joinedAt:   user.createdAt || new Date(),
      });

      created++;
      console.log('  ✓ Linked : "%s" (%s)', user.name, phone);
    }

    // ── 4. Summary ───────────────────────────────────────────────────────
    console.log('\n--- Summary ---');
    console.log('  Total in JSON      : %d', adminsJson.length);
    console.log('  UserFranchise added: %d', created);
    console.log('  Already existed    : %d', skipped);
    console.log('  User not in DB     : %d', notFound);

    if (missing.length > 0) {
      console.log('\n--- Users not found in DB (run migrateAreaAdmins.js first) ---');
      missing.forEach((m, i) => console.log('  %d. %s', i + 1, m));
    }

    await mongoose.connection.close();
    console.log('\nDone.');
    process.exit(0);
  } catch (err) {
    console.error('Backfill failed:', err);
    process.exit(1);
  }
}

run();
