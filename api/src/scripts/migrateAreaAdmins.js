/**
 * Migrate Area Admins Script
 *
 * Imports area admin users from "area admins.json" in the project root.
 * Each record is matched to its Location hierarchy (district → area)
 * and created as a User with role "area_admin".
 *
 * - Handles district/area name mismatches between JSON and DB
 * - Uses phone as the unique identifier; skips if phone already exists
 * - Links adminScope to the correct district and area Location documents
 *
 * Run from the api directory:
 *   node src/scripts/migrateAreaAdmins.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { User, Location, UserFranchise } = require('../models');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');

// Map district names from area admins.json → actual DB district names (uppercase)
const DISTRICT_NAME_MAP = {
  'ERANAKULAM': 'ERNAKULAM',
  // ALAPPUZHA matches the DB exactly — no mapping needed
};

// Map area names from area admins.json → actual DB area names (uppercase)
// Key format: "DISTRICT_DB_NAME|AREA_NAME_FROM_JSON" → "ACTUAL_AREA_NAME_IN_DB"
const AREA_NAME_MAP = {
  // Ernakulam
  'ERNAKULAM|KUNNATHUNADU': 'KUNNATHNADU',
  // Thiruvananthapuram
  'THIRUVANANTHAPURAM|AATINGAL': 'ATTINGAL',
  'THIRUVANANTHAPURAM|PALODE': 'PALOD',
  'THIRUVANANTHAPURAM|KAYAKKOOTAM': 'KAZHAKKOOTTAM',
  // Thrissur
  'THRISSUR|EDAKKAYIZHUR': 'EDAKAZHIYUR',
  'THRISSUR|GURUVAYOOR': 'GURUVAYOOR',
  'THRISSUR|IRINJALAKKUDA': 'IRINJALAKKUDA',
  'THRISSUR|EDAVILANG': 'EDAVILANGU',
  'THRISSUR|VADAKKEDKKAD': 'VADAKKEDKKAD',
};

function normalizeDistrictName(name) {
  const upper = name.trim().toUpperCase();
  return DISTRICT_NAME_MAP[upper] || upper;
}

function normalizeAreaName(districtDbName, areaName) {
  const upper = areaName.trim().toUpperCase();
  const key = districtDbName + '|' + upper;
  return AREA_NAME_MAP[key] || upper;
}

/**
 * Normalise a phone value that may be a number or a spaced string like "94463 23162".
 * Returns a clean 10-digit string, or null if the result is invalid.
 */
function normalizePhone(raw) {
  if (raw === null || raw === undefined) return null;
  const cleaned = String(raw).replace(/\s+/g, '').trim();
  // Must be exactly 10 digits starting with 6-9
  if (/^[6-9]\d{9}$/.test(cleaned)) return cleaned;
  return null;
}

async function run() {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      console.error('MONGODB_URI is not set. Set it in .env or environment.');
      process.exit(1);
    }

    await mongoose.connect(uri);
    console.log('Connected to MongoDB\n');

    // ── 0. Resolve franchise ─────────────────────────────────────────────
    const franchiseSlug = process.env.DEFAULT_FRANCHISE_SLUG || 'people';
    const Franchise = require('../models/Franchise');
    const franchiseDoc = await Franchise.findOne({ slug: franchiseSlug });
    if (!franchiseDoc) {
      console.error(`Franchise with slug "${franchiseSlug}" not found. Set DEFAULT_FRANCHISE_SLUG or run franchise:seed first.`);
      process.exit(1);
    }
    console.log(`Franchise: "${franchiseDoc.displayName}" (${franchiseDoc._id})\n`);

    // ── 1. Read JSON file ───────────────────────────────────────────────
    const jsonPath = path.join(PROJECT_ROOT, 'area admins.json');
    const adminsJson = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    console.log('Area admins to migrate: %d\n', adminsJson.length);

    // ── 2. Pre-load all locations into maps for fast lookup ─────────────
    const allDistricts = await Location.find({ type: 'district' });
    const allAreas = await Location.find({ type: 'area' });

    // district name (uppercase) → Location doc
    const districtMap = new Map();
    for (const d of allDistricts) {
      districtMap.set(d.name.toUpperCase(), d);
    }

    // "districtId|areaName(uppercase)" → Location doc
    const areaMap = new Map();
    for (const a of allAreas) {
      const key = a.parent.toString() + '|' + a.name.toUpperCase();
      areaMap.set(key, a);
    }

    // ── 3. Migrate each area admin ──────────────────────────────────────
    let created = 0;
    let skipped = 0;
    let failed = 0;
    const failures = [];

    for (const admin of adminsJson) {
      const phone = normalizePhone(admin.Phone);
      const name = (admin.Name || '').trim();
      const areaName = (admin.Area || '').trim();
      const districtRaw = (admin.District || '').trim();

      if (!phone) {
        const msg = `Invalid/missing phone "${admin.Phone}" for "${name}"`;
        console.log('  SKIP: %s', msg);
        failures.push(msg);
        skipped++;
        continue;
      }

      if (!areaName || !districtRaw) {
        console.log('  SKIP: Missing area/district for "%s" (%s)', name, phone);
        skipped++;
        continue;
      }

      // Check if user already exists with this phone
      const existing = await User.findOne({ phone });
      if (existing) {
        console.log('  SKIP: User already exists for "%s" (%s)', name, phone);
        skipped++;
        continue;
      }

      // Resolve district
      const districtDbName = normalizeDistrictName(districtRaw);
      const districtDoc = districtMap.get(districtDbName);
      if (!districtDoc) {
        const msg = `District "${districtRaw}" (→ "${districtDbName}") not found for "${name}" (${phone})`;
        console.log('  FAIL: %s', msg);
        failures.push(msg);
        failed++;
        continue;
      }

      // Resolve area (with name mapping)
      const areaNormalized = normalizeAreaName(districtDbName, areaName);
      const areaKey = districtDoc._id.toString() + '|' + areaNormalized;
      const areaDoc = areaMap.get(areaKey);
      if (!areaDoc) {
        const msg = `Area "${areaName}" (→ "${areaNormalized}") in district "${districtDbName}" not found for "${name}" (${phone})`;
        console.log('  FAIL: %s', msg);
        failures.push(msg);
        failed++;
        continue;
      }

      // Create user
      try {
        const user = await User.create({
          name,
          phone,
          role: 'area_admin',
          password: null,
          isVerified: true,
          isActive: true,
          adminScope: {
            level: 'area',
            district: districtDoc._id,
            area: areaDoc._id,
            regions: [areaDoc._id],
            permissions: {
              canCreateUsers: true,
              canManageProjects: false,
              canManageSchemes: false,
              canApproveApplications: true,
              canViewReports: true,
              canManageFinances: false
            }
          },
          profile: {
            location: {
              district: districtDoc._id,
              area: areaDoc._id
            }
          }
        });

        // Create UserFranchise so the user is visible within this franchise
        await UserFranchise.create({
          user: user._id,
          franchise: franchiseDoc._id,
          role: 'area_admin',
          adminScope: user.adminScope,
          isActive: true,
          joinedAt: new Date(),
        });

        created++;
        console.log('  ✓ Created area_admin: "%s" (%s) → %s / %s', name, phone, districtDoc.name, areaDoc.name);
      } catch (err) {
        const msg = `Create failed for "${name}" (${phone}): ${err.message}`;
        console.log('  FAIL: %s', msg);
        failures.push(msg);
        failed++;
      }
    }

    // ── 4. Summary ──────────────────────────────────────────────────────
    console.log('\n--- Migration Summary ---');
    console.log('  Total in JSON:   %d', adminsJson.length);
    console.log('  Users created:   %d', created);
    console.log('  Skipped (exist): %d', skipped);
    console.log('  Failed:          %d', failed);

    if (failures.length > 0) {
      console.log('\n--- Failures ---');
      failures.forEach((f, i) => console.log('  %d. %s', i + 1, f));
    }

    await mongoose.connection.close();
    console.log('\nDone. Database connection closed.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

run();
