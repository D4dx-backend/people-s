const Beneficiary = require('../models/Beneficiary');
const Location = require('../models/Location');
const { User } = require('../models');
const { validationResult } = require('express-validator');
const ResponseHelper = require('../utils/responseHelper');

// Get all beneficiaries with pagination and search
const getBeneficiaries = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search = '', 
      status = '', 
      state = '', 
      district = '', 
      area = '', 
      unit = '',
      gender = '',
      project = '',
      scheme = '',
      includeApprovedInterviews = false
    } = req.query;

    // Build filter object
    const filter = {};
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status) filter.status = status;
    if (state) filter.state = state;
    if (district) filter.district = district;
    if (area) filter.area = area;
    if (unit) filter.unit = unit;
    if (gender) filter['profile.gender'] = gender;

    // Apply user's regional access restrictions
    const userRegionalFilter = getUserRegionalFilter(req.user);
    Object.assign(filter, userRegionalFilter);

    // Multi-tenant: Beneficiaries are franchise-scoped
    if (req.franchiseId) filter.franchise = req.franchiseId;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // If project or scheme filters are applied, we need to filter by applications
    let beneficiaryQuery = Beneficiary.find(filter);
    
    if (project || scheme) {
      const Application = require('../models/Application');
      const applicationFilter = {};
      if (project) applicationFilter.project = project;
      if (scheme) applicationFilter.scheme = scheme;
      if (req.franchiseId) applicationFilter.franchise = req.franchiseId;
      
      const applications = await Application.find(applicationFilter).distinct('beneficiary');
      filter._id = { $in: applications };
    }
    
    let beneficiaries = await Beneficiary.find(filter)
      .populate('state', 'name code')
      .populate('district', 'name code')
      .populate('area', 'name code')
      .populate('unit', 'name code')
      .populate('createdBy', 'name')
      .populate('verifiedBy', 'name')
      .populate({
        path: 'applications',
        populate: [
          { path: 'scheme', select: 'name code' },
          { path: 'project', select: 'name code' }
        ]
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    let total = await Beneficiary.countDocuments(filter);

    // Include approved interview applicants if requested
    if (includeApprovedInterviews === 'true') {
      const Interview = require('../models/Interview');
      const Application = require('../models/Application');
      
      // Find completed interviews with passed result
      const approvedInterviews = await Interview.find({
        status: 'completed',
        result: 'passed'
      }).populate({
        path: 'application',
        populate: [
          { path: 'beneficiary', populate: ['state', 'district', 'area', 'unit'] },
          { path: 'scheme', select: 'name' },
          { path: 'project', select: 'name' }
        ]
      });

      // Convert approved interviews to beneficiary format
      const interviewBeneficiaries = approvedInterviews
        .filter(interview => interview.application && interview.application.beneficiary)
        .map(interview => {
          const app = interview.application;
          const beneficiary = app.beneficiary;
          
          return {
            ...beneficiary.toObject(),
            source: 'interview',
            interviewId: interview._id,
            approvedAt: interview.completedAt,
            applications: [app._id], // Include the approved application
            status: 'active', // Approved interview applicants are active beneficiaries
            isVerified: true // Auto-verify approved interview applicants
          };
        });

      // Merge with regular beneficiaries (avoid duplicates)
      const existingBeneficiaryIds = beneficiaries.map(b => b._id.toString());
      const uniqueInterviewBeneficiaries = interviewBeneficiaries.filter(
        ib => !existingBeneficiaryIds.includes(ib._id.toString())
      );

      beneficiaries = [...beneficiaries, ...uniqueInterviewBeneficiaries];
      total += uniqueInterviewBeneficiaries.length;
    }

    res.status(200).json({
      success: true,
      data: {
        beneficiaries,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total,
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching beneficiaries:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

// Get single beneficiary
const getBeneficiary = async (req, res) => {
  try {
    const beneficiaryQuery = { _id: req.params.id };
    if (req.franchiseId) beneficiaryQuery.franchise = req.franchiseId;
    const beneficiary = await Beneficiary.findOne(beneficiaryQuery)
      .populate('state', 'name code')
      .populate('district', 'name code')
      .populate('area', 'name code')
      .populate('unit', 'name code')
      .populate('createdBy', 'name')
      .populate('verifiedBy', 'name')
      .populate('applications');

    if (!beneficiary) {
      return res.status(404).json({ 
        success: false,
        message: 'Beneficiary not found' 
      });
    }

    // Check if user has access to this beneficiary
    if (!hasAccessToBeneficiary(req.user, beneficiary)) {
      return res.status(403).json({ 
        success: false,
        message: 'Access denied' 
      });
    }

    res.status(200).json({
      success: true,
      data: { beneficiary }
    });
  } catch (error) {
    console.error('Error fetching beneficiary:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Create new beneficiary
const createBeneficiary = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return ResponseHelper.validationError(res, errors.array());
    }

    const { name, phone, state, district, area, unit } = req.body;

    // Check if phone already exists in Beneficiary collection
    const benefPhoneQuery = { phone };
    if (req.franchiseId) benefPhoneQuery.franchise = req.franchiseId;
    const existingBeneficiary = await Beneficiary.findOne(benefPhoneQuery);
    if (existingBeneficiary) {
      return ResponseHelper.error(res, 'Phone number already registered', 400);
    }

    // Check if phone already exists in User collection
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return ResponseHelper.error(res, 'Phone number already registered as user', 400);
    }

    // Verify location hierarchy
    const locationValid = await verifyLocationHierarchy(state, district, area, unit);
    if (!locationValid) {
      return ResponseHelper.error(res, 'Invalid location hierarchy', 400);
    }

    // Check if user has access to create beneficiary in this location
    console.log('🔍 Checking location access:', {
      userRole: req.user?.role,
      userId: req.user?._id,
      location: { state, district, area, unit }
    });
    
    if (!hasAccessToLocation(req.user, { state, district, area, unit })) {
      console.log('❌ Location access denied for user:', req.user?.role);
      return ResponseHelper.forbidden(res, 'Access denied for this location');
    }
    
    console.log('✅ Location access granted for user:', req.user?.role);

    // Create User record for the beneficiary (so it appears in User Management)
    // This must be done BEFORE creating the Beneficiary record
    let user;
    try {
      user = new User({
        name,
        phone,
        role: 'beneficiary',
        profile: {
          location: {
            district,
            area,
            unit
          }
        },
        isVerified: true, // Admin-created beneficiaries are pre-verified
        isActive: true,
        createdBy: req.user._id || req.user.id
      });

      await user.save();
      console.log(`✅ Created User record for beneficiary: ${name} (${phone}), User ID: ${user._id}`);
      
      // Verify the user was actually created
      const verifyUser = await User.findById(user._id);
      if (!verifyUser) {
        console.error(`❌ User was not found after creation! ID: ${user._id}`);
        return ResponseHelper.error(res, 'Failed to create user record', 500);
      }
      console.log(`✅ Verified User exists in database: ${verifyUser.name} (${verifyUser.phone}), Role: ${verifyUser.role}`);
    } catch (userError) {
      console.error('❌ Error creating User record:', userError);
      // If it's a duplicate key error, check if user already exists
      if (userError.code === 11000) {
        // User with this phone already exists, try to find it
        user = await User.findOne({ phone });
        if (user) {
          console.log(`⚠️ User already exists with phone ${phone}, using existing user`);
        } else {
          return ResponseHelper.error(res, `Failed to create user: ${userError.message}`, 400);
        }
      } else {
        return ResponseHelper.error(res, `Failed to create user: ${userError.message}`, 400);
      }
    }

    // Create Beneficiary record
    const beneficiary = new Beneficiary({
      name,
      phone,
      state,
      district,
      area,
      unit,
      status: 'active',
      isVerified: true, // Admin-created beneficiaries are pre-verified
      createdBy: req.user._id || req.user.id,
      franchise: req.franchiseId || null
    });

    await beneficiary.save();
    console.log(`✅ Created Beneficiary record: ${name} (${phone}), Beneficiary ID: ${beneficiary._id}`);

    const populatedBeneficiary = await Beneficiary.findOne({ _id: beneficiary._id, franchise: req.franchiseId })
      .populate('state', 'name code')
      .populate('district', 'name code')
      .populate('area', 'name code')
      .populate('unit', 'name code')
      .populate('createdBy', 'name');

    return ResponseHelper.success(res, { beneficiary: populatedBeneficiary }, 'Beneficiary created successfully', 201);
  } catch (error) {
    console.error('Error creating beneficiary:', error);
    return ResponseHelper.error(res, error.message || 'Server error', 500);
  }
};

// Update beneficiary
const updateBeneficiary = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return ResponseHelper.validationError(res, errors.array());
    }

    const updateQuery = { _id: req.params.id };
    if (req.franchiseId) updateQuery.franchise = req.franchiseId;
    const beneficiary = await Beneficiary.findOne(updateQuery);
    if (!beneficiary) {
      return res.status(404).json({ message: 'Beneficiary not found' });
    }

    // Check if user has access to update this beneficiary
    if (!hasAccessToBeneficiary(req.user, beneficiary)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { name, phone, state, district, area, unit, status } = req.body;

    // Check if phone already exists (excluding current beneficiary)
    if (phone && phone !== beneficiary.phone) {
      const dupQuery = { phone, _id: { $ne: req.params.id } };
      if (req.franchiseId) dupQuery.franchise = req.franchiseId;
      const existingBeneficiary = await Beneficiary.findOne(dupQuery);
      if (existingBeneficiary) {
        return res.status(400).json({ message: 'Phone number already registered' });
      }
    }

    // Verify location hierarchy if location is being updated
    if (state || district || area || unit) {
      const newState = state || beneficiary.state;
      const newDistrict = district || beneficiary.district;
      const newArea = area || beneficiary.area;
      const newUnit = unit || beneficiary.unit;
      
      const locationValid = await verifyLocationHierarchy(newState, newDistrict, newArea, newUnit);
      if (!locationValid) {
        return res.status(400).json({ message: 'Invalid location hierarchy' });
      }

      // Check if user has access to new location
      if (!hasAccessToLocation(req.user, { 
        state: newState, 
        district: newDistrict, 
        area: newArea, 
        unit: newUnit 
      })) {
        return res.status(403).json({ message: 'Access denied for this location' });
      }
    }

    // Update fields
    if (name) beneficiary.name = name;
    if (phone) beneficiary.phone = phone;
    if (state) beneficiary.state = state;
    if (district) beneficiary.district = district;
    if (area) beneficiary.area = area;
    if (unit) beneficiary.unit = unit;
    if (status) beneficiary.status = status;
    
    beneficiary.updatedBy = req.user.id;

    await beneficiary.save();

    const updatedBeneficiary = await Beneficiary.findOne({ _id: beneficiary._id, franchise: req.franchiseId })
      .populate('state', 'name code')
      .populate('district', 'name code')
      .populate('area', 'name code')
      .populate('unit', 'name code')
      .populate('createdBy', 'name')
      .populate('updatedBy', 'name')
      .populate('verifiedBy', 'name');

    return ResponseHelper.success(res, { beneficiary: updatedBeneficiary }, 'Beneficiary updated successfully', 200);
  } catch (error) {
    console.error('Error updating beneficiary:', error);
    return ResponseHelper.error(res, error.message || 'Server error', 500);
  }
};

// Delete beneficiary
const deleteBeneficiary = async (req, res) => {
  try {
    const delQuery = { _id: req.params.id };
    if (req.franchiseId) delQuery.franchise = req.franchiseId;
    const beneficiary = await Beneficiary.findOne(delQuery);
    if (!beneficiary) {
      return res.status(404).json({ message: 'Beneficiary not found' });
    }

    // Check if user has access to delete this beneficiary
    if (!hasAccessToBeneficiary(req.user, beneficiary)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Check if beneficiary has applications
    if (beneficiary.applications && beneficiary.applications.length > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete beneficiary with existing applications' 
      });
    }

    await Beneficiary.findOneAndDelete({ _id: req.params.id, franchise: req.franchiseId });
    res.json({ message: 'Beneficiary deleted successfully' });
  } catch (error) {
    console.error('Error deleting beneficiary:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Verify beneficiary
const verifyBeneficiary = async (req, res) => {
  try {
    const verifyQuery = { _id: req.params.id };
    if (req.franchiseId) verifyQuery.franchise = req.franchiseId;
    const beneficiary = await Beneficiary.findOne(verifyQuery);
    if (!beneficiary) {
      return res.status(404).json({ message: 'Beneficiary not found' });
    }

    // Check if user has access to verify this beneficiary
    if (!hasAccessToBeneficiary(req.user, beneficiary)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    beneficiary.isVerified = true;
    beneficiary.verifiedBy = req.user.id;
    beneficiary.verifiedAt = new Date();
    beneficiary.status = 'active';
    beneficiary.updatedBy = req.user.id;

    await beneficiary.save();

    const verifiedBeneficiary = await Beneficiary.findOne({ _id: beneficiary._id, franchise: req.franchiseId })
      .populate('state', 'name code')
      .populate('district', 'name code')
      .populate('area', 'name code')
      .populate('unit', 'name code')
      .populate('verifiedBy', 'name');

    res.json(verifiedBeneficiary);
  } catch (error) {
    console.error('Error verifying beneficiary:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Helper functions
const getUserRegionalFilter = (user) => {
  const filter = {};
  
  // Super admin and state admin have access to all beneficiaries
  if (user.role === 'super_admin' || user.role === 'state_admin') {
    return filter; // No restrictions
  }
  
  // For other admin roles, check their adminScope.regions
  if (user.adminScope?.regions && user.adminScope.regions.length > 0) {
    const regions = user.adminScope.regions;
    
    if (user.role === 'district_admin') {
      filter.district = { $in: regions };
    } else if (user.role === 'area_admin') {
      filter.area = { $in: regions };
    } else if (user.role === 'unit_admin') {
      filter.unit = { $in: regions };
    }
  }
  
  return filter;
};

const hasAccessToBeneficiary = (user, beneficiary) => {
  if (user.role === 'super_admin' || user.role === 'state_admin') return true;
  
  // Check if user has access based on their adminScope.regions
  if (user.adminScope?.regions && user.adminScope.regions.length > 0) {
    const userRegions = user.adminScope.regions.map(r => r.toString());
    
    if (user.role === 'district_admin') {
      return userRegions.includes(beneficiary.district?.toString());
    } else if (user.role === 'area_admin') {
      return userRegions.includes(beneficiary.area?.toString());
    } else if (user.role === 'unit_admin') {
      return userRegions.includes(beneficiary.unit?.toString());
    }
  }
  
  return false;
};

const hasAccessToLocation = (user, location) => {
  // Safety check
  if (!user || !user.role) {
    console.log('⚠️ hasAccessToLocation: Invalid user object');
    return false;
  }

  // Super admin and state admin have full access
  if (user.role === 'super_admin' || user.role === 'state_admin') {
    console.log(`✅ hasAccessToLocation: ${user.role} has full access`);
    return true;
  }
  
  // For other admin roles, check their adminScope
  if (user.role === 'district_admin') {
    // Check if user's district matches the location's district
    const userDistrictId = user.adminScope?.district?.toString() || 
                          (user.adminScope?.regions && user.adminScope.regions[0]?.toString());
    const hasAccess = userDistrictId === location.district?.toString();
    console.log(`🔍 district_admin access check: ${hasAccess}`, { userDistrictId, locationDistrict: location.district?.toString() });
    return hasAccess;
  } else if (user.role === 'area_admin') {
    // Check if user's area matches the location's area
    const userAreaId = user.adminScope?.area?.toString() || 
                      (user.adminScope?.regions && user.adminScope.regions[0]?.toString());
    const hasAccess = userAreaId === location.area?.toString();
    console.log(`🔍 area_admin access check: ${hasAccess}`, { userAreaId, locationArea: location.area?.toString() });
    return hasAccess;
  } else if (user.role === 'unit_admin') {
    // Check if user's unit matches the location's unit
    const userUnitId = user.adminScope?.unit?.toString() || 
                      (user.adminScope?.regions && user.adminScope.regions[0]?.toString());
    const hasAccess = userUnitId === location.unit?.toString();
    console.log(`🔍 unit_admin access check: ${hasAccess}`, { userUnitId, locationUnit: location.unit?.toString() });
    return hasAccess;
  }
  
  console.log(`❌ hasAccessToLocation: Unknown role ${user.role}`);
  return false;
};

const verifyLocationHierarchy = async (stateId, districtId, areaId, unitId) => {
  try {
    const [state, district, area, unit] = await Promise.all([
      Location.findById(stateId),
      Location.findById(districtId),
      Location.findById(areaId),
      Location.findById(unitId)
    ]);

    if (!state || !district || !area || !unit) return false;
    if (state.type !== 'state') return false;
    if (district.type !== 'district' || district.parent.toString() !== stateId.toString()) return false;
    if (area.type !== 'area' || area.parent.toString() !== districtId.toString()) return false;
    if (unit.type !== 'unit' || unit.parent.toString() !== areaId.toString()) return false;

    return true;
  } catch (error) {
    return false;
  }
};

// Export beneficiaries to Excel/CSV
const exportBeneficiaries = async (req, res) => {
  try {
    const { 
      search = '', 
      status = '', 
      state = '', 
      district = '', 
      area = '', 
      unit = '',
      gender = '',
      project = '',
      scheme = '',
      format = 'excel',
      includeApprovedInterviews = false
    } = req.query;

    // Build filter object (same as getBeneficiaries)
    const filter = {};
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status) filter.status = status;
    if (state) filter.state = state;
    if (district) filter.district = district;
    if (area) filter.area = area;
    if (unit) filter.unit = unit;
    if (gender) filter['profile.gender'] = gender;

    // Apply user's regional access restrictions
    const userRegionalFilter = getUserRegionalFilter(req.user);
    Object.assign(filter, userRegionalFilter);
    if (req.franchiseId) filter.franchise = req.franchiseId;

    // If project or scheme filters are applied, we need to filter by applications
    if (project || scheme) {
      const Application = require('../models/Application');
      const applicationFilter = {};
      if (project) applicationFilter.project = project;
      if (scheme) applicationFilter.scheme = scheme;
      if (req.franchiseId) applicationFilter.franchise = req.franchiseId;
      
      const applications = await Application.find(applicationFilter).distinct('beneficiary');
      filter._id = { $in: applications };
    }
    
    // Get all beneficiaries without pagination for export
    let beneficiaries = await Beneficiary.find(filter)
      .populate('state', 'name code')
      .populate('district', 'name code')
      .populate('area', 'name code')
      .populate('unit', 'name code')
      .populate('createdBy', 'name')
      .populate('verifiedBy', 'name')
      .populate('applications')
      .sort({ createdAt: -1 });

    // Include approved interview applicants if requested
    if (includeApprovedInterviews === 'true') {
      const Interview = require('../models/Interview');
      const Application = require('../models/Application');
      
      const approvedInterviews = await Interview.find({
        status: 'completed',
        result: 'passed'
      }).populate({
        path: 'application',
        populate: [
          { path: 'beneficiary', populate: ['state', 'district', 'area', 'unit'] },
          { path: 'scheme', select: 'name' },
          { path: 'project', select: 'name' }
        ]
      });

      const interviewBeneficiaries = approvedInterviews
        .filter(interview => interview.application && interview.application.beneficiary)
        .map(interview => {
          const app = interview.application;
          const beneficiary = app.beneficiary;
          
          return {
            ...beneficiary.toObject(),
            source: 'interview',
            interviewId: interview._id,
            approvedAt: interview.completedAt,
            applications: [app._id],
            status: 'active',
            isVerified: true
          };
        });

      const existingBeneficiaryIds = beneficiaries.map(b => b._id.toString());
      const uniqueInterviewBeneficiaries = interviewBeneficiaries.filter(
        ib => !existingBeneficiaryIds.includes(ib._id.toString())
      );

      beneficiaries = [...beneficiaries, ...uniqueInterviewBeneficiaries];
    }

    // Prepare data for export
    const exportData = beneficiaries.map(beneficiary => ({
      'ID': beneficiary._id,
      'Name': beneficiary.name,
      'Phone': beneficiary.phone,
      'Status': beneficiary.status,
      'Verified': beneficiary.isVerified ? 'Yes' : 'No',
      'State': beneficiary.state?.name || '',
      'District': beneficiary.district?.name || '',
      'Area': beneficiary.area?.name || '',
      'Unit': beneficiary.unit?.name || '',
      'Gender': beneficiary.profile?.gender || '',
      'Applications Count': beneficiary.applications?.length || 0,
      'Source': beneficiary.source || 'direct',
      'Created Date': beneficiary.createdAt ? new Date(beneficiary.createdAt).toLocaleDateString() : '',
      'Created By': beneficiary.createdBy?.name || '',
      'Verified By': beneficiary.verifiedBy?.name || '',
      'Verified Date': beneficiary.verifiedAt ? new Date(beneficiary.verifiedAt).toLocaleDateString() : ''
    }));

    if (format === 'excel') {
      const ExcelJS = require('exceljs');
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Beneficiaries');

      // Add headers
      const headers = Object.keys(exportData[0] || {});
      worksheet.addRow(headers);

      // Style headers
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      // Add data
      exportData.forEach(row => {
        worksheet.addRow(Object.values(row));
      });

      // Auto-fit columns
      worksheet.columns.forEach(column => {
        column.width = Math.max(column.width || 0, 15);
      });

      // Set response headers
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=beneficiaries-${new Date().toISOString().split('T')[0]}.xlsx`);

      // Write to response
      await workbook.xlsx.write(res);
      res.end();
    } else {
      // CSV format
      const createCsvWriter = require('csv-writer').createObjectCsvWriter;
      const csvWriter = createCsvWriter({
        path: '', // We'll write directly to response
        header: Object.keys(exportData[0] || {}).map(key => ({ id: key, title: key }))
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=beneficiaries-${new Date().toISOString().split('T')[0]}.csv`);

      // Convert to CSV string
      const csvString = [
        Object.keys(exportData[0] || {}).join(','),
        ...exportData.map(row => Object.values(row).map(val => `"${val}"`).join(','))
      ].join('\n');

      res.send(csvString);
    }

  } catch (error) {
    console.error('Error exporting beneficiaries:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

module.exports = {
  getBeneficiaries,
  getBeneficiary,
  createBeneficiary,
  updateBeneficiary,
  deleteBeneficiary,
  verifyBeneficiary,
  exportBeneficiaries
};