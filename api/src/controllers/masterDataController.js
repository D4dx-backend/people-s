const MasterData = require('../models/MasterData');
const { validationResult } = require('express-validator');
const { buildFranchiseReadFilter, buildFranchiseMatchStage, getWriteFranchiseId } = require('../utils/franchiseFilterHelper');

/**
 * Get all master data configurations with filtering
 */
const getMasterData = async (req, res) => {
  try {
    const {
      type,
      category,
      scope,
      status = 'active',
      page = 1,
      limit = 50,
      search
    } = req.query;

    // Build filter
    const filter = {};
    
    if (type) filter.type = type;
    if (category) filter.category = category;
    if (scope) filter.scope = scope;
    if (status !== 'all') filter.status = status;
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Only show effective configurations by default
    const now = new Date();
    filter.effectiveFrom = { $lte: now };
    filter.$or = [
      { effectiveTo: { $exists: false } },
      { effectiveTo: null },
      { effectiveTo: { $gte: now } }
    ];

    const skip = (parseInt(page) - 1) * parseInt(limit);

    Object.assign(filter, buildFranchiseReadFilter(req));

    const [masterDataList, total] = await Promise.all([
      MasterData.find(filter)
        .populate('targetRegions', 'name code type')
        .populate('targetProjects', 'name code')
        .populate('targetSchemes', 'name code')
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email')
        .sort({ type: 1, category: 1, name: 1 })
        .skip(skip)
        .limit(parseInt(limit)),
      MasterData.countDocuments(filter)
    ]);

    // Filter based on user access
    const accessibleMasterData = masterDataList.filter(md => md.canUserAccess(req.user));

    res.json({
      success: true,
      data: {
        masterData: accessibleMasterData,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total,
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching master data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch master data',
      error: error.message
    });
  }
};

/**
 * Get master data by ID
 */
const getMasterDataById = async (req, res) => {
  try {
    const masterData = await MasterData.findOne({ _id: req.params.id, ...buildFranchiseReadFilter(req) })
      .populate('targetRegions', 'name code type')
      .populate('targetProjects', 'name code')
      .populate('targetSchemes', 'name code')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    if (!masterData) {
      return res.status(404).json({
        success: false,
        message: 'Master data configuration not found'
      });
    }

    // Check user access
    if (!masterData.canUserAccess(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this master data configuration'
      });
    }

    res.json({
      success: true,
      data: { masterData }
    });
  } catch (error) {
    console.error('Error fetching master data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch master data',
      error: error.message
    });
  }
};

/**
 * Create new master data configuration
 */
const createMasterData = async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const masterDataData = {
      ...req.body,
      createdBy: req.user._id,
      franchise: req.franchiseId || null  // Multi-tenant
    };

    const masterData = new MasterData(masterDataData);
    await masterData.save();

    await masterData.populate([
      { path: 'targetRegions', select: 'name code type' },
      { path: 'targetProjects', select: 'name code' },
      { path: 'targetSchemes', select: 'name code' },
      { path: 'createdBy', select: 'name email' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Master data configuration created successfully',
      data: { masterData }
    });
  } catch (error) {
    console.error('Error creating master data:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: Object.values(error.errors).map(err => ({
          field: err.path,
          message: err.message
        }))
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create master data configuration',
      error: error.message
    });
  }
};

/**
 * Update master data configuration
 */
const updateMasterData = async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const masterData = await MasterData.findOne({ _id: req.params.id, franchise: req.franchiseId });
    
    if (!masterData) {
      return res.status(404).json({
        success: false,
        message: 'Master data configuration not found'
      });
    }

    // Check user access
    if (!masterData.canUserAccess(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to update this master data configuration'
      });
    }

    // Update fields
    Object.assign(masterData, req.body);
    masterData.updatedBy = req.user._id;

    await masterData.save();

    await masterData.populate([
      { path: 'targetRegions', select: 'name code type' },
      { path: 'targetProjects', select: 'name code' },
      { path: 'targetSchemes', select: 'name code' },
      { path: 'createdBy', select: 'name email' },
      { path: 'updatedBy', select: 'name email' }
    ]);

    res.json({
      success: true,
      message: 'Master data configuration updated successfully',
      data: { masterData }
    });
  } catch (error) {
    console.error('Error updating master data:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: Object.values(error.errors).map(err => ({
          field: err.path,
          message: err.message
        }))
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update master data configuration',
      error: error.message
    });
  }
};

/**
 * Delete master data configuration
 */
const deleteMasterData = async (req, res) => {
  try {
    const masterData = await MasterData.findOne({ _id: req.params.id, franchise: req.franchiseId });
    
    if (!masterData) {
      return res.status(404).json({
        success: false,
        message: 'Master data configuration not found'
      });
    }

    // Check user access
    if (!masterData.canUserAccess(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to delete this master data configuration'
      });
    }

    // Check if configuration is being used
    if (masterData.usageCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete master data configuration that is currently in use'
      });
    }

    await MasterData.findOneAndDelete({ _id: req.params.id, franchise: req.franchiseId });

    res.json({
      success: true,
      message: 'Master data configuration deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting master data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete master data configuration',
      error: error.message
    });
  }
};

/**
 * Get master data by type and category
 */
const getMasterDataByType = async (req, res) => {
  try {
    const { type } = req.params;
    const { category, scope } = req.query;

    const filter = { 
      type,
      status: 'active'
    };
    
    if (category) filter.category = category;
    if (scope) filter.scope = scope;

    // Only show effective configurations
    const now = new Date();
    filter.effectiveFrom = { $lte: now };
    filter.$or = [
      { effectiveTo: { $exists: false } },
      { effectiveTo: null },
      { effectiveTo: { $gte: now } }
    ];

    const masterDataList = await MasterData.find(filter)
      .populate('targetRegions', 'name code type')
      .populate('targetProjects', 'name code')
      .populate('targetSchemes', 'name code')
      .sort({ category: 1, name: 1 });

    // Filter based on user access
    const accessibleMasterData = masterDataList.filter(md => md.canUserAccess(req.user));

    res.json({
      success: true,
      data: { masterData: accessibleMasterData }
    });
  } catch (error) {
    console.error('Error fetching master data by type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch master data',
      error: error.message
    });
  }
};

/**
 * Clone master data configuration
 */
const cloneMasterData = async (req, res) => {
  try {
    const originalMasterData = await MasterData.findOne({ _id: req.params.id, franchise: req.franchiseId });
    
    if (!originalMasterData) {
      return res.status(404).json({
        success: false,
        message: 'Master data configuration not found'
      });
    }

    // Check user access
    if (!originalMasterData.canUserAccess(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to clone this master data configuration'
      });
    }

    // Create clone
    const cloneData = originalMasterData.toObject();
    delete cloneData._id;
    delete cloneData.__v;
    delete cloneData.createdAt;
    delete cloneData.updatedAt;
    
    cloneData.name = `${cloneData.name} (Copy)`;
    cloneData.status = 'draft';
    cloneData.createdBy = req.user._id;
    cloneData.updatedBy = undefined;
    cloneData.usageCount = 0;
    cloneData.lastUsed = undefined;

    const clonedMasterData = new MasterData(cloneData);
    await clonedMasterData.save();

    await clonedMasterData.populate([
      { path: 'targetRegions', select: 'name code type' },
      { path: 'targetProjects', select: 'name code' },
      { path: 'targetSchemes', select: 'name code' },
      { path: 'createdBy', select: 'name email' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Master data configuration cloned successfully',
      data: { masterData: clonedMasterData }
    });
  } catch (error) {
    console.error('Error cloning master data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clone master data configuration',
      error: error.message
    });
  }
};

module.exports = {
  getMasterData,
  getMasterDataById,
  createMasterData,
  updateMasterData,
  deleteMasterData,
  getMasterDataByType,
  cloneMasterData
};