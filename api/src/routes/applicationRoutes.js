const express = require('express');
const { body } = require('express-validator');
const {
  getApplications,
  getApplication,
  createApplication,
  updateApplication,
  reviewApplication,
  approveApplication,
  deleteApplication,
  revertApplicationStage,
  updateApplicationStage,
  addStageComment,
  uploadStageDocument,
  getRenewalDueApplications,
  getRenewalHistory
} = require('../controllers/applicationController');
const { authenticate, authorize } = require('../middleware/auth');
const { syncApplicationStages } = require('../middleware/syncStages');
const { uploadSingle } = require('../middleware/upload');
const { createExportHandler } = require('../middleware/exportHandler');
const exportConfigs = require('../config/exportConfigs');
const Application = require('../models/Application');

const router = express.Router();

// Validation rules
const applicationValidation = [
  body('beneficiary')
    .isMongoId()
    .withMessage('Valid beneficiary ID is required'),
  body('scheme')
    .isMongoId()
    .withMessage('Valid scheme ID is required'),
  body('project')
    .optional()
    .isMongoId()
    .withMessage('Valid project ID is required'),
  body('requestedAmount')
    .isNumeric()
    .isFloat({ min: 1 })
    .withMessage('Requested amount must be a positive number'),
  body('documents')
    .optional()
    .isArray()
    .withMessage('Documents must be an array')
];

const updateApplicationValidation = [
  body('requestedAmount')
    .optional()
    .isNumeric()
    .isFloat({ min: 1 })
    .withMessage('Requested amount must be a positive number'),
  body('documents')
    .optional()
    .isArray()
    .withMessage('Documents must be an array'),
  body('status')
    .optional()
    .isIn(['pending', 'under_review', 'approved', 'rejected', 'completed'])
    .withMessage('Invalid status')
];

const reviewApplicationValidation = [
  body('status')
    .isIn(['under_review', 'approved', 'rejected'])
    .withMessage('Invalid review status'),
  body('comments')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Comments must be less than 500 characters')
];

const approveApplicationValidation = [
  body('approvedAmount')
    .isNumeric()
    .isFloat({ min: 1 })
    .withMessage('Approved amount must be a positive number'),
  body('comments')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Comments must be less than 500 characters')
];

// Routes

// Export applications as CSV or JSON
router.get('/export',
  authenticate,
  authorize('super_admin', 'state_admin', 'district_admin', 'area_admin', 'unit_admin'),
  createExportHandler(Application, exportConfigs.application)
);

// Renewal management routes (must come before /:id routes)
router.get('/renewal-due',
  authenticate,
  authorize('super_admin', 'state_admin', 'district_admin', 'area_admin', 'unit_admin'),
  getRenewalDueApplications
);

router.get('/:id/renewal-history',
  authenticate,
  authorize('super_admin', 'state_admin', 'district_admin', 'area_admin', 'unit_admin'),
  getRenewalHistory
);

router.get('/', 
  authenticate, 
  authorize('super_admin', 'state_admin', 'district_admin', 'area_admin', 'unit_admin'), 
  getApplications
);

router.get('/:id', 
  authenticate, 
  authorize('super_admin', 'state_admin', 'district_admin', 'area_admin', 'unit_admin'), 
  getApplication
);

router.post('/', 
  authenticate, 
  authorize('super_admin', 'state_admin', 'district_admin', 'area_admin', 'unit_admin'), 
  applicationValidation,
  syncApplicationStages, // Automatically sync stages from scheme
  createApplication
);

router.put('/:id', 
  authenticate, 
  authorize('super_admin', 'state_admin', 'district_admin', 'area_admin', 'unit_admin'), 
  updateApplicationValidation, 
  updateApplication
);

router.patch('/:id/review', 
  authenticate, 
  authorize('super_admin', 'state_admin', 'area_admin'), 
  reviewApplicationValidation, 
  reviewApplication
);

// Approve application - PATCH (keep for backward compatibility)
router.patch('/:id/approve', 
  authenticate, 
  authorize('super_admin', 'state_admin', 'area_admin'), 
  approveApplicationValidation, 
  approveApplication
);

// Approve application - PUT (preferred method)
router.put('/:id/approve', 
  authenticate, 
  authorize('super_admin', 'state_admin', 'area_admin'), 
  approveApplicationValidation, 
  approveApplication
);

router.delete('/:id', 
  authenticate, 
  authorize('super_admin', 'state_admin', 'district_admin', 'area_admin', 'unit_admin'), 
  deleteApplication
);

// Update application stage status (now includes district_admin, unit_admin)
router.patch('/:id/stages/:stageId', 
  authenticate, 
  authorize('super_admin', 'state_admin', 'district_admin', 'area_admin', 'unit_admin'), 
  updateApplicationStage
);

// Add comment to a stage
router.patch('/:id/stages/:stageId/comment', 
  authenticate, 
  authorize('super_admin', 'state_admin', 'district_admin', 'area_admin', 'unit_admin'), 
  addStageComment
);

// Upload document for a stage
router.post('/:id/stages/:stageId/documents/:docIndex', 
  authenticate, 
  authorize('super_admin', 'state_admin', 'district_admin', 'area_admin', 'unit_admin'), 
  uploadSingle('document'),
  uploadStageDocument
);

// Revert application to a previous stage
router.patch('/:id/revert', 
  authenticate, 
  authorize('super_admin', 'state_admin', 'district_admin', 'area_admin'), 
  revertApplicationStage
);

// Get applications pending committee approval
router.get('/committee/pending', 
  authenticate, 
  authorize('super_admin', 'state_admin', 'district_admin'), 
  async (req, res) => {
    try {
      const { page = 1, limit = 10, search = '' } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const Application = require('../models/Application');
      const Beneficiary = require('../models/Beneficiary');

      // Build filter
      const filter = { status: 'pending_committee_approval' };

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

      // Apply user scope filtering (bypass for super_admin and state_admin)
      const RBACMiddleware = require('../middleware/rbacMiddleware');
      if (req.user.role !== 'super_admin' && req.user.role !== 'state_admin') {
        const userScope = await RBACMiddleware.getUserScope(req.user);
        if (userScope.state) filter['location.state'] = userScope.state;
        if (userScope.district) filter['location.district'] = userScope.district;
      }

      const total = await Application.countDocuments(filter);
      const applications = await Application.find(filter)
        .populate('beneficiary', 'name phone email location')
        .populate('scheme', 'name category')
        .populate('project', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

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
      console.error('Error fetching pending committee applications:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch applications'
      });
    }
  }
);

// Committee decision on application
router.patch('/:id/committee-decision', 
  authenticate, 
  authorize('super_admin', 'state_admin', 'district_admin'), 
  async (req, res) => {
    try {
      const { id } = req.params;
      const { decision, comments, distributionTimeline, isRecurring, recurringConfig } = req.body;

      if (!decision || !['approved', 'rejected'].includes(decision)) {
        return res.status(400).json({
          success: false,
          message: 'Valid decision (approved or rejected) is required'
        });
      }

      const Application = require('../models/Application');
      const application = await Application.findById(id);

      if (!application) {
        return res.status(404).json({
          success: false,
          message: 'Application not found'
        });
      }

      if (application.status !== 'pending_committee_approval') {
        return res.status(400).json({
          success: false,
          message: 'Application is not pending committee approval'
        });
      }

      // Update application with committee decision
      application.status = decision;
      application.committeeApprovedBy = req.user._id;
      application.committeeApprovedAt = new Date();
      application.committeeComments = comments;

      // Handle recurring payments
      if (decision === 'approved' && isRecurring && recurringConfig) {
        application.isRecurring = true;
        application.recurringConfig = {
          ...recurringConfig,
          status: 'active'
        };
        
        // Calculate total recurring amount
        if (recurringConfig.hasDistributionTimeline && recurringConfig.distributionTimeline) {
          // Timeline + recurring: total = timeline amount × number of cycles
          const timelineTotal = recurringConfig.distributionTimeline.reduce((sum, phase) => sum + (phase.amount || 0), 0);
          application.recurringConfig.totalRecurringAmount = timelineTotal * recurringConfig.numberOfPayments;
          application.approvedAmount = timelineTotal; // Approved amount per cycle
        } else {
          // Simple recurring: total = amount per payment × number of cycles
          application.recurringConfig.totalRecurringAmount = recurringConfig.amountPerPayment * recurringConfig.numberOfPayments;
          application.approvedAmount = recurringConfig.amountPerPayment * recurringConfig.numberOfPayments;
        }
      } else if (decision === 'approved' && distributionTimeline && Array.isArray(distributionTimeline)) {
        // Non-recurring with timeline
        application.distributionTimeline = distributionTimeline;
        application.approvedAmount = distributionTimeline.reduce((sum, phase) => sum + (phase.amount || 0), 0);
      }

      // Set renewal expiry if scheme supports renewals (committee approval path)
      if (decision === 'approved') {
        const Scheme = require('../models/Scheme');
        const scheme = await Scheme.findById(application.scheme);
        if (scheme?.renewalSettings?.isRenewable) {
          const approvedDate = new Date();
          application.approvedAt = approvedDate;
          const expiryDate = new Date(approvedDate);
          expiryDate.setDate(expiryDate.getDate() + (scheme.renewalSettings.renewalPeriodDays || 365));
          application.expiryDate = expiryDate;

          const renewalDueDate = new Date(expiryDate);
          renewalDueDate.setDate(renewalDueDate.getDate() - (scheme.renewalSettings.autoNotifyBeforeDays || 30));
          application.renewalDueDate = renewalDueDate;

          application.renewalStatus = 'active';
          application.renewalNotificationSent = false;
          console.log(`📅 Committee approval - Renewal set: expires ${expiryDate.toISOString()}`);
        }
      }

      await application.save();

      // Generate recurring payment schedule if recurring
      if (decision === 'approved' && isRecurring && recurringConfig) {
        try {
          const recurringPaymentService = require('../services/recurringPaymentService');
          const schedule = await recurringPaymentService.generatePaymentSchedule(application._id);
          console.log(`✅ Generated ${schedule.length} recurring payment records`);
        } catch (recurringError) {
          console.error('❌ Error generating recurring schedule:', recurringError);
        }
      }
      // Create payment records for non-recurring approved applications with timeline
      else if (decision === 'approved' && distributionTimeline && Array.isArray(distributionTimeline)) {
        try {
          const Payment = require('../models/Payment');
          
          console.log('💰 Creating payment records for approved application');
          
          for (let index = 0; index < distributionTimeline.length; index++) {
            const phase = distributionTimeline[index];
            const paymentData = {
              application: application._id,
              beneficiary: application.beneficiary,
              scheme: application.scheme,
              project: application.project,
              amount: phase.amount,
              type: 'installment',
              method: 'bank_transfer',
              installment: {
                number: index + 1,
                totalInstallments: distributionTimeline.length,
                description: phase.description
              },
              timeline: {
                initiatedAt: new Date(),
                expectedCompletionDate: phase.expectedDate
              },
              status: 'pending',
              initiatedBy: req.user._id,
              location: {
                state: application.location?.state,
                district: application.location?.district,
                area: application.location?.area,
                unit: application.location?.unit
              }
            };
            
            const payment = await Payment.create(paymentData);
            console.log(`✅ Payment ${index + 1}/${distributionTimeline.length} created:`, payment.paymentNumber);
          }
          
          console.log(`✅ Created ${distributionTimeline.length} payment records`);
        } catch (paymentError) {
          console.error('❌ Error creating payments:', paymentError);
          // Don't fail the whole request if payment creation fails
        }
      }

      // Create a report entry for the committee decision
      try {
        const Report = require('../models/Report');
        const reportTitle = decision === 'approved' 
          ? 'Committee Approved Application' 
          : 'Committee Rejected Application';
        
        await Report.create({
          type: 'application_decision',
          title: reportTitle,
          description: comments || `Application ${application.applicationNumber} was ${decision} by committee`,
          generatedBy: req.user._id,
          relatedApplication: application._id,
          data: {
            applicationNumber: application.applicationNumber,
            decision: decision,
            committeeComments: comments,
            distributionTimeline: distributionTimeline
          }
        });
      } catch (reportError) {
        console.error('❌ Error creating report:', reportError);
      }

      res.json({
        success: true,
        message: `Application ${decision} successfully`,
        data: { application }
      });
    } catch (error) {
      console.error('Error processing committee decision:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to process committee decision'
      });
    }
  }
);

module.exports = router;