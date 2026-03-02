const mongoose = require('mongoose');

/**
 * Franchise Mongoose Plugin
 *
 * Apply this plugin to every tenant-scoped schema to:
 *  1. Add a `franchise` field (ObjectId → Franchise, indexed).
 *  2. Safety-check: warn (or throw in FRANCHISE_STRICT mode) if a
 *     find/count/aggregate runs without a franchise filter.
 *
 * Usage:
 *   const franchisePlugin = require('../utils/franchisePlugin');
 *   // During migration period (required: false is safe fallback):
 *   mySchema.plugin(franchisePlugin);
 *
 * Options:
 *   required {boolean} — default false (transition-safe). Set to true after
 *                        migration ensures all docs have a franchise value.
 *
 * To bypass safety checks (migration scripts, global admin):
 *   Model.find({}).setOptions({ bypassFranchise: true })
 *   Model.aggregate([...], { bypassFranchise: true })
 *
 * Models that MUST NOT use this plugin (shared/global):
 *   Location — shared across all franchises
 *   Franchise — the tenant table itself
 */

function franchisePlugin(schema, options = {}) {
  // required defaults to false for safe migration; set true after migration
  const required = options.required === true;

  // ── 1. Add the franchise field ────────────────────────────────────────────
  schema.add({
    franchise: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Franchise',
      required: required ? [true, 'Franchise context is required'] : false,
      index: true
    }
  });

  // ── 2. Helper: check if query options carry the bypass flag ───────────────
  function isBypassed(queryObj) {
    return !!(
      queryObj.options?.bypassFranchise ||
      queryObj._userProvidedFields?.bypassFranchise
    );
  }

  // ── 3. Pre-hooks: safety enforcement ─────────────────────────────────────
  //    FRANCHISE_STRICT=true → hard-throw (useful in tests / dev)
  //    Otherwise → console.warn in non-production only

  const strict = process.env.FRANCHISE_STRICT === 'true';

  function enforceFilter(queryObj, methodName) {
    if (isBypassed(queryObj)) return;

    const conditions = queryObj._conditions || {};
    if (!conditions.franchise) {
      const modelName = schema.options.collection || 'unknown';
      const msg = `[franchisePlugin] ${modelName}.${methodName}() called WITHOUT franchise filter. ` +
                  'Pass { franchise: req.franchiseId } in query or set { bypassFranchise: true }.';
      if (strict) throw new Error(msg);
      if (process.env.NODE_ENV !== 'production') console.warn(msg);
    }
  }

  const queriedMethods = ['find', 'findOne', 'findOneAndUpdate', 'findOneAndDelete', 'countDocuments', 'distinct'];

  queriedMethods.forEach(method => {
    schema.pre(method, function () {
      enforceFilter(this, method);
    });
  });

  // ── 4. Pre-save: ensure franchise is set (only when required mode) ────────
  if (required) {
    schema.pre('save', function (next) {
      if (!this.franchise) {
        return next(new Error(`[franchisePlugin] Cannot save ${this.constructor.modelName} without a franchise.`));
      }
      next();
    });
  }

  // ── 5. Pre-aggregate: enforce franchise $match as first stage ────────────
  schema.pre('aggregate', function () {
    if (this.options?.bypassFranchise) return;

    const pipeline = this.pipeline();
    const firstStage = pipeline[0];

    if (firstStage && firstStage.$match && firstStage.$match.franchise) return;

    const msg = `[franchisePlugin] aggregate() called WITHOUT franchise in first $match stage.`;
    if (strict) throw new Error(msg);
    if (process.env.NODE_ENV !== 'production') console.warn(msg);
  });
}

module.exports = franchisePlugin;
