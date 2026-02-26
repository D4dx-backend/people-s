const franchiseCache = require('../utils/franchiseCache');

/**
 * Tenant Resolver Middleware
 *
 * Identifies the current franchise (tenant) from the incoming request and
 * sets `req.franchise` and `req.franchiseId` for all downstream middleware
 * and controllers.
 *
 * Detection order:
 *  1. Custom domain  — e.g. erp.myorg.com  (full hostname match in Franchise.domain)
 *  2. Subdomain      — e.g. people.peopleerp.com  → slug = 'people'
 *  3. X-Franchise-Slug header (fallback for dev / API testing)
 *
 * Environment variables:
 *   BASE_DOMAIN — e.g. 'peopleerp.com'
 *                 Used to strip the base and extract the subdomain.
 *
 * Skip paths (configured in SKIP_PREFIXES):
 *   /api/health
 *   /api/global/*
 *   These endpoints serve the global admin or monitoring and don't need
 *   a franchise context.
 */

const BASE_DOMAIN = (process.env.BASE_DOMAIN || '').toLowerCase().trim();
const DEFAULT_FRANCHISE_SLUG = (process.env.DEFAULT_FRANCHISE_SLUG || '').toLowerCase().trim();

// Paths that skip franchise resolution entirely
const SKIP_PREFIXES = [
  '/api/health',
  '/api/global/'
];

// Paths where franchise is optional — request proceeds with req.franchise = null
// if no franchise is found (useful for public endpoints on localhost dev)
const OPTIONAL_FRANCHISE_PATHS = [
  '/api/config/public',
  '/api/website/public-settings',
  '/api/website/public-news',
  '/api/website/public-brochures',
  '/api/partners/public',
  '/api/banners/public',
  '/api/location/',  // location is global
];

/**
 * Extract the franchise slug from a hostname.
 *
 * Examples (BASE_DOMAIN = 'peopleerp.com'):
 *   people.peopleerp.com → 'people'
 *   bz.peopleerp.com     → 'bz'
 *   bz.staging.peopleerp.com → 'bz'  (strips any base suffix, takes first part)
 *   peopleerp.com        → null  (no subdomain)
 *   localhost            → null
 *   127.0.0.1            → null
 */
function extractSlugFromHostname(hostname) {
  if (!hostname) return null;

  // Strip port if present
  const host = hostname.split(':')[0].toLowerCase();

  // If BASE_DOMAIN is set, use it to identify the subdomain
  if (BASE_DOMAIN && host.endsWith(`.${BASE_DOMAIN}`)) {
    const withoutBase = host.slice(0, host.length - BASE_DOMAIN.length - 1); // remove '.base_domain'
    // withoutBase might be 'people' or 'bz.staging' — take the first segment
    return withoutBase.split('.')[0] || null;
  }

  // Fallback: if no BASE_DOMAIN configured, assume first subdomain of any hostname
  const parts = host.split('.');
  // Ignore localhost, IPs, single-word hosts
  if (parts.length < 3) return null;
  if (/^\d+$/.test(parts[0])) return null; // IP octet
  return parts[0] || null;
}

/**
 * Main middleware function.
 */
async function tenantResolver(req, res, next) {
  // ── Skip excluded paths ──────────────────────────────────────────────────
  const path = req.path || req.url;
  if (SKIP_PREFIXES.some(prefix => path.startsWith(prefix))) {
    return next();
  }

  try {
    let franchise = null;
    const hostname = req.hostname || (req.headers.host || '').split(':')[0];

    // ── 1. Custom domain lookup ───────────────────────────────────────────
    franchise = await franchiseCache.getFranchiseByDomain(hostname);

    // ── 2. Subdomain lookup ───────────────────────────────────────────────
    if (!franchise) {
      const slug = extractSlugFromHostname(hostname);
      if (slug) {
        franchise = await franchiseCache.getFranchiseBySlug(slug);
      }
    }

    // ── 3. X-Franchise-Slug header (dev / testing fallback) ──────────────
    if (!franchise) {
      const headerSlug = req.headers['x-franchise-slug'];
      if (headerSlug) {
        franchise = await franchiseCache.getFranchiseBySlug(headerSlug.toLowerCase().trim());
      }
    }

    // ── 5. DEFAULT_FRANCHISE_SLUG env fallback (localhost / single-tenant dev) ──
    // If DEFAULT_FRANCHISE_SLUG is set in .env, every unresolved request falls
    // back to that franchise.  Safe for development; keep unset in production
    // for strict multi-tenant enforcement.
    if (!franchise && DEFAULT_FRANCHISE_SLUG) {
      franchise = await franchiseCache.getFranchiseBySlug(DEFAULT_FRANCHISE_SLUG);
    }

    // ── 5. Not found ──────────────────────────────────────────────────────
    if (!franchise) {
      // For "optional" paths, allow through with null franchise context
      const isOptional = OPTIONAL_FRANCHISE_PATHS.some(p => path.startsWith(p));
      if (isOptional) {
        req.franchise   = null;
        req.franchiseId = null;
        return next();
      }

      return res.status(404).json({
        success: false,
        message: 'Organization not found. Please check the URL.',
        code: 'FRANCHISE_NOT_FOUND'
      });
    }

    if (!franchise.isActive) {
      return res.status(403).json({
        success: false,
        message: 'This organization is currently inactive.',
        code: 'FRANCHISE_INACTIVE'
      });
    }

    // ── 5. Attach to request ──────────────────────────────────────────────
    req.franchise   = franchise;
    req.franchiseId = franchise._id;

    next();
  } catch (error) {
    console.error('[tenantResolver] Error resolving franchise:', error);
    next(error);
  }
}

module.exports = tenantResolver;
module.exports.extractSlugFromHostname = extractSlugFromHostname; // exported for tests
