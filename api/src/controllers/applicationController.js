const Application = require('../models/Application');
const Beneficiary = require('../models/Beneficiary');
const Scheme = require('../models/Scheme');
const Project = require('../models/Project');
const MasterData = require('../models/MasterData');
const FormConfiguration = require('../models/FormConfiguration');
const User = require('../models/User');
const notificationService = require('../services/notificationService');
const recurringPaymentService = require('../services/recurringPaymentService');
const { calculateApplicationScore } = require('../utils/scoringEngine');
const { validationResult } = require('express-validator');
const RBACMiddleware = require('../middleware/rbacMiddleware');

// Get all applications with pagination and search
const getApplications = async (req, res) => {
  try {
    console.log('🔍 getApplications called by user:', {
      id: req.user._id,
      role: req.user.role,
      adminScope: req.user.adminScope
    });

    const { 
      page = 1, 
      limit = 10, 
      search = '', 
      status = '', 
      scheme = '',
      project = '',
      state = '', 
      district = '', 
      area = '', 
      unit = '' 
    } = req.query;

    console.log('🔍 getApplications - Query parameters:', {
      page,
      limit,
      status,
      search: search ? '***' : '',
      scheme,
      project,
      district,
      area,
      unit
    });

    // Build filter object
    const filter = {};
    
    if (search) {
      // Search in application number or beneficiary details
      const beneficiaries = await Beneficiary.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');
      
      filter.$or = [
        { applicationNumber: { $regex: search, $options: 'i' } },
        { beneficiary: { $in: beneficiaries.map(b => b._id) } }
      ];
    }
    
    if (status) {
      filter.status = status;
      console.log('✅ Status filter applied:', status);
    }
    if (scheme) filter.scheme = scheme;
    if (project) filter.project = project;
    if (state) filter.state = state;
    if (district) filter.district = district;
    if (area) filter.area = area;
    if (unit) filter.unit = unit;

    // Apply user's regional access restrictions
    const userRegionalFilter = getUserRegionalFilter(req.user);
    console.log('🔍 User regional filter:', userRegionalFilter);
    
    // Apply regional filtering based on user's scope
    Object.assign(filter, userRegionalFilter);
    
    console.log('🔍 Final filter:', filter);

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Check total applications in database
    const totalApplicationsInDB = await Application.countDocuments();
    console.log('🔍 Total applications in database:', totalApplicationsInDB);
    
    const applications = await Application.find(filter)
      .populate('beneficiary', 'name phone')
      .populate('scheme', 'name code maxAmount distributionTimeline applicationSettings')
      .populate('project', 'name code')
      .populate('state', 'name code')
      .populate('district', 'name code')
      .populate('area', 'name code')
      .populate('unit', 'name code')
      .populate('createdBy', 'name')
      .populate('reviewedBy', 'name')
      .populate('approvedBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Application.countDocuments(filter);

    res.json({
      success: true,
      data: {
        applications,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total,
          limit: parseInt(limit)
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching applications:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error',
      timestamp: new Date().toISOString()
    });
  }
};

// Get single application
const getApplication = async (req, res) => {
  try {
    const application = await Application.findById(req.params.id)
      .populate('beneficiary')
      .populate('scheme', 'name code maxAmount distributionTimeline applicationSettings')
      .populate('project')
      .populate('state', 'name code')
      .populate('district', 'name code')
      .populate('area', 'name code')
      .populate('unit', 'name code')
      .populate('createdBy', 'name')
      .populate('reviewedBy', 'name')
      .populate('approvedBy', 'name');

    if (!application) {
      return res.status(404).json({ 
        success: false,
        message: 'Application not found',
        timestamp: new Date().toISOString()
      });
    }

    // Check if user has access to this application
    console.log('🔍 Checking application access:', {
      userId: req.user._id,
      userRole: req.user.role,
      userAdminScope: req.user.adminScope,
      applicationId: application._id,
      applicationDistrict: application.district?._id || application.district,
      applicationArea: application.area?._id || application.area,
      applicationUnit: application.unit?._id || application.unit
    });
    
    // Try both access check methods
    let hasAccess = hasAccessToApplication(req.user, application);
    
    // If the simple check fails, try the RBAC middleware check (more comprehensive)
    if (!hasAccess) {
      try {
        hasAccess = await RBACMiddleware.checkApplicationAccess(req.user, application);
        console.log('✅ RBAC access check result:', hasAccess);
      } catch (rbacError) {
        console.error('❌ RBAC access check error:', rbacError);
        // Fall back to simple check result
      }
    } else {
      console.log('✅ Simple access check result: true');
    }
    
    if (!hasAccess) {
      console.warn('❌ Access denied for application:', {
        userId: req.user._id,
        userRole: req.user.role,
        userAdminScope: req.user.adminScope,
        applicationId: application._id
      });
      return res.status(403).json({ 
        success: false,
        message: 'Access denied',
        timestamp: new Date().toISOString()
      });
    }

    // Fetch payments for this application
    const Payment = require('../models/Payment');
    const payments = await Payment.find({ application: application._id })
      .sort({ 'installment.number': 1 })
      .lean();

    res.json({
      success: true,
      message: 'Application retrieved successfully',
      data: {
        application,
        payments
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching application:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error',
      timestamp: new Date().toISOString()
    });
  }
};

// Create new application
const createApplication = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { beneficiary, scheme, project, requestedAmount, documents, isRecurring, recurringConfig } = req.body;

    // Verify beneficiary exists and is active
    const beneficiaryDoc = await Beneficiary.findById(beneficiary);
    if (!beneficiaryDoc) {
      return res.status(400).json({ message: 'Beneficiary not found' });
    }
    if (beneficiaryDoc.status !== 'active') {
      return res.status(400).json({ message: 'Beneficiary must be active to apply' });
    }

    // Verify scheme exists and is active
    const schemeDoc = await Scheme.findById(scheme);
    if (!schemeDoc) {
      return res.status(400).json({ message: 'Scheme not found' });
    }
    if (schemeDoc.status !== 'active') {
      return res.status(400).json({ message: 'Scheme is not active' });
    }

    // Verify project if provided
    let projectDoc = null;
    if (project) {
      projectDoc = await Project.findById(project);
      if (!projectDoc) {
        return res.status(400).json({ message: 'Project not found' });
      }
      if (projectDoc.status !== 'active') {
        return res.status(400).json({ message: 'Project is not active' });
      }
    }

    // Validate requested amount
    if (requestedAmount > schemeDoc.maxAmount) {
      return res.status(400).json({ 
        message: `Requested amount cannot exceed scheme maximum of ₹${schemeDoc.maxAmount}` 
      });
    }

    // Check if user has access to create application for this beneficiary
    if (!hasAccessToBeneficiary(req.user, beneficiaryDoc)) {
      return res.status(403).json({ message: 'Access denied for this beneficiary' });
    }

    // Generate distribution timeline based on scheme configuration
    const distributionTimeline = await generateDistributionTimeline(schemeDoc, requestedAmount);

    // Initialize application with scheme-based workflow stages
    const applicationStages = getApplicationStagesFromScheme(schemeDoc);

    const application = new Application({
      beneficiary,
      scheme,
      project,
      requestedAmount,
      documents: documents || [],
      distributionTimeline,
      applicationStages, // Add the workflow stages
      currentStage: applicationStages.length > 0 ? applicationStages[0].name : 'Application Received',
      state: beneficiaryDoc.state,
      district: beneficiaryDoc.district,
      area: beneficiaryDoc.area,
      unit: beneficiaryDoc.unit,
      createdBy: req.user.id,
      // Add recurring configuration
      isRecurring: isRecurring || false,
      recurringConfig: isRecurring ? {
        enabled: true,
        period: recurringConfig.period,
        numberOfPayments: recurringConfig.numberOfPayments,
        amountPerPayment: recurringConfig.amountPerPayment,
        startDate: recurringConfig.startDate,
        customAmounts: recurringConfig.customAmounts || [],
        status: 'active'
      } : undefined
    });

    // Calculate eligibility score if form has scoring enabled
    if (req.body.formData) {
      try {
        const formConfig = await FormConfiguration.findOne({
          scheme: scheme,
          enabled: true
        });
        if (formConfig) {
          const scoreResult = calculateApplicationScore(req.body.formData, formConfig);
          application.eligibilityScore = scoreResult;
          application.formData = req.body.formData;
        }
      } catch (scoringError) {
        console.error('Scoring calculation failed:', scoringError.message);
      }
    }

    await application.save();

    // If recurring, generate payment schedule after application is created
    if (isRecurring && recurringConfig) {
      try {
        await recurringPaymentService.generatePaymentSchedule(
          application,
          recurringConfig,
          req.user.id
        );
      } catch (recurringError) {
        console.error('Error generating recurring schedule:', recurringError);
        // Don't fail the application creation, just log the error
      }
    }

    // Add application to beneficiary's applications array
    beneficiaryDoc.applications.push(application._id);
    await beneficiaryDoc.save();

    const populatedApplication = await Application.findById(application._id)
      .populate('beneficiary', 'name phone')
      .populate('scheme', 'name code distributionTimeline applicationSettings')
      .populate('project', 'name code')
      .populate('createdBy', 'name');

    res.status(201).json(populatedApplication);
  } catch (error) {
    console.error('Error creating application:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update application
const updateApplication = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    // Check if user has access to update this application
    if (!hasAccessToApplication(req.user, application)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { requestedAmount, documents, status } = req.body;

    // Only allow certain status transitions
    if (status && !isValidStatusTransition(application.status, status)) {
      return res.status(400).json({ 
        message: `Cannot change status from ${application.status} to ${status}` 
      });
    }

    // Update fields
    if (requestedAmount !== undefined) {
      // Verify against scheme limits
      const scheme = await Scheme.findById(application.scheme);
      if (requestedAmount > scheme.maxAmount) {
        return res.status(400).json({ 
          message: `Requested amount cannot exceed scheme maximum of ₹${scheme.maxAmount}` 
        });
      }
      application.requestedAmount = requestedAmount;
    }
    
    if (documents) application.documents = documents;
    if (status) application.status = status;
    
    application.updatedBy = req.user.id;

    await application.save();

    const updatedApplication = await Application.findById(application._id)
      .populate('beneficiary', 'name phone')
      .populate('scheme', 'name code distributionTimeline applicationSettings')
      .populate('project', 'name code')
      .populate('createdBy', 'name')
      .populate('updatedBy', 'name');

    res.json(updatedApplication);
  } catch (error) {
    console.error('Error updating application:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Review application
const reviewApplication = async (req, res) => {
  try {
    const { status, comments } = req.body;

    if (!['under_review', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid review status' });
    }

    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    // Check if user has access to review this application
    if (!hasAccessToApplication(req.user, application)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Only pending applications can be reviewed
    if (application.status !== 'pending') {
      return res.status(400).json({ 
        message: 'Only pending applications can be reviewed' 
      });
    }

    application.status = status;
    application.reviewedBy = req.user.id;
    application.reviewedAt = new Date();
    application.reviewComments = comments;
    application.updatedBy = req.user.id;

    await application.save();

    const reviewedApplication = await Application.findById(application._id)
      .populate('beneficiary', 'name phone area')
      .populate('scheme', 'name code distributionTimeline applicationSettings')
      .populate('project', 'name code')
      .populate('reviewedBy', 'name');

    // Notify area coordinator when marked for review
    if (status === 'under_review') {
      notificationService
        .notifyAreaReviewRequired(reviewedApplication, { createdBy: req.user.id })
        .catch(err => console.error('❌ Area review notification failed:', err));
    }

    res.json(reviewedApplication);
  } catch (error) {
    console.error('Error reviewing application:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Approve application
const approveApplication = async (req, res) => {
  try {
    const { approvedAmount, comments } = req.body;

    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    // Check if user has access to approve this application
    if (!hasAccessToApplication(req.user, application)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Allow approval from 'pending' or 'under_review' status
    if (!['pending', 'under_review'].includes(application.status)) {
      return res.status(400).json({ 
        message: `Only pending or under_review applications can be approved. Current status: ${application.status}` 
      });
    }

    // Validate approved amount
    if (approvedAmount > application.requestedAmount) {
      return res.status(400).json({ 
        message: 'Approved amount cannot exceed requested amount' 
      });
    }

    application.status = 'approved';
    application.approvedAmount = approvedAmount;
    application.approvedBy = req.user.id;
    application.approvedAt = new Date();
    application.approvalComments = comments;
    application.updatedBy = req.user.id;

    // Update distribution timeline with actual approved amount and dates
    await updateDistributionTimelineOnApproval(application, approvedAmount);

    // Set renewal expiry if scheme supports renewals
    const scheme = await Scheme.findById(application.scheme);
    if (scheme?.renewalSettings?.isRenewable) {
      const approvedDate = application.approvedAt;
      const expiryDate = new Date(approvedDate);
      expiryDate.setDate(expiryDate.getDate() + (scheme.renewalSettings.renewalPeriodDays || 365));
      application.expiryDate = expiryDate;
      
      const renewalDueDate = new Date(expiryDate);
      renewalDueDate.setDate(renewalDueDate.getDate() - (scheme.renewalSettings.autoNotifyBeforeDays || 30));
      application.renewalDueDate = renewalDueDate;
      
      application.renewalStatus = 'active';
      application.renewalNotificationSent = false;
      console.log(`📅 Renewal set: expires ${expiryDate.toISOString()}, due notification ${renewalDueDate.toISOString()}`);
    }

    await application.save();

    const approvedApplication = await Application.findById(application._id)
      .populate('beneficiary', 'name phone')
      .populate('scheme', 'name code distributionTimeline applicationSettings')
      .populate('project', 'name code')
      .populate('approvedBy', 'name');

    // Notify beneficiary (WhatsApp) on approval
    notificationService
      .notifyApplicationDecisionToBeneficiary(approvedApplication, 'approved', { createdBy: req.user.id })
      .catch(err => console.error('❌ Beneficiary approval notification failed:', err));

    res.json(approvedApplication);
  } catch (error) {
    console.error('Error approving application:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete application
const deleteApplication = async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    // Check if user has access to delete this application
    if (!hasAccessToApplication(req.user, application)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Only pending applications can be deleted
    if (application.status !== 'pending') {
      return res.status(400).json({ 
        message: 'Only pending applications can be deleted' 
      });
    }

    // Remove application from beneficiary's applications array
    await Beneficiary.findByIdAndUpdate(
      application.beneficiary,
      { $pull: { applications: application._id } }
    );

    await Application.findByIdAndDelete(req.params.id);
    res.json({ message: 'Application deleted successfully' });
  } catch (error) {
    console.error('Error deleting application:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Helper functions
const getUserRegionalFilter = (user) => {
  console.log('🔍 getUserRegionalFilter called with user:', {
    role: user.role,
    adminScope: user.adminScope
  });
  
  const filter = {};
  
  // Super admin has access to all applications
  if (user.role === 'super_admin') {
    console.log(`🔍 super_admin - no restrictions`);
    return filter; // No restrictions
  }

  // Helper function to get ID from populated reference or direct ID
  const getId = (ref) => {
    if (!ref) return null;
    if (typeof ref === 'object' && ref._id) return ref._id.toString();
    return ref.toString();
  };

  // State admin: filter by their assigned state
  if (user.role === 'state_admin') {
    const stateId = user.adminScope?.state ? getId(user.adminScope.state) : null;
    const regions = (user.adminScope?.regions || []).map(r => getId(r));
    if (stateId) {
      filter.state = stateId;
      console.log('🔍 State admin filter applied (from adminScope.state):', filter);
    } else if (regions.length > 0) {
      filter.state = { $in: regions };
      console.log('🔍 State admin filter applied (from regions):', filter);
    } else {
      console.log('🔍 State admin has no state scope - restricting to no results');
      filter._id = { $exists: false }; // no state assigned → deny access to all applications
    }
    return filter;
  }

  // Project coordinator: see applications for their assigned projects
  // Also apply region-based scoping if available for extra security
  if (user.role === 'project_coordinator') {
    const projectIds = (user.adminScope?.projects || []).map(p => getId(p)).filter(Boolean);
    if (projectIds.length > 0) {
      filter.project = { $in: projectIds };
      console.log('🔍 Project coordinator filter applied:', filter);
    } else {
      // No assigned projects - return no results (use impossible ID)
      filter._id = new (require('mongoose').Types.ObjectId)();
      filter._id = { $exists: false }; // Will match nothing
      console.log('🔍 Project coordinator has no assigned projects - returning empty');
    }
    return filter;
  }

  // Scheme coordinator: see applications for their assigned schemes
  // Also apply region-based scoping if available for extra security
  if (user.role === 'scheme_coordinator') {
    const schemeIds = (user.adminScope?.schemes || []).map(s => getId(s)).filter(Boolean);
    if (schemeIds.length > 0) {
      filter.scheme = { $in: schemeIds };
      console.log('🔍 Scheme coordinator filter applied:', filter);
    } else {
      filter._id = { $exists: false }; // Will match nothing
      console.log('🔍 Scheme coordinator has no assigned schemes - returning empty');
    }
    return filter;
  }

  // Check adminScope.regions array first (for backward compatibility)
  if (user.adminScope?.regions && user.adminScope.regions.length > 0) {
    const regions = user.adminScope.regions.map(r => getId(r)).filter(Boolean);
    console.log('🔍 User has regions array:', regions);

    if (user.role === 'district_admin') {
      // District admin sees ALL applications within their district (all units/areas under it)
      filter.district = { $in: regions };
      console.log('🔍 District admin filter applied (from regions):', filter);
    } else if (user.role === 'area_admin') {
      // Area admin sees ALL applications within their area (all units under it)
      filter.area = { $in: regions };
      console.log('🔍 Area admin filter applied (from regions):', filter);
    } else if (user.role === 'unit_admin') {
      // Unit admin sees only their unit's applications
      filter.unit = { $in: regions };
      console.log('🔍 Unit admin filter applied (from regions):', filter);
    }
  } else {
    // Fallback: Check direct district/area/unit properties
    const userUnitId = user.adminScope?.unit ? getId(user.adminScope.unit) : null;
    const userAreaId = user.adminScope?.area ? getId(user.adminScope.area) : null;
    const userDistrictId = user.adminScope?.district ? getId(user.adminScope.district) : null;

    if (user.role === 'unit_admin' && userUnitId) {
      filter.unit = userUnitId;
      console.log('🔍 Unit admin filter applied (from direct unit):', filter);
    } else if (user.role === 'area_admin' && userAreaId) {
      filter.area = userAreaId;
      console.log('🔍 Area admin filter applied (from direct area):', filter);
    } else if (user.role === 'district_admin' && userDistrictId) {
      // District admin sees all applications in their district regardless of area/unit
      filter.district = userDistrictId;
      console.log('🔍 District admin filter applied (from direct district):', filter);
    } else {
      // No scope defined - deny access to prevent data leakage
      filter._id = { $exists: false };
      console.log('🔍 No adminScope found for user - restricting access to prevent data leakage');
    }
  }

  return filter;
};

const hasAccessToApplication = (user, application) => {
  // Super admin and state admin have access to everything
  if (user.role === 'super_admin') {
    console.log(`✅ super_admin - full access granted`);
    return true;
  }

  // Helper function to get ID from populated reference or direct ID
  const getId = (ref) => {
    if (!ref) return null;
    if (typeof ref === 'object' && ref._id) return ref._id.toString();
    return ref.toString();
  };

  // State admin: check if application belongs to their assigned state
  if (user.role === 'state_admin') {
    const stateId = user.adminScope?.state ? getId(user.adminScope.state) : null;
    const regions = (user.adminScope?.regions || []).map(r => r.toString());
    const applicationStateId = getId(application.state);
    if (stateId) {
      const hasAccess = applicationStateId && stateId === applicationStateId;
      console.log(`🔍 State admin check: ${hasAccess ? '✅' : '❌'} (user state: ${stateId}, app state: ${applicationStateId})`);
      return hasAccess;
    } else if (regions.length > 0) {
      const hasAccess = applicationStateId && regions.includes(applicationStateId);
      console.log(`🔍 State admin check (regions): ${hasAccess ? '✅' : '❌'}`);
      return hasAccess;
    }
    // No state scope assigned - grant access (backward compatible)
    console.log('✅ State admin has no state scope - full access granted');
    return true;
  }

  console.log('🔍 hasAccessToApplication check:', {
    userRole: user.role,
    hasAdminScope: !!user.adminScope,
    adminScopeRegions: user.adminScope?.regions?.length || 0,
    adminScopeDistrict: user.adminScope?.district ? getId(user.adminScope.district) : null,
    adminScopeArea: user.adminScope?.area ? getId(user.adminScope.area) : null,
    adminScopeUnit: user.adminScope?.unit ? getId(user.adminScope.unit) : null,
    applicationDistrict: getId(application.district),
    applicationArea: getId(application.area),
    applicationUnit: getId(application.unit)
  });
  
  // Project coordinator: check if application belongs to their assigned projects
  if (user.role === 'project_coordinator') {
    const projectIds = (user.adminScope?.projects || []).map(p => p.toString());
    if (projectIds.length === 0) {
      console.log('❌ Project coordinator has no assigned projects - access denied');
      return false;
    }
    const appProjectId = getId(application.project);
    const hasAccess = appProjectId && projectIds.includes(appProjectId);
    console.log(`🔍 Project coordinator check: ${hasAccess ? '✅' : '❌'}`);
    return hasAccess;
  }

  // Scheme coordinator: check if application belongs to their assigned schemes
  if (user.role === 'scheme_coordinator') {
    const schemeIds = (user.adminScope?.schemes || []).map(s => s.toString());
    if (schemeIds.length === 0) {
      console.log('❌ Scheme coordinator has no assigned schemes - access denied');
      return false;
    }
    const appSchemeId = getId(application.scheme);
    const hasAccess = appSchemeId && schemeIds.includes(appSchemeId);
    console.log(`🔍 Scheme coordinator check: ${hasAccess ? '✅' : '❌'}`);
    return hasAccess;
  }

  // Handle both adminScope formats: regions array and direct district/area/unit
  if (user.adminScope) {
    // Format 1: Check adminScope.regions array
    if (user.adminScope.regions && user.adminScope.regions.length > 0) {
      const userRegions = user.adminScope.regions.map(r => r.toString());
      const applicationDistrictId = getId(application.district);
      const applicationAreaId = getId(application.area);
      const applicationUnitId = getId(application.unit);
      
      if (user.role === 'district_admin') {
        // District admin: access to any application whose district matches
        const hasAccess = applicationDistrictId && userRegions.includes(applicationDistrictId);
        console.log(`🔍 District admin check: ${hasAccess ? '✅' : '❌'} (user regions: [${userRegions.join(', ')}], app district: ${applicationDistrictId})`);
        return hasAccess;
      } else if (user.role === 'area_admin') {
        // Area admin: access to any application whose area matches
        const hasAccess = applicationAreaId && userRegions.includes(applicationAreaId);
        console.log(`🔍 Area admin check: ${hasAccess ? '✅' : '❌'} (user regions: [${userRegions.join(', ')}], app area: ${applicationAreaId})`);
        return hasAccess;
      } else if (user.role === 'unit_admin') {
        // Unit admin: access only to their unit's applications
        const hasAccess = applicationUnitId && userRegions.includes(applicationUnitId);
        console.log(`🔍 Unit admin check: ${hasAccess ? '✅' : '❌'} (user regions: [${userRegions.join(', ')}], app unit: ${applicationUnitId})`);
        return hasAccess;
      }
    }
    
    // Format 2: Check direct adminScope.district/area/unit properties
    const userDistrictId = user.adminScope.district ? getId(user.adminScope.district) : null;
    const userAreaId = user.adminScope.area ? getId(user.adminScope.area) : null;
    const userUnitId = user.adminScope.unit ? getId(user.adminScope.unit) : null;
    
    if (user.role === 'district_admin' && userDistrictId) {
      const applicationDistrictId = getId(application.district);
      const hasAccess = applicationDistrictId && userDistrictId === applicationDistrictId;
      console.log(`🔍 District admin direct check: ${hasAccess ? '✅' : '❌'} (user district: ${userDistrictId}, app district: ${applicationDistrictId})`);
      return hasAccess;
    } else if (user.role === 'area_admin' && userAreaId) {
      const applicationAreaId = getId(application.area);
      const hasAccess = applicationAreaId && userAreaId === applicationAreaId;
      console.log(`🔍 Area admin direct check: ${hasAccess ? '✅' : '❌'} (user area: ${userAreaId}, app area: ${applicationAreaId})`);
      return hasAccess;
    } else if (user.role === 'unit_admin' && userUnitId) {
      const applicationUnitId = getId(application.unit);
      const hasAccess = applicationUnitId && userUnitId === applicationUnitId;
      console.log(`🔍 Unit admin direct check: ${hasAccess ? '✅' : '❌'} (user unit: ${userUnitId}, app unit: ${applicationUnitId})`);
      return hasAccess;
    }
  }
  
  // If no adminScope or matching access, deny access
  console.warn('❌ Access denied for application - no matching scope:', {
    userId: user._id,
    userRole: user.role,
    hasAdminScope: !!user.adminScope,
    adminScope: user.adminScope,
    applicationId: application._id,
    applicationDistrict: getId(application.district),
    applicationArea: getId(application.area),
    applicationUnit: getId(application.unit)
  });
  
  return false;
};

const hasAccessToBeneficiary = (user, beneficiary) => {
  if (user.role === 'super_admin') return true;

  const getId = (ref) => {
    if (!ref) return null;
    if (typeof ref === 'object' && ref._id) return ref._id.toString();
    return ref.toString();
  };

  const regions = (user.adminScope?.regions || []).map(r => r.toString());

  if (user.role === 'state_admin') {
    const stateId = user.adminScope?.state ? getId(user.adminScope.state) : null;
    if (stateId) return stateId === getId(beneficiary.state);
    if (regions.length > 0) return regions.includes(getId(beneficiary.state));
    return true; // No scope assigned - backward compatible
  }

  if (user.role === 'district_admin') {
    const districtId = user.adminScope?.district ? getId(user.adminScope.district) : null;
    if (districtId) return districtId === getId(beneficiary.district);
    return regions.includes(getId(beneficiary.district));
  }

  if (user.role === 'area_admin') {
    const areaId = user.adminScope?.area ? getId(user.adminScope.area) : null;
    if (areaId) return areaId === getId(beneficiary.area);
    return regions.includes(getId(beneficiary.area));
  }

  if (user.role === 'unit_admin') {
    const unitId = user.adminScope?.unit ? getId(user.adminScope.unit) : null;
    if (unitId) return unitId === getId(beneficiary.unit);
    return regions.includes(getId(beneficiary.unit));
  }

  return false;
};

const isValidStatusTransition = (currentStatus, newStatus) => {
  const validTransitions = {
    'draft': ['pending', 'cancelled'],
    'pending': ['under_review', 'rejected'],
    'under_review': ['approved', 'rejected'],
    'approved': ['completed'],
    'rejected': [],
    'completed': []
  };
  
  return validTransitions[currentStatus]?.includes(newStatus) || false;
};

// Get application stages from scheme configuration
const getApplicationStagesFromScheme = (scheme) => {
  try {
    let stages = [];

    const defaultCommentConfig = {
      unitAdmin: { enabled: false, required: false },
      areaAdmin: { enabled: false, required: false },
      districtAdmin: { enabled: false, required: false }
    };

    // Use scheme's custom stages if available
    if (scheme.statusStages && scheme.statusStages.length > 0) {
      stages = scheme.statusStages.map(stage => ({
        name: stage.name,
        description: stage.description,
        order: stage.order,
        isRequired: stage.isRequired,
        allowedRoles: stage.allowedRoles,
        autoTransition: stage.autoTransition,
        transitionConditions: stage.transitionConditions,
        commentConfig: {
          unitAdmin: {
            enabled: stage.commentConfig?.unitAdmin?.enabled || false,
            required: stage.commentConfig?.unitAdmin?.required || false
          },
          areaAdmin: {
            enabled: stage.commentConfig?.areaAdmin?.enabled || false,
            required: stage.commentConfig?.areaAdmin?.required || false
          },
          districtAdmin: {
            enabled: stage.commentConfig?.districtAdmin?.enabled || false,
            required: stage.commentConfig?.districtAdmin?.required || false
          }
        },
        requiredDocuments: (stage.requiredDocuments || []).map(doc => ({
          name: doc.name,
          description: doc.description,
          isRequired: doc.isRequired !== false
        }))
      }));
    } else {
      // Use default application stages
      stages = [
        {
          name: "Application Received",
          description: "Initial application submission and registration",
          order: 1,
          isRequired: true,
          allowedRoles: ['super_admin', 'state_admin', 'district_admin', 'area_admin', 'unit_admin'],
          autoTransition: true,
          transitionConditions: "Automatically set when application is submitted",
          commentConfig: defaultCommentConfig,
          requiredDocuments: []
        },
        {
          name: "Document Verification",
          description: "Verification of submitted documents and eligibility",
          order: 2,
          isRequired: true,
          allowedRoles: ['super_admin', 'state_admin', 'district_admin', 'area_admin', 'unit_admin'],
          autoTransition: false,
          transitionConditions: "",
          commentConfig: { ...defaultCommentConfig, unitAdmin: { enabled: true, required: false } },
          requiredDocuments: []
        },
        {
          name: "Field Verification",
          description: "Physical verification and field assessment",
          order: 3,
          isRequired: false,
          allowedRoles: ['super_admin', 'state_admin', 'district_admin', 'area_admin', 'unit_admin'],
          autoTransition: false,
          transitionConditions: "",
          commentConfig: { ...defaultCommentConfig, areaAdmin: { enabled: true, required: false } },
          requiredDocuments: []
        },
        {
          name: "Interview Process",
          description: "Beneficiary interview and assessment",
          order: 4,
          isRequired: scheme.applicationSettings?.requiresInterview || false,
          allowedRoles: ['super_admin', 'state_admin', 'district_admin', 'area_admin', 'unit_admin', 'scheme_coordinator'],
          autoTransition: false,
          transitionConditions: "",
          commentConfig: defaultCommentConfig,
          requiredDocuments: []
        },
        {
          name: "Final Review",
          description: "Final review and decision making",
          order: 5,
          isRequired: true,
          allowedRoles: ['super_admin', 'state_admin', 'district_admin', 'area_admin'],
          autoTransition: false,
          transitionConditions: "",
          commentConfig: { ...defaultCommentConfig, districtAdmin: { enabled: true, required: false } },
          requiredDocuments: []
        },
        {
          name: "Approved",
          description: "Application approved for disbursement",
          order: 6,
          isRequired: true,
          allowedRoles: ['super_admin', 'state_admin', 'district_admin', 'area_admin'],
          autoTransition: false,
          transitionConditions: "",
          commentConfig: defaultCommentConfig,
          requiredDocuments: []
        },
        {
          name: "Disbursement",
          description: "Money disbursement to beneficiary",
          order: 7,
          isRequired: true,
          allowedRoles: ['super_admin', 'state_admin', 'district_admin', 'area_admin'],
          autoTransition: false,
          transitionConditions: "",
          commentConfig: defaultCommentConfig,
          requiredDocuments: []
        },
        {
          name: "Completed",
          description: "Application process completed successfully",
          order: 8,
          isRequired: true,
          allowedRoles: ['super_admin', 'state_admin', 'district_admin', 'area_admin'],
          autoTransition: true,
          transitionConditions: "Automatically set when all disbursements are complete",
          commentConfig: defaultCommentConfig,
          requiredDocuments: []
        }
      ];
    }

    // Modify stages based on scheme settings
    if (!scheme.applicationSettings?.requiresInterview) {
      // Mark interview stage as not required
      stages = stages.map(stage => 
        stage.name === "Interview Process" 
          ? { ...stage, isRequired: false }
          : stage
      );
    }

    return stages.sort((a, b) => a.order - b.order);
  } catch (error) {
    console.error('Error getting application stages from scheme:', error);
    return [];
  }
};

// Generate distribution timeline based on scheme configuration
const generateDistributionTimeline = async (scheme, requestedAmount) => {
  try {
    let timeline = [];

    // First, check if scheme has its own distribution timeline
    if (scheme.distributionTimeline && scheme.distributionTimeline.length > 0) {
      timeline = scheme.distributionTimeline.map(step => ({
        description: step.description,
        amount: Math.round((requestedAmount * step.percentage) / 100),
        percentage: step.percentage,
        expectedDate: new Date(Date.now() + (step.daysFromApproval * 24 * 60 * 60 * 1000)),
        status: 'pending',
        notes: step.notes
      }));
    } else {
      // Look for master data distribution timeline templates
      const distributionTemplate = await MasterData.findOne({
        type: 'distribution_timeline_templates',
        status: 'active',
        $or: [
          { scope: 'global' },
          { scope: 'scheme_specific', targetSchemes: scheme._id }
        ]
      }).sort({ scope: -1 }); // Prefer scheme-specific over global

      if (distributionTemplate && distributionTemplate.configuration.distributionSteps) {
        timeline = distributionTemplate.configuration.distributionSteps.map(step => ({
          description: step.description,
          amount: Math.round((requestedAmount * step.percentage) / 100),
          percentage: step.percentage,
          expectedDate: new Date(Date.now() + (step.daysFromApproval * 24 * 60 * 60 * 1000)),
          status: 'pending',
          notes: step.notes
        }));
      } else {
        // Default timeline if no configuration found
        timeline = [
          {
            description: 'Initial Payment',
            amount: requestedAmount,
            percentage: 100,
            expectedDate: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)), // 30 days from now
            status: 'pending',
            notes: 'Full amount disbursement'
          }
        ];
      }
    }

    return timeline;
  } catch (error) {
    console.error('Error generating distribution timeline:', error);
    // Return default timeline on error
    return [
      {
        description: 'Initial Payment',
        amount: requestedAmount,
        percentage: 100,
        expectedDate: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)),
        status: 'pending',
        notes: 'Full amount disbursement'
      }
    ];
  }
};

// Update distribution timeline when application is approved
const updateDistributionTimelineOnApproval = async (application, approvedAmount) => {
  try {
    const approvalDate = new Date();
    
    // Get the latest scheme configuration to ensure we use current timeline settings
    const Scheme = require('../models/Scheme');
    const scheme = await Scheme.findById(application.scheme);
    
    if (scheme && scheme.distributionTimeline && scheme.distributionTimeline.length > 0) {
      // Regenerate timeline based on current scheme configuration
      application.distributionTimeline = scheme.distributionTimeline.map(step => ({
        description: step.description,
        amount: Math.round((approvedAmount * step.percentage) / 100),
        percentage: step.percentage,
        expectedDate: new Date(approvalDate.getTime() + (step.daysFromApproval * 24 * 60 * 60 * 1000)),
        status: 'pending',
        notes: step.notes || '',
        isAutomatic: step.isAutomatic || false,
        requiresVerification: step.requiresVerification !== false
      }));
    } else {
      // Fallback: Update existing timeline with approved amount and recalculate dates from approval date
      application.distributionTimeline = application.distributionTimeline.map(step => {
        const updatedStep = { ...step };
        
        // Recalculate amount based on approved amount
        updatedStep.amount = Math.round((approvedAmount * step.percentage) / 100);
        
        // Recalculate expected date from approval date
        // Extract days from original expected date calculation
        const originalDays = Math.ceil((step.expectedDate - application.createdAt) / (24 * 60 * 60 * 1000));
        updatedStep.expectedDate = new Date(approvalDate.getTime() + (originalDays * 24 * 60 * 60 * 1000));
        
        return updatedStep;
      });
    }

    // Add timeline update to stage history
    if (!application.stageHistory) {
      application.stageHistory = [];
    }
    
    application.stageHistory.push({
      stageName: 'Distribution Timeline Updated',
      status: 'completed',
      timestamp: approvalDate,
      updatedBy: application.approvedBy,
      notes: `Distribution timeline updated with approved amount: ₹${approvedAmount.toLocaleString()}`
    });

    return application.distributionTimeline;
  } catch (error) {
    console.error('Error updating distribution timeline:', error);
    return application.distributionTimeline;
  }
};

// Update all applications when scheme distribution timeline is modified
const updateApplicationsDistributionTimeline = async (schemeId, newDistributionTimeline, updatedBy) => {
  try {
    const Application = require('../models/Application');
    
    // Find all approved applications for this scheme that haven't been completed
    const applications = await Application.find({
      scheme: schemeId,
      status: { $in: ['approved', 'disbursed'] }, // Only update approved/disbursed applications
      'distributionTimeline.status': { $ne: 'completed' } // Don't update if all payments are completed
    });

    console.log(`Found ${applications.length} applications to update for scheme ${schemeId}`);

    const updatePromises = applications.map(async (application) => {
      try {
        // Regenerate timeline based on new scheme configuration
        const updatedTimeline = newDistributionTimeline.map(step => {
          // Find existing step to preserve payment status if already processed
          const existingStep = application.distributionTimeline.find(
            existing => existing.description === step.description || 
                       existing.percentage === step.percentage
          );

          return {
            description: step.description,
            amount: Math.round((application.approvedAmount * step.percentage) / 100),
            percentage: step.percentage,
            expectedDate: existingStep && existingStep.status === 'completed' 
              ? existingStep.expectedDate 
              : new Date(application.approvedAt.getTime() + (step.daysFromApproval * 24 * 60 * 60 * 1000)),
            status: existingStep ? existingStep.status : 'pending',
            actualDate: existingStep ? existingStep.actualDate : undefined,
            paymentId: existingStep ? existingStep.paymentId : undefined,
            notes: step.notes || existingStep?.notes || '',
            isAutomatic: step.isAutomatic || false,
            requiresVerification: step.requiresVerification !== false
          };
        });

        // Update the application
        application.distributionTimeline = updatedTimeline;
        
        // Add to stage history
        if (!application.stageHistory) {
          application.stageHistory = [];
        }
        
        application.stageHistory.push({
          stageName: 'Distribution Timeline Updated',
          status: 'completed',
          timestamp: new Date(),
          updatedBy: updatedBy,
          notes: 'Distribution timeline updated due to scheme configuration change'
        });

        await application.save();
        console.log(`Updated distribution timeline for application ${application._id}`);
        
        return { success: true, applicationId: application._id };
      } catch (error) {
        console.error(`Error updating application ${application._id}:`, error);
        return { success: false, applicationId: application._id, error: error.message };
      }
    });

    const results = await Promise.all(updatePromises);
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`Distribution timeline update completed: ${successful} successful, ${failed} failed`);
    
    return {
      success: true,
      updated: successful,
      failed: failed,
      total: applications.length,
      results: results
    };
  } catch (error) {
    console.error('Error updating applications distribution timeline:', error);
    return {
      success: false,
      error: error.message,
      updated: 0,
      failed: 0,
      total: 0
    };
  }
};

// ==============================
// HELPER: GET USERS BY ROLE AND SCOPE
// ==============================
const getUsersByRoleAndScope = async (role, application) => {
  try {
    const query = { role, isActive: true };
    
    // Add geographic scope filtering based on role
    if (role === 'unit_admin' && application.unit) {
      query['adminScope.unit'] = application.unit;
    } else if (role === 'area_admin' && application.area) {
      query['adminScope.area'] = application.area;
    } else if (role === 'district_admin' && application.district) {
      query['adminScope.district'] = application.district;
    }
    
    const users = await User.find(query)
      .select('_id name phone email role adminScope')
      .lean();
    
    return users;
  } catch (error) {
    console.error(`Error fetching users for role ${role}:`, error);
    return [];
  }
};

// ==============================
// GET AVAILABLE REVERT ROLES
// ==============================
const getAvailableRevertRoles = async (req, res) => {
  try {
    const { id } = req.params;

    const application = await Application.findById(id);
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    // Find current stage
    const sortedStages = [...application.applicationStages].sort((a, b) => a.order - b.order);
    const currentStageIndex = sortedStages.findIndex(s => s.status === 'pending' || s.status === 'in_progress');
    const effectiveCurrentIndex = currentStageIndex === -1 ? sortedStages.length - 1 : currentStageIndex;

    // Get all stages before current
    const previousStages = sortedStages.slice(0, effectiveCurrentIndex);

    // Extract unique roles from previous stages (only admin roles)
    const adminRoles = ['unit_admin', 'area_admin', 'district_admin'];
    const rolesSet = new Set();
    
    previousStages.forEach(stage => {
      if (stage.allowedRoles && stage.allowedRoles.length > 0) {
        stage.allowedRoles.forEach(role => {
          if (adminRoles.includes(role)) {
            rolesSet.add(role);
          }
        });
      }
    });

    // If no roles found in previous stages, use default hierarchy based on current stage
    if (rolesSet.size === 0 && effectiveCurrentIndex > 0) {
      // Default to unit_admin as a fallback
      rolesSet.add('unit_admin');
    }

    const roles = Array.from(rolesSet);

    // Sort roles by hierarchy: unit_admin < area_admin < district_admin
    const roleHierarchy = { unit_admin: 1, area_admin: 2, district_admin: 3 };
    roles.sort((a, b) => roleHierarchy[a] - roleHierarchy[b]);

    // Get user counts for each role
    const rolesWithCounts = await Promise.all(
      roles.map(async (role) => {
        const users = await getUsersByRoleAndScope(role, application);
        return {
          role,
          userCount: users.length,
          displayName: role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
        };
      })
    );

    // Check if any roles have users
    const hasAvailableUsers = rolesWithCounts.some(r => r.userCount > 0);

    res.json({
      success: true,
      data: {
        availableRoles: rolesWithCounts,
        currentStage: sortedStages[effectiveCurrentIndex]?.name,
        hasAvailableUsers,
        message: !hasAvailableUsers ? 'No users found for previous stages. Please contact administrators to assign users to the relevant roles.' : null
      }
    });
  } catch (error) {
    console.error('Error fetching available revert roles:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch available revert roles'
    });
  }
};

// ========================
// REVERT APPLICATION STAGE
// ========================
const revertApplicationStage = async (req, res) => {
  try {
    const { id } = req.params;
    const { targetRole, reason } = req.body;

    if (!targetRole || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Target role and reason are required'
      });
    }

    const application = await Application.findById(id);
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    // Find current stage (first non-completed/non-skipped stage, or last stage)
    const sortedStages = [...application.applicationStages].sort((a, b) => a.order - b.order);
    const currentStageIndex = sortedStages.findIndex(s => s.status === 'pending' || s.status === 'in_progress');
    // If all completed, consider the last stage as current
    const effectiveCurrentIndex = currentStageIndex === -1 ? sortedStages.length - 1 : currentStageIndex;

    // Find the most recent stage before current that has targetRole in allowedRoles
    let targetStageIndex = -1;
    for (let i = effectiveCurrentIndex - 1; i >= 0; i--) {
      const stage = sortedStages[i];
      if (stage.allowedRoles && stage.allowedRoles.includes(targetRole)) {
        targetStageIndex = i;
        break;
      }
    }

    if (targetStageIndex === -1) {
      return res.status(404).json({
        success: false,
        message: `No previous stage found for role: ${targetRole}`
      });
    }

    const targetStage = sortedStages[targetStageIndex];

    // Get users to forward the application to
    const targetUsers = await getUsersByRoleAndScope(targetRole, application);
    if (targetUsers.length === 0) {
      console.warn(`⚠️ No active users found for role ${targetRole} in application scope`);
      return res.status(400).json({
        success: false,
        message: `No active users found in ${targetRole.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} role for this application's location. Please contact administrators.`
      });
    }

    // Mark all stages from target to current as reverted, then set target to pending
    for (let i = targetStageIndex; i <= effectiveCurrentIndex; i++) {
      const stageId = sortedStages[i]._id;
      const stageIdx = application.applicationStages.findIndex(s => s._id.toString() === stageId.toString());
      if (stageIdx !== -1) {
        if (i === targetStageIndex) {
          application.applicationStages[stageIdx].status = 'pending';
          application.applicationStages[stageIdx].completedAt = null;
          application.applicationStages[stageIdx].completedBy = null;
        } else {
          application.applicationStages[stageIdx].status = 'reverted';
        }
        // Clear comments on reverted stages so they can be re-added
        application.applicationStages[stageIdx].comments = {
          unitAdmin: { comment: null, commentedBy: null, commentedAt: null },
          areaAdmin: { comment: null, commentedBy: null, commentedAt: null },
          districtAdmin: { comment: null, commentedBy: null, commentedAt: null }
        };
      }
    }

    // Also reset any stages after the effective current that were pending (shouldn't normally happen)
    // but ensure stages after target that are between target+1 and currentIndex are reverted
    for (let i = targetStageIndex + 1; i <= effectiveCurrentIndex; i++) {
      const stageId = sortedStages[i]._id;
      const stageIdx = application.applicationStages.findIndex(s => s._id.toString() === stageId.toString());
      if (stageIdx !== -1) {
        application.applicationStages[stageIdx].status = 'pending';
        application.applicationStages[stageIdx].completedAt = null;
        application.applicationStages[stageIdx].completedBy = null;
      }
    }

    // Update current stage
    application.currentStage = targetStage.name;

    // Add to stage history
    if (!application.stageHistory) {
      application.stageHistory = [];
    }
    application.stageHistory.push({
      stageName: sortedStages[effectiveCurrentIndex]?.name || application.currentStage,
      status: 'reverted',
      timestamp: new Date(),
      updatedBy: req.user._id,
      notes: reason,
      revertedTo: targetStage.name
    });

    await application.save();

    await application.populate('applicationStages.completedBy', 'name role');
    await application.populate('stageHistory.updatedBy', 'name role');

    // Populate beneficiary and scheme for notification
    await application.populate('beneficiary', 'name phone userId');
    await application.populate('scheme', 'name');

    // Send revert/forward notifications to beneficiary + targeted users
    notificationService
      .notifyApplicationForwarded(application, targetStage.name, targetRole, targetUsers, {
        forwardedBy: req.user._id,
        reason
      })
      .catch(err => console.error('❌ Application forward notification failed:', err));

    res.json({
      success: true,
      message: `Application forwarded to ${targetRole} at stage: ${targetStage.name}`,
      data: { 
        application,
        forwardedTo: {
          role: targetRole,
          userCount: targetUsers.length
        }
      }
    });
  } catch (error) {
    console.error('Error reverting application stage:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to revert application stage'
    });
  }
};

// ==============================
// UPDATE APPLICATION STAGE STATUS
// ==============================
const updateApplicationStage = async (req, res) => {
  try {
    const { id, stageId } = req.params;
    const { status, notes } = req.body;

    const application = await Application.findById(id);
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    // Find the stage to update
    const stageIndex = application.applicationStages.findIndex(
      stage => stage._id.toString() === stageId
    );

    if (stageIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Stage not found'
      });
    }

    const stage = application.applicationStages[stageIndex];

    // Validate status
    const validStatuses = ['pending', 'in_progress', 'completed', 'skipped'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    // If completing a stage, validate required comments and documents
    if (status === 'completed') {
      const userRole = req.user.role;
      const commentConfig = stage.commentConfig || {};
      const comments = stage.comments || {};

      // Check required comments
      const roleCommentMap = {
        'unit_admin': 'unitAdmin',
        'area_admin': 'areaAdmin',
        'district_admin': 'districtAdmin'
      };

      // Validate ALL required comments are present (not just the current user's role)
      for (const [role, configKey] of Object.entries(roleCommentMap)) {
        if (commentConfig[configKey]?.enabled && commentConfig[configKey]?.required) {
          if (!comments[configKey]?.comment) {
            return res.status(400).json({
              success: false,
              message: `${role.replace('_', ' ')} comment is required before completing this stage`
            });
          }
        }
      }

      // Validate required documents are uploaded
      const requiredDocs = (stage.requiredDocuments || []).filter(doc => doc.isRequired);
      const missingDocs = requiredDocs.filter(doc => !doc.uploadedFile);
      if (missingDocs.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Required documents missing: ${missingDocs.map(d => d.name).join(', ')}`
        });
      }
    }

    // Update the stage
    application.applicationStages[stageIndex].status = status;
    if (notes !== undefined) {
      application.applicationStages[stageIndex].notes = notes;
    }

    if (status === 'completed') {
      application.applicationStages[stageIndex].completedAt = new Date();
      application.applicationStages[stageIndex].completedBy = req.user._id;
    }

    // Add to stage history
    if (!application.stageHistory) {
      application.stageHistory = [];
    }

    application.stageHistory.push({
      stageName: application.applicationStages[stageIndex].name,
      status: status,
      timestamp: new Date(),
      updatedBy: req.user._id,
      notes: notes
    });

    // Update current stage (next pending stage)
    const nextPendingStage = application.applicationStages
      .filter(s => s.status === 'pending')
      .sort((a, b) => a.order - b.order)[0];
    if (nextPendingStage) {
      application.currentStage = nextPendingStage.name;
    }

    await application.save();

    await application.populate('applicationStages.completedBy', 'name role');
    await application.populate('stageHistory.updatedBy', 'name role');

    res.json({
      success: true,
      message: 'Stage updated successfully',
      data: { application }
    });
  } catch (error) {
    console.error('Error updating stage:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update stage'
    });
  }
};

// =============================
// ADD COMMENT TO APPLICATION STAGE
// =============================
const addStageComment = async (req, res) => {
  try {
    const { id, stageId } = req.params;
    const { comment } = req.body;
    const userRole = req.user.role;

    if (!comment) {
      return res.status(400).json({
        success: false,
        message: 'Comment text is required'
      });
    }

    // Map user role to comment field
    const roleToFieldMap = {
      'unit_admin': 'unitAdmin',
      'area_admin': 'areaAdmin',
      'district_admin': 'districtAdmin',
      'super_admin': null, // super_admin can comment as any role, handled below
      'state_admin': null
    };

    const application = await Application.findById(id);
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    const stageIndex = application.applicationStages.findIndex(
      stage => stage._id.toString() === stageId
    );
    if (stageIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Stage not found'
      });
    }

    const stage = application.applicationStages[stageIndex];

    // Determine which comment field to use
    let commentField = roleToFieldMap[userRole];

    // For super_admin/state_admin, allow specifying which role's comment to add via req.body.role
    if (!commentField && req.body.role) {
      const targetField = roleToFieldMap[req.body.role];
      if (targetField) {
        commentField = targetField;
      }
    }

    // If still no field (super/state admin without specifying role), use districtAdmin as default
    if (!commentField) {
      commentField = 'districtAdmin';
    }

    // Verify comment is enabled for this role in this stage
    const commentConfig = stage.commentConfig || {};
    if (!commentConfig[commentField]?.enabled) {
      // For super/state admin, allow anyway
      if (!['super_admin', 'state_admin'].includes(userRole)) {
        return res.status(400).json({
          success: false,
          message: `Comments are not enabled for ${commentField} in this stage`
        });
      }
    }

    // Set the comment
    if (!application.applicationStages[stageIndex].comments) {
      application.applicationStages[stageIndex].comments = {};
    }
    application.applicationStages[stageIndex].comments[commentField] = {
      comment: comment,
      commentedBy: req.user._id,
      commentedAt: new Date()
    };

    await application.save();

    await application.populate(`applicationStages.comments.${commentField}.commentedBy`, 'name role');

    res.json({
      success: true,
      message: 'Comment added successfully',
      data: {
        stage: application.applicationStages[stageIndex]
      }
    });
  } catch (error) {
    console.error('Error adding stage comment:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to add comment'
    });
  }
};

// =============================
// UPLOAD DOCUMENT FOR A STAGE
// =============================
const uploadStageDocument = async (req, res) => {
  try {
    const { id, stageId, docIndex } = req.params;

    const application = await Application.findById(id);
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    const stageIndex = application.applicationStages.findIndex(
      stage => stage._id.toString() === stageId
    );
    if (stageIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Stage not found'
      });
    }

    const stage = application.applicationStages[stageIndex];
    const docIdx = parseInt(docIndex);

    if (isNaN(docIdx) || docIdx < 0 || docIdx >= (stage.requiredDocuments || []).length) {
      return res.status(400).json({
        success: false,
        message: 'Invalid document index'
      });
    }

    // Get the uploaded file URL from the request (set by upload middleware)
    const fileUrl = req.fileUrl || (req.file ? req.file.location || req.file.path : null);
    if (!fileUrl) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Update the document record
    application.applicationStages[stageIndex].requiredDocuments[docIdx].uploadedFile = fileUrl;
    application.applicationStages[stageIndex].requiredDocuments[docIdx].uploadedBy = req.user._id;
    application.applicationStages[stageIndex].requiredDocuments[docIdx].uploadedAt = new Date();

    await application.save();

    res.json({
      success: true,
      message: 'Document uploaded successfully',
      data: {
        document: application.applicationStages[stageIndex].requiredDocuments[docIdx]
      }
    });
  } catch (error) {
    console.error('Error uploading stage document:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload document'
    });
  }
};

// Get applications due for renewal (admin)
const getRenewalDueApplications = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      renewalStatus = '',
      scheme = '',
      search = ''
    } = req.query;

    const filter = {};

    // Filter by renewal status
    if (renewalStatus) {
      filter.renewalStatus = renewalStatus;
    } else {
      filter.renewalStatus = { $in: ['active', 'due_for_renewal', 'expired'] };
    }

    // Filter by scheme
    if (scheme) filter.scheme = scheme;

    // Search
    if (search) {
      const beneficiaries = await Beneficiary.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');

      filter.$or = [
        { applicationNumber: { $regex: search, $options: 'i' } },
        { beneficiary: { $in: beneficiaries.map(b => b._id) } }
      ];
    }

    // Apply regional access restrictions
    const userRegionalFilter = getUserRegionalFilter(req.user);
    Object.assign(filter, userRegionalFilter);

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const applications = await Application.find(filter)
      .populate('beneficiary', 'name phone')
      .populate('scheme', 'name code renewalSettings')
      .populate('project', 'name code')
      .populate('state', 'name code')
      .populate('district', 'name code')
      .populate('area', 'name code')
      .populate('unit', 'name code')
      .sort({ expiryDate: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Application.countDocuments(filter);

    res.json({
      success: true,
      data: {
        applications,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Error fetching renewal-due applications:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get renewal history for an application
const getRenewalHistory = async (req, res) => {
  try {
    const { id } = req.params;

    const application = await Application.findById(id);
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    if (!hasAccessToApplication(req.user, application)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Find the root application (original)
    let rootApplicationId = application._id;
    if (application.isRenewal && application.parentApplication) {
      // Walk up the chain to find the original
      let current = application;
      while (current.isRenewal && current.parentApplication) {
        current = await Application.findById(current.parentApplication);
        if (!current) break;
        rootApplicationId = current._id;
      }
    }

    // Find all renewals in the chain
    const renewals = await Application.find({
      $or: [
        { _id: rootApplicationId },
        { parentApplication: rootApplicationId }
      ]
    })
      .populate('beneficiary', 'name phone')
      .populate('scheme', 'name code')
      .sort({ renewalNumber: 1 });

    // Also find renewals of renewals (nested)
    const allRenewalIds = renewals.map(r => r._id);
    const nestedRenewals = await Application.find({
      parentApplication: { $in: allRenewalIds },
      _id: { $nin: allRenewalIds }
    })
      .populate('beneficiary', 'name phone')
      .populate('scheme', 'name code')
      .sort({ renewalNumber: 1 });

    const allApplications = [...renewals, ...nestedRenewals].sort((a, b) => a.renewalNumber - b.renewalNumber);

    res.json({
      success: true,
      data: {
        originalApplication: allApplications.find(a => !a.isRenewal) || allApplications[0],
        renewals: allApplications.filter(a => a.isRenewal),
        totalRenewals: allApplications.filter(a => a.isRenewal).length
      }
    });
  } catch (error) {
    console.error('Error fetching renewal history:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Recalculate eligibility score for an existing application
const recalculateScore = async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    // Authorization: verify requesting user has access to this specific application
    if (!hasAccessToApplication(req.user, application)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    if (!application.formData) {
      return res.status(400).json({ success: false, message: 'Application has no form data to score' });
    }

    const formConfig = await FormConfiguration.findOne({
      scheme: application.scheme,
      enabled: true
    });

    if (!formConfig) {
      return res.status(404).json({ success: false, message: 'No active form configuration found for this scheme' });
    }

    const scoreResult = calculateApplicationScore(application.formData, formConfig);
    application.eligibilityScore = scoreResult;
    await application.save();

    res.json({
      success: true,
      message: 'Score recalculated successfully',
      data: { eligibilityScore: scoreResult }
    });
  } catch (error) {
    console.error('Error recalculating score:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getApplications,
  getApplication,
  createApplication,
  updateApplication,
  reviewApplication,
  approveApplication,
  deleteApplication,
  getApplicationStagesFromScheme,
  generateDistributionTimeline,
  updateDistributionTimelineOnApproval,
  updateApplicationsDistributionTimeline,
  getAvailableRevertRoles,
  revertApplicationStage,
  updateApplicationStage,
  addStageComment,
  uploadStageDocument,
  getRenewalDueApplications,
  getRenewalHistory,
  recalculateScore
};