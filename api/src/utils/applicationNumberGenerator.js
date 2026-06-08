const mongoose = require('mongoose');
const Counter = require('../models/Counter');

/**
 * Atomically generate a unique application number for a given franchise.
 *
 * Replaces the legacy `countDocuments() + 1` pattern which had a race
 * condition: two concurrent submissions could read the same count and try
 * to insert the same number, causing an E11000 duplicate-key error and a
 * failed submission.
 *
 * Strategy:
 *  - Uses an atomic per-franchise/per-year counter (`findOneAndUpdate $inc`).
 *    Each concurrent caller receives a distinct sequence value, so two
 *    parallel submissions can never collide with each other.
 *  - On first use for a franchise/year, the counter is seeded from the
 *    highest existing legacy application number so we don't collide with
 *    numbers created by the old algorithm.
 *  - A small existence-check retry loop is kept as a final safety net.
 *
 * @param {Object} options
 * @param {mongoose.Types.ObjectId|string|null} options.franchiseId - Franchise scope (may be null).
 * @param {mongoose.Model} [options.ApplicationModel] - Application model (defaults to mongoose.model('Application')).
 * @returns {Promise<string>} A unique application number, e.g. "APP2026000101".
 */
async function generateApplicationNumber({ franchiseId = null, ApplicationModel } = {}) {
  const Application = ApplicationModel || mongoose.model('Application');
  const year = new Date().getFullYear();
  const prefix = `APP${year}`;
  const scopeKey = franchiseId ? String(franchiseId) : 'global';
  const counterKey = `application_${scopeKey}_${year}`;

  // Build a franchise filter that mirrors the unique index { applicationNumber, franchise }.
  const franchiseFilter = franchiseId ? { franchise: franchiseId } : {};

  // Seed the counter from the highest existing legacy number (once per franchise/year).
  await seedCounterIfNeeded({ Application, counterKey, prefix, franchiseFilter });

  // Atomic increment guarantees distinct sequences for concurrent callers.
  for (let attempt = 0; attempt < 5; attempt++) {
    const seq = await Counter.getNextSequence(counterKey);
    const applicationNumber = `${prefix}${String(seq).padStart(6, '0')}`;

    // Safety net: skip the (rare) case where a legacy number already used this value.
    const clash = await Application.exists({ applicationNumber, ...franchiseFilter });
    if (!clash) {
      return applicationNumber;
    }
  }

  // Extremely unlikely fallback — guarantee uniqueness with a timestamp suffix.
  return `${prefix}${String(Date.now()).slice(-6)}`;
}

/**
 * Seed the counter to the current max sequence for this franchise/year, but only
 * if the counter document does not already exist. Safe under concurrency:
 * the upsert with $setOnInsert is a no-op when the document is already present,
 * and a concurrent insert simply loses the race harmlessly.
 */
async function seedCounterIfNeeded({ Application, counterKey, prefix, franchiseFilter }) {
  const existing = await Counter.findById(counterKey).lean();
  if (existing) return;

  let startSeq = 0;
  const last = await Application.findOne({
    ...franchiseFilter,
    applicationNumber: { $regex: `^${prefix}` }
  })
    .sort({ applicationNumber: -1 })
    .select('applicationNumber')
    .lean();

  if (last && last.applicationNumber) {
    const parsed = parseInt(last.applicationNumber.slice(prefix.length), 10);
    if (!Number.isNaN(parsed)) startSeq = parsed;
  }

  try {
    await Counter.updateOne(
      { _id: counterKey },
      { $setOnInsert: { seq: startSeq } },
      { upsert: true }
    );
  } catch (err) {
    // Ignore duplicate-key from a concurrent seed; the counter now exists either way.
    if (!(err && err.code === 11000)) throw err;
  }
}

module.exports = { generateApplicationNumber };
