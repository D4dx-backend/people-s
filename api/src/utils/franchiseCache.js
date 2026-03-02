/**
 * Franchise Cache Utility
 *
 * In-memory TTL cache for franchise lookups.  Eliminates DB round-trips on
 * every request — the tenant resolver calls this on each incoming API call.
 *
 * Uses a simple Map-based TTL store (no Redis dependency required for a
 * single-server deployment).  Swap the backend for node-cache or ioredis
 * if horizontal scaling is needed later.
 *
 * Cache namespaces:
 *   bySlug   — Franchise doc keyed by slug        TTL 5 min
 *   byDomain — Franchise doc keyed by custom domain TTL 5 min
 *   branding — toBrandingObject() keyed by franchiseId TTL 10 min
 *   access   — boolean keyed by `userId:franchiseId`  TTL 2 min
 */

// ── Tiny TTL Map ──────────────────────────────────────────────────────────────

class TTLMap {
  constructor(ttlMs) {
    this._ttl = ttlMs;
    this._store = new Map();
  }

  get(key) {
    const entry = this._store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this._store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key, value) {
    this._store.set(key, { value, expiresAt: Date.now() + this._ttl });
    return this;
  }

  delete(key) {
    this._store.delete(key);
    return this;
  }

  /** Remove all expired entries (call periodically if needed). */
  prune() {
    const now = Date.now();
    for (const [key, entry] of this._store) {
      if (now > entry.expiresAt) this._store.delete(key);
    }
  }

  clear() {
    this._store.clear();
  }
}

// ── Cache stores ──────────────────────────────────────────────────────────────

const FIVE_MIN  = 5  * 60 * 1000;
const TWO_MIN   = 2  * 60 * 1000;
const TEN_MIN   = 10 * 60 * 1000;

const bySlug    = new TTLMap(FIVE_MIN);
const byDomain  = new TTLMap(FIVE_MIN);
const branding  = new TTLMap(TEN_MIN);
const access    = new TTLMap(TWO_MIN);

// Prune expired entries every 5 minutes to prevent unbounded memory growth
setInterval(() => {
  bySlug.prune();
  byDomain.prune();
  branding.prune();
  access.prune();
}, FIVE_MIN).unref(); // .unref() so this timer won't keep the process alive

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch franchise by slug, with caching.
 * Falls back to DB on cache miss.
 * @param {string} slug
 * @returns {Promise<import('../models/Franchise') | null>}
 */
async function getFranchiseBySlug(slug) {
  const cached = bySlug.get(slug);
  if (cached !== undefined) return cached;

  const Franchise = require('../models/Franchise');
  const doc = await Franchise.findBySlug(slug);
  bySlug.set(slug, doc);   // caches null too, so missing slugs don't hit DB repeatedly
  if (doc) byDomain.set(doc.slug, doc); // keep domain cache in sync
  return doc;
}

/**
 * Fetch franchise by custom domain, with caching.
 * @param {string} domain
 * @returns {Promise<import('../models/Franchise') | null>}
 */
async function getFranchiseByDomain(domain) {
  const cached = byDomain.get(domain);
  if (cached !== undefined) return cached;

  const Franchise = require('../models/Franchise');
  const doc = await Franchise.findByDomain(domain);
  // Warm cache for all known domains of this franchise so future lookups
  // for sibling domains are also served from cache
  if (doc && Array.isArray(doc.domains)) {
    doc.domains.forEach(d => byDomain.set(d, doc));
    bySlug.set(doc.slug, doc);
  } else {
    byDomain.set(domain, doc); // cache the miss too
  }
  return doc;
}

/**
 * Get franchise branding object (safe for public API), with caching.
 * @param {string} franchiseId  — MongoDB ObjectId string
 * @returns {Promise<object>}
 */
async function getFranchiseBranding(franchiseId) {
  const key = franchiseId.toString();
  const cached = branding.get(key);
  if (cached !== undefined) return cached;

  const Franchise = require('../models/Franchise');
  const doc = await Franchise.findById(key);
  const result = doc ? doc.toBrandingObject() : null;
  branding.set(key, result);
  return result;
}

/**
 * Check whether a user has access to a franchise (active membership).
 * @param {string} userId
 * @param {string} franchiseId
 * @returns {Promise<boolean>}
 */
async function checkUserAccess(userId, franchiseId) {
  const key = `${userId}:${franchiseId}`;
  const cached = access.get(key);
  if (cached !== undefined) return cached;

  const UserFranchise = require('../models/UserFranchise');
  const result = await UserFranchise.hasAccess(userId, franchiseId);
  access.set(key, result);
  return result;
}

/**
 * Invalidate all cache entries for a franchise (call after franchise updates).
 * @param {Object} franchise  — Franchise document (needs .slug, .domains, .id/_id)
 */
function invalidateFranchise(franchise) {
  bySlug.delete(franchise.slug);
  // Clear all domain entries for this franchise
  const domains = Array.isArray(franchise.domains) ? franchise.domains : [];
  domains.forEach(d => byDomain.delete(d));
  // Legacy: also clear single .domain field if present
  if (franchise.domain) byDomain.delete(franchise.domain);
  branding.delete(franchise._id?.toString() || franchise.id?.toString());
}

/**
 * Invalidate user-access cache entries for a user (call after role changes).
 * @param {string} userId
 */
function invalidateUserAccess(userId) {
  // We cannot enumerate a specific key pattern cheaply, so we prune all access
  // entries for this user by iterating. Access cache is small (2 min TTL).
  const prefix = `${userId}:`;
  for (const key of access._store.keys()) {
    if (key.startsWith(prefix)) access.delete(key);
  }
}

/**
 * Clear all caches (useful in tests or forced refresh).
 */
function clearAll() {
  bySlug.clear();
  byDomain.clear();
  branding.clear();
  access.clear();
}

module.exports = {
  getFranchiseBySlug,
  getFranchiseByDomain,
  getFranchiseBranding,
  checkUserAccess,
  invalidateFranchise,
  invalidateUserAccess,
  clearAll
};
