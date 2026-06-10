const mongoose = require('mongoose');
const Application = require('../models/Application');
const Beneficiary = require('../models/Beneficiary');
const Scheme = require('../models/Scheme');
const Project = require('../models/Project');
const MasterData = require('../models/MasterData');
const FormConfiguration = require('../models/FormConfiguration');
const User = require('../models/User');
const notificationService = require('../services/notificationService');
const recurringPaymentService = require('../services/recurringPaymentService');
const applicationPdfService = require('../services/applicationPdfService');
const { calculateApplicationScore } = require('../utils/scoringEngine');
const { validationResult } = require('express-validator');
const RBACMiddleware = require('../middleware/rbacMiddleware');
const { buildFranchiseReadFilter, buildFranchiseMatchStage, getWriteFranchiseId } = require('../utils/franchiseFilterHelper');

// Returns the effective user context for regional filtering.
// Franchise-specific role/adminScope (req.userFranchise) takes priority over the
// legacy global fields on the User model (req.user).
const getEffectiveUserForFilter = (req) => ({
  role: req.userFranchise?.role || req.userRole || req.user.role,
  adminScope: req.userFranchise?.adminScope || req.user.adminScope,
  isSuperAdmin: req.user.isSuperAdmin
});

// Get all applications with pagination and search
const getApplications = async (req, res) => {
  try {
    console.log('🔍 getApplications called by user:', {
      id: req.user._id,
      role: req.userFranchise?.role || req.user.role,
      adminScope: req.userFranchise?.adminScope || req.user.adminScope
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

    // Apply user's regional access restrictions (prefer franchise-specific scope)
    const userRegionalFilter = getUserRegionalFilter(getEffectiveUserForFilter(req));
    console.log('🔍 User regional filter:', userRegionalFilter);
    
    // Apply regional filtering (super_admin and state_admin have no restrictions)
    Object.assign(filter, userRegionalFilter);

    // Multi-tenant: restrict results to the current franchise
    Object.assign(filter, buildFranchiseReadFilter(req));
    
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

    // Apply the same hierarchical stage visibility filter to each application
    const listUserRole = req.user.role;
    const listStageVisibilityRoles = {
      'super_admin':    null,
      'state_admin':    null,
      'district_admin': ['district_admin', 'area_admin', 'area_president', 'unit_admin'],
      'area_admin':     ['area_admin', 'area_president', 'unit_admin'],
      'area_president': ['area_president', 'unit_admin'],
      'unit_admin':     ['unit_admin'],
    };
    const listVisibleRoles = listStageVisibilityRoles[listUserRole];

    const filteredApplications = applications.map(app => {
      const appObj = app.toObject ? app.toObject() : app;
      if (listVisibleRoles) {
        appObj.applicationStages = (appObj.applicationStages || []).filter(stage => {
          const allowed = stage.allowedRoles || [];
          if (allowed.length === 0) return true;
          return allowed.some(r => listVisibleRoles.includes(r));
        });
      }
      return appObj;
    });

    res.json({
      success: true,
      data: {
        applications: filteredApplications,
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
    const application = await Application.findOne({ _id: req.params.id, ...buildFranchiseReadFilter(req) })
      .populate('beneficiary')
      .populate('scheme', 'name code maxAmount distributionTimeline applicationSettings')
      .populate('project')
      .populate('state', 'name code')
      .populate('district', 'name code')
      .populate('area', 'name code')
      .populate('unit', 'name code')
      .populate('originalLocation.district', 'name code')
      .populate('originalLocation.area', 'name code')
      .populate('originalLocation.unit', 'name code')
      .populate('locationChangeHistory.previousDistrict', 'name code')
      .populate('locationChangeHistory.previousArea', 'name code')
      .populate('locationChangeHistory.previousUnit', 'name code')
      .populate('locationChangeHistory.newDistrict', 'name code')
      .populate('locationChangeHistory.newArea', 'name code')
      .populate('locationChangeHistory.newUnit', 'name code')
      .populate('locationChangeHistory.changedBy', 'name role')
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
    let hasAccess = hasAccessToApplication(getEffectiveUserForFilter(req), application);
    
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

    // ======================================================
    // HIERARCHICAL STAGE VISIBILITY FILTER
    // Higher-level admins can see all stages below them.
    // Lower-level admins only see stages relevant to their level.
    //   super_admin / state_admin  → all stages
    //   district_admin             → district + area + unit stages
    //   area_admin                 → area + unit stages
    //   unit_admin                 → unit stages only
    // ======================================================
    const userRole = req.user.role;
    const stageVisibilityRoles = {
      'super_admin':    null, // null = no filter (see all)
      'state_admin':    null,
      'district_admin': ['district_admin', 'area_admin', 'area_president', 'unit_admin'],
      'area_admin':     ['area_admin', 'area_president', 'unit_admin'],
      'area_president': ['area_president', 'unit_admin'],
      'unit_admin':     ['unit_admin'],
    };
    const visibleRoles = stageVisibilityRoles[userRole];

    const applicationObj = application.toObject();
    if (visibleRoles) {
      applicationObj.applicationStages = (applicationObj.applicationStages || []).filter(stage => {
        const allowed = stage.allowedRoles || [];
        // If stage has no allowedRoles configured, always show it (legacy stages)
        if (allowed.length === 0) return true;
        return allowed.some(r => visibleRoles.includes(r));
      });
    }

    res.json({
      success: true,
      message: 'Application retrieved successfully',
      data: {
        application: applicationObj,
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
    const beneficiaryDoc = await Beneficiary.findOne({ _id: beneficiary, franchise: req.franchiseId });
    if (!beneficiaryDoc) {
      return res.status(400).json({ message: 'Beneficiary not found' });
    }
    if (beneficiaryDoc.status !== 'active') {
      return res.status(400).json({ message: 'Beneficiary must be active to apply' });
    }

    // Verify scheme exists and is active
    const schemeDoc = await Scheme.findOne({ _id: scheme, franchise: req.franchiseId });
    if (!schemeDoc) {
      return res.status(400).json({ message: 'Scheme not found' });
    }
    if (schemeDoc.status !== 'active') {
      return res.status(400).json({ message: 'Scheme is not active' });
    }

    // Verify project if provided
    let projectDoc = null;
    if (project) {
      projectDoc = await Project.findOne({ _id: project, franchise: req.franchiseId });
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
      franchise: req.franchiseId || null, // Multi-tenant: assign to current franchise
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
          enabled: true,
          'scoringConfig.enabled': true 
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

    const populatedApplication = await Application.findOne({ _id: application._id, franchise: req.franchiseId })
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

    const application = await Application.findOne({ _id: req.params.id, franchise: req.franchiseId });
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    // Check if user has access to update this application
    if (!hasAccessToApplication(getEffectiveUserForFilter(req), application)) {
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
      const scheme = await Scheme.findOne({ _id: application.scheme, franchise: req.franchiseId });
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

    const updatedApplication = await Application.findOne({ _id: application._id, franchise: req.franchiseId })
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

    if (!['under_review', 'field_verification', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid review status' });
    }

    const application = await Application.findOne({ _id: req.params.id, franchise: req.franchiseId });
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    // Check if user has access to review this application
    if (!hasAccessToApplication(getEffectiveUserForFilter(req), application)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Only pending, under_review, field_verification, or interview_completed applications can be reviewed/transitioned
    if (!['pending', 'under_review', 'field_verification', 'interview_completed'].includes(application.status)) {
      return res.status(400).json({ 
        message: 'Only pending, under_review, field_verification, or interview_completed applications can be reviewed' 
      });
    }

    application.status = status;
    application.reviewedBy = req.user.id;
    application.reviewedAt = new Date();
    application.reviewComments = comments;
    application.updatedBy = req.user.id;

    await application.save();

    const reviewedApplication = await Application.findOne({ _id: application._id, franchise: req.franchiseId })
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

    const application = await Application.findOne({ _id: req.params.id, franchise: req.franchiseId });
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    // Check if user has access to approve this application
    if (!hasAccessToApplication(getEffectiveUserForFilter(req), application)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Allow approval from 'pending', 'under_review', or 'field_verification' status
    if (!['pending', 'under_review', 'field_verification', 'interview_completed'].includes(application.status)) {
      return res.status(400).json({ 
        message: `Application cannot be approved from current status: ${application.status}` 
      });
    }

    // Validate approved amount
    if (!approvedAmount || approvedAmount <= 0) {
      return res.status(400).json({ 
        message: 'Approved amount must be greater than zero' 
      });
    }

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

    // On direct approval, mark all pending/in-progress stages as completed
    // and set currentStage to the last stage (typically "Completed")
    if (application.applicationStages && application.applicationStages.length > 0) {
      const sortedStages = [...application.applicationStages].sort((a, b) => a.order - b.order);
      application.applicationStages.forEach(stage => {
        if (stage.status === 'pending' || stage.status === 'in_progress') {
          stage.status = 'completed';
          stage.completedAt = new Date();
          stage.completedBy = req.user.id;
          stage.notes = stage.notes || 'Completed via direct approval';
        }
      });
      // Set currentStage to the last stage name (highest order)
      const lastStage = sortedStages[sortedStages.length - 1];
      application.currentStage = lastStage.name;

      // Add to stage history
      if (!application.stageHistory) application.stageHistory = [];
      application.stageHistory.push({
        stageName: lastStage.name,
        status: 'completed',
        timestamp: new Date(),
        updatedBy: req.user.id,
        notes: `Direct approval by ${req.user.role || 'admin'}`
      });
    }

    // Update distribution timeline with actual approved amount and dates
    await updateDistributionTimelineOnApproval(application, approvedAmount);

    // Set renewal expiry if scheme supports renewals
    const scheme = await Scheme.findOne({ _id: application.scheme, franchise: req.franchiseId });
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

    // Create payment records from distribution timeline
    try {
      const Payment = require('../models/Payment');

      if (application.distributionTimeline && application.distributionTimeline.length > 0) {
        console.log('💰 Creating payments from distribution timeline:', application.distributionTimeline.length, 'phases');

        for (let i = 0; i < application.distributionTimeline.length; i++) {
          const timeline = application.distributionTimeline[i];
          const paymentCount = await Payment.countDocuments();
          const year = new Date().getFullYear();
          const paymentNumber = `PAY${year}${String(paymentCount + 1).padStart(6, '0')}`;

          const payment = new Payment({
            paymentNumber,
            application: application._id,
            beneficiary: application.beneficiary,
            project: application.project,
            scheme: application.scheme,
            amount: timeline.amount,
            type: 'installment',
            method: 'bank_transfer',
            status: 'pending',
            installment: {
              number: i + 1,
              totalInstallments: application.distributionTimeline.length,
              description: timeline.description || `Phase ${i + 1}`
            },
            timeline: {
              expectedCompletionDate: timeline.expectedDate ? new Date(timeline.expectedDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              approvedAt: new Date()
            },
            approvals: [{
              level: 'finance',
              approver: req.user.id,
              status: 'approved',
              approvedAt: new Date(),
              comments: comments || 'Approved via direct approval'
            }],
            metadata: {
              notes: `Direct approval. ${comments || ''}`.trim()
            },
            initiatedBy: req.user.id,
            franchiseId: req.franchiseId || application.franchiseId,
            location: {
              state: application.location?.state,
              district: application.location?.district,
              area: application.location?.area,
              unit: application.location?.unit
            }
          });

          await payment.save();
          console.log(`✅ Payment ${i + 1}/${application.distributionTimeline.length} created: ${paymentNumber}`);
        }
      } else {
        // No timeline — create single full payment
        const paymentCount = await Payment.countDocuments();
        const year = new Date().getFullYear();
        const paymentNumber = `PAY${year}${String(paymentCount + 1).padStart(6, '0')}`;

        const payment = new Payment({
          paymentNumber,
          application: application._id,
          beneficiary: application.beneficiary,
          project: application.project,
          scheme: application.scheme,
          amount: approvedAmount,
          type: 'full_payment',
          method: 'bank_transfer',
          status: 'pending',
          timeline: {
            expectedCompletionDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            approvedAt: new Date()
          },
          approvals: [{
            level: 'finance',
            approver: req.user.id,
            status: 'approved',
            approvedAt: new Date(),
            comments: comments || 'Approved via direct approval'
          }],
          metadata: {
            notes: `Direct approval. ${comments || ''}`.trim()
          },
          initiatedBy: req.user.id,
          franchiseId: req.franchiseId || application.franchiseId,
          location: {
            state: application.location?.state,
            district: application.location?.district,
            area: application.location?.area,
            unit: application.location?.unit
          }
        });

        await payment.save();
        console.log('✅ Single payment created:', paymentNumber);
      }
    } catch (paymentError) {
      console.error('❌ Error creating payment records:', paymentError);
      // Don't fail the approval if payment creation fails
    }

    const approvedApplication = await Application.findOne({ _id: application._id, franchise: req.franchiseId })
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
    const application = await Application.findOne({ _id: req.params.id, franchise: req.franchiseId });
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    // Check if user has access to delete this application
    if (!hasAccessToApplication(getEffectiveUserForFilter(req), application)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Only pending applications can be deleted
    if (application.status !== 'pending') {
      return res.status(400).json({ 
        message: 'Only pending applications can be deleted' 
      });
    }

    // Remove application from beneficiary's applications array
    await Beneficiary.findOneAndUpdate(
      { _id: application.beneficiary, franchise: req.franchiseId },
      { $pull: { applications: application._id } }
    );

    await Application.findOneAndDelete({ _id: req.params.id, franchise: req.franchiseId });
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

  // Super admin and state admin have access to all applications
  if (user.role === 'super_admin' || user.role === 'state_admin') {
    console.log(`🔍 ${user.role} - no restrictions`);
    return filter; // No restrictions
  }

  // Helper function to get ObjectId from populated reference or direct ID
  const getObjectId = (ref) => {
    if (!ref) return null;
    if (ref instanceof mongoose.Types.ObjectId) return ref;
    if (typeof ref === 'object' && ref._id) {
      return ref._id instanceof mongoose.Types.ObjectId ? ref._id : new mongoose.Types.ObjectId(ref._id.toString());
    }
    return new mongoose.Types.ObjectId(ref.toString());
  };

  // Check adminScope.regions array first (for backward compatibility)
  if (user.adminScope?.regions && user.adminScope.regions.length > 0) {
    const regions = user.adminScope.regions.map(r => getObjectId(r));
    console.log('🔍 User has regions array:', regions);

    if (user.role === 'district_admin') {
      // District admin can see applications from their district
      filter.district = { $in: regions };
      console.log('🔍 District admin filter applied (from regions):', filter);
    } else if (user.role === 'area_admin' || user.role === 'area_president') {
      // Area admin / area president can see applications from their area
      filter.area = { $in: regions };
      console.log('🔍 Area admin/president filter applied (from regions):', filter);
    } else if (user.role === 'unit_admin') {
      // Unit admin can see applications from their unit
      filter.unit = { $in: regions };
      console.log('🔍 Unit admin filter applied (from regions):', filter);
    }
  } else {
    // Fallback: Check direct district/area/unit properties
    const userUnitId = user.adminScope?.unit ? getObjectId(user.adminScope.unit) : null;
    const userAreaId = user.adminScope?.area ? getObjectId(user.adminScope.area) : null;
    const userDistrictId = user.adminScope?.district ? getObjectId(user.adminScope.district) : null;

    if (user.role === 'unit_admin' && userUnitId) {
      filter.unit = userUnitId;
      console.log('🔍 Unit admin filter applied (from direct unit):', filter);
    } else if ((user.role === 'area_admin' || user.role === 'area_president') && userAreaId) {
      filter.area = userAreaId;
      console.log('🔍 Area admin/president filter applied (from direct area):', filter);
    } else if (user.role === 'district_admin' && userDistrictId) {
      filter.district = userDistrictId;
      console.log('🔍 District admin filter applied (from direct district):', filter);
    } else {
      console.log('🔍 No adminScope found for user - no filter applied');
    }
  }

  return filter;
};

const hasAccessToApplication = (user, application) => {
  // Super admin and state admin have access to everything
  if (user.role === 'super_admin' || user.role === 'state_admin') {
    console.log(`✅ ${user.role} - full access granted`);
    return true;
  }
  
  // Helper function to get ID from populated reference or direct ID
  const getId = (ref) => {
    if (!ref) return null;
    if (typeof ref === 'object' && ref._id) return ref._id.toString();
    return ref.toString();
  };
  
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
  
  // Handle both adminScope formats: regions array and direct district/area/unit
  if (user.adminScope) {
    // Format 1: Check adminScope.regions array
    if (user.adminScope.regions && user.adminScope.regions.length > 0) {
      const userRegions = user.adminScope.regions.map(r => r.toString());
      const applicationDistrictId = getId(application.district);
      const applicationAreaId = getId(application.area);
      const applicationUnitId = getId(application.unit);
      
      if (user.role === 'district_admin') {
        const hasAccess = applicationDistrictId && userRegions.includes(applicationDistrictId);
        console.log(`🔍 District admin check: ${hasAccess ? '✅' : '❌'} (user regions: [${userRegions.join(', ')}], app district: ${applicationDistrictId})`);
        return hasAccess;
      } else if (user.role === 'area_admin' || user.role === 'area_president') {
        const hasAccess = applicationAreaId && userRegions.includes(applicationAreaId);
        console.log(`🔍 Area admin/president check: ${hasAccess ? '✅' : '❌'} (user regions: [${userRegions.join(', ')}], app area: ${applicationAreaId})`);
        return hasAccess;
      } else if (user.role === 'unit_admin') {
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
    } else if ((user.role === 'area_admin' || user.role === 'area_president') && userAreaId) {
      const applicationAreaId = getId(application.area);
      const hasAccess = applicationAreaId && userAreaId === applicationAreaId;
      console.log(`🔍 Area admin/president direct check: ${hasAccess ? '✅' : '❌'} (user area: ${userAreaId}, app area: ${applicationAreaId})`);
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
  
  // Check if user has access based on their adminScope.regions
  if (user.adminScope?.regions && user.adminScope.regions.length > 0) {
    const userRegions = user.adminScope.regions.map(r => r.toString());
    
    if (user.role === 'state_admin') {
      return userRegions.includes(beneficiary.state?.toString());
    } else if (user.role === 'district_admin') {
      return userRegions.includes(beneficiary.district?.toString());
    } else if (user.role === 'area_admin' || user.role === 'area_president') {
      return userRegions.includes(beneficiary.area?.toString());
    } else if (user.role === 'unit_admin') {
      return userRegions.includes(beneficiary.unit?.toString());
    }
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
      areaPresident: { enabled: false, required: false },
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
          areaPresident: {
            enabled: stage.commentConfig?.areaPresident?.enabled || false,
            required: stage.commentConfig?.areaPresident?.required || false
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
          allowedRoles: ['super_admin', 'state_admin', 'district_admin', 'area_admin', 'area_president', 'unit_admin'],
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
          allowedRoles: ['super_admin', 'state_admin', 'district_admin', 'area_admin', 'area_president', 'unit_admin'],
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
          allowedRoles: ['super_admin', 'state_admin', 'district_admin', 'area_admin', 'area_president', 'unit_admin'],
          autoTransition: false,
          transitionConditions: "",
          commentConfig: { ...defaultCommentConfig, areaAdmin: { enabled: true, required: false }, areaPresident: { enabled: true, required: false } },
          requiredDocuments: []
        },
        {
          name: "Interview Process",
          description: "Beneficiary interview and assessment",
          order: 4,
          isRequired: scheme.applicationSettings?.requiresInterview || false,
          allowedRoles: ['super_admin', 'state_admin', 'district_admin', 'area_admin', 'area_president', 'unit_admin', 'scheme_coordinator'],
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
          allowedRoles: ['super_admin', 'state_admin', 'district_admin', 'area_admin', 'area_president'],
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
          allowedRoles: ['super_admin', 'state_admin', 'district_admin', 'area_admin', 'area_president'],
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
          allowedRoles: ['super_admin', 'state_admin', 'district_admin', 'area_admin', 'area_president'],
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
          allowedRoles: ['super_admin', 'state_admin', 'district_admin', 'area_admin', 'area_president'],
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
    const scheme = await Scheme.findOne({ _id: application.scheme, franchise: application.franchise });
    
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
    const UserFranchise = require('../models/UserFranchise');

    const baseQuery = {
      role,
      isActive: true,
      franchise: application.franchise,
    };

    // Try scoped query first (matching exact geographic scope)
    const scopedQuery = { ...baseQuery };
    if (role === 'unit_admin' && application.unit) {
      scopedQuery['adminScope.unit'] = application.unit;
    } else if ((role === 'area_admin' || role === 'area_president') && application.area) {
      scopedQuery['adminScope.area'] = application.area;
    } else if (role === 'district_admin' && application.district) {
      scopedQuery['adminScope.district'] = application.district;
    }

    let memberships = await UserFranchise.find(scopedQuery)
      .select('_id user role adminScope')
      .populate('user', '_id name phone email')
      .lean();

    // If scoped search returns nothing, fall back to all users of that role in the franchise
    if (memberships.length === 0 && scopedQuery !== baseQuery) {
      memberships = await UserFranchise.find(baseQuery)
        .select('_id user role adminScope')
        .populate('user', '_id name phone email')
        .lean();
    }

    // Flatten to user-shaped objects so callers can use .phone, ._id etc. directly
    return memberships
      .filter(m => m.user)
      .map(m => ({
        _id: m.user._id,
        name: m.user.name,
        phone: m.user.phone,
        email: m.user.email,
        role: m.role,
        adminScope: m.adminScope
      }));
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

    const application = await Application.findOne({ _id: id, ...buildFranchiseReadFilter(req) });
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

    // Extract unique roles from previous stages (all admin roles)
    const adminRoles = ['unit_admin', 'area_admin', 'area_president', 'district_admin', 'state_admin', 'scheme_coordinator', 'project_coordinator'];
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

    // Sort roles by hierarchy: unit_admin < area_admin < district_admin < state_admin
    const roleHierarchy = { unit_admin: 1, area_president: 2, area_admin: 2, district_admin: 3, scheme_coordinator: 3, project_coordinator: 3, state_admin: 4, super_admin: 5 };

    // Filter roles to only those LOWER in hierarchy than the current user's role.
    // e.g. state_admin sees [district_admin, area_admin, unit_admin]; district_admin sees [area_admin, unit_admin].
    const currentUserRole = req.userRole || req.user?.role;
    const currentUserLevel = roleHierarchy[currentUserRole] ?? 99;
    const roles = Array.from(rolesSet).filter(role => (roleHierarchy[role] ?? 99) < currentUserLevel);
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

    const application = await Application.findOne({ _id: id, franchise: req.franchiseId });
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
          areaPresident: { comment: null, commentedBy: null, commentedAt: null },
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
// HELPER: Verify role can act on a specific stage
// (super_admin / state_admin are always allowed)
// ==============================
const canRoleActOnStage = (userRole, stage) => {
  if (!userRole) return false;
  if (userRole === 'super_admin' || userRole === 'state_admin') return true;
  const allowed = stage && Array.isArray(stage.allowedRoles) ? stage.allowedRoles : [];
  // If stage has no allowedRoles configured, fall back to "any admin" (legacy behaviour)
  if (allowed.length === 0) return true;
  return allowed.includes(userRole);
};

// ==============================
// UPDATE APPLICATION STAGE STATUS
// ==============================
const updateApplicationStage = async (req, res) => {
  try {
    const { id, stageId } = req.params;
    const { status, notes } = req.body;

    const application = await Application.findOne({ _id: id, franchise: req.franchiseId });
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    // Enforce regional scope (unit/area/district admins only see their own)
    if (!hasAccessToApplication(getEffectiveUserForFilter(req), application)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this application'
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

    // Enforce stage-level role restriction (e.g. unit_admin cannot complete Final Review)
    if (!canRoleActOnStage(req.user.role, stage)) {
      return res.status(403).json({
        success: false,
        message: `Your role (${req.user.role}) is not permitted to act on stage "${stage.name}". Allowed roles: ${(stage.allowedRoles || []).join(', ')}`
      });
    }

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
        'area_president': 'areaPresident',
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

    // ======================================================
    // AUTO-SYNC APPLICATION STATUS FROM STAGE COMPLETION
    // Maps stage pipeline progress to the top-level status field
    // so the list view always reflects the real state.
    // ======================================================
    if (status === 'completed') {
      const stageNameLower = (stage.name || '').toLowerCase().trim();
      const terminalStatuses = ['rejected', 'cancelled'];

      if (!terminalStatuses.includes(application.status)) {
        const allStages = application.applicationStages;

        // Check whether ALL stages are now done
        const allDone = allStages.every(s => ['completed', 'skipped'].includes(s.status));

        if (allDone && !['approved', 'disbursed'].includes(application.status)) {
          // Every stage finished → mark the whole application completed
          application.status = 'completed';
        } else if (
          stageNameLower.includes('field verification') &&
          !['approved', 'disbursed', 'completed', 'pending_committee_approval', 'interview_scheduled', 'interview_completed'].includes(application.status)
        ) {
          application.status = 'field_verification';
        } else if (
          (stageNameLower.includes('final review') || stageNameLower.includes('committee')) &&
          !['approved', 'disbursed', 'completed'].includes(application.status)
        ) {
          // Final Review stage done → waiting for formal approval action
          application.status = 'pending_committee_approval';
        } else if (
          stageNameLower.includes('interview') &&
          !['approved', 'disbursed', 'completed', 'pending_committee_approval'].includes(application.status)
        ) {
          application.status = 'interview_completed';
        } else if (application.status === 'pending') {
          // First stage completed → application is now actively being reviewed
          application.status = 'under_review';
        }
        // If status is already under_review / interview_scheduled etc., leave it unchanged
        // until a more meaningful transition above fires.
      }
    }
    // ======================================================

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
      'area_president': 'areaPresident',
      'area_admin': 'areaAdmin',
      'district_admin': 'districtAdmin',
      'super_admin': null, // super_admin can comment as any role, handled below
      'state_admin': null
    };

    const application = await Application.findOne({ _id: id, franchise: req.franchiseId });
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    // Enforce regional scope
    if (!hasAccessToApplication(getEffectiveUserForFilter(req), application)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this application'
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

    // Enforce stage-level role restriction
    if (!canRoleActOnStage(userRole, stage)) {
      return res.status(403).json({
        success: false,
        message: `Your role (${userRole}) is not permitted to comment on stage "${stage.name}". Allowed roles: ${(stage.allowedRoles || []).join(', ')}`
      });
    }

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
    // area_president can comment whenever unitAdmin or areaPresident comment is enabled
    const isCommentEnabled = commentField === 'areaPresident'
      ? (commentConfig.areaPresident?.enabled || commentConfig.unitAdmin?.enabled)
      : commentConfig[commentField]?.enabled;
    if (!isCommentEnabled) {
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

    const application = await Application.findOne({ _id: id, franchise: req.franchiseId });
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    // Enforce regional scope
    if (!hasAccessToApplication(getEffectiveUserForFilter(req), application)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this application'
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

    // Enforce stage-level role restriction (cannot upload to stages outside your scope)
    if (!canRoleActOnStage(req.user.role, stage)) {
      return res.status(403).json({
        success: false,
        message: `Your role (${req.user.role}) is not permitted to upload documents on stage "${stage.name}". Allowed roles: ${(stage.allowedRoles || []).join(', ')}`
      });
    }

    // Prevent uploads to already completed/skipped stages
    if (['completed', 'skipped'].includes(stage.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot upload documents to a ${stage.status} stage`
      });
    }

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

    const application = await Application.findOne({ _id: id, ...buildFranchiseReadFilter(req) });
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    if (!hasAccessToApplication(getEffectiveUserForFilter(req), application)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Find the root application (original)
    let rootApplicationId = application._id;
    if (application.isRenewal && application.parentApplication) {
      // Walk up the chain to find the original
      let current = application;
      while (current.isRenewal && current.parentApplication) {
        current = await Application.findOne({ _id: current.parentApplication, franchise: application.franchise });
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

// Modify an already approved application (amount, timeline, comments)
const modifyApprovedApplication = async (req, res) => {
  try {
    const { approvedAmount, comments, reason, distributionTimeline } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Modification reason is required'
      });
    }

    const application = await Application.findOne({ _id: req.params.id, franchise: req.franchiseId });
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    // Check if user has access
    if (!hasAccessToApplication(getEffectiveUserForFilter(req), application)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Only approved applications can be modified
    if (application.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: `Only approved applications can be modified. Current status: ${application.status}`
      });
    }

    // Validate approved amount
    if (approvedAmount !== undefined) {
      if (!approvedAmount || approvedAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Approved amount must be greater than zero'
        });
      }
      if (approvedAmount > application.requestedAmount) {
        return res.status(400).json({
          success: false,
          message: 'Approved amount cannot exceed requested amount'
        });
      }
    }

    // Build modification history entry
    const modificationEntry = {
      modifiedBy: req.user.id,
      modifiedAt: new Date(),
      reason: reason.trim(),
      previousAmount: application.approvedAmount,
      newAmount: approvedAmount !== undefined ? approvedAmount : application.approvedAmount,
      previousComments: application.approvalComments || ''
    };

    // Initialize modificationHistory array if not exists
    if (!application.modificationHistory) {
      application.modificationHistory = [];
    }
    application.modificationHistory.push(modificationEntry);

    // Update fields
    if (approvedAmount !== undefined) {
      application.approvedAmount = approvedAmount;
    }
    if (comments !== undefined) {
      application.approvalComments = comments;
    }
    application.lastModifiedBy = req.user.id;
    application.lastModifiedAt = new Date();
    application.updatedBy = req.user.id;

    // Update distribution timeline if provided
    if (distributionTimeline && Array.isArray(distributionTimeline)) {
      application.distributionTimeline = distributionTimeline;
    }

    // Recalculate distribution timeline amounts based on new approved amount
    const finalAmount = approvedAmount !== undefined ? approvedAmount : application.approvedAmount;
    await updateDistributionTimelineOnApproval(application, finalAmount);

    await application.save();

    const updatedApplication = await Application.findOne({ _id: application._id, franchise: req.franchiseId })
      .populate('beneficiary', 'name phone')
      .populate('scheme', 'name code distributionTimeline applicationSettings')
      .populate('project', 'name code')
      .populate('approvedBy', 'name')
      .populate('lastModifiedBy', 'name');

    res.json({
      success: true,
      message: 'Approved application modified successfully',
      data: updatedApplication
    });
  } catch (error) {
    console.error('Error modifying approved application:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// ==============================
// SYNC APPLICATION STATUS FROM CURRENT STAGES
// Fixes applications stuck in 'pending' when stages are already completed
// POST /:id/sync-status — callable by admins
// ==============================
const syncApplicationStatus = async (req, res) => {
  try {
    const application = await Application.findOne({ _id: req.params.id, franchise: req.franchiseId });
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    if (!hasAccessToApplication(getEffectiveUserForFilter(req), application)) {
      return res.status(403).json({ success: false, message: 'You do not have access to this application' });
    }

    // Don't touch terminal / explicitly-set statuses
    if (['rejected', 'cancelled', 'approved', 'disbursed'].includes(application.status)) {
      return res.json({
        success: true,
        message: `Status is already '${application.status}' — no change needed`,
        data: { status: application.status }
      });
    }

    const stages = application.applicationStages || [];
    const allDone = stages.length > 0 && stages.every(s => ['completed', 'skipped'].includes(s.status));
    const hasFinalReviewDone = stages.some(s =>
      ['completed', 'skipped'].includes(s.status) &&
      (s.name || '').toLowerCase().includes('final review')
    );
    const hasInterviewDone = stages.some(s =>
      ['completed', 'skipped'].includes(s.status) &&
      (s.name || '').toLowerCase().includes('interview')
    );
    const anyCompleted = stages.some(s => ['completed', 'skipped'].includes(s.status));

    const oldStatus = application.status;

    if (allDone) {
      application.status = 'completed';
    } else if (hasFinalReviewDone) {
      application.status = 'pending_committee_approval';
    } else if (hasInterviewDone) {
      application.status = 'interview_completed';
    } else if (anyCompleted && application.status === 'pending') {
      application.status = 'under_review';
    }

    if (application.status !== oldStatus) {
      await application.save();
    }

    res.json({
      success: true,
      message: application.status !== oldStatus
        ? `Status updated from '${oldStatus}' → '${application.status}'`
        : 'Status is already up-to-date',
      data: { oldStatus, status: application.status }
    });
  } catch (error) {
    console.error('Error syncing application status:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

const recalculateScore = async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    if (!application.formData) {
      return res.status(400).json({ success: false, message: 'Application has no form data to score' });
    }

    const formConfig = await FormConfiguration.findOne({
      scheme: application.scheme,
      enabled: true,
      'scoringConfig.enabled': true
    });

    if (!formConfig) {
      return res.status(400).json({ success: false, message: 'No scoring configuration found for this scheme' });
    }

    const scoreResult = calculateApplicationScore(application.formData, formConfig);
    application.eligibilityScore = scoreResult;
    await application.save();

    res.json({ success: true, message: 'Eligibility score recalculated', data: { eligibilityScore: scoreResult } });
  } catch (error) {
    console.error('Error recalculating score:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// ─── Application PDF Download ────────────────────────────────────────────────

/**
 * Generate and download a filled application PDF
 * GET /api/applications/:id/pdf
 */
const downloadApplicationPdf = async (req, res) => {
  try {
    const { id } = req.params;

    const application = await Application.findById(id)
      .populate('beneficiary', 'name phone')
      .populate('scheme', 'name description')
      .populate('project', 'name')
      .populate('district', 'name')
      .populate('area', 'name')
      .populate('unit', 'name')
      .populate('approvedBy', 'name')
      .populate('reviewedBy', 'name');

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    const formConfig = await FormConfiguration.findOne({
      scheme: application.scheme._id || application.scheme,
      isRenewalForm: false
    });

    const filePath = await applicationPdfService.generateFilledApplicationPdf(application, formConfig);

    const fileName = `Application_${application.applicationNumber || id}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    const fileStream = require('fs').createReadStream(filePath);
    fileStream.pipe(res);
    fileStream.on('end', () => {
      require('fs').unlink(filePath, () => {}); // cleanup
    });
  } catch (error) {
    console.error('Error generating application PDF:', error);
    res.status(500).json({ success: false, message: 'Failed to generate application PDF' });
  }
};

/**
 * Generate and download a blank form PDF for a scheme
 * GET /api/schemes/:schemeId/form-pdf/blank
 */
const downloadBlankFormPdf = async (req, res) => {
  try {
    const schemeId = req.params.id || req.params.schemeId;

    const scheme = await Scheme.findById(schemeId).select('name');
    if (!scheme) {
      return res.status(404).json({ success: false, message: 'Scheme not found' });
    }

    const formConfig = await FormConfiguration.findOne({
      scheme: schemeId,
      isRenewalForm: false
    });

    if (!formConfig) {
      return res.status(404).json({ success: false, message: 'Form configuration not found for this scheme' });
    }

    const filePath = await applicationPdfService.generateBlankFormPdf(formConfig, scheme.name);

    const fileName = `${scheme.name.replace(/\s+/g, '_')}_Application_Form.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    const fileStream = require('fs').createReadStream(filePath);
    fileStream.pipe(res);
    fileStream.on('end', () => {
      require('fs').unlink(filePath, () => {}); // cleanup
    });
  } catch (error) {
    console.error('Error generating blank form PDF:', error);
    res.status(500).json({ success: false, message: 'Failed to generate blank form PDF' });
  }
};

// ─── Consolidation Report ─────────────────────────────────────────────────────

/**
 * Get application consolidation stats for any admin level
 * GET /api/applications/consolidation?startDate=&endDate=&scheme=&status=
 */
const getApplicationConsolidation = async (req, res) => {
  try {
    const { startDate, endDate, scheme, status } = req.query;
    const { role, adminScope, isSuperAdmin } = getEffectiveUserForFilter(req);

    const franchiseFilter = buildFranchiseReadFilter(req);

    // Date filter
    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.$lte = end;
    }

    const baseFilter = { ...franchiseFilter };
    if (Object.keys(dateFilter).length > 0) baseFilter.createdAt = dateFilter;

    // Location scoping
    if (!isSuperAdmin && role !== 'state_admin') {
      if (role === 'district_admin' && adminScope?.district) {
        baseFilter.district = new mongoose.Types.ObjectId(adminScope.district);
      } else if ((role === 'area_admin' || role === 'area_president') && adminScope?.area) {
        baseFilter.area = new mongoose.Types.ObjectId(adminScope.area);
      } else if (role === 'unit_admin' && adminScope?.unit) {
        baseFilter.unit = new mongoose.Types.ObjectId(adminScope.unit);
      }
    }

    if (scheme) baseFilter.scheme = new mongoose.Types.ObjectId(scheme);
    if (status) baseFilter.status = status;

    // Count by status using a single aggregation
    const statusGroups = await Application.aggregate([
      { $match: baseFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const counts = {
      total: 0,
      pending: 0,
      under_review: 0,
      field_verification: 0,
      interview_scheduled: 0,
      interview_completed: 0,
      pending_committee_approval: 0,
      approved: 0,
      rejected: 0,
      on_hold: 0,
      cancelled: 0,
      disbursed: 0,
      completed: 0,
      draft: 0
    };

    statusGroups.forEach(({ _id, count }) => {
      counts.total += count;
      if (_id && counts.hasOwnProperty(_id)) {
        counts[_id] = count;
      }
    });

    res.json({ success: true, data: counts });
  } catch (error) {
    console.error('Error getting application consolidation:', error);
    res.status(500).json({ success: false, message: 'Failed to get consolidation data' });
  }
};

// ─── Feature: Duplicate Application Detection ─────────────────────────────────

/**
 * Get duplicate application details for a specific application
 * GET /api/applications/:id/duplicates
 *
 * Returns the list of other applications that share the same phone/aadhaar/ration
 * card values as this application, based on the form's duplicateDetection config.
 * Also triggers a fresh re-check and updates the stored duplicateInfo.
 */
const getApplicationDuplicates = async (req, res) => {
  try {
    const { id } = req.params;
    const application = await Application.findOne({ _id: id, ...buildFranchiseReadFilter(req) })
      .populate('beneficiary', 'name phone')
      .populate('scheme', 'name code');

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    if (!hasAccessToApplication(getEffectiveUserForFilter(req), application)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Get formConfiguration for this scheme
    const formConfig = await FormConfiguration.findOne({
      scheme: application.scheme._id || application.scheme,
      franchise: req.franchiseId,
      enabled: true
    }).lean();

    if (!formConfig || !formConfig.duplicateDetection || formConfig.duplicateDetection.length === 0) {
      return res.json({
        success: true,
        message: 'No duplicate detection configured for this scheme',
        data: { isDuplicate: false, matchedFields: [], checkedAt: null }
      });
    }

    const enabledChecks = formConfig.duplicateDetection.filter(d => d.enabled);
    const matchedFields = [];

    for (const check of enabledChecks) {
      const fieldKey = `field_${check.fieldId}`;
      const fieldValue = application.formData && application.formData[fieldKey];
      if (!fieldValue || String(fieldValue).trim() === '') continue;

      const dupApps = await Application.find({
        _id: { $ne: application._id },
        scheme: application.scheme._id || application.scheme,
        franchise: req.franchiseId,
        [`formData.${fieldKey}`]: String(fieldValue).trim()
      })
        .populate('beneficiary', 'name phone')
        .select('_id applicationNumber status createdAt beneficiary')
        .lean();

      if (dupApps.length > 0) {
        matchedFields.push({
          fieldType: check.fieldType,
          fieldLabel: check.fieldLabel,
          fieldId: check.fieldId,
          fieldValue: String(fieldValue).trim(),
          matchedApplications: dupApps.map(a => ({
            _id: a._id,
            applicationNumber: a.applicationNumber,
            status: a.status,
            createdAt: a.createdAt,
            beneficiaryName: a.beneficiary?.name || 'Unknown',
            beneficiaryPhone: a.beneficiary?.phone || ''
          }))
        });
      }
    }

    // Persist updated duplicate info
    const updatedDuplicateInfo = {
      isDuplicate: matchedFields.length > 0,
      matchedFields: matchedFields.map(f => ({
        fieldType: f.fieldType,
        fieldLabel: f.fieldLabel,
        fieldId: f.fieldId,
        matchedApplicationIds: f.matchedApplications.map(a => a._id)
      })),
      checkedAt: new Date()
    };
    await Application.findByIdAndUpdate(id, { duplicateInfo: updatedDuplicateInfo });

    res.json({
      success: true,
      data: {
        isDuplicate: matchedFields.length > 0,
        matchedFields,
        checkedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Error checking application duplicates:', error);
    res.status(500).json({ success: false, message: 'Failed to check duplicates' });
  }
};

// ─── Feature: Location Edit by Area/Unit Admins ───────────────────────────────

/**
 * Update the location (district/area/unit) on an application.
 * Allowed for: unit_admin, area_admin, district_admin, state_admin, super_admin.
 * Unit/area admins can only assign locations within their own scope.
 *
 * PATCH /api/applications/:id/location
 * Body: { district?, area, unit, reason? }
 */
const updateApplicationLocation = async (req, res) => {
  try {
    const { id } = req.params;
    const { district, area, unit, reason } = req.body;

    if (!area || !unit) {
      return res.status(400).json({
        success: false,
        message: 'Area and unit are required for transfer'
      });
    }

    const application = await Application.findOne({ _id: id, ...buildFranchiseReadFilter(req) });
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    const effectiveUser = getEffectiveUserForFilter(req);

    let hasAccess = hasAccessToApplication(effectiveUser, application);

    // Fallback 1: franchise-scope check may fail if UserFranchise.adminScope.regions
    // is not populated in the DB.  Re-try using the raw User.adminScope (User model)
    // which is populated from the legacy adminScope field and is more likely to have
    // district/area/unit set even on older records.
    if (!hasAccess && req.user.adminScope) {
      const userViaModel = {
        role: effectiveUser.role,
        adminScope: req.user.adminScope,
        isSuperAdmin: req.user.isSuperAdmin,
      };
      hasAccess = hasAccessToApplication(userViaModel, application);
    }

    // Fallback 2: RBAC middleware check (uses UserRole collection, same as GET endpoint).
    if (!hasAccess) {
      try {
        hasAccess = await RBACMiddleware.checkApplicationAccess(req.user, application);
      } catch (_rbacErr) {
        // fall through — hasAccess stays false
      }
    }

    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Transfers are only allowed while the application is still in an early,
    // pre-approval state ("just submitted" → "under review"). Once it has moved
    // past review it must not be relocated.
    const TRANSFERABLE_STATUSES = ['pending', 'under_review'];
    if (!TRANSFERABLE_STATUSES.includes(application.status)) {
      return res.status(400).json({
        success: false,
        message: `Application can only be transferred while it is pending or under review (current status: ${application.status}).`
      });
    }

    // Verify Location documents exist. Any allowed admin role may transfer to any
    // location, so we validate the target documents only (no scope restriction).
    const Location = require('../models/Location');
    const [areaDoc, unitDoc, districtDoc] = await Promise.all([
      Location.findById(area),
      Location.findById(unit),
      district ? Location.findById(district) : Promise.resolve(null)
    ]);
    if (!areaDoc || areaDoc.type !== 'area') return res.status(400).json({ success: false, message: 'Invalid area ID' });
    if (!unitDoc || unitDoc.type !== 'unit') return res.status(400).json({ success: false, message: 'Invalid unit ID' });
    if (district && (!districtDoc || districtDoc.type !== 'district')) {
      return res.status(400).json({ success: false, message: 'Invalid district ID' });
    }

    // Record previous values for history
    const previousValues = {
      previousDistrict: application.district,
      previousArea: application.area,
      previousUnit: application.unit,
    };

    // Capture the original (reference) location once, on the first transfer, so
    // the very first location the application arrived at is always recoverable.
    if (!application.originalLocation || !application.originalLocation.capturedAt) {
      application.originalLocation = {
        state: application.state,
        district: application.district,
        area: application.area,
        unit: application.unit,
        capturedAt: new Date()
      };
    }

    // Apply new location. Keep state in sync with the resolved district when one
    // is provided (district's parent is the state in the location hierarchy).
    if (district) {
      application.district = district;
      if (districtDoc && districtDoc.parent) {
        application.state = districtDoc.parent;
      }
    }
    application.area = area;
    application.unit = unit;
    application.updatedBy = req.user._id;

    // Append to location change history
    if (!application.locationChangeHistory) application.locationChangeHistory = [];
    application.locationChangeHistory.push({
      changedBy: req.user._id,
      changedAt: new Date(),
      ...previousValues,
      newDistrict: district || application.district,
      newArea: area,
      newUnit: unit,
      reason: reason || ''
    });

    // Add to stage history for admin visibility
    if (!application.stageHistory) application.stageHistory = [];
    application.stageHistory.push({
      stageName: 'Application Transferred',
      status: 'completed',
      timestamp: new Date(),
      updatedBy: req.user._id,
      notes: `Application transferred by ${req.user.role}. ${reason ? `Reason: ${reason}` : ''}`
    });

    await application.save();

    const updated = await Application.findById(id)
      .populate('district', 'name code')
      .populate('area', 'name code')
      .populate('unit', 'name code')
      .populate('originalLocation.district', 'name code')
      .populate('originalLocation.area', 'name code')
      .populate('originalLocation.unit', 'name code');

    res.json({
      success: true,
      message: 'Application transferred successfully',
      data: {
        district: updated.district,
        area: updated.area,
        unit: updated.unit,
        originalLocation: updated.originalLocation,
        locationChangeHistory: updated.locationChangeHistory
      }
    });
  } catch (error) {
    console.error('Error transferring application:', error);
    res.status(500).json({ success: false, message: 'Failed to transfer application' });
  }
};

// ─── Feature: Application Receipts Listing ────────────────────────────────────

/**
 * List receipts (completed payments) for admin review, with search/filter.
 * All admin roles can access this endpoint; regional scoping applies.
 *
 * GET /api/applications/receipts
 * Query params: search, scheme, startDate, endDate, page, limit
 */
const getApplicationReceipts = async (req, res) => {
  try {
    const Payment = require('../models/Payment');
    const {
      search = '',
      scheme = '',
      startDate,
      endDate,
      page = 1,
      limit = 20
    } = req.query;

    // Find approved/completed/disbursed applications with an approved amount
    const approvedAppQuery = {
      status: { $in: ['approved', 'completed', 'disbursed'] },
      approvedAmount: { $gt: 0 },
      ...buildFranchiseReadFilter(req)
    };

    // Apply regional access restriction using application's location
    const effectiveUser = getEffectiveUserForFilter(req);
    if (effectiveUser.role !== 'super_admin' && effectiveUser.role !== 'state_admin') {
      const regionFilter = getUserRegionalFilter(effectiveUser);
      if (Object.keys(regionFilter).length > 0) {
        Object.assign(approvedAppQuery, regionFilter);
      }
    }

    // Search by application number
    if (search) {
      approvedAppQuery.$or = [
        { applicationNumber: { $regex: search, $options: 'i' } }
      ];
    }

    // Fetch eligible applications with populated fields for fallback receipt entries
    const eligibleApps = await Application.find(approvedAppQuery)
      .populate('beneficiary', 'name phone')
      .populate('scheme', 'name code')
      .populate('project', 'name code')
      .populate('district', 'name')
      .populate('area', 'name')
      .populate('unit', 'name')
      .lean();
    const eligibleAppIds = eligibleApps.map(a => a._id);

    // Also filter by beneficiary name/phone when searching
    let searchBeneficiaryIds = [];
    if (search) {
      const matchedBeneficiaries = await Beneficiary.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } }
        ]
      }).select('_id').lean();
      searchBeneficiaryIds = matchedBeneficiaries.map(b => b._id);
    }

    const paymentFilter = {
      application: { $in: eligibleAppIds },
      amount: { $gt: 0 }
      // No additional franchise filter — applications are already franchise-scoped above
    };

    if (startDate || endDate) {
      paymentFilter['createdAt'] = {};
      if (startDate) paymentFilter['createdAt'].$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        paymentFilter['createdAt'].$lte = end;
      }
    }

    if (scheme) paymentFilter.scheme = scheme;

    if (search && searchBeneficiaryIds.length > 0) {
      paymentFilter.$or = [
        { application: { $in: eligibleAppIds } },
        { beneficiary: { $in: searchBeneficiaryIds } }
      ];
    }

    const payments = await Payment.find(paymentFilter)
      .populate({
        path: 'application',
        select: 'applicationNumber status district area unit',
        populate: [
          { path: 'district', select: 'name' },
          { path: 'area', select: 'name' },
          { path: 'unit', select: 'name' }
        ]
      })
      .populate('beneficiary', 'name phone')
      .populate('scheme', 'name code')
      .populate('project', 'name code')
      .populate('initiatedBy', 'name')
      .sort({ createdAt: -1 })
      .lean();

    // Build payment-based receipt entries
    const paymentReceipts = payments.map(p => ({
      paymentId: p._id,
      applicationId: p.application?._id || '',
      applicationNumber: p.application?.applicationNumber || '',
      beneficiaryName: p.beneficiary?.name || '',
      schemeName: p.scheme?.name || '',
      amount: p.amount || 0,
      paidAt: p.timeline?.completedAt || p.timeline?.approvedAt || p.createdAt || '',
      district: p.application?.district?.name || '',
      area: p.application?.area?.name || '',
      unit: p.application?.unit?.name || '',
    }));

    // For applications with NO payment records, create fallback receipt entries from application data
    const appsWithPayments = new Set(payments.map(p => (p.application?._id || p.application)?.toString()));
    const appsWithoutPayments = eligibleApps.filter(a => !appsWithPayments.has(a._id.toString()));

    const appFallbackReceipts = appsWithoutPayments.map(a => ({
      paymentId: null,
      applicationId: a._id,
      applicationNumber: a.applicationNumber || '',
      beneficiaryName: a.beneficiary?.name || '',
      schemeName: a.scheme?.name || '',
      amount: a.approvedAmount || 0,
      paidAt: a.approvedAt || a.updatedAt || '',
      district: a.district?.name || '',
      area: a.area?.name || '',
      unit: a.unit?.name || '',
    }));

    // Merge: payment-based entries first, then fallback entries; sort by date descending
    const allReceipts = [...paymentReceipts, ...appFallbackReceipts].sort(
      (a, b) => new Date(b.paidAt || 0) - new Date(a.paidAt || 0)
    );

    const total = allReceipts.length;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const receipts = allReceipts.slice(skip, skip + parseInt(limit));

    res.json({
      success: true,
      data: receipts,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)) || 1,
        totalCount: total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching receipts:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch receipts' });
  }
};

module.exports = {
  getApplications,
  getApplication,
  createApplication,
  updateApplication,
  reviewApplication,
  approveApplication,
  modifyApprovedApplication,
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
  recalculateScore,
  syncApplicationStatus,
  downloadApplicationPdf,
  downloadBlankFormPdf,
  getApplicationConsolidation,
  getApplicationDuplicates,
  updateApplicationLocation,
  getApplicationReceipts
};