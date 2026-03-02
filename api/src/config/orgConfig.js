/**
 * Organization Configuration
 * 
 * Centralized org-aware configuration. The ORG_NAME env var determines
 * which NGO preset is loaded. Each deployment sets ORG_NAME to either
 * 'baithuzzakath' or 'people_foundation' — the rest auto-resolves.
 * 
 * Individual fields can be overridden via env vars (ORG_DISPLAY_NAME,
 * ORG_REG_NUMBER, etc.) for fine-grained control without code changes.
 */

const path = require('path');

// ── Org Presets ──────────────────────────────────────────────────────────────
const ORG_PRESETS = {
  baithuzzakath: {
    key: 'baithuzzakath',
    displayName: 'Baithuzzakath',
    tagline: 'Empowering Communities Through Zakat and Charitable Programs',
    regNumber: 'KL/TC/123/2020',
    address: 'Baithuzzakath Bhavan, Kozhikode, Kerala - 673001',
    phone: '+91-495-2345678',
    email: 'info@baithuzzakath.org',
    supportEmail: 'support@baithuzzakath.org',
    paymentsEmail: 'payments@baithuzzakath.org',
    website: 'www.baithuzzakath.org',
    websiteUrl: 'https://baithuzzakath.org',
    logoFilename: 'logo-baithuzzakath.png',
    defaultTheme: 'green',
    copyrightHolder: 'Baithuzzakath',
    emailSenderName: 'Baithuzzakath',
    erpTitle: 'Baithuzzakath ERP',
    erpSubtitle: 'ERP Solution for NGOs',
    heroSubtext: 'Transforming lives through transparent distribution of Zakat, supporting education, healthcare, and livelihood initiatives across Kerala',
    aboutText: 'Baithuzzakath ERP is dedicated to the transparent and effective distribution of Zakat funds to support the underprivileged communities across Kerala. We run comprehensive programs in education, healthcare, housing, and livelihood development, ensuring that assistance reaches those who need it most.',
    footerText: 'Dedicated to transparent Zakat distribution and community welfare across Kerala',
    welcomeEmailText: 'your gateway to transparent and efficient Zakat distribution',
    communityLabel: 'Islamic Values',
    communityDescription: 'Guided by Islamic principles of charity, compassion, and social justice',
  },

  people_foundation: {
    key: 'people_foundation',
    displayName: "People's Foundation",
    tagline: 'Empowering Communities Through Compassion and Service',
    regNumber: 'KL/TC/456/2022',
    address: "People's Foundation, Kozhikode, Kerala - 673001",
    phone: '+91-495-9876543',
    email: 'info@peoplefoundation.org',
    supportEmail: 'support@peoplefoundation.org',
    paymentsEmail: 'payments@peoplefoundation.org',
    website: 'www.peoplefoundation.org',
    websiteUrl: 'https://peoplefoundation.org',
    logoFilename: 'logo-peoplefoundation.png',
    defaultTheme: 'blue',
    copyrightHolder: "People's Foundation",
    emailSenderName: "People's Foundation",
    erpTitle: "People's Foundation ERP",
    erpSubtitle: 'ERP Solution for NGOs',
    heroSubtext: 'Empowering communities through transparent welfare distribution, supporting education, healthcare, and livelihood initiatives',
    aboutText: "People's Foundation ERP is dedicated to the transparent and effective distribution of welfare funds to support underprivileged communities. We run comprehensive programs in education, healthcare, housing, and livelihood development, ensuring that assistance reaches those who need it most.",
    footerText: 'Dedicated to transparent welfare distribution and community empowerment',
    welcomeEmailText: 'your gateway to transparent and efficient welfare distribution',
    communityLabel: 'Community Values',
    communityDescription: 'Guided by principles of compassion, equity, and social justice',
  },
};

// ── Build config ─────────────────────────────────────────────────────────────

/**
 * Returns the organisation configuration object.
 * Reads ORG_NAME from env, picks the preset, then overlays any per-field
 * env-var overrides so individual values can be tweaked at deploy time.
 */
function getOrgConfig() {
  const orgName = (process.env.ORG_NAME || 'people_foundation').toLowerCase().trim();
  const preset = ORG_PRESETS[orgName] || ORG_PRESETS.people_foundation;

  // Allow env-var overrides for any preset field
  const config = {
    ...preset,
    displayName: process.env.ORG_DISPLAY_NAME || preset.displayName,
    tagline: process.env.ORG_TAGLINE || preset.tagline,
    regNumber: process.env.ORG_REG_NUMBER || preset.regNumber,
    address: process.env.ORG_ADDRESS || preset.address,
    phone: process.env.ORG_PHONE || preset.phone,
    email: process.env.ORG_EMAIL || preset.email,
    supportEmail: process.env.ORG_SUPPORT_EMAIL || preset.supportEmail,
    paymentsEmail: process.env.ORG_PAYMENTS_EMAIL || preset.paymentsEmail,
    website: process.env.ORG_WEBSITE || preset.website,
    websiteUrl: process.env.ORG_WEBSITE_URL || preset.websiteUrl,
    logoFilename: process.env.ORG_LOGO_FILENAME || preset.logoFilename,
    defaultTheme: process.env.ORG_DEFAULT_THEME || preset.defaultTheme,
    copyrightHolder: process.env.ORG_COPYRIGHT_HOLDER || preset.copyrightHolder,
    emailSenderName: process.env.ORG_EMAIL_SENDER_NAME || preset.emailSenderName,
    erpTitle: process.env.ORG_ERP_TITLE || preset.erpTitle,
    erpSubtitle: process.env.ORG_ERP_SUBTITLE || preset.erpSubtitle,
    heroSubtext: process.env.ORG_HERO_SUBTEXT || preset.heroSubtext,
    aboutText: process.env.ORG_ABOUT_TEXT || preset.aboutText,
    footerText: process.env.ORG_FOOTER_TEXT || preset.footerText,
    welcomeEmailText: process.env.ORG_WELCOME_EMAIL_TEXT || preset.welcomeEmailText,
    communityLabel: process.env.ORG_COMMUNITY_LABEL || preset.communityLabel,
    communityDescription: process.env.ORG_COMMUNITY_DESC || preset.communityDescription,
  };

  // Derived helpers
  config.logoPath = path.join(__dirname, '../assets', config.logoFilename);
  config.copyrightText = `© ${new Date().getFullYear()} ${config.copyrightHolder}. All rights reserved.`;

  return config;
}

// Export a singleton AND the factory (for tests / dynamic reload)
const orgConfig = getOrgConfig();

module.exports = orgConfig;
module.exports.getOrgConfig = getOrgConfig;
module.exports.ORG_PRESETS = ORG_PRESETS;
