const mongoose = require('mongoose');

/**
 * Franchise Model
 *
 * Each NGO that uses this ERP platform is a "franchise".
 * Identified by subdomain (slug) or custom domain.
 * All tenant-scoped data carries a `franchise` ObjectId reference.
 * Location data is GLOBAL (no franchise) and shared across all franchises.
 */
const franchiseSchema = new mongoose.Schema({
  // Identity
  name: {
    type: String,
    required: [true, 'Franchise name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  slug: {
    type: String,
    required: [true, 'Slug is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers and hyphens']
  },

  // Branding
  displayName: {
    type: String,
    required: [true, 'Display name is required'],
    trim: true
  },
  tagline: { type: String, default: '' },
  regNumber: { type: String, default: '' },
  address: { type: String, default: '' },
  phone: { type: String, default: '' },
  email: { type: String, default: '' },
  supportEmail: { type: String, default: '' },
  paymentsEmail: { type: String, default: '' },
  website: { type: String, default: '' },
  websiteUrl: { type: String, default: '' },

  // Logo
  logoUrl: { type: String, default: '' },
  logoFilename: { type: String, default: 'logo-placeholder.png' },

  // Theme
  defaultTheme: {
    type: String,
    enum: ['blue', 'purple', 'green', 'custom'],
    default: 'blue'
  },
  customTheme: {
    primaryColor: { type: String, default: '' },
    secondaryColor: { type: String, default: '' },
    accentColor: { type: String, default: '' },
    heroGradient: { type: String, default: '' },
    fontFamily: { type: String, default: '' }
  },

  // ERP text
  erpTitle: { type: String, default: 'NGO ERP' },
  erpSubtitle: { type: String, default: 'ERP Solution for NGOs' },
  heroSubtext: { type: String, default: '' },
  aboutText: { type: String, default: '' },
  footerText: { type: String, default: '' },
  copyrightText: { type: String, default: '' },
  copyrightHolder: { type: String, default: '' },
  welcomeEmailText: { type: String, default: '' },
  communityLabel: { type: String, default: '' },
  communityDescription: { type: String, default: '' },
  emailSenderName: { type: String, default: '' },

  // Custom domains — a franchise can be reached by multiple fully-qualified domain names.
  // e.g. ['erp.peoplefoundation.org', 'peoplefoundation.org', 'people.peopleerp.com']
  // Each value must be globally unique across all franchises.
  domains: {
    type: [String],
    default: [],
    set: function (arr) {
      return Array.isArray(arr)
        ? [...new Set(arr.map(d => d.toLowerCase().trim()).filter(Boolean))]
        : [];
    }
  },

  // Status
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },

  // Per-franchise feature flags & settings
  settings: {
    maxUsers: { type: Number, default: 0 },        // 0 = unlimited
    maxBeneficiaries: { type: Number, default: 0 }, // 0 = unlimited
    features: {
      donations: { type: Boolean, default: true },
      website: { type: Boolean, default: true },
      mobileApp: { type: Boolean, default: true },
      recurringPayments: { type: Boolean, default: true },
      speechToText: { type: Boolean, default: true }
    },
    // Override SMS/WhatsApp credentials per franchise (optional)
    smsConfig: {
      dxingApiKey: { type: String, select: false },
      dxingApiSecret: { type: String, select: false },
      enabled: { type: Boolean, default: false }
    },
    emailConfig: {
      smtpHost: { type: String, select: false },
      smtpPort: { type: Number, select: false },
      smtpUser: { type: String, select: false },
      smtpPass: { type: String, select: false },
      enabled: { type: Boolean, default: false }
    }
  },

  // Audit
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function (doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      // Never expose sensitive configs
      if (ret.settings) {
        delete ret.settings.smsConfig;
        delete ret.settings.emailConfig;
      }
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// ── Indexes ──────────────────────────────────────────────────────────────────
// slug: unique index defined on field (unique: true)
// isActive: index defined on field (index: true)
// domains: sparse index for fast lookups by domain.
// Uniqueness is enforced at the application level in Franchise.addDomain()
// to avoid MongoDB multikey-index quirks with empty arrays.
franchiseSchema.index({ domains: 1 }, { sparse: true });

// ── Virtual: derived copyright text ─────────────────────────────────────────
franchiseSchema.virtual('copyrightLine').get(function () {
  const holder = this.copyrightHolder || this.displayName;
  return `© ${new Date().getFullYear()} ${holder}. All rights reserved.`;
});

// ── Virtual: logo path ───────────────────────────────────────────────────────
franchiseSchema.virtual('logoPath').get(function () {
  const path = require('path');
  return path.join(__dirname, '../assets', this.logoFilename || 'logo-placeholder.png');
});

// ── Static: find by slug (used by tenant resolver + cache) ───────────────────
franchiseSchema.statics.findBySlug = function (slug) {
  return this.findOne({ slug: slug.toLowerCase(), isActive: true });
};

// ── Static: find by custom domain (searches the domains array) ───────────────
franchiseSchema.statics.findByDomain = function (domain) {
  return this.findOne({ domains: domain.toLowerCase().trim(), isActive: true });
};

// ── Static: add a domain to a franchise ──────────────────────────────────────
franchiseSchema.statics.addDomain = async function (franchiseId, domain) {
  const d = domain.toLowerCase().trim();
  // Ensure no other franchise owns this domain
  const conflict = await this.findOne({ domains: d, _id: { $ne: franchiseId } });
  if (conflict) throw Object.assign(new Error(`Domain "${d}" is already used by franchise "${conflict.slug}"`), { code: 'DOMAIN_CONFLICT' });
  return this.findByIdAndUpdate(
    franchiseId,
    { $addToSet: { domains: d } },
    { new: true }
  );
};

// ── Static: remove a domain from a franchise ─────────────────────────────────
franchiseSchema.statics.removeDomain = function (franchiseId, domain) {
  return this.findByIdAndUpdate(
    franchiseId,
    { $pull: { domains: domain.toLowerCase().trim() } },
    { new: true }
  );
};

// ── Static: list all active franchises ───────────────────────────────────────
franchiseSchema.statics.getActiveFranchises = function () {
  return this.find({ isActive: true }).sort({ name: 1 });
};

// ── Method: convert to public branding object (safe for frontend) ────────────
franchiseSchema.methods.toBrandingObject = function () {
  return {
    key: this.slug,
    displayName: this.displayName,
    tagline: this.tagline,
    regNumber: this.regNumber,
    address: this.address,
    phone: this.phone,
    email: this.email,
    supportEmail: this.supportEmail,
    paymentsEmail: this.paymentsEmail,
    website: this.website,
    websiteUrl: this.websiteUrl,
    logoUrl: this.logoUrl,
    logoFilename: this.logoFilename,
    defaultTheme: this.defaultTheme,
    customTheme: this.customTheme,
    erpTitle: this.erpTitle,
    erpSubtitle: this.erpSubtitle,
    heroSubtext: this.heroSubtext,
    aboutText: this.aboutText,
    footerText: this.footerText,
    copyrightText: this.copyrightLine,
    communityLabel: this.communityLabel,
    communityDescription: this.communityDescription
  };
};

module.exports = mongoose.model('Franchise', franchiseSchema);
