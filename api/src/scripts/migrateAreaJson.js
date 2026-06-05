/**
 * Migrate Area JSON Script
 *
 * Imports both Area Admins and Area Presidents from "area.json" in the
 * project root.  Each record is matched to its Location hierarchy
 * (district → area) and created as a User with the correct role.
 *
 * Role mapping:
 *   "Area Admin"      → area_admin
 *   "Area President"  → area_president
 *
 * These persons are COMMON ADMINS — active in every franchise (Peoples,
 * Baidh Zakat, …).  So after creating / verifying each User, the script
 * upserts a UserFranchise record for EVERY active franchise.
 *
 * Safe to re-run:
 *   - User creation is skipped if a user with the same phone already exists.
 *   - UserFranchise records are upserted (created or reactivated), never
 *     duplicated.
 *
 * Run from the api/ directory:
 *   node src/scripts/migrateAreaJson.js
 *
 * Failures (unresolved districts/areas, bad phones) are listed at the end.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { User, Location, UserFranchise } = require('../models');
const Franchise = require('../models/Franchise');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');

// ─────────────────────────────────────────────────────────────────────────────
// Name normalisation maps
// ─────────────────────────────────────────────────────────────────────────────

/**
 * District names in area.json  →  district names stored in Location DB
 * (Location.name is taken from districts.json "title" field)
 */
const DISTRICT_NAME_MAP = {
  'TRIVANDRUM':  'THIRUVANANTHAPURAM',
  // ALAPPUZHA matches DB exactly — remove the wrong ALAPUZHA mapping
  'KASARGODE':   'KASARGOD',
  // MALAPPURAM EAST and MALAPPURAM WEST exist as real districts in the DB — no mapping needed
};

/**
 * Area names in area.json  →  area names stored in Location DB
 * (Location.name is taken from areas.json "title" field)
 *
 * Key format: "DB_DISTRICT_NAME|AREA_NAME_FROM_JSON"
 *             (both already uppercased before lookup)
 */
const AREA_NAME_MAP = {
  // Kasargod
  'KASARGOD|KANJAGAD':             'KANHANGAD',
  'KASARGOD|THRIKKARIPPUR':        'TRIKKARIPUR',
  'KASARGOD|KASARGOD':             'KASARAGOD',
  // Kannur
  'KANNUR|CHAKKARAKALLU':          'CHAKKARAKKAL',
  'KANNUR|THALIPARAMBA':           'TALIPARAMBA',
  'KANNUR|NEW MAHI':               'NEW MAHE',
  // Wayanad
  'WAYANAD|KALPETTA':              'KALPATTA',
  'WAYANAD|MANANTHAVADI':          'MANANTHAVADY',
  // Kozhikode
  'KOZHIKODE|AYANCHERI':           'AYANCHERY',
  'KOZHIKODE|THIRUVAMBADI':        'TIRUVAMBADI',
  'KOZHIKODE|N I T':               'N.I.T',
  'KOZHIKODE|KAKKODI':             'KAKKODY',
  // Malappuram East (area names that differ from JSON)
  'MALAPPURAM EAST|MAKKARAPARAMB': 'MAKKARAPARAMBA',
  'MALAPPURAM EAST|PADAPPARAMBA':  'PADAPPARAMBU',
  'MALAPPURAM EAST|KARUVARAKUNDU': 'KARUVARAKKUND',
  // Malappuram West (area names that differ from JSON)
  'MALAPPURAM WEST|A R NAGAR':     'A.R.NAGAR',
  'MALAPPURAM WEST|PERUMBADAPPU':  'PERUMBADAPP',
  // Thrissur
  'THRISSUR|CHALAKKUDY':           'CHALAKKUDI',
  'THRISSUR|EDAKKAZHIYUR':         'EDAKAZHIYUR',
  'THRISSUR|EDAVILANG':            'EDAVILANGU',
  'THRISSUR|GURUVAYUR':            'GURUVAYOOR',
  'THRISSUR|SN PURAM':             'S N PURAM',
  'THRISSUR|VADANAPPALLY':         'VADANAPALLY',
  'THRISSUR|VADAKKANCHERY':        'WADAKKANCHERY',
  // Ernakulam
  'ERNAKULAM|CHENGAMANADU':        'CHENGAMANAD',
  // Kochi City
  'KOCHI CITY|VYTTILA':            'VYTILA',
  // Alappuzha
  'ALAPPUZHA|AMBALAPPUZHA':        'AMBALAPUZHA',
  'ALAPPUZHA|HARIPPAD':            'HARIPAD',
  // Kottayam
  'KOTTAYAM|THALAYOLAPPARAMBU':    'TALAYOLAPARAMBU',
  // Palakkad
  'PALAKKAD|KOLLANGODE':           'KOLLANGOD',
  'PALAKKAD|PUTHUCODE':            'PUTHUKKOD',
  'PALAKKAD|TRITHALA':             'THRITHALA',
};

/**
 * When area.json lists "MALAPPURAM" as the district but the DB has split it
 * into MALAPPURAM EAST and MALAPPURAM WEST, we need to route each area to
 * the correct sub-district.
 *
 * Key: area name from JSON, uppercased (before any AREA_NAME_MAP mapping).
 * Value: the DB district name to use instead.
 */
const MALAPPURAM_AREA_REROUTE = {
  // ── MALAPPURAM EAST ──────────────────────────────────────────────────────
  'AREEKODE':        'MALAPPURAM EAST',
  'CHUNGATHARA':     'MALAPPURAM EAST',
  'EDAVANNA':        'MALAPPURAM EAST',
  'KARUVARAKUNDU':   'MALAPPURAM EAST',
  'KONDOTTY':        'MALAPPURAM EAST',
  'PULIKKAL':        'MALAPPURAM EAST',
  'MALAPPURAM':      'MALAPPURAM EAST',
  'MAKKARAPARAMB':   'MALAPPURAM EAST',
  'MAMPAD':          'MALAPPURAM EAST',
  'MANJERI':         'MALAPPURAM EAST',
  'NILAMBUR':        'MALAPPURAM EAST',
  'PADAPPARAMBA':    'MALAPPURAM EAST',
  'PANDIKKAD':       'MALAPPURAM EAST',
  'PERINTHALMANNA':  'MALAPPURAM EAST',
  'SANTHAPURAM':     'MALAPPURAM EAST',
  'TIRURKAD':        'MALAPPURAM EAST',
  'VALLUVAMBRAM':    'MALAPPURAM EAST',
  'VAZHAKKAD':       'MALAPPURAM EAST',
  'WANDOOR':         'MALAPPURAM EAST',
  // ── MALAPPURAM WEST ──────────────────────────────────────────────────────
  'A R NAGAR':       'MALAPPURAM WEST',
  'ALATHIYUR':       'MALAPPURAM WEST',
  'EDAPPAL':         'MALAPPURAM WEST',
  'KOTTAKKAL':       'MALAPPURAM WEST',
  'MARANCHERY':      'MALAPPURAM WEST',
  'PARAPPUR':        'MALAPPURAM WEST',
  'PERUMBADAPPU':    'MALAPPURAM WEST',
  'PONNANI':         'MALAPPURAM WEST',
  'PUTHANATHANI':    'MALAPPURAM WEST',
  'TANALUR':         'MALAPPURAM WEST',
  'TANUR':           'MALAPPURAM WEST',
  'THALAKKAD':       'MALAPPURAM WEST',
  'TIRUR':           'MALAPPURAM WEST',
  'TIRURANGADI':     'MALAPPURAM WEST',
  'UNIVERSITY':      'MALAPPURAM WEST',
  'VAILATHUR':       'MALAPPURAM WEST',
  'VALANCHERY':      'MALAPPURAM WEST',
  'VENGARA':         'MALAPPURAM WEST',
};



function normalizeDistrictName(raw, rawArea) {
  const upper = (raw || '').trim().toUpperCase();
  const mapped = DISTRICT_NAME_MAP[upper] || upper;

  // Plain MALAPPURAM no longer exists in DB — reroute to EAST or WEST
  if (mapped === 'MALAPPURAM') {
    const areaUpper = (rawArea || '').trim().toUpperCase();
    const rerouted = MALAPPURAM_AREA_REROUTE[areaUpper];
    if (rerouted) return rerouted;
    // Not in map — return as-is so it fails with a clear message
  }

  return mapped;
}

function normalizeAreaName(dbDistrictName, rawArea) {
  const upper = (rawArea || '').trim().toUpperCase();
  const key   = dbDistrictName + '|' + upper;
  return AREA_NAME_MAP[key] || upper;
}

/**
 * Convert a phone value (number or string, possibly with spaces) to a clean
 * 10-digit Indian mobile number string, or null if invalid.
 */
function normalizePhone(raw) {
  if (raw === null || raw === undefined) return null;
  // Handle comma-separated numbers (e.g. "9447123578, 9847078157") — take first
  const first = String(raw).split(',')[0];
  const cleaned = first.replace(/\s+/g, '').trim();
  return /^[6-9]\d{9}$/.test(cleaned) ? cleaned : null;
}

/** Map JSON "Role" value → User.role enum */
function mapRole(jsonRole) {
  const r = (jsonRole || '').trim();
  if (r === 'Area Admin')     return 'area_admin';
  if (r === 'Area President') return 'area_president';
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function run() {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      console.error('MONGODB_URI is not set. Set it in .env or environment.');
      process.exit(1);
    }

    await mongoose.connect(uri);
    console.log('Connected to MongoDB\n');

    // ── 1. Load all active franchises ─────────────────────────────────────
    const activeFranchises = await Franchise.find({ isActive: true })
      .select('_id slug displayName')
      .lean();

    if (activeFranchises.length === 0) {
      console.error('No active franchises found. Run franchise:seed first.');
      process.exit(1);
    }
    console.log(`Active franchises (${activeFranchises.length}):`);
    activeFranchises.forEach(f =>
      console.log(`  • [${f.slug}] ${f.displayName}  (${f._id})`)
    );
    console.log();

    // ── 2. Read area.json ─────────────────────────────────────────────────
    const jsonPath = path.join(PROJECT_ROOT, 'area.json');
    const records  = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    console.log(`Records in area.json: ${records.length}\n`);

    // ── 3. Pre-load Location maps ─────────────────────────────────────────
    const allDistricts = await Location.find({ type: 'district' }).lean();
    const allAreas     = await Location.find({ type: 'area'     }).lean();

    // districtName.toUpperCase() → Location doc
    const districtMap = new Map();
    for (const d of allDistricts) {
      districtMap.set(d.name.toUpperCase(), d);
    }

    // "districtId|areaName.toUpperCase()" → Location doc
    const areaMap = new Map();
    for (const a of allAreas) {
      const key = a.parent.toString() + '|' + a.name.toUpperCase();
      areaMap.set(key, a);
    }

    // ── 4. Process each record ────────────────────────────────────────────
    let usersCreated      = 0;
    let usersSkipped      = 0;   // already existed
    let memberCreated     = 0;
    let memberReactivated = 0;
    let failed            = 0;
    const failures        = [];

    for (const rec of records) {
      const phone       = normalizePhone(rec.Phone);
      const name        = (rec.Name     || '').trim();
      const rawRole     = (rec.Role     || '').trim();
      const rawArea     = (rec.Area     || '').trim();
      const rawDistrict = (rec.District || '').trim();
      const slNo        = rec['Sl No'];

      // ── Validate phone ──────────────────────────────────────────────────
      if (!phone) {
        const msg = `[#${slNo}] "${name}" — invalid/missing phone: "${rec.Phone}"`;
        console.log('  FAIL: %s', msg);
        failures.push(msg);
        failed++;
        continue;
      }

      // ── Validate role ───────────────────────────────────────────────────
      const role = mapRole(rawRole);
      if (!role) {
        const msg = `[#${slNo}] "${name}" (${phone}) — unknown role: "${rawRole}"`;
        console.log('  FAIL: %s', msg);
        failures.push(msg);
        failed++;
        continue;
      }

      // ── Resolve district ────────────────────────────────────────────────
      const dbDistrictName = normalizeDistrictName(rawDistrict, rawArea);
      const districtDoc    = districtMap.get(dbDistrictName);
      if (!districtDoc) {
        const msg = `[#${slNo}] "${name}" (${phone}) — district "${rawDistrict}" → "${dbDistrictName}" not found in DB`;
        console.log('  FAIL: %s', msg);
        failures.push(msg);
        failed++;
        continue;
      }

      // ── Resolve area ────────────────────────────────────────────────────
      const dbAreaName  = normalizeAreaName(dbDistrictName, rawArea);
      const areaKey     = districtDoc._id.toString() + '|' + dbAreaName;
      const areaDoc     = areaMap.get(areaKey);
      if (!areaDoc) {
        const msg = `[#${slNo}] "${name}" (${phone}) — area "${rawArea}" → "${dbAreaName}" in district "${dbDistrictName}" not found in DB`;
        console.log('  FAIL: %s', msg);
        failures.push(msg);
        failed++;
        continue;
      }

      // ── Determine adminScope ────────────────────────────────────────────
      const adminScope = {
        level:    'area',
        district: districtDoc._id,
        area:     areaDoc._id,
        regions:  [areaDoc._id],
        permissions: {
          canCreateUsers:         true,
          canManageProjects:      false,
          canManageSchemes:       false,
          canApproveApplications: true,
          canViewReports:         true,
          canManageFinances:      false,
        },
      };

      // ── Find or create User ─────────────────────────────────────────────
      let user = await User.findOne({ phone });

      if (!user) {
        try {
          user = await User.create({
            name,
            phone,
            role,
            password:   null,
            isVerified: true,
            isActive:   true,
            adminScope,
            profile: {
              location: {
                district: districtDoc._id,
                area:     areaDoc._id,
              },
            },
          });
          usersCreated++;
          console.log(
            '  ✓ Created %s: "%s" (%s) → %s / %s',
            role, name, phone, districtDoc.name, areaDoc.name
          );
        } catch (err) {
          const msg = `[#${slNo}] "${name}" (${phone}) — User.create failed: ${err.message}`;
          console.log('  FAIL: %s', msg);
          failures.push(msg);
          failed++;
          continue;
        }
      } else {
        usersSkipped++;
        console.log(
          '  – Existing user "%s" (%s) role=%s → ensuring franchise memberships',
          name, phone, user.role
        );
      }

      // ── Upsert UserFranchise for every active franchise ─────────────────
      for (const franchise of activeFranchises) {
        try {
          const existing = await UserFranchise.findOne({
            user:      user._id,
            franchise: franchise._id,
            role,
          });

          if (existing) {
            if (!existing.isActive) {
              existing.isActive   = true;
              existing.adminScope = adminScope;
              await existing.save();
              memberReactivated++;
            }
            // already correct — nothing to do
          } else {
            await UserFranchise.create({
              user:       user._id,
              franchise:  franchise._id,
              role,
              adminScope,
              isActive:   true,
              joinedAt:   user.createdAt || new Date(),
            });
            memberCreated++;
          }
        } catch (err) {
          const msg = `[#${slNo}] "${name}" (${phone}) — UserFranchise upsert failed for franchise [${franchise.slug}]: ${err.message}`;
          console.log('  WARN: %s', msg);
          failures.push(msg);
        }
      }
    }

    // ── 5. Summary ────────────────────────────────────────────────────────
    console.log('\n' + '='.repeat(50));
    console.log('Migration Summary');
    console.log('='.repeat(50));
    console.log('  Total records in JSON  : %d', records.length);
    console.log('  Users created          : %d', usersCreated);
    console.log('  Users already existing : %d', usersSkipped);
    console.log('  UserFranchise created  : %d', memberCreated);
    console.log('  UserFranchise reactvtd : %d', memberReactivated);
    console.log('  Active franchises      : %d', activeFranchises.length);
    console.log('  Failed / Skipped       : %d', failed);

    if (failures.length > 0) {
      console.log('\n' + '-'.repeat(50));
      console.log('Failures (%d):', failures.length);
      console.log('-'.repeat(50));
      failures.forEach((f, i) => console.log('  %d. %s', i + 1, f));
    } else {
      console.log('\n  ✓ No failures.');
    }

    await mongoose.connection.close();
    console.log('\nDone. Connection closed.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

run();
