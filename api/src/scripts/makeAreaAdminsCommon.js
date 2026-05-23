/**
 * Make Area Admins Common (Cross-Franchise)
 *
 * For every user in "area admins.json" that already exists in the DB,
 * this script creates (or reactivates) a UserFranchise record for EACH
 * active franchise — identical to what the platform does when
 * isCommonAdmin = true in createFranchiseAdmin.
 *
 * Safe to run multiple times — existing records are upserted, not duplicated.
 *
 * Run from the api directory:
 *   node src/scripts/makeAreaAdminsCommon.js
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

    // ── 1. Load all active franchises ────────────────────────────────────
    const activeFranchises = await Franchise.find({ isActive: true }).select('_id slug displayName').lean();
    if (activeFranchises.length === 0) {
      console.error('No active franchises found.');
      process.exit(1);
    }
    console.log(`Active franchises (${activeFranchises.length}):`);
    activeFranchises.forEach(f => console.log(`  • [${f.slug}] ${f.displayName} (${f._id})`));
    console.log();

    // ── 2. Read area admins JSON ─────────────────────────────────────────
    const adminsJson = JSON.parse(
      fs.readFileSync(path.join(PROJECT_ROOT, 'area admins.json'), 'utf-8')
    );
    console.log(`Area admins in JSON: ${adminsJson.length}\n`);

    // ── 3. Process each admin ─────────────────────────────────────────────
    let processedUsers = 0;
    let membershipsCreated = 0;
    let membershipsUpdated = 0;
    let notFound = 0;
    const missing = [];

    for (const admin of adminsJson) {
      const phone = normalizePhone(admin.Phone);
      const name  = (admin.Name || '').trim();

      if (!phone) {
        console.log('  SKIP (bad phone): %s', name);
        continue;
      }

      const user = await User.findOne({ phone });
      if (!user) {
        console.log('  NOT FOUND: "%s" (%s) — run migrateAreaAdmins.js first', name, phone);
        missing.push(`${name} (${phone})`);
        notFound++;
        continue;
      }

      // Assign to every active franchise
      for (const franchise of activeFranchises) {
        const existing = await UserFranchise.findOne({
          user: user._id,
          franchise: franchise._id,
        });

        if (existing) {
          // Reactivate and ensure role/scope is up to date
          if (!existing.isActive || existing.role !== 'area_admin') {
            existing.isActive = true;
            existing.role = 'area_admin';
            existing.adminScope = user.adminScope || {};
            await existing.save();
            membershipsUpdated++;
          }
          // Already correct — nothing to do
        } else {
          await UserFranchise.create({
            user:       user._id,
            franchise:  franchise._id,
            role:       'area_admin',
            adminScope: user.adminScope || {},
            isActive:   true,
            joinedAt:   user.createdAt || new Date(),
          });
          membershipsCreated++;
        }
      }

      processedUsers++;
    }

    // ── 4. Summary ────────────────────────────────────────────────────────
    console.log('\n--- Summary ---');
    console.log('  Users processed         : %d / %d', processedUsers, adminsJson.length);
    console.log('  Franchises per user      : %d', activeFranchises.length);
    console.log('  UserFranchise created    : %d', membershipsCreated);
    console.log('  UserFranchise updated    : %d', membershipsUpdated);
    console.log('  Users not found in DB    : %d', notFound);

    if (missing.length > 0) {
      console.log('\n--- Missing users (not in DB) ---');
      missing.forEach((m, i) => console.log('  %d. %s', i + 1, m));
    }

    await mongoose.connection.close();
    console.log('\nDone.');
    process.exit(0);
  } catch (err) {
    console.error('Script failed:', err);
    process.exit(1);
  }
}

run();
