const mongoose = require('mongoose');

/**
 * Franchise Filter Helper
 *
 * Provides standardised franchise-scoping functions for controllers.
 *
 *   buildFranchiseReadFilter(req)
 *     Returns a query-ready object for READ operations.
 *     - Cross-franchise users: { franchise: { $in: [...] } } or a single ID
 *       depending on the optional ?franchiseFilter query-param.
 *     - Normal users: { franchise: req.franchiseId } (or {} when no franchise context).
 *
 *   buildFranchiseMatchStage(req)
 *     Returns a MongoDB $match stage object for aggregation pipelines.
 *     Convenience wrapper around buildFranchiseReadFilter that ensures ObjectId types.
 *
 *   getWriteFranchiseId(req)
 *     Always returns the primary franchise (from the subdomain the user is on).
 */

function buildFranchiseReadFilter(req) {
  if (req.isCrossFranchise && req.crossFranchiseIds?.length > 1) {
    const filterParam = req.query?.franchiseFilter;

    if (!filterParam || filterParam === 'all') {
      return { franchise: { $in: req.crossFranchiseIds } };
    }

    const isAllowed = req.crossFranchiseIds.some(
      id => id.toString() === filterParam
    );
    if (isAllowed) {
      return { franchise: new mongoose.Types.ObjectId(filterParam) };
    }
  }

  if (req.franchiseId) {
    return { franchise: req.franchiseId };
  }

  return {};
}

function buildFranchiseMatchStage(req) {
  if (req.isCrossFranchise && req.crossFranchiseIds?.length > 1) {
    const filterParam = req.query?.franchiseFilter;

    if (!filterParam || filterParam === 'all') {
      return {
        franchise: {
          $in: req.crossFranchiseIds.map(
            id => new mongoose.Types.ObjectId(id.toString())
          )
        }
      };
    }

    const isAllowed = req.crossFranchiseIds.some(
      id => id.toString() === filterParam
    );
    if (isAllowed) {
      return { franchise: new mongoose.Types.ObjectId(filterParam) };
    }
  }

  if (req.franchiseId) {
    return { franchise: new mongoose.Types.ObjectId(req.franchiseId.toString()) };
  }

  return {};
}

function getWriteFranchiseId(req) {
  return req.franchiseId || null;
}

module.exports = {
  buildFranchiseReadFilter,
  buildFranchiseMatchStage,
  getWriteFranchiseId
};
