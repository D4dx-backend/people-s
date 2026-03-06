const Partner = require('../models/Partner');
const { uploadToSpaces, deleteFromSpaces, extractKeyFromUrl } = require('../utils/s3Upload');
const { buildFranchiseReadFilter, buildFranchiseMatchStage, getWriteFranchiseId } = require('../utils/franchiseFilterHelper');

// Get all partners (authenticated)
exports.getAllPartners = async (req, res) => {
  try {
    const { status } = req.query;
    const query = {};
    
    if (status) query.status = status;

    Object.assign(query, buildFranchiseReadFilter(req));
    
    const partners = await Partner.find(query)
      .sort({ order: 1, createdAt: -1 })
      .populate('createdBy', 'name')
      .populate('updatedBy', 'name');
    
    res.status(200).json({
      success: true,
      data: { partners }
    });
  } catch (error) {
    console.error('Error fetching partners:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching partners',
      error: error.message
    });
  }
};

// Get public partners (no auth required)
exports.getPublicPartners = async (req, res) => {
  try {
    const partners = await Partner.find({ status: 'active', ...buildFranchiseReadFilter(req) })
      .sort({ order: 1, createdAt: -1 })
      .select('name logoUrl link order');
    
    res.status(200).json({
      success: true,
      data: { partners }
    });
  } catch (error) {
    console.error('Error fetching public partners:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching partners',
      error: error.message
    });
  }
};

// Get single partner
exports.getPartnerById = async (req, res) => {
  try {
    const partner = await Partner.findOne({ _id: req.params.id, ...buildFranchiseReadFilter(req) })
      .populate('createdBy', 'name')
      .populate('updatedBy', 'name');
    
    if (!partner) {
      return res.status(404).json({
        success: false,
        message: 'Partner not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: { partner }
    });
  } catch (error) {
    console.error('Error fetching partner:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching partner',
      error: error.message
    });
  }
};

// Create new partner
exports.createPartner = async (req, res) => {
  try {
    const { name, link, order, status } = req.body;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Logo image is required'
      });
    }
    
    // Upload logo to Spaces
    const uploadResult = await uploadToSpaces(req.file, 'partners', {
      maxSizeMB: 5,
      allowedTypes: ['image/jpeg', 'image/png', 'image/jpg']
    });
    
    const partner = new Partner({
      name,
      logoUrl: uploadResult.url,
      logoKey: uploadResult.key,
      link,
      order: order || 0,
      status: status || 'active',
      createdBy: req.user._id,
      franchise: req.franchiseId || null  // Multi-tenant
    });
    
    await partner.save();
    
    res.status(201).json({
      success: true,
      message: 'Partner created successfully',
      data: { partner }
    });
  } catch (error) {
    console.error('Error creating partner:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating partner',
      error: error.message
    });
  }
};

// Update partner
exports.updatePartner = async (req, res) => {
  try {
    const { name, link, order, status } = req.body;
    const partner = await Partner.findOne({ _id: req.params.id, franchise: req.franchiseId });
    
    if (!partner) {
      return res.status(404).json({
        success: false,
        message: 'Partner not found'
      });
    }
    
    // If new logo is uploaded
    if (req.file) {
      // Delete old logo
      if (partner.logoKey) {
        await deleteFromSpaces(partner.logoKey);
      }
      
      // Upload new logo
      const uploadResult = await uploadToSpaces(req.file, 'partners', {
        maxSizeMB: 5,
        allowedTypes: ['image/jpeg', 'image/png', 'image/jpg']
      });
      
      partner.logoUrl = uploadResult.url;
      partner.logoKey = uploadResult.key;
    }
    
    // Update other fields
    if (name) partner.name = name;
    if (link !== undefined) partner.link = link;
    if (order !== undefined) partner.order = order;
    if (status) partner.status = status;
    partner.updatedBy = req.user._id;
    
    await partner.save();
    
    res.status(200).json({
      success: true,
      message: 'Partner updated successfully',
      data: { partner }
    });
  } catch (error) {
    console.error('Error updating partner:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating partner',
      error: error.message
    });
  }
};

// Delete partner
exports.deletePartner = async (req, res) => {
  try {
    const partner = await Partner.findOne({ _id: req.params.id, franchise: req.franchiseId });
    
    if (!partner) {
      return res.status(404).json({
        success: false,
        message: 'Partner not found'
      });
    }
    
    // Delete logo from Spaces
    if (partner.logoKey) {
      await deleteFromSpaces(partner.logoKey);
    }
    
    await Partner.findOneAndDelete({ _id: req.params.id, franchise: req.franchiseId });
    
    res.status(200).json({
      success: true,
      message: 'Partner deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting partner:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting partner',
      error: error.message
    });
  }
};
