/**
 * Seed Franchises Script
 * ======================
 * Creates the initial franchise records for People Foundation and Baithuzzakath.
 * Uses the existing orgConfig.js ORG_PRESETS as the source of truth.
 *
 * SAFE TO RUN MULTIPLE TIMES — fully idempotent (upserts by slug).
 *
 * Usage:
 *   node src/scripts/seedFranchises.js
 *   # or via npm script:
 *   npm run franchise:seed
 */

require('dotenv').config();
const mongoose = require('mongoose');
const config = require('../config/environment');
const { ORG_PRESETS } = require('../config/orgConfig');
const Franchise = require('../models/Franchise');
const WebsiteSettings = require('../models/WebsiteSettings');
const rbacService = require('../services/rbacService');

// ── Franchise definitions derived from orgConfig presets ─────────────────────

const FRANCHISE_SEEDS = [
  {
    slug: 'people',
    orgKey: 'people_foundation',
    // List all custom domains this franchise should respond to.
    // Subdomain (people.peopleerp.com) is handled automatically via BASE_DOMAIN.
    // Add production domains here, e.g.:
    //   domains: ['erp.peoplefoundation.org', 'peoplefoundation.org']
    domains: [],
  },
  {
    slug: 'bz',
    orgKey: 'baithuzzakath',
    // Add production domains here, e.g.:
    //   domains: ['erp.baithuzzakath.org', 'baithuzzakath.org']
    domains: [],
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a Franchise document from an orgConfig preset.
 */
function buildFranchiseDoc(seed) {
  const preset = ORG_PRESETS[seed.orgKey];
  if (!preset) throw new Error(`Unknown orgKey: ${seed.orgKey}`);

  return {
    slug: seed.slug,
    name: preset.displayName,
    displayName: preset.displayName,
    tagline: preset.tagline,
    logoUrl: `/uploads/logos/${preset.logoFilename}`,
    defaultTheme: preset.defaultTheme || 'blue',
    customTheme: null,
    erpTitle: preset.erpTitle,
    erpSubtitle: preset.erpSubtitle,
    domains: Array.isArray(seed.domains) ? seed.domains : [],
    isActive: true,
    settings: {
      contactPhone: preset.phone,
      contactEmail: preset.email,
      supportEmail: preset.supportEmail,
      address: preset.address,
      websiteUrl: preset.websiteUrl,
      copyrightHolder: preset.copyrightHolder,
      footerText: preset.footerText,
      regNumber: preset.regNumber,
    },
  };
}

/**
 * Build default WebsiteSettings for a franchise.
 */
function buildWebsiteSettings(franchiseId, preset) {
  return {
    franchise: franchiseId,
    aboutUs: {
      title: `About ${preset.displayName}`,
      description: preset.aboutText || preset.heroSubtext || '',
    },
    contactDetails: {
      phone: preset.phone,
      email: preset.email,
      address: preset.address,
    },
    counts: [
      { title: 'Beneficiaries Served', count: 0, icon: 'users', order: 1 },
      { title: 'Active Projects',      count: 0, icon: 'folder', order: 2 },
      { title: 'Total Donors',         count: 0, icon: 'heart',  order: 3 },
      { title: 'Districts Covered',    count: 0, icon: 'map-pin', order: 4 },
    ],
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function seedFranchises() {
  console.log('🌱 Starting franchise seed...\n');

  // Connect to MongoDB — disable autoIndex so we control when indexes are built
  await mongoose.connect(config.MONGODB_URI, { autoIndex: false });
  console.log(`✅ Connected to MongoDB: ${config.MONGODB_URI.replace(/\/\/.*@/, '//***@')}\n`);

  // ── Drop stale unique indexes left over from pre-franchise schema ────────
  const dropStaleIndex = async (collectionName, indexName) => {
    try {
      await mongoose.connection.db.collection(collectionName).dropIndex(indexName);
      console.log(`  🗑️  Dropped stale index "${indexName}" from ${collectionName}`);
    } catch (e) {
      if (e.code === 27 || e.codeName === 'IndexNotFound') {
        // Already gone — fine
      } else {
        console.warn(`  ⚠️  Could not drop ${collectionName}.${indexName}: ${e.message}`);
      }
    }
  };
  await dropStaleIndex('permissions', 'name_1');
  await dropStaleIndex('roles', 'name_1');
  await dropStaleIndex('franchises', 'domain_1');
  await dropStaleIndex('franchises', 'domains_1'); // drop to allow Mongoose to recreate with correct unique settings

  // Ensure existing franchise docs have an empty domains[] array (not null/missing)
  // so the unique multikey index does not create conflicting null entries
  const domainInit = await mongoose.connection.db.collection('franchises')
    .updateMany(
      { domains: { $exists: false } },
      { $set: { domains: [] } }
    );
  if (domainInit.modifiedCount > 0) {
    console.log(`  🔧  Initialized domains[] on ${domainInit.modifiedCount} franchise(s)`);
  }

  // Migrate legacy single-domain field → domains array (one-time, idempotent)
  const migDomain = await mongoose.connection.db.collection('franchises')
    .updateMany(
      { domain: { $exists: true, $ne: null }, domains: { $exists: false } },
      [{ $set: { domains: ['$domain'] } }]
    );
  if (migDomain.modifiedCount > 0) {
    console.log(`  🔄  Migrated legacy domain field to domains[] for ${migDomain.modifiedCount} franchise(s)`);
  }

  // Unset null domain fields so sparse unique index treats them as absent
  const domainFix = await mongoose.connection.db.collection('franchises')
    .updateMany({ domain: null }, { $unset: { domain: '' } });
  if (domainFix.modifiedCount > 0) {
    console.log(`  🔧  Cleared null domain from ${domainFix.modifiedCount} franchise(s)`);
  }

  // Now that data is clean, create/sync all indexes for the models we touch
  const Permission   = require('../models/Permission');
  const Role         = require('../models/Role');
  await Franchise.syncIndexes();
  await Permission.syncIndexes();
  await Role.syncIndexes();
  console.log('  ✅ Indexes synced\n');

  const results = [];

  for (const seed of FRANCHISE_SEEDS) {
    const preset = ORG_PRESETS[seed.orgKey];
    console.log(`─── Processing franchise: ${seed.slug} (${preset.displayName}) ───`);

    // ── 1. Upsert Franchise ───────────────────────────────────────────────
    const franchiseDoc = buildFranchiseDoc(seed);
    let franchise = await Franchise.findOne({ slug: seed.slug });

    if (franchise) {
      console.log(`  ℹ️  Franchise "${seed.slug}" already exists (${franchise._id}) — updating non-critical fields`);
      // Only update safe fields; don't stomp over production changes
      franchise.tagline      = franchise.tagline      || franchiseDoc.tagline;
      franchise.erpTitle     = franchise.erpTitle     || franchiseDoc.erpTitle;
      franchise.erpSubtitle  = franchise.erpSubtitle  || franchiseDoc.erpSubtitle;
      franchise.logoUrl      = franchise.logoUrl      || franchiseDoc.logoUrl;
      if (!franchise.settings) franchise.settings = franchiseDoc.settings;
      await franchise.save();
    } else {
      franchise = await Franchise.create(franchiseDoc);
      console.log(`  ✅ Created franchise "${seed.slug}" with _id: ${franchise._id}`);
    }

    // ── 2. Initialize RBAC (idempotent) ───────────────────────────────────
    console.log(`  🔐 Initializing RBAC for franchise ${franchise._id}...`);
    await rbacService.initializeFranchiseRBAC(franchise._id);

    // ── 3. Upsert default WebsiteSettings ────────────────────────────────
    const existingWS = await WebsiteSettings.findOne({ franchise: franchise._id })
      .setOptions({ bypassFranchise: true });

    if (!existingWS) {
      const wsData = buildWebsiteSettings(franchise._id, preset);
      await WebsiteSettings.create(wsData);
      console.log(`  🌐 Created default WebsiteSettings for franchise ${franchise._id}`);
    } else {
      console.log(`  ℹ️  WebsiteSettings already exist for franchise ${franchise._id}`);
    }

    results.push({ slug: seed.slug, franchiseId: franchise._id.toString() });
    console.log();
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════');
  console.log('✅ Franchise seed complete!\n');
  console.log('Franchise IDs (save these for migration):');
  for (const r of results) {
    console.log(`  ${r.slug.padEnd(10)} → ${r.franchiseId}`);
  }
  console.log();
  console.log('Next step: npm run franchise:migrate');
  console.log('═══════════════════════════════════════════\n');

  await mongoose.disconnect();
}

seedFranchises().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
