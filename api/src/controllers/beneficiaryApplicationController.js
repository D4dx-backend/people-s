const { Application, Scheme, User, FormConfiguration, Beneficiary, Location } = require('../models');
const ResponseHelper = require('../utils/responseHelper');
const mongoose = require('mongoose');
const notificationService = require('../services/notificationService');

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
        status: 'active'
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
            status: { $in: ['approved', 'completed'] }
          });

          // Check if user has already applied
          const existingApplication = await Application.findOne({
            scheme: scheme._id,
            applicant: req.user._id,
            status: { $nin: ['rejected', 'cancelled'] }
          });

          // Check if scheme has a valid form configuration in database
          const hasValidFormConfig = await FormConfiguration.findOne({
            scheme: scheme._id,
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
            hasApplied: !!existingApplication,
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
        status: 'active'
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
        enabled: true
      }).select('title description pages submissionSettings isPublished');

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
        status: { $in: ['approved', 'completed'] }
      });

      // Check if user has already applied
      const existingApplication = await Application.findOne({
        scheme: scheme._id,
        applicant: req.user._id,
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
      const scheme = await Scheme.findById(schemeId).populate('project');
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
      let beneficiary = await Beneficiary.findOne({ phone: req.user.phone });
      
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
        status: { $nin: ['rejected'] }
      });

      if (existingApplication) {
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
      const applicationCount = await Application.countDocuments();
      const year = new Date().getFullYear();
      const applicationNumber = `APP${year}${String(applicationCount + 1).padStart(6, '0')}`;

      console.log('📝 Generated application number:', applicationNumber);
      console.log('📝 Form data received:', formData);

      // Create application with all required fields INCLUDING formData
      const application = new Application({
        applicationNumber: applicationNumber,
        beneficiary: beneficiary._id,
        scheme: schemeId,
        project: scheme.project?._id || scheme.project, // Handle if project is populated or just ID
        requestedAmount: requestedAmount,
        formData: formData, // ✅ SAVE THE FORM DATA!
        status: 'pending', // Use valid enum value
        state: beneficiary.state,
        district: beneficiary.district,
        area: beneficiary.area,
        unit: beneficiary.unit,
        createdBy: userId,
        documents: documents || []
      });

      console.log('📝 Application object before save:', {
        applicationNumber: application.applicationNumber,
        beneficiary: application.beneficiary,
        scheme: application.scheme,
        status: application.status,
        requestedAmount: application.requestedAmount,
        formDataKeys: Object.keys(formData || {})
      });

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
          submittedAt: application.createdAt
        }
      }, 'Application submitted successfully');

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
      const beneficiary = await Beneficiary.findOne({ phone: req.user.phone });
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
      const query = { beneficiary: beneficiary._id };
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
      const beneficiary = await Beneficiary.findOne({ phone: req.user.phone });
      if (!beneficiary) {
        return ResponseHelper.error(res, 'Beneficiary record not found', 404);
      }

      const application = await Application.findOne({
        _id: id,
        beneficiary: beneficiary._id
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
      const application = await Application.findOne({ applicationNumber: applicationId })
        .populate('scheme', 'name category benefits')
        .populate('beneficiary', 'name phone')
        .select('applicationNumber scheme status createdAt reviewedAt approvedAt requestedAmount approvedAmount');

      if (!application) {
        return ResponseHelper.error(res, 'Application not found', 404);
      }

      // Find beneficiary record to verify ownership
      const beneficiary = await Beneficiary.findOne({ phone: req.user.phone });
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
        applicant: applicantId
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
      const beneficiary = await Beneficiary.findOne({ phone: req.user.phone });
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
        { $match: { beneficiary: beneficiary._id } },
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
}

module.exports = new BeneficiaryApplicationController();