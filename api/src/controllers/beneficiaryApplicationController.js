const { Application, Scheme, User, FormConfiguration, Beneficiary, Location } = require('../models');
const ResponseHelper = require('../utils/responseHelper');
const mongoose = require('mongoose');
const notificationService = require('../services/notificationService');
const { getApplicationStagesFromScheme } = require('./applicationController');
const { calculateApplicationScore } = require('../utils/scoringEngine');
const { buildFranchiseReadFilter, buildFranchiseMatchStage, getWriteFranchiseId } = require('../utils/franchiseFilterHelper');

class BeneficiaryApplicationController {
  /**
   * Get available schemes for beneficiaries
   * GET /api/beneficiary/schemes
   */
  async getAvailableSchemes(req, res) {
    try {
      const { category, search } = req.query;

      // Build query for active schemes
      const today = new Date();
      const query = {
        status: 'active',
        ...buildFranchiseReadFilter(req)
      };

      if (category && category !== 'all') {
        query.category = category;
      }

      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }

      console.log('🔍 Beneficiary Schemes Query:', JSON.stringify(query, null, 2));
      
      // Count total schemes matching query
      const totalCount = await Scheme.countDocuments(query);
      console.log('📊 Total active schemes found:', totalCount);

      const schemes = await Scheme.find(query)
        .populate('project', 'name')
        .select(`
          name description category priority
          benefits.type benefits.amount benefits.frequency benefits.description
          eligibility.incomeLimit eligibility.ageRange eligibility.gender eligibility.documents
          applicationSettings.startDate applicationSettings.endDate applicationSettings.maxApplications
          applicationSettings.requiresInterview applicationSettings.allowMultipleApplications
          statistics.totalApplications statistics.approvedApplications statistics.totalBeneficiaries
          hasFormConfiguration
          renewalSettings
        `)
        .sort({ priority: -1, createdAt: -1 });

      console.log('📋 Schemes retrieved:', schemes.length);
      if (schemes.length > 0) {
        console.log('- First scheme:', schemes[0].name);
      }

      // Add additional information for each scheme
      const schemesWithStats = await Promise.all(
        schemes.map(async (scheme) => {
          // Count approved/completed beneficiaries
          const beneficiariesCount = await Application.countDocuments({
            scheme: scheme._id,
            ...buildFranchiseReadFilter(req),
            status: { $in: ['approved', 'completed'] }
          });

          // Check if user has already applied or has a draft
          const existingApplication = await Application.findOne({
            scheme: scheme._id,
            applicant: req.user._id,
            ...buildFranchiseReadFilter(req),
            status: { $nin: ['rejected', 'cancelled'] }
          });

          // Check for draft specifically (beneficiary-based lookup)
          const draftApplication = await Application.findOne({
            scheme: scheme._id,
            ...buildFranchiseReadFilter(req),
            status: 'draft'
          }).populate('beneficiary', 'phone').then(app => {
            if (app && app.beneficiary?.phone === req.user.phone) return app;
            return null;
          });

          // Check if scheme has a valid form configuration in database
          const hasValidFormConfig = await FormConfiguration.findOne({
            scheme: scheme._id,
            ...buildFranchiseReadFilter(req),
            enabled: true,
            pages: { $exists: true, $ne: [] }
          });

          console.log(`📋 Scheme ${scheme.name}: hasValidFormConfig = ${!!hasValidFormConfig}`);

          // Calculate days remaining for application
          const daysRemaining = Math.ceil(
            (new Date(scheme.applicationSettings.endDate) - today) / (1000 * 60 * 60 * 24)
          );

          // Format eligibility criteria for display
          const eligibilityCriteria = [];
          
          if (scheme.eligibility.incomeLimit) {
            eligibilityCriteria.push(`Annual family income below ₹${scheme.eligibility.incomeLimit.toLocaleString()}`);
          }
          
          if (scheme.eligibility.ageRange.min || scheme.eligibility.ageRange.max) {
            const ageText = scheme.eligibility.ageRange.min && scheme.eligibility.ageRange.max
              ? `Age between ${scheme.eligibility.ageRange.min}-${scheme.eligibility.ageRange.max} years`
              : scheme.eligibility.ageRange.min
                ? `Minimum age ${scheme.eligibility.ageRange.min} years`
                : `Maximum age ${scheme.eligibility.ageRange.max} years`;
            eligibilityCriteria.push(ageText);
          }
          
          if (scheme.eligibility.gender && scheme.eligibility.gender !== 'any') {
            eligibilityCriteria.push(`Gender: ${scheme.eligibility.gender}`);
          }

          // Format required documents
          const requiredDocuments = scheme.eligibility.documents
            .filter(doc => doc.required)
            .map(doc => doc.description || doc.type.replace('_', ' ').toUpperCase());

          return {
            _id: scheme._id,
            name: scheme.name,
            description: scheme.description,
            category: scheme.category,
            priority: scheme.priority,
            project: scheme.project,
            
            // Benefit information
            benefitType: scheme.benefits.type,
            maxAmount: scheme.benefits.amount,
            benefitFrequency: scheme.benefits.frequency,
            benefitDescription: scheme.benefits.description,
            
            // Application settings
            applicationDeadline: scheme.applicationSettings.endDate,
            daysRemaining,
            requiresInterview: scheme.applicationSettings.requiresInterview,
            allowMultipleApplications: scheme.applicationSettings.allowMultipleApplications,
            
            // Eligibility and requirements
            eligibilityCriteria,
            requiredDocuments,
            
            // Statistics
            beneficiariesCount,
            totalApplications: scheme.statistics.totalApplications,
            successRate: scheme.statistics.totalApplications > 0 
              ? Math.round((scheme.statistics.approvedApplications / scheme.statistics.totalApplications) * 100)
              : 0,
            
            // Application status
            hasApplied: !!(existingApplication && existingApplication.status !== 'draft'),
            hasDraft: !!draftApplication,
            draftApplicationId: draftApplication?._id,
            existingApplicationId: existingApplication?._id,
            existingApplicationStatus: existingApplication?.status,
            
            // Form availability - check if form config exists in database
            hasFormConfiguration: !!hasValidFormConfig,
            
            // Status indicators
            isUrgent: daysRemaining <= 7,
            isPopular: beneficiariesCount > 100,
            isNew: (today - new Date(scheme.createdAt)) / (1000 * 60 * 60 * 24) <= 30
          };
        })
      );

      // Sort schemes by priority and urgency
      schemesWithStats.sort((a, b) => {
        // Prioritize schemes user hasn't applied to
        if (a.hasApplied !== b.hasApplied) {
          return a.hasApplied ? 1 : -1;
        }
        
        // Then by urgency (deadline approaching)
        if (a.isUrgent !== b.isUrgent) {
          return a.isUrgent ? -1 : 1;
        }
        
        // Then by priority
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });

      return ResponseHelper.success(res, {
        schemes: schemesWithStats,
        total: schemesWithStats.length,
        categories: [...new Set(schemesWithStats.map(s => s.category))],
        summary: {
          totalActive: schemesWithStats.length,
          notApplied: schemesWithStats.filter(s => !s.hasApplied).length,
          urgent: schemesWithStats.filter(s => s.isUrgent).length,
          requireInterview: schemesWithStats.filter(s => s.requiresInterview).length
        }
      }, 'Active schemes retrieved successfully');

    } catch (error) {
      console.error('❌ Get Available Schemes Error:', error);
      return ResponseHelper.error(res, error.message, 500);
    }
  }

  /**
   * Get scheme details by ID
   * GET /api/beneficiary/schemes/:id
   */
  async getSchemeDetails(req, res) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return ResponseHelper.error(res, 'Invalid scheme ID', 400);
      }

      // Check if scheme is active - simplified to match the schemes list
      const scheme = await Scheme.findOne({
        _id: id,
        status: 'active',
        ...buildFranchiseReadFilter(req)
      })
        .populate('project', 'name description')
        .select(`
          name description category priority
          benefits.type benefits.amount benefits.frequency benefits.description
          eligibility.incomeLimit eligibility.ageRange eligibility.gender eligibility.documents
          applicationSettings.startDate applicationSettings.endDate applicationSettings.maxApplications
          applicationSettings.requiresInterview applicationSettings.allowMultipleApplications
          statistics.totalApplications statistics.approvedApplications statistics.totalBeneficiaries
          hasFormConfiguration
        `);

      if (!scheme) {
        console.log('❌ Scheme not found with ID:', id);
        return ResponseHelper.error(res, 'Scheme not found or not accepting applications', 404);
      }

      console.log('✅ Scheme found:', scheme.name);

      // Get form configuration - ONLY from database, no defaults
      const formConfig = await FormConfiguration.findOne({ 
        scheme: scheme._id,
        ...buildFranchiseReadFilter(req),
        enabled: true
      }).select('title description pages submissionSettings isPublished scoringConfig');

      console.log('📋 Form config found:', !!formConfig);
      if (formConfig) {
        console.log('📋 Form config enabled:', formConfig.enabled);
        console.log('📋 Form config published:', formConfig.isPublished);
        console.log('📋 Form config pages:', formConfig.pages?.length || 0);
      }

      // Only use form configuration if it exists in database and has valid pages
      if (!formConfig || !formConfig.pages || formConfig.pages.length === 0) {
        console.log('❌ No valid form configuration found for scheme:', scheme.name);
        return ResponseHelper.error(res, 'Application form is not available for this scheme. Please contact administrator.', 400);
      }

      console.log('✅ Using database form configuration for scheme:', scheme.name);
      const finalFormConfig = {
        title: formConfig.title,
        description: formConfig.description,
        pages: formConfig.pages,
        confirmationMessage: formConfig.submissionSettings?.confirmationMessage || "Thank you for your application."
      };

      console.log('📋 Final form config pages:', finalFormConfig.pages?.length || 0);

      // Get beneficiary count
      const beneficiariesCount = await Application.countDocuments({
        scheme: scheme._id,
        ...buildFranchiseReadFilter(req),
        status: { $in: ['approved', 'completed'] }
      });

      // Check if user has already applied
      const existingApplication = await Application.findOne({
        scheme: scheme._id,
        applicant: req.user._id,
        ...buildFranchiseReadFilter(req),
        status: { $nin: ['rejected', 'cancelled'] }
      });

      // Calculate days remaining for application
      const today = new Date();
      const daysRemaining = Math.ceil(
        (new Date(scheme.applicationSettings.endDate) - today) / (1000 * 60 * 60 * 24)
      );

      // Format eligibility criteria for display
      const eligibilityCriteria = [];
      
      if (scheme.eligibility.incomeLimit) {
        eligibilityCriteria.push(`Annual family income below ₹${scheme.eligibility.incomeLimit.toLocaleString()}`);
      }
      
      if (scheme.eligibility.ageRange.min || scheme.eligibility.ageRange.max) {
        const ageText = scheme.eligibility.ageRange.min && scheme.eligibility.ageRange.max
          ? `Age between ${scheme.eligibility.ageRange.min}-${scheme.eligibility.ageRange.max} years`
          : scheme.eligibility.ageRange.min
            ? `Minimum age ${scheme.eligibility.ageRange.min} years`
            : `Maximum age ${scheme.eligibility.ageRange.max} years`;
        eligibilityCriteria.push(ageText);
      }
      
      if (scheme.eligibility.gender && scheme.eligibility.gender !== 'any') {
        eligibilityCriteria.push(`Gender: ${scheme.eligibility.gender}`);
      }

      // Note: requiredDocuments removed - only using FormConfiguration file fields

      return ResponseHelper.success(res, {
        scheme: {
          _id: scheme._id,
          name: scheme.name,
          description: scheme.description,
          category: scheme.category,
          priority: scheme.priority,
          project: scheme.project,
          
          // Benefit information
          benefitType: scheme.benefits.type,
          maxAmount: scheme.benefits.amount,
          benefitFrequency: scheme.benefits.frequency,
          benefitDescription: scheme.benefits.description,
          
          // Application settings
          applicationDeadline: scheme.applicationSettings.endDate,
          daysRemaining,
          requiresInterview: scheme.applicationSettings.requiresInterview,
          allowMultipleApplications: scheme.applicationSettings.allowMultipleApplications,
          
          // Eligibility and requirements
          eligibilityCriteria,
          
          // Statistics
          beneficiariesCount,
          totalApplications: scheme.statistics.totalApplications,
          successRate: scheme.statistics.totalApplications > 0 
            ? Math.round((scheme.statistics.approvedApplications / scheme.statistics.totalApplications) * 100)
            : 0,
          
          // Application status
          hasApplied: !!existingApplication,
          existingApplicationId: existingApplication?._id,
          existingApplicationStatus: existingApplication?.status,
          
          // Renewal settings
          renewalSettings: scheme.renewalSettings || { isRenewable: false },

          // Form configuration
          formConfig: finalFormConfig
        }
      }, 'Scheme details retrieved successfully');

    } catch (error) {
      console.error('❌ Get Scheme Details Error:', error);
      return ResponseHelper.error(res, error.message, 500);
    }
  }

  /**
   * Submit application for a scheme
   * POST /api/beneficiary/applications
   */
  async submitApplication(req, res) {
    try {
      const { schemeId, formData, documents } = req.body;
      const userId = req.user._id;

      // Validate input
      if (!schemeId || !formData) {
        return ResponseHelper.error(res, 'Scheme ID and form data are required', 400);
      }

      if (!mongoose.Types.ObjectId.isValid(schemeId)) {
        return ResponseHelper.error(res, 'Invalid scheme ID', 400);
      }

      // Check if scheme exists and is active
      const scheme = await Scheme.findOne({ _id: schemeId, franchise: req.franchiseId }).populate('project');
      if (!scheme) {
        return ResponseHelper.error(res, 'Scheme not found', 404);
      }

      if (scheme.status !== 'active') {
        return ResponseHelper.error(res, 'Scheme is not currently accepting applications', 400);
      }

      // Get user's profile location data
      const user = await User.findById(userId).select('profile');
      
      // Validate that user has completed profile with location
      if (!user?.profile?.location?.district || !user?.profile?.location?.area || !user?.profile?.location?.unit) {
        return ResponseHelper.error(res, 'Please complete your profile with location information before applying', 400);
      }

      // Find or create beneficiary record
      let beneficiary = await Beneficiary.findOne({ phone: req.user.phone, franchise: req.franchiseId });
      
      if (!beneficiary) {
        // Get state from district's parent
        const district = await Location.findById(user.profile.location.district);
        if (!district || !district.parent) {
          return ResponseHelper.error(res, 'Invalid location data. Please update your profile.', 400);
        }

        // Create beneficiary record using user's profile location
        beneficiary = new Beneficiary({
          name: req.user.name,
          phone: req.user.phone,
          franchise: req.franchiseId,
          state: district.parent, // State is parent of district
          district: user.profile.location.district,
          area: user.profile.location.area,
          unit: user.profile.location.unit,
          status: 'active',
          isVerified: true,
          createdBy: userId
        });
        
        await beneficiary.save();
        console.log('✅ Created beneficiary record with location from user profile');
      } else {
        // Update beneficiary location if it has changed in user profile
        const district = await Location.findById(user.profile.location.district);
        beneficiary.state = district?.parent || beneficiary.state;
        beneficiary.district = user.profile.location.district;
        beneficiary.area = user.profile.location.area;
        beneficiary.unit = user.profile.location.unit;
        await beneficiary.save();
        console.log('✅ Updated beneficiary location from user profile');
      }

      // Check if beneficiary has already applied for this scheme
      const existingApplication = await Application.findOne({
        scheme: schemeId,
        beneficiary: beneficiary._id,
        franchise: req.franchiseId,
        status: { $nin: ['rejected', 'cancelled'] }
      });

      if (existingApplication) {
        if (existingApplication.status === 'draft') {
          // Convert draft to submitted application
          console.log('📝 Converting draft to submitted application:', existingApplication.applicationNumber);
          
          const rawAmount = formData.requestedAmount || formData.field_12;
          const parsedAmount = (typeof rawAmount === 'number' || (typeof rawAmount === 'string' && !isNaN(Number(rawAmount))))
            ? Number(rawAmount) : null;
          const requestedAmount = parsedAmount || scheme.benefits?.amount || 0;

          existingApplication.formData = formData;
          existingApplication.requestedAmount = requestedAmount;
          existingApplication.documents = documents || [];
          existingApplication.status = 'pending';
          existingApplication.draftMetadata = undefined;
          
          // Get application stages from scheme
          const applicationStages = getApplicationStagesFromScheme(scheme);
          existingApplication.applicationStages = applicationStages.map(stage => ({
            ...stage,
            status: 'pending',
            completedAt: null,
            completedBy: null,
            notes: null,
            comments: {
              unitAdmin: { comment: null, commentedBy: null, commentedAt: null },
              areaAdmin: { comment: null, commentedBy: null, commentedAt: null },
              districtAdmin: { comment: null, commentedBy: null, commentedAt: null }
            },
            requiredDocuments: (stage.requiredDocuments || []).map(doc => ({
              name: doc.name,
              description: doc.description,
              isRequired: doc.isRequired,
              uploadedFile: null,
              uploadedBy: null,
              uploadedAt: null
            }))
          }));
          existingApplication.currentStage = applicationStages[0]?.name || 'Application Received';

          // Calculate eligibility score if form has scoring enabled
          try {
            const formConfig = await FormConfiguration.findOne({ 
              scheme: schemeId, 
              franchise: req.franchiseId,
              enabled: true,
              'scoringConfig.enabled': true 
            });
            if (formConfig) {
              const scoreResult = calculateApplicationScore(formData, formConfig);
              existingApplication.eligibilityScore = scoreResult;
              if (scoreResult.autoRejected) {
                existingApplication.status = 'rejected';
                existingApplication.reviewComments = `Auto-rejected: Eligibility score ${scoreResult.percentage}% is below the minimum threshold of ${scoreResult.threshold}%`;
                existingApplication.reviewedAt = new Date();
              }
            }
          } catch (scoringError) {
            console.error('⚠️ Scoring calculation failed (non-blocking):', scoringError.message);
          }

          await existingApplication.save();

          await existingApplication.populate([
            { path: 'scheme', select: 'name category benefits' },
            { path: 'beneficiary', select: 'name phone' }
          ]);

          notificationService
            .notifyApplicationSubmitted(existingApplication, { createdBy: userId })
            .catch(err => console.error('❌ Application submitted notification failed:', err));

          return ResponseHelper.success(res, {
            application: {
              _id: existingApplication._id,
              applicationId: existingApplication.applicationNumber,
              applicationNumber: existingApplication.applicationNumber,
              scheme: existingApplication.scheme,
              status: existingApplication.status,
              requestedAmount: existingApplication.requestedAmount,
              submittedAt: existingApplication.createdAt,
              convertedFromDraft: true
            }
          }, existingApplication.eligibilityScore?.autoRejected 
            ? 'Application submitted but auto-rejected due to low eligibility score'
            : 'Application submitted successfully');
        }
        
        return ResponseHelper.error(res, 'You have already applied for this scheme', 400);
      }

      // Extract requested amount from form data or use scheme max amount
      // Only use numeric values — skip arrays (table fields) or non-numeric strings
      const rawAmount = formData.requestedAmount || formData.field_12;
      const parsedAmount = (typeof rawAmount === 'number' || (typeof rawAmount === 'string' && !isNaN(Number(rawAmount))))
        ? Number(rawAmount)
        : null;
      const requestedAmount = parsedAmount || scheme.benefits?.amount || 0;

      // Generate application number manually to avoid pre-save middleware issues
      const applicationCount = await Application.countDocuments({ franchise: req.franchiseId });
      const year = new Date().getFullYear();
      const applicationNumber = `APP${year}${String(applicationCount + 1).padStart(6, '0')}`;

      console.log('📝 Generated application number:', applicationNumber);
      console.log('📝 Form data received:', formData);

      // Get application stages from scheme configuration
      const applicationStages = getApplicationStagesFromScheme(scheme);

      // Create application with all required fields INCLUDING formData
      const application = new Application({
        applicationNumber: applicationNumber,
        beneficiary: beneficiary._id,
        scheme: schemeId,
        franchise: req.franchiseId,
        project: scheme.project?._id || scheme.project, // Handle if project is populated or just ID
        requestedAmount: requestedAmount,
        formData: formData, // ✅ SAVE THE FORM DATA!
        status: 'pending', // Use valid enum value
        state: beneficiary.state,
        district: beneficiary.district,
        area: beneficiary.area,
        unit: beneficiary.unit,
        createdBy: userId,
        documents: documents || [],
        applicationStages: applicationStages.map(stage => ({
          ...stage,
          status: 'pending',
          completedAt: null,
          completedBy: null,
          notes: null,
          comments: {
            unitAdmin: { comment: null, commentedBy: null, commentedAt: null },
            areaAdmin: { comment: null, commentedBy: null, commentedAt: null },
            districtAdmin: { comment: null, commentedBy: null, commentedAt: null }
          },
          requiredDocuments: (stage.requiredDocuments || []).map(doc => ({
            name: doc.name,
            description: doc.description,
            isRequired: doc.isRequired,
            uploadedFile: null,
            uploadedBy: null,
            uploadedAt: null
          }))
        })),
        currentStage: applicationStages[0]?.name || 'Application Received'
      });

      console.log('📝 Application object before save:', {
        applicationNumber: application.applicationNumber,
        beneficiary: application.beneficiary,
        scheme: application.scheme,
        status: application.status,
        requestedAmount: application.requestedAmount,
        formDataKeys: Object.keys(formData || {})
      });

      // Calculate eligibility score if form has scoring enabled
      try {
        const formConfig = await FormConfiguration.findOne({ 
          scheme: schemeId, 
          franchise: req.franchiseId,
          enabled: true,
          'scoringConfig.enabled': true 
        });

        if (formConfig) {
          console.log('📊 Calculating eligibility score...');
          const scoreResult = calculateApplicationScore(formData, formConfig);
          application.eligibilityScore = scoreResult;
          console.log('📊 Score calculated:', {
            totalPoints: scoreResult.totalPoints,
            maxPoints: scoreResult.maxPoints,
            percentage: scoreResult.percentage,
            meetsThreshold: scoreResult.meetsThreshold,
            autoRejected: scoreResult.autoRejected
          });

          // Auto-reject if below threshold and auto-reject is enabled
          if (scoreResult.autoRejected) {
            application.status = 'rejected';
            application.reviewComments = `Auto-rejected: Eligibility score ${scoreResult.percentage}% is below the minimum threshold of ${scoreResult.threshold}%`;
            application.reviewedAt = new Date();
            console.log('⚠️ Application auto-rejected due to low eligibility score');
          }
        }
      } catch (scoringError) {
        console.error('⚠️ Scoring calculation failed (non-blocking):', scoringError.message);
        // Don't block application submission if scoring fails
      }

      await application.save();

      // Add application to beneficiary's applications array
      beneficiary.applications.push(application._id);
      await beneficiary.save();

      // Populate the response
      await application.populate([
        { path: 'scheme', select: 'name category benefits' },
        { path: 'beneficiary', select: 'name phone' }
      ]);

            // Notify area coordinator + unit administrator (system/in-app)
            // Fire-and-forget: failure should not block application submission
            notificationService
              .notifyApplicationSubmitted(application, { createdBy: userId })
              .catch(err => console.error('❌ Application submitted notification failed:', err));

      return ResponseHelper.success(res, {
        application: {
          _id: application._id,
          applicationId: application.applicationNumber, // Use applicationNumber as applicationId for frontend
          applicationNumber: application.applicationNumber,
          scheme: application.scheme,
          status: application.status,
          requestedAmount: application.requestedAmount,
          submittedAt: application.createdAt,
          eligibilityScore: application.eligibilityScore?.totalPoints > 0 ? {
            percentage: application.eligibilityScore.percentage,
            meetsThreshold: application.eligibilityScore.meetsThreshold,
            autoRejected: application.eligibilityScore.autoRejected
          } : undefined
        }
      }, application.eligibilityScore?.autoRejected 
        ? 'Application submitted but auto-rejected due to low eligibility score'
        : 'Application submitted successfully');

    } catch (error) {
      console.error('❌ Submit Application Error:', error);
      return ResponseHelper.error(res, error.message, 500);
    }
  }

  /**
   * Get beneficiary's applications
   * GET /api/beneficiary/applications
   */
  async getMyApplications(req, res) {
    try {
      const { status, page = 1, limit = 10 } = req.query;
      const userId = req.user._id;

      // Find beneficiary record
      const beneficiary = await Beneficiary.findOne({ phone: req.user.phone, ...buildFranchiseReadFilter(req) });
      if (!beneficiary) {
        return ResponseHelper.success(res, {
          applications: [],
          pagination: {
            current: 1,
            pages: 0,
            total: 0,
            limit: parseInt(limit)
          }
        }, 'No applications found');
      }

      // Build query
      const query = { beneficiary: beneficiary._id, ...buildFranchiseReadFilter(req) };
      if (status && status !== 'all') {
        query.status = status;
      }

      // Pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const applications = await Application.find(query)
        .populate('scheme', 'name category benefits')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Application.countDocuments(query);

      // Format applications for response
      const formattedApplications = applications.map(app => ({
        _id: app._id,
        applicationId: app.applicationNumber,
        scheme: {
          _id: app.scheme._id,
          name: app.scheme.name,
          category: app.scheme.category,
          maxAmount: app.scheme.benefits?.amount || 0
        },
        status: app.status,
        submittedAt: app.createdAt,
        requestedAmount: app.requestedAmount
      }));

      return ResponseHelper.success(res, {
        applications: formattedApplications,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total,
          limit: parseInt(limit)
        }
      }, 'Applications retrieved successfully');

    } catch (error) {
      console.error('❌ Get My Applications Error:', error);
      return ResponseHelper.error(res, error.message, 500);
    }
  }

  /**
   * Get application details by ID
   * GET /api/beneficiary/applications/:id
   */
  async getApplicationDetails(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user._id;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return ResponseHelper.error(res, 'Invalid application ID', 400);
      }

      // Find beneficiary record
      const beneficiary = await Beneficiary.findOne({ phone: req.user.phone, ...buildFranchiseReadFilter(req) });
      if (!beneficiary) {
        return ResponseHelper.error(res, 'Beneficiary record not found', 404);
      }

      const application = await Application.findOne({
        _id: id,
        beneficiary: beneficiary._id,
        ...buildFranchiseReadFilter(req)
      })
        .populate('scheme', 'name description category benefits eligibility')
        .populate('reviewedBy', 'name role')
        .populate('approvedBy', 'name role');

      if (!application) {
        return ResponseHelper.error(res, 'Application not found', 404);
      }

      return ResponseHelper.success(res, { application }, 'Application details retrieved successfully');

    } catch (error) {
      console.error('❌ Get Application Details Error:', error);
      return ResponseHelper.error(res, error.message, 500);
    }
  }

  /**
   * Track application by application number
   * GET /api/beneficiary/track/:applicationId
   */
  async trackApplication(req, res) {
    try {
      const { applicationId } = req.params;

      // Find application by applicationNumber (not applicationId)
      const application = await Application.findOne({ applicationNumber: applicationId, ...buildFranchiseReadFilter(req) })
        .populate('scheme', 'name category benefits')
        .populate('beneficiary', 'name phone')
        .select('applicationNumber scheme status createdAt reviewedAt approvedAt requestedAmount approvedAmount');

      if (!application) {
        return ResponseHelper.error(res, 'Application not found', 404);
      }

      // Find beneficiary record to verify ownership
      const beneficiary = await Beneficiary.findOne({ phone: req.user.phone, ...buildFranchiseReadFilter(req) });
      if (!beneficiary || application.beneficiary._id.toString() !== beneficiary._id.toString()) {
        return ResponseHelper.error(res, 'Access denied', 403);
      }

      // Format response
      const formattedApplication = {
        _id: application._id,
        applicationId: application.applicationNumber,
        scheme: {
          _id: application.scheme._id,
          name: application.scheme.name,
          category: application.scheme.category
        },
        status: application.status,
        submittedAt: application.createdAt,
        reviewedAt: application.reviewedAt,
        approvedAt: application.approvedAt,
        requestedAmount: application.requestedAmount,
        approvedAmount: application.approvedAmount
      };

      return ResponseHelper.success(res, { application: formattedApplication }, 'Application tracking retrieved successfully');

    } catch (error) {
      console.error('❌ Track Application Error:', error);
      return ResponseHelper.error(res, error.message, 500);
    }
  }

  /**
   * Cancel application (only if in submitted status)
   * PUT /api/beneficiary/applications/:id/cancel
   */
  async cancelApplication(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const applicantId = req.user._id;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return ResponseHelper.error(res, 'Invalid application ID', 400);
      }

      const application = await Application.findOne({
        _id: id,
        applicant: applicantId,
        franchise: req.franchiseId
      });

      if (!application) {
        return ResponseHelper.error(res, 'Application not found', 404);
      }

      // Only allow cancellation if application is in submitted or under_review status
      if (!['submitted', 'under_review'].includes(application.status)) {
        return ResponseHelper.error(res, 'Application cannot be cancelled at this stage', 400);
      }

      // Update application status
      application.status = 'cancelled';
      application.statusHistory.push({
        status: 'cancelled',
        timestamp: new Date(),
        comment: reason || 'Cancelled by applicant'
      });

      await application.save();

      return ResponseHelper.success(res, {
        application: {
          id: application._id,
          applicationId: application.applicationId,
          status: application.status
        }
      }, 'Application cancelled successfully');

    } catch (error) {
      console.error('❌ Cancel Application Error:', error);
      return ResponseHelper.error(res, error.message, 500);
    }
  }

  /**
   * Get application statistics for beneficiary
   * GET /api/beneficiary/stats
   */
  async getApplicationStats(req, res) {
    try {
      const userId = req.user._id;

      // Find beneficiary record
      const beneficiary = await Beneficiary.findOne({ phone: req.user.phone, ...buildFranchiseReadFilter(req) });
      if (!beneficiary) {
        return ResponseHelper.success(res, { 
          stats: {
            total: 0,
            pending: 0,
            under_review: 0,
            approved: 0,
            rejected: 0,
            completed: 0,
            totalApprovedAmount: 0
          }
        }, 'Statistics retrieved successfully');
      }

      const stats = await Application.aggregate([
        { $match: { beneficiary: beneficiary._id, ...buildFranchiseMatchStage(req), status: { $ne: 'draft' } } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$approvedAmount' }
          }
        }
      ]);

      // Format stats
      const formattedStats = {
        total: 0,
        pending: 0,
        under_review: 0,
        approved: 0,
        rejected: 0,
        completed: 0,
        totalApprovedAmount: 0
      };

      stats.forEach(stat => {
        formattedStats[stat._id] = stat.count;
        formattedStats.total += stat.count;
        
        if (stat._id === 'approved' || stat._id === 'completed') {
          formattedStats.totalApprovedAmount += stat.totalAmount || 0;
        }
      });

      return ResponseHelper.success(res, { stats: formattedStats }, 'Statistics retrieved successfully');

    } catch (error) {
      console.error('❌ Get Application Stats Error:', error);
      return ResponseHelper.error(res, error.message, 500);
    }
  }

  /**
   * Get applications due for renewal for the logged-in beneficiary
   * GET /api/beneficiary/applications/renewal-due
   */
  async getRenewalDueApplications(req, res) {
    try {
      const beneficiary = await Beneficiary.findOne({ phone: req.user.phone, ...buildFranchiseReadFilter(req) });
      if (!beneficiary) {
        return ResponseHelper.success(res, { applications: [] }, 'No renewal-due applications');
      }

      const applications = await Application.find({
        beneficiary: beneficiary._id,
        ...buildFranchiseReadFilter(req),
        renewalStatus: { $in: ['due_for_renewal', 'active'] },
        expiryDate: { $ne: null }
      })
        .populate('scheme', 'name code category renewalSettings')
        .populate('project', 'name')
        .sort({ expiryDate: 1 });

      // Add computed fields
      const now = new Date();
      const enrichedApplications = applications.map(app => {
        const appObj = app.toObject();
        appObj.daysUntilExpiry = app.expiryDate
          ? Math.ceil((app.expiryDate - now) / (1000 * 60 * 60 * 24))
          : null;
        appObj.isExpiringSoon = appObj.daysUntilExpiry !== null && appObj.daysUntilExpiry <= 7;
        return appObj;
      });

      return ResponseHelper.success(res, {
        applications: enrichedApplications,
        total: enrichedApplications.length
      }, 'Renewal-due applications retrieved');
    } catch (error) {
      console.error('❌ Get Renewal Due Applications Error:', error);
      return ResponseHelper.error(res, error.message, 500);
    }
  }

  /**
   * Get renewal form with pre-filled data from parent application
   * GET /api/beneficiary/applications/:id/renewal-form
   */
  async getRenewalForm(req, res) {
    try {
      const { id } = req.params;

      const beneficiary = await Beneficiary.findOne({ phone: req.user.phone, ...buildFranchiseReadFilter(req) });
      if (!beneficiary) {
        return ResponseHelper.error(res, 'Beneficiary not found', 404);
      }

      // Find the application
      const application = await Application.findOne({
        _id: id,
        beneficiary: beneficiary._id,
        ...buildFranchiseReadFilter(req)
      }).populate('scheme', 'name code renewalSettings');

      if (!application) {
        return ResponseHelper.error(res, 'Application not found', 404);
      }

      // Verify scheme supports renewals
      const scheme = await Scheme.findOne({ _id: application.scheme._id || application.scheme, ...buildFranchiseReadFilter(req) });
      if (!scheme?.renewalSettings?.isRenewable) {
        return ResponseHelper.error(res, 'This scheme does not support renewals', 400);
      }

      // Check renewal status
      if (!['active', 'due_for_renewal'].includes(application.renewalStatus)) {
        return ResponseHelper.error(res, `Application cannot be renewed. Current renewal status: ${application.renewalStatus}`, 400);
      }

      // Check max renewals limit
      if (scheme.renewalSettings.maxRenewals > 0) {
        const renewalCount = await Application.countDocuments({
          parentApplication: application._id,
          ...buildFranchiseReadFilter(req),
          isRenewal: true
        });
        if (renewalCount >= scheme.renewalSettings.maxRenewals) {
          return ResponseHelper.error(res, `Maximum renewals (${scheme.renewalSettings.maxRenewals}) reached for this application`, 400);
        }
      }

      // Get renewal form configuration (separate form for renewals)
      let formConfig = await FormConfiguration.findOne({
        scheme: scheme._id,
        ...buildFranchiseReadFilter(req),
        isRenewalForm: true
      });

      // If no renewal form, fall back to original form
      if (!formConfig) {
        formConfig = await FormConfiguration.findOne({
          scheme: scheme._id,
          ...buildFranchiseReadFilter(req),
          isRenewalForm: { $ne: true }
        });
      }

      if (!formConfig) {
        return ResponseHelper.error(res, 'No form configuration found for renewal', 404);
      }

      return ResponseHelper.success(res, {
        formConfiguration: formConfig,
        prefillData: application.formData || {},
        parentApplication: {
          _id: application._id,
          applicationNumber: application.applicationNumber,
          status: application.status,
          renewalStatus: application.renewalStatus,
          expiryDate: application.expiryDate,
          renewalNumber: application.renewalNumber,
          approvedAmount: application.approvedAmount,
          requestedAmount: application.requestedAmount
        },
        scheme: {
          _id: scheme._id,
          name: scheme.name,
          code: scheme.code,
          renewalSettings: scheme.renewalSettings
        }
      }, 'Renewal form retrieved successfully');
    } catch (error) {
      console.error('❌ Get Renewal Form Error:', error);
      return ResponseHelper.error(res, error.message, 500);
    }
  }

  /**
   * Submit a renewal application
   * POST /api/beneficiary/applications/:id/renew
   */
  async submitRenewal(req, res) {
    try {
      const { id } = req.params;
      const { formData, documents } = req.body;

      if (!formData || typeof formData !== 'object') {
        return ResponseHelper.error(res, 'Form data is required', 400);
      }

      const beneficiary = await Beneficiary.findOne({ phone: req.user.phone, franchise: req.franchiseId });
      if (!beneficiary) {
        return ResponseHelper.error(res, 'Beneficiary not found', 404);
      }

      // Find the parent application
      const parentApplication = await Application.findOne({
        _id: id,
        beneficiary: beneficiary._id,
        franchise: req.franchiseId
      }).populate('scheme');

      if (!parentApplication) {
        return ResponseHelper.error(res, 'Application not found', 404);
      }

      // Verify scheme supports renewals
      const scheme = await Scheme.findOne({ _id: parentApplication.scheme._id || parentApplication.scheme, franchise: req.franchiseId });
      if (!scheme?.renewalSettings?.isRenewable) {
        return ResponseHelper.error(res, 'This scheme does not support renewals', 400);
      }

      // Check renewal status
      if (!['active', 'due_for_renewal'].includes(parentApplication.renewalStatus)) {
        return ResponseHelper.error(res, `Application cannot be renewed. Current renewal status: ${parentApplication.renewalStatus}`, 400);
      }

      // Check max renewals
      if (scheme.renewalSettings.maxRenewals > 0) {
        const renewalCount = await Application.countDocuments({
          parentApplication: parentApplication._id,
          franchise: req.franchiseId,
          isRenewal: true
        });
        if (renewalCount >= scheme.renewalSettings.maxRenewals) {
          return ResponseHelper.error(res, `Maximum renewals (${scheme.renewalSettings.maxRenewals}) reached`, 400);
        }
      }

      // Check if there's already a pending renewal
      const existingRenewal = await Application.findOne({
        parentApplication: parentApplication._id,
        franchise: req.franchiseId,
        isRenewal: true,
        status: { $nin: ['rejected', 'cancelled'] }
      });
      if (existingRenewal) {
        return ResponseHelper.error(res, 'A renewal application is already in progress', 400);
      }

      // Generate application number
      const applicationCount = await Application.countDocuments({ franchise: req.franchiseId });
      const year = new Date().getFullYear();
      const applicationNumber = `APP${year}${String(applicationCount + 1).padStart(6, '0')}`;

      // Calculate new renewal number
      const renewalNumber = (parentApplication.renewalNumber || 0) + 1;

      // Determine initial status based on requiresReapproval
      const requiresReapproval = scheme.renewalSettings.requiresReapproval !== false;
      const initialStatus = requiresReapproval ? 'pending' : 'approved';

      // Get application stages from scheme (if requires reapproval)
      const applicationStages = requiresReapproval ? getApplicationStagesFromScheme(scheme) : [];

      // Extract amount from form data
      const rawAmount = formData.requestedAmount || formData.field_12;
      const parsedAmount = (typeof rawAmount === 'number' || (typeof rawAmount === 'string' && !isNaN(Number(rawAmount))))
        ? Number(rawAmount)
        : null;
      const requestedAmount = parsedAmount || parentApplication.requestedAmount || scheme.benefits?.amount || 0;

      // Create renewal application
      const renewalApplication = new Application({
        applicationNumber,
        beneficiary: beneficiary._id,
        scheme: scheme._id,
        franchise: req.franchiseId,
        project: parentApplication.project,
        requestedAmount,
        formData,
        documents: documents || [],
        status: initialStatus,
        isRenewal: true,
        parentApplication: parentApplication._id,
        renewalNumber,
        state: beneficiary.state,
        district: beneficiary.district,
        area: beneficiary.area,
        unit: beneficiary.unit,
        applicationStages,
        currentStage: requiresReapproval ? 'Application Received' : 'Completed',
        createdBy: req.user._id,
        updatedBy: req.user._id
      });

      // If auto-approved, set approval details and renewal expiry
      if (!requiresReapproval) {
        renewalApplication.approvedAmount = requestedAmount;
        renewalApplication.approvedAt = new Date();
        renewalApplication.approvalComments = 'Auto-approved renewal';

        // Set renewal expiry for the new application
        const approvedDate = renewalApplication.approvedAt;
        const expiryDate = new Date(approvedDate);
        expiryDate.setDate(expiryDate.getDate() + (scheme.renewalSettings.renewalPeriodDays || 365));
        renewalApplication.expiryDate = expiryDate;

        const renewalDueDate = new Date(expiryDate);
        renewalDueDate.setDate(renewalDueDate.getDate() - (scheme.renewalSettings.autoNotifyBeforeDays || 30));
        renewalApplication.renewalDueDate = renewalDueDate;
        renewalApplication.renewalStatus = 'active';
      } else {
        renewalApplication.renewalStatus = 'not_applicable'; // Will be set when approved
      }

      await renewalApplication.save();

      // Mark parent application as renewed
      parentApplication.renewalStatus = 'renewed';
      await parentApplication.save();

      console.log(`✅ Renewal application ${applicationNumber} created (renewal #${renewalNumber}) for parent ${parentApplication.applicationNumber}`);

      return ResponseHelper.success(res, {
        application: {
          _id: renewalApplication._id,
          applicationNumber: renewalApplication.applicationNumber,
          status: renewalApplication.status,
          isRenewal: true,
          renewalNumber,
          parentApplicationNumber: parentApplication.applicationNumber,
          autoApproved: !requiresReapproval
        }
      }, `Renewal application submitted successfully${!requiresReapproval ? ' (auto-approved)' : ''}`);
    } catch (error) {
      console.error('❌ Submit Renewal Error:', error);
      return ResponseHelper.error(res, error.message, 500);
    }
  }

  /**
   * Save a new draft or update existing draft
   * POST /api/beneficiary/applications/draft
   */
  async saveDraft(req, res) {
    try {
      const { schemeId, formData, documents, currentPage } = req.body;
      const userId = req.user._id;

      if (!schemeId) {
        return ResponseHelper.error(res, 'Scheme ID is required', 400);
      }

      if (!mongoose.Types.ObjectId.isValid(schemeId)) {
        return ResponseHelper.error(res, 'Invalid scheme ID', 400);
      }

      // Check if scheme exists and is active
      const scheme = await Scheme.findOne({ _id: schemeId, franchise: req.franchiseId });
      if (!scheme) {
        return ResponseHelper.error(res, 'Scheme not found', 404);
      }

      if (scheme.status !== 'active') {
        return ResponseHelper.error(res, 'Scheme is not currently accepting applications', 400);
      }

      // Get user's profile location data
      const user = await User.findById(userId).select('profile');
      if (!user?.profile?.location?.district || !user?.profile?.location?.area || !user?.profile?.location?.unit) {
        return ResponseHelper.error(res, 'Please complete your profile with location information before applying', 400);
      }

      // Find or create beneficiary record
      let beneficiary = await Beneficiary.findOne({ phone: req.user.phone, franchise: req.franchiseId });
      if (!beneficiary) {
        const district = await Location.findById(user.profile.location.district);
        if (!district || !district.parent) {
          return ResponseHelper.error(res, 'Invalid location data. Please update your profile.', 400);
        }
        beneficiary = new Beneficiary({
          name: req.user.name,
          phone: req.user.phone,
          franchise: req.franchiseId,
          state: district.parent,
          district: user.profile.location.district,
          area: user.profile.location.area,
          unit: user.profile.location.unit,
          status: 'active',
          isVerified: true,
          createdBy: userId
        });
        await beneficiary.save();
      }

      // Check for existing draft for this scheme
      let existingDraft = await Application.findOne({
        scheme: schemeId,
        beneficiary: beneficiary._id,
        franchise: req.franchiseId,
        status: 'draft'
      });

      if (existingDraft) {
        // Update existing draft
        existingDraft.formData = formData || existingDraft.formData;
        existingDraft.documents = documents || existingDraft.documents;
        existingDraft.draftMetadata = {
          lastSavedAt: new Date(),
          currentPage: currentPage || 0,
          completedPages: existingDraft.draftMetadata?.completedPages || [],
          autoSaved: req.body.autoSave || false
        };

        // Update requestedAmount if present in formData
        if (formData) {
          const rawAmount = formData.requestedAmount || formData.field_12;
          const parsedAmount = (typeof rawAmount === 'number' || (typeof rawAmount === 'string' && !isNaN(Number(rawAmount))))
            ? Number(rawAmount) : null;
          if (parsedAmount) existingDraft.requestedAmount = parsedAmount;
        }

        await existingDraft.save();

        return ResponseHelper.success(res, {
          draft: {
            _id: existingDraft._id,
            applicationNumber: existingDraft.applicationNumber,
            lastSavedAt: existingDraft.draftMetadata.lastSavedAt
          }
        }, 'Draft updated successfully');
      }

      // Check for existing non-draft application
      const existingApp = await Application.findOne({
        scheme: schemeId,
        beneficiary: beneficiary._id,
        franchise: req.franchiseId,
        status: { $nin: ['rejected', 'cancelled', 'draft'] }
      });

      if (existingApp) {
        return ResponseHelper.error(res, 'You have already applied for this scheme', 400);
      }

      // Generate application number
      const applicationCount = await Application.countDocuments({ franchise: req.franchiseId });
      const year = new Date().getFullYear();
      const applicationNumber = `APP${year}${String(applicationCount + 1).padStart(6, '0')}`;

      // Create new draft
      const draft = new Application({
        applicationNumber,
        beneficiary: beneficiary._id,
        scheme: schemeId,
        franchise: req.franchiseId,
        project: scheme.project,
        requestedAmount: 0,
        formData: formData || {},
        status: 'draft',
        state: beneficiary.state,
        district: beneficiary.district,
        area: beneficiary.area,
        unit: beneficiary.unit,
        createdBy: userId,
        documents: documents || [],
        draftMetadata: {
          lastSavedAt: new Date(),
          currentPage: currentPage || 0,
          completedPages: [],
          autoSaved: req.body.autoSave || false
        }
      });

      await draft.save();

      // Add to beneficiary's applications array
      beneficiary.applications.push(draft._id);
      await beneficiary.save();

      console.log('📝 Draft saved:', applicationNumber);

      return ResponseHelper.success(res, {
        draft: {
          _id: draft._id,
          applicationNumber: draft.applicationNumber,
          lastSavedAt: draft.draftMetadata.lastSavedAt
        }
      }, 'Draft saved successfully', 201);

    } catch (error) {
      console.error('❌ Save Draft Error:', error);
      return ResponseHelper.error(res, error.message, 500);
    }
  }

  /**
   * Update an existing draft
   * PUT /api/beneficiary/applications/draft/:id
   */
  async updateDraft(req, res) {
    try {
      const { id } = req.params;
      const { formData, documents, currentPage, autoSave } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return ResponseHelper.error(res, 'Invalid draft ID', 400);
      }

      // Find beneficiary
      const beneficiary = await Beneficiary.findOne({ phone: req.user.phone, franchise: req.franchiseId });
      if (!beneficiary) {
        return ResponseHelper.error(res, 'Beneficiary record not found', 404);
      }

      const draft = await Application.findOne({
        _id: id,
        beneficiary: beneficiary._id,
        franchise: req.franchiseId,
        status: 'draft'
      });

      if (!draft) {
        return ResponseHelper.error(res, 'Draft not found', 404);
      }

      // Update draft fields
      if (formData) draft.formData = formData;
      if (documents) draft.documents = documents;
      
      // Update requestedAmount if present in formData
      if (formData) {
        const rawAmount = formData.requestedAmount || formData.field_12;
        const parsedAmount = (typeof rawAmount === 'number' || (typeof rawAmount === 'string' && !isNaN(Number(rawAmount))))
          ? Number(rawAmount) : null;
        if (parsedAmount) draft.requestedAmount = parsedAmount;
      }

      draft.draftMetadata = {
        lastSavedAt: new Date(),
        currentPage: currentPage !== undefined ? currentPage : (draft.draftMetadata?.currentPage || 0),
        completedPages: draft.draftMetadata?.completedPages || [],
        autoSaved: autoSave || false
      };

      await draft.save();

      return ResponseHelper.success(res, {
        draft: {
          _id: draft._id,
          applicationNumber: draft.applicationNumber,
          lastSavedAt: draft.draftMetadata.lastSavedAt
        }
      }, 'Draft updated successfully');

    } catch (error) {
      console.error('❌ Update Draft Error:', error);
      return ResponseHelper.error(res, error.message, 500);
    }
  }

  /**
   * Get draft for a specific scheme
   * GET /api/beneficiary/applications/draft/scheme/:schemeId
   */
  async getDraftForScheme(req, res) {
    try {
      const { schemeId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(schemeId)) {
        return ResponseHelper.error(res, 'Invalid scheme ID', 400);
      }

      // Find beneficiary
      const beneficiary = await Beneficiary.findOne({ phone: req.user.phone, ...buildFranchiseReadFilter(req) });
      if (!beneficiary) {
        return ResponseHelper.success(res, { draft: null }, 'No draft found');
      }

      const draft = await Application.findOne({
        scheme: schemeId,
        beneficiary: beneficiary._id,
        ...buildFranchiseReadFilter(req),
        status: 'draft'
      }).populate('scheme', 'name category');

      if (!draft) {
        return ResponseHelper.success(res, { draft: null }, 'No draft found');
      }

      return ResponseHelper.success(res, {
        draft: {
          _id: draft._id,
          applicationNumber: draft.applicationNumber,
          formData: draft.formData,
          documents: draft.documents,
          draftMetadata: draft.draftMetadata,
          scheme: draft.scheme,
          createdAt: draft.createdAt,
          updatedAt: draft.updatedAt
        }
      }, 'Draft retrieved successfully');

    } catch (error) {
      console.error('❌ Get Draft Error:', error);
      return ResponseHelper.error(res, error.message, 500);
    }
  }

  /**
   * Delete a draft
   * DELETE /api/beneficiary/applications/draft/:id
   */
  async deleteDraft(req, res) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return ResponseHelper.error(res, 'Invalid draft ID', 400);
      }

      // Find beneficiary
      const beneficiary = await Beneficiary.findOne({ phone: req.user.phone, franchise: req.franchiseId });
      if (!beneficiary) {
        return ResponseHelper.error(res, 'Beneficiary record not found', 404);
      }

      const draft = await Application.findOneAndDelete({
        _id: id,
        beneficiary: beneficiary._id,
        franchise: req.franchiseId,
        status: 'draft'
      });

      if (!draft) {
        return ResponseHelper.error(res, 'Draft not found or already submitted', 404);
      }

      // Remove from beneficiary's applications array
      beneficiary.applications = beneficiary.applications.filter(
        appId => appId.toString() !== id
      );
      await beneficiary.save();

      return ResponseHelper.success(res, null, 'Draft deleted successfully');

    } catch (error) {
      console.error('❌ Delete Draft Error:', error);
      return ResponseHelper.error(res, error.message, 500);
    }
  }
}

module.exports = new BeneficiaryApplicationController();