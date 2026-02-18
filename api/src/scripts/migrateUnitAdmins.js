/**
 * Migrate Unit Admins Script
 *
 * Imports unit admin users from unitadmins.json.
 * Each record is matched to its Location hierarchy (district → area → unit)
 * and created as a User with role "unit_admin".
 *
 * - Handles district/area name mismatches between JSON and DB
 * - Uses phone (contactNo) as the unique identifier; skips if phone already exists
 * - Links adminScope to the correct district, area, and unit Location documents
 *
 * Run from the api directory:
 *   node src/scripts/migrateUnitAdmins.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { User, Location } = require('../models');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');

// Map district names from unitadmins.json → actual DB district names (uppercase)
const DISTRICT_NAME_MAP = {
  'ALAPPUZHA': 'ALAPUZHA',
  'KASARAGODE': 'KASARGOD',
  'KOCHI': 'KOCHI CITY',
  'KOZHIKODE (CITY)': 'KOZHIKODE CITY',
};

// Map area names from unitadmins.json → actual DB area names (uppercase)
// Key format: "DISTRICT_DB_NAME|AREA_NAME_FROM_JSON" → "ACTUAL_AREA_NAME_IN_DB"
const AREA_NAME_MAP = {
  // Ernakulam
  'ERNAKULAM|KUNNATHUNAD': 'KUNNATHNADU',
  // Kannur
  'KANNUR|VALAPATANAM': 'VALAPATTANAM',
  // Kollam
  'KOLLAM|KADAKKAL': 'KADACKAL',
  // Kozhikode
  'KOZHIKODE|KAKKODI': 'KAKKODY',
  'KOZHIKODE|KODIYATHUR': 'KODIYATHOOR',
  'KOZHIKODE|KUTTIADY': 'KUTTIADI',
  'KOZHIKODE|MEPPAYYUR': 'MEPPAYUR',
  'KOZHIKODE|N I T': 'N.I.T',
  'KOZHIKODE|PALATH': 'RAMANATTUKARA', // Palath is part of Ramanattukara area
  'KOZHIKODE|VATAKARA': 'VADAKARA',
  // Malappuram
  'MALAPPURAM|A R NAGAR': 'A.R.NAGAR',
  'MALAPPURAM|AREEKOD': 'AREEKODE',
  'MALAPPURAM|KARUVARAKUNDU': 'KARUVARAKKUND',
  'MALAPPURAM|KONDOTTY': 'KONDOTTY EAST',
  'MALAPPURAM|MAKKARAPPARAMBA': 'MAKKARAPARAMBA',
  'MALAPPURAM|PADAPARAMBA': 'PADAPPARAMBU',
  'MALAPPURAM|PERUMPADAPPU': 'PERUMBADAPP',
  'MALAPPURAM|THIRURKAD': 'TIRURKAD',
  // Thiruvananthapuram
  'THIRUVANANTHAPURAM|KAZHAKKOOTTAM': 'KAZHAKOOTTAM',
  'THIRUVANANTHAPURAM|PALODE': 'PALOD',
  'THIRUVANANTHAPURAM|THIRUVANANTHAPURAM NORTH': 'TRIVANDRUM NORTH',
  'THIRUVANANTHAPURAM|THIRUVANANTHAPURAM SOUTH': 'TRIVANDRUM SOUTH',
  'THIRUVANANTHAPURAM|THIRUVANANTHAPURAM WEST': 'TRIVANDRUM WEST',
  // Thrissur
  'THRISSUR|EDAKKAZHIYUR': 'EDAKAZHIYUR',
  'THRISSUR|EDAVILANG': 'EDAVILANGU',
  'THRISSUR|GURUVAYUR': 'GURUVAYOOR',
  'THRISSUR|IRINJALAKUDA': 'IRINJALAKKUDA',
  'THRISSUR|VATANAPALLY': 'VADANAPALLY',
  // Wayanad
  'WAYANAD|SULTHAN BATHERY': 'SULTHAN BATHERI',
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
 * Validate an email address using a robust regex.
 * Returns true only for well-formed addresses.
 */
function validateEmail(email) {
  if (!email) return false;
  // RFC 5322-inspired regex: requires non-empty local part, @, domain with at least one dot
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
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

    // ── 1. Read JSON file ───────────────────────────────────────────────
    const adminsJson = JSON.parse(
      fs.readFileSync(path.join(PROJECT_ROOT, 'unitadmins.json'), 'utf-8')
    );
    console.log('Unit admins to migrate: %d\n', adminsJson.length);

    // ── 2. Pre-load all locations into maps for fast lookup ─────────────
    const allDistricts = await Location.find({ type: 'district' });
    const allAreas = await Location.find({ type: 'area' });
    const allUnits = await Location.find({ type: 'unit' });

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

    // "areaId|unitName(uppercase)" → Location doc
    const unitMap = new Map();
    // Also build: areaId → [unit docs] for fallback searching
    const unitsByArea = new Map();
    for (const u of allUnits) {
      const key = u.parent.toString() + '|' + u.name.toUpperCase();
      unitMap.set(key, u);
      if (!unitsByArea.has(u.parent.toString())) {
        unitsByArea.set(u.parent.toString(), []);
      }
      unitsByArea.get(u.parent.toString()).push(u);
    }

    // ── 3. Migrate each unit admin ──────────────────────────────────────
    let created = 0;
    let skipped = 0;
    let failed = 0;
    let unitsCreated = 0;
    let unitAutoCode = 10000; // start high to avoid collisions
    const failures = [];

    for (const admin of adminsJson) {
      const phone = (admin.contactNo || '').trim();
      const name = (admin.name || '').trim();
      const rawEmail = (admin.emailId || '').trim();
      // Validate email and skip malformed addresses rather than storing them
      let email;
      if (rawEmail) {
        if (validateEmail(rawEmail)) {
          email = rawEmail;
        } else {
          console.log('  WARN: Invalid email "%s" for "%s" (%s) - omitting email field', rawEmail, name, admin.contactNo);
        }
      }
      const unitName = (admin.unit || '').trim();
      const areaName = (admin.area || '').trim();
      const districtRaw = (admin.district || '').trim();

      if (!phone) {
        console.log('  SKIP: No phone for "%s"', name);
        skipped++;
        continue;
      }

      if (!areaName || !unitName) {
        console.log('  SKIP: Missing area/unit for "%s" (%s)', name, phone);
        skipped++;
        continue;
      }

      // Check if user already exists with this phone
      const existing = await User.findOne({ phone });
      if (existing) {
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

      // Resolve unit - try exact match first, then substring/contains match
      const unitKey = areaDoc._id.toString() + '|' + unitName.toUpperCase();
      let unitDoc = unitMap.get(unitKey);

      if (!unitDoc) {
        // Fallback: search units under this area for a partial match
        const areaUnits = unitsByArea.get(areaDoc._id.toString()) || [];
        const searchName = unitName.toUpperCase();

        // Try: unit name starts with search, or search starts with unit name
        unitDoc = areaUnits.find(u => {
          const uName = u.name.toUpperCase();
          return uName.startsWith(searchName) || searchName.startsWith(uName) ||
                 uName.includes(searchName) || searchName.includes(uName);
        });
      }

      // If unit still not found, create it under the resolved area
      if (!unitDoc) {
        try {
          // Find a unique code by probing the DB before creating
          let newCode;
          let codeFound = false;
          while (!codeFound) {
            unitAutoCode++;
            newCode = 'UA_' + String(unitAutoCode).padStart(5, '0');
            const existing = await Location.findOne({ code: newCode });
            if (!existing) codeFound = true;
          }
          unitDoc = await Location.create({
            name: unitName,
            type: 'unit',
            code: newCode,
            parent: areaDoc._id,
            isActive: true
          });
          // Add to maps for future lookups
          const newKey = areaDoc._id.toString() + '|' + unitName.toUpperCase();
          unitMap.set(newKey, unitDoc);
          if (!unitsByArea.has(areaDoc._id.toString())) {
            unitsByArea.set(areaDoc._id.toString(), []);
          }
          unitsByArea.get(areaDoc._id.toString()).push(unitDoc);
          unitsCreated++;
          console.log('  + Created missing unit: "%s" under area "%s" (%s)', unitName, areaDoc.name, districtDbName);
        } catch (err) {
          const msg = `Failed to create unit "${unitName}" under area "${areaName}": ${err.message}`;
          console.log('  FAIL: %s', msg);
          failures.push(msg);
          failed++;
          continue;
        }
      }

      // Create user
      try {
        await User.create({
          name,
          phone,
          email,
          role: 'unit_admin',
          password: null,
          isVerified: true,
          isActive: admin.isActive !== false,
          adminScope: {
            level: 'unit',
            district: districtDoc._id,
            area: areaDoc._id,
            unit: unitDoc._id,
            regions: [unitDoc._id],
            permissions: {
              canCreateUsers: false,
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
              area: areaDoc._id,
              unit: unitDoc._id
            }
          }
        });
        created++;
      } catch (err) {
        const msg = `Create failed for "${name}" (${phone}): ${err.message}`;
        console.log('  FAIL: %s', msg);
        failures.push(msg);
        failed++;
      }
    }

    // ── 4. Summary ──────────────────────────────────────────────────────
    console.log('\n--- Migration Summary ---');
    console.log('  Total in JSON:  %d', adminsJson.length);
    console.log('  Users created:   %d', created);
    console.log('  Units created:   %d (missing units auto-created)', unitsCreated);
    console.log('  Skipped (exist): %d', skipped);
    console.log('  Failed:         %d', failed);

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
