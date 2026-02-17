const Scheme = require('../models/Scheme');

/**
 * Middleware to automatically sync application stages with scheme stages
 * This ensures new applications always have the correct stages
 */
const syncApplicationStages = async (req, res, next) => {
  try {
    // Only run for POST (create) and PUT (update) operations
    if (req.method !== 'POST' && req.method !== 'PUT') {
      return next();
    }

    // Get scheme ID from request body
    const schemeId = req.body.scheme;
    
    if (!schemeId) {
      return next();
    }

    // Fetch the scheme
    const scheme = await Scheme.findById(schemeId);
    
    if (!scheme || !scheme.statusStages || scheme.statusStages.length === 0) {
      // No stages to sync, continue
      return next();
    }

    // Initialize application stages from scheme
    const applicationStages = scheme.statusStages.map(schemeStage => ({
      name: schemeStage.name,
      description: schemeStage.description,
      order: schemeStage.order,
      isRequired: schemeStage.isRequired,
      allowedRoles: schemeStage.allowedRoles,
      autoTransition: schemeStage.autoTransition,
      transitionConditions: schemeStage.transitionConditions,
      status: 'pending',
      completedAt: null,
      completedBy: null,
      notes: null,
      // Copy comment configuration from scheme
      commentConfig: {
        unitAdmin: {
          enabled: schemeStage.commentConfig?.unitAdmin?.enabled || false,
          required: schemeStage.commentConfig?.unitAdmin?.required || false
        },
        areaAdmin: {
          enabled: schemeStage.commentConfig?.areaAdmin?.enabled || false,
          required: schemeStage.commentConfig?.areaAdmin?.required || false
        },
        districtAdmin: {
          enabled: schemeStage.commentConfig?.districtAdmin?.enabled || false,
          required: schemeStage.commentConfig?.districtAdmin?.required || false
        }
      },
      // Initialize empty comments
      comments: {
        unitAdmin: { comment: null, commentedBy: null, commentedAt: null },
        areaAdmin: { comment: null, commentedBy: null, commentedAt: null },
        districtAdmin: { comment: null, commentedBy: null, commentedAt: null }
      },
      // Copy required documents from scheme (with empty upload fields)
      requiredDocuments: (schemeStage.requiredDocuments || []).map(doc => ({
        name: doc.name,
        description: doc.description,
        isRequired: doc.isRequired,
        uploadedFile: null,
        uploadedBy: null,
        uploadedAt: null
      }))
    }));

    // Add stages to request body
    req.body.applicationStages = applicationStages;
    req.body.currentStage = applicationStages[0]?.name || 'Application Received';

    console.log(`✅ Synced ${applicationStages.length} stages from scheme "${scheme.name}"`);
    
    next();
  } catch (error) {
    console.error('Error syncing application stages:', error);
    // Don't block the request, just log the error
    next();
  }
};

module.exports = { syncApplicationStages };
