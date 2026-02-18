/**
 * Migrate Locations Script
 *
 * Removes all existing district, area, and unit locations from the database
 * and re-imports them from the JSON export files:
 *   - districts.json  (districts)
 *   - areas.json      (areas, linked to districts by districtName)
 *   - units.json      (units, linked to areas by areaName + districtName)
 *
 * The "state" location (Kerala, code KL) is preserved or created if missing.
 *
 * Run from the api directory:
 *   node src/scripts/migrateLocations.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Location = require('../models/Location');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');

async function run() {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      console.error('MONGODB_URI is not set. Set it in .env or environment.');
      process.exit(1);
    }

    await mongoose.connect(uri);
    console.log('Connected to MongoDB\n');

    // ── 1. Read JSON files ──────────────────────────────────────────────
    const districtsJson = JSON.parse(
      fs.readFileSync(path.join(PROJECT_ROOT, 'districts.json'), 'utf-8')
    );
    const areasJson = JSON.parse(
      fs.readFileSync(path.join(PROJECT_ROOT, 'areas.json'), 'utf-8')
    );
    const unitsJson = JSON.parse(
      fs.readFileSync(path.join(PROJECT_ROOT, 'units.json'), 'utf-8')
    );

    console.log('JSON files loaded:');
    console.log('  districts: %d', districtsJson.length);
    console.log('  areas:     %d', areasJson.length);
    console.log('  units:     %d', unitsJson.length);
    console.log('');

    // ── 2. Ensure state exists ──────────────────────────────────────────
    let kerala = await Location.findOne({ type: 'state', code: 'KL' });
    if (!kerala) {
      kerala = await Location.create({
        name: 'Kerala',
        type: 'state',
        code: 'KL',
        parent: null,
        coordinates: { latitude: 10.8505, longitude: 76.2711 },
        population: 33406061,
        area: 38852
      });
      console.log('Created state: Kerala (KL)');
    } else {
      console.log('State already exists: Kerala (KL)');
    }

    // ── 3. Delete existing districts, areas, and units ──────────────────
    const deletedUnits = await Location.deleteMany({ type: 'unit' });
    const deletedAreas = await Location.deleteMany({ type: 'area' });
    const deletedDistricts = await Location.deleteMany({ type: 'district' });
    console.log('Deleted existing locations:');
    console.log('  districts: %d', deletedDistricts.deletedCount);
    console.log('  areas:     %d', deletedAreas.deletedCount);
    console.log('  units:     %d', deletedUnits.deletedCount);
    console.log('');

    // ── 4. Insert districts ─────────────────────────────────────────────
    // Generate unique codes from district title
    const districtCodeMap = new Map(); // title -> code (for dedup)
    function generateDistrictCode(title) {
      // Use first 3 chars + incremental suffix if needed
      const base = title.replace(/[^A-Z]/g, '').substring(0, 4) || title.substring(0, 4).toUpperCase();
      let code = 'D_' + base;
      let suffix = 1;
      while (districtCodeMap.has(code)) {
        code = 'D_' + base + suffix;
        suffix++;
      }
      districtCodeMap.set(code, true);
      return code;
    }

    const districtMap = new Map(); // title (uppercase) -> Location doc
    let districtCount = 0;

    for (const d of districtsJson) {
      const title = d.title.trim();
      const code = generateDistrictCode(title.toUpperCase());

      const doc = await Location.create({
        name: title,
        type: 'district',
        code,
        parent: kerala._id,
        isActive: true
      });
      districtMap.set(title.toUpperCase(), doc);
      districtCount++;
    }
    console.log('Inserted %d districts', districtCount);

    // ── 5. Insert areas ─────────────────────────────────────────────────
    const areaMap = new Map(); // "districtName|areaTitle" -> Location doc
    let areaCount = 0;
    let areaSkipped = 0;

    for (const a of areasJson) {
      const title = a.title.trim();
      const districtName = a.districtName.trim().toUpperCase();
      const parentDistrict = districtMap.get(districtName);

      if (!parentDistrict) {
        console.log('  WARNING: District "%s" not found for area "%s" - skipping', a.districtName, title);
        areaSkipped++;
        continue;
      }

      // Use the code from the JSON, prefixed with A_ for uniqueness
      // Increment areaCount before computing the fallback so each area gets a unique index
      areaCount++;
      const code = 'A_' + (a.code ? a.code.trim() : String(areaCount));

      const doc = await Location.create({
        name: title,
        type: 'area',
        code,
        parent: parentDistrict._id,
        isActive: true
      });

      const key = districtName + '|' + title.toUpperCase();
      areaMap.set(key, doc);
    }
    console.log('Inserted %d areas (skipped %d)', areaCount, areaSkipped);

    // ── 6. Insert units ─────────────────────────────────────────────────
    let unitCount = 0;
    let unitSkipped = 0;
    let unitCodeCounter = 1;

    for (const u of unitsJson) {
      const title = u.title.trim();
      const districtName = (u.districtName || '').trim().toUpperCase();
      const areaName = (u.areaName || '').trim().toUpperCase();

      const areaKey = districtName + '|' + areaName;
      const parentArea = areaMap.get(areaKey);

      if (!parentArea) {
        console.log('  WARNING: Area "%s" in district "%s" not found for unit "%s" - skipping', u.areaName, u.districtName, title);
        unitSkipped++;
        continue;
      }

      const code = 'U_' + String(unitCodeCounter).padStart(5, '0');
      unitCodeCounter++;

      await Location.create({
        name: title,
        type: 'unit',
        code,
        parent: parentArea._id,
        isActive: true
      });
      unitCount++;
    }
    console.log('Inserted %d units (skipped %d)', unitCount, unitSkipped);

    // ── 7. Summary ──────────────────────────────────────────────────────
    console.log('\n--- Migration Summary ---');
    const counts = await Location.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);
    counts.forEach(({ _id, count }) => {
      console.log('  %s: %d', _id, count);
    });

    await mongoose.connection.close();
    console.log('\nDone. Database connection closed.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

run();
