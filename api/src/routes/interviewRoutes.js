const express = require('express');
const router = express.Router();

const notificationService = require('../services/notificationService');
const Application = require('../models/Application');
const Interview = require('../models/Interview');
const { authenticate, crossFranchiseResolver } = require('../middleware/auth');
const RBACMiddleware = require('../middleware/rbacMiddleware');
const { validate } = require('../middleware/validation');
const Joi = require('joi');

// Validation schemas
const scheduleInterviewSchema = Joi.object({
  date: Joi.string().isoDate().required(),
  time: Joi.string().required(),
  type: Joi.string().valid('offline', 'online').required(),
  location: Joi.string().when('type', {
    is: 'offline',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  meetingLink: Joi.string().when('type', {
    is: 'online',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  interviewers: Joi.array().items(Joi.string()).optional(),
  notes: Joi.string().optional()
});

const updateInterviewSchema = Joi.object({
  date: Joi.string().isoDate().optional(),
  time: Joi.string().optional(),
  type: Joi.string().valid('offline', 'online').optional(),
  location: Joi.string().optional(),
  meetingLink: Joi.string().optional(),
  interviewers: Joi.array().items(Joi.string()).optional(),
  notes: Joi.string().optional(),
  result: Joi.string().valid('pending', 'passed', 'failed').optional()
});

/**
 * @swagger
 * /api/interviews:
 *   get:
 *     summary: Get all scheduled interviews
 *     tags: [Interviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [scheduled, completed, cancelled]
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of interviews retrieved successfully
 */
router.get('/', 
  authenticate, crossFranchiseResolver,
  RBACMiddleware.hasPermission('interviews.read'),
  async (req, res) => {
    try {
      const { 
        page = 1, 
        limit = 10, 
        status = 'all',
        date,
        search 
      } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      // Build query for interviews
      let query = {};

      // Apply user scope filtering (bypass for super_admin and state_admin)
      const isSuperAdmin = req.user.role === 'super_admin';
      const isStateAdmin = req.user.role === 'state_admin';
      
      if (!isSuperAdmin && !isStateAdmin) {
        const userScope = await RBACMiddleware.getUserScope(req.user);
        if (userScope.regions && userScope.regions.length > 0) {
          // Since interviews don't have direct region fields, we need to filter through applications
          const Application = require('../models/Application');
          const applicationsInScope = await Application.find({
            $or: [
              { state: { $in: userScope.regions } },
              { district: { $in: userScope.regions } },
              { area: { $in: userScope.regions } },
              { unit: { $in: userScope.regions } }
            ]
          }).select('_id');
          
          const applicationIds = applicationsInScope.map(app => app._id);
          query.application = { $in: applicationIds };
        }
      }

      // Filter by status
      if (status !== 'all') {
        query.status = status;
      }

      // Filter by date
      if (date) {
        const targetDate = new Date(date);
        const nextDay = new Date(targetDate);
        nextDay.setDate(nextDay.getDate() + 1);
        
        query.scheduledDate = {
          $gte: targetDate,
          $lt: nextDay
        };
      }

      const interviews = await Interview.find(query)
        .populate({
          path: 'application',
          populate: [
            { path: 'beneficiary', select: 'name phone' },
            { path: 'scheme', select: 'name code' },
            { path: 'project', select: 'name code' },
            { path: 'state', select: 'name code' },
            { path: 'district', select: 'name code' },
            { path: 'area', select: 'name code' },
            { path: 'unit', select: 'name code' }
          ]
        })
        .populate('scheduledBy', 'name')
        .populate('interviewers', 'name')
        .populate('completedBy', 'name')
        .sort({ scheduledDate: 1 })
        .skip(skip)
        .limit(parseInt(limit));

      // Apply search filter after population if needed
      let filteredInterviews = interviews;
      if (search) {
        const searchRegex = new RegExp(search, 'i');
        filteredInterviews = interviews.filter(interview => 
          interview.application.applicationNumber.match(searchRegex) ||
          interview.application.beneficiary.name.match(searchRegex)
        );
      }

      const total = await Interview.countDocuments(query);

      // Transform data for frontend
      const interviewData = filteredInterviews.map(interview => ({
        id: interview._id,
        interviewNumber: interview.interviewNumber,
        applicationId: interview.application._id,
        applicationNumber: interview.application.applicationNumber,
        applicantName: interview.application.beneficiary.name,
        applicantPhone: interview.application.beneficiary.phone,
        projectName: interview.application.project?.name || 'N/A',
        schemeName: interview.application.scheme.name,
        date: interview.scheduledDate,
        time: interview.scheduledTime,
        type: interview.type,
        location: interview.location,
        meetingLink: interview.meetingLink,
        interviewers: interview.interviewers?.map(i => i.name) || [],
        status: interview.status,
        notes: interview.notes,
        result: interview.result,
        scheduledBy: interview.scheduledBy?.name,
        scheduledAt: interview.scheduledAt,
        completedAt: interview.completedAt,
        completedBy: interview.completedBy?.name,
        rescheduleCount: interview.rescheduleCount,
        state: interview.application.state.name,
        district: interview.application.district.name,
        area: interview.application.area.name,
        unit: interview.application.unit.name
      }));

      res.json({
        success: true,
        message: 'Interviews retrieved successfully',
        data: {
          interviews: interviewData,
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
      console.error('Error fetching interviews:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch interviews',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * @swagger
 * /api/interviews/schedule/{applicationId}:
 *   post:
 *     summary: Schedule an interview for an application
 *     tags: [Interviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - date
 *               - time
 *               - type
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *               time:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [offline, online]
 *               location:
 *                 type: string
 *               meetingLink:
 *                 type: string
 *               interviewers:
 *                 type: array
 *                 items:
 *                   type: string
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Interview scheduled successfully
 */
router.post('/schedule/:applicationId',
  authenticate, crossFranchiseResolver,
  // RBACMiddleware.hasPermission('interviews.schedule'), // Temporarily disabled for debugging
  validate(scheduleInterviewSchema),
  async (req, res) => {
    try {
      const { applicationId } = req.params;
      const { date, time, type, location, meetingLink, interviewers, notes } = req.body;

      console.log('Scheduling interview for application:', applicationId);
      console.log('Request body:', req.body);

      // Build query based on applicationId format
      let query = {};
      if (applicationId.match(/^[0-9a-fA-F]{24}$/)) {
        // It's a valid ObjectId
        query = {
          $or: [
            { _id: applicationId },
            { applicationNumber: applicationId }
          ]
        };
      } else {
        // It's likely an application number
        query = { applicationNumber: applicationId };
      }

      const application = await Application.findOne(query);
      console.log('Found application:', application ? application.applicationNumber : 'Not found');

      if (!application) {
        return res.status(404).json({
          success: false,
          message: 'Application not found',
          timestamp: new Date().toISOString()
        });
      }

      // Check if user has permission to schedule interview for this application
      // Temporarily disabled for debugging
      // const hasPermission = await RBACMiddleware.checkApplicationAccess(req.user, application);
      // if (!hasPermission) {
      //   return res.status(403).json({
      //     success: false,
      //     message: 'Access denied for this application',
      //     timestamp: new Date().toISOString()
      //   });
      // }

      // Create new interview record
      const interview = new Interview({
        application: application._id,
        scheduledDate: new Date(date),
        scheduledTime: time,
        type,
        location: type === 'offline' ? location : undefined,
        meetingLink: type === 'online' ? meetingLink : undefined,
        interviewers: interviewers || [],
        scheduledBy: req.user._id,
        createdBy: req.user._id,
        notes
      });

      await interview.save();

      // Update application status
      application.status = 'interview_scheduled';
      await application.save();

      // Populate for response
      await application.populate('beneficiary', 'name phone');
      await application.populate('scheme', 'name');
      await application.populate('project', 'name');

      // Notify beneficiary + unit admin
      notificationService
        .notifyInterviewScheduled(application, interview, { createdBy: req.user._id })
        .catch(err => console.error('❌ Interview scheduled notification failed:', err));

      res.json({
        success: true,
        message: 'Interview scheduled successfully',
        data: {
          interview: {
            id: interview._id,
            interviewNumber: interview.interviewNumber,
            applicationNumber: application.applicationNumber,
            applicantName: application.beneficiary.name,
            scheduledDate: interview.scheduledDate,
            scheduledTime: interview.scheduledTime,
            type: interview.type,
            location: interview.location,
            meetingLink: interview.meetingLink
          }
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error scheduling interview:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        applicationId: req.params.applicationId,
        body: req.body
      });
      res.status(500).json({
        success: false,
        message: 'Failed to schedule interview',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * @swagger
 * /api/interviews/{applicationId}:
 *   put:
 *     summary: Update interview details
 *     tags: [Interviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *               time:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [offline, online]
 *               location:
 *                 type: string
 *               meetingLink:
 *                 type: string
 *               interviewers:
 *                 type: array
 *                 items:
 *                   type: string
 *               notes:
 *                 type: string
 *               result:
 *                 type: string
 *                 enum: [pending, passed, failed]
 *     responses:
 *       200:
 *         description: Interview updated successfully
 */
router.put('/:applicationId',
  authenticate, crossFranchiseResolver,
  RBACMiddleware.hasPermission('interviews.update'),
  validate(updateInterviewSchema),
  async (req, res) => {
    try {
      const { applicationId } = req.params;
      const updateData = req.body;

      // Find the application
      const application = await Application.findOne({
        $or: [
          { _id: applicationId },
          { applicationNumber: applicationId }
        ]
      });

      if (!application) {
        return res.status(404).json({
          success: false,
          message: 'Application not found',
          timestamp: new Date().toISOString()
        });
      }

      console.log('🔍 Looking for active interview for application:', application._id);
      
      // Find the active interview for this application
      const activeInterview = await Interview.getActiveInterview(application._id);
      
      console.log('📋 Active interview found:', activeInterview ? activeInterview.interviewNumber : 'None');
      
      if (!activeInterview) {
        // Try to find any interview for this application
        const anyInterview = await Interview.findOne({ application: application._id });
        console.log('📋 Any interview found:', anyInterview ? anyInterview.interviewNumber : 'None');
        
        return res.status(404).json({
          success: false,
          message: 'No active interview found for this application',
          timestamp: new Date().toISOString()
        });
      }

      // Check permission
      const hasPermission = await RBACMiddleware.checkApplicationAccess(req.user, application);
      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: 'Access denied for this application',
          timestamp: new Date().toISOString()
        });
      }

      console.log('🔄 Rescheduling interview with data:', updateData);
      
      // Reschedule the interview (creates new interview record and marks old one as rescheduled)
      const newInterview = await activeInterview.reschedule({
        scheduledDate: updateData.date ? new Date(updateData.date) : activeInterview.scheduledDate,
        scheduledTime: updateData.time || activeInterview.scheduledTime,
        type: updateData.type || activeInterview.type,
        location: updateData.location !== undefined ? updateData.location : activeInterview.location,
        meetingLink: updateData.meetingLink !== undefined ? updateData.meetingLink : activeInterview.meetingLink,
        interviewers: updateData.interviewers || activeInterview.interviewers,
        notes: updateData.notes || activeInterview.notes
      }, 'Interview rescheduled via API', req.user._id);
      
      console.log('✅ New interview created:', newInterview.interviewNumber);

      await newInterview.populate('scheduledBy', 'name');

      // Populate application for notifications
      await application.populate('beneficiary', 'name phone');
      await application.populate('scheme', 'name');
      await application.populate('project', 'name');

      // Notify beneficiary + unit/area admin about reschedule
      notificationService
        .notifyInterviewRescheduled(application, newInterview, { createdBy: req.user._id })
        .catch(err => console.error('❌ Interview rescheduled notification failed:', err));

      res.json({
        success: true,
        message: 'Interview rescheduled successfully',
        data: {
          interview: {
            id: newInterview._id,
            interviewNumber: newInterview.interviewNumber,
            scheduledDate: newInterview.scheduledDate,
            scheduledTime: newInterview.scheduledTime,
            type: newInterview.type,
            location: newInterview.location,
            meetingLink: newInterview.meetingLink,
            rescheduleCount: newInterview.rescheduleCount
          }
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Error updating interview:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        applicationId: req.params.applicationId,
        body: req.body
      });
      res.status(500).json({
        success: false,
        message: 'Failed to update interview',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * @swagger
 * /api/interviews/{id}/complete:
 *   patch:
 *     summary: Mark interview as completed
 *     tags: [Interviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Interview ID or Application ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - result
 *             properties:
 *               result:
 *                 type: string
 *                 enum: [passed, failed]
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Interview completed successfully
 */
router.patch('/:id/complete',
  authenticate, crossFranchiseResolver,
  RBACMiddleware.hasPermission('interviews.update'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { result, notes, forwardToCommittee, interviewReport, isRecurring, recurringConfig } = req.body;

      console.log('🔍 Completing interview with ID:', id);
      console.log('📝 Request data:', { result, notes, forwardToCommittee, isRecurring });

      let interview = null;
      let application = null;

      // First, try to find by interview ID
      if (id.match(/^[0-9a-fA-F]{24}$/)) {
        interview = await Interview.findById(id);
        console.log('📋 Found interview by ID:', interview ? interview.interviewNumber : 'Not found');
        
        if (interview) {
          // Get the application for this interview
          application = await Application.findById(interview.application);
          console.log('📄 Found application:', application ? application.applicationNumber : 'Not found');
        }
      }

      // If not found by interview ID, try to find by application ID/number
      if (!interview) {
        console.log('🔍 Trying to find by application ID/number:', id);
        
        // Build query based on whether id is a valid ObjectId
        const mongoose = require('mongoose');
        let query;
        if (mongoose.Types.ObjectId.isValid(id) && id.match(/^[0-9a-fA-F]{24}$/)) {
          // Valid ObjectId format - search by both _id and applicationNumber
          query = {
            $or: [
              { _id: id },
              { applicationNumber: id }
            ]
          };
        } else {
          // Not a valid ObjectId - only search by applicationNumber
          query = { applicationNumber: id };
        }
        
        application = await Application.findOne(query);

        if (application) {
          console.log('📄 Found application:', application.applicationNumber);
          
          // Find the interview for this application (scheduled or completed for editing)
          interview = await Interview.findOne({ 
            application: application._id,
            status: { $in: ['scheduled', 'completed'] }
          });
          
          console.log('📋 Found scheduled interview:', interview ? interview.interviewNumber : 'Not found');
        }
      }

      if (!application) {
        console.log('❌ Application not found');
        return res.status(404).json({
          success: false,
          message: 'Application not found',
          timestamp: new Date().toISOString()
        });
      }

      if (!interview) {
        console.log('❌ No interview found');
        return res.status(404).json({
          success: false,
          message: 'Interview not found',
          timestamp: new Date().toISOString()
        });
      }

      // Check permission
      console.log('🔐 Checking access for user:', {
        userId: req.user._id,
        role: req.user.role,
        applicationId: application._id,
        applicationNumber: application.applicationNumber
      });
      
      // Super admin and state admin have full access
      if (req.user.role !== 'super_admin' && req.user.role !== 'state_admin') {
        const hasPermission = await RBACMiddleware.checkApplicationAccess(req.user, application);
        if (!hasPermission) {
          console.log('❌ Access denied for user:', req.user.role);
          return res.status(403).json({
            success: false,
            message: 'Access denied for this application',
            timestamp: new Date().toISOString()
          });
        }
      }
      
      console.log('✅ Access granted');
      console.log('✅ Completing interview:', interview.interviewNumber);

      // Update the Interview document
      const wasAlreadyCompleted = interview.status === 'completed';
      interview.status = 'completed';
      interview.result = result;
      if (!wasAlreadyCompleted) {
        interview.completedAt = new Date();
        interview.completedBy = req.user._id;
      }
      if (notes) {
        interview.notes = notes;
      }
      await interview.save();

      console.log('✅ Interview updated successfully', wasAlreadyCompleted ? '(edited)' : '(completed)');

      // Also update the application status and interview info
      if (result === 'passed') {
        // If forwarding to committee, set status to pending_committee_approval
        if (forwardToCommittee) {
          application.status = 'pending_committee_approval';
          if (interviewReport) {
            application.interviewReport = interviewReport;
          }
          
          // Note: When forwarding to committee, we don't set isRecurring or recurringConfig
          // The committee will configure these during their approval process
          if (isRecurring) {
            console.log('🔄 Application marked for recurring payments - will be configured by committee');
          }
          
          console.log('📋 Application forwarded to committee approval');
        } else {
          application.status = 'approved'; // Move to approved status if interview passed
          
          // Handle recurring payments for direct approvals
          if (isRecurring && recurringConfig) {
            application.isRecurring = true;
            application.recurringConfig = {
              ...recurringConfig,
              status: 'active'
            };
            
            // Calculate total recurring amount
            if (recurringConfig.hasDistributionTimeline && recurringConfig.distributionTimeline) {
              const timelineTotal = recurringConfig.distributionTimeline.reduce((sum, phase) => sum + (phase.amount || 0), 0);
              application.recurringConfig.totalRecurringAmount = timelineTotal * recurringConfig.numberOfPayments;
              application.approvedAmount = timelineTotal;
            } else {
              application.recurringConfig.totalRecurringAmount = recurringConfig.amountPerPayment * recurringConfig.numberOfPayments;
              application.approvedAmount = recurringConfig.amountPerPayment * recurringConfig.numberOfPayments;
            }
            console.log('🔄 Recurring payment configured:', application.recurringConfig);
          }
        }
      } else {
        application.status = 'rejected'; // Move to rejected status if interview failed
      }
      
      if (!application.interview) {
        application.interview = {};
      }
      application.interview.result = result;
      if (!wasAlreadyCompleted) {
        application.interview.completedAt = new Date();
      }
      if (notes) {
        application.interview.notes = notes;
      }

      // Save distribution timeline if provided (for approved applications)
      if (result === 'passed' && req.body.distributionTimeline && Array.isArray(req.body.distributionTimeline)) {
        application.distributionTimeline = req.body.distributionTimeline;
        console.log('💰 Distribution timeline saved:', req.body.distributionTimeline.length, 'phases');
      }

      console.log('💾 Saving application with status:', application.status);
      console.log('💾 Application interview data:', JSON.stringify(application.interview, null, 2));
      
      // Mark the document as modified to ensure save triggers
      application.markModified('interview');
      application.markModified('status');
      
      try {
        const savedApp = await application.save();
        console.log('✅ Application updated successfully, new status:', savedApp.status);
        
        // Generate recurring payment schedule if approved with recurring payments
        if (result === 'passed' && !forwardToCommittee && isRecurring && recurringConfig) {
          try {
            console.log('🔄 Generating recurring payment schedule for application:', savedApp._id);
            const RecurringPaymentService = require('../services/recurringPaymentService');
            const service = new RecurringPaymentService();
            const generatedPayments = await service.generatePaymentSchedule(savedApp._id);
            console.log(`✅ Generated ${generatedPayments.length} recurring payment records`);
          } catch (recurringError) {
            console.error('❌ Failed to generate recurring payment schedule:', recurringError);
            // Don't fail the whole request, just log the error
          }
        }
      } catch (saveError) {
        console.error('❌ Error saving application:', saveError);
        console.error('❌ Error name:', saveError.name);
        console.error('❌ Error message:', saveError.message);
        if (saveError.errors) {
          console.error('❌ Validation errors:', JSON.stringify(saveError.errors, null, 2));
        }
        console.error('Application data:', {
          id: application._id,
          status: application.status,
          interview: application.interview
        });
        
        // Return error response immediately
        return res.status(400).json({
          success: false,
          message: 'Failed to save application',
          error: saveError.message,
          validationErrors: saveError.errors,
          timestamp: new Date().toISOString()
        });
      }

      // Create a report entry for the approval/rejection decision
      try {
        const Report = require('../models/Report');
        const reportTitle = result === 'passed' 
          ? 'Interview Passed - Application Approved' 
          : 'Interview Failed - Application Rejected';
        
        const report = new Report({
          application: application._id,
          reportDate: new Date(),
          reportType: 'interview',
          title: reportTitle,
          details: notes || `Interview ${result}. ${result === 'passed' ? 'Application has been approved.' : 'Application has been rejected.'}`,
          status: 'submitted',
          priority: result === 'passed' ? 'high' : 'medium',
          followUpRequired: false,
          isPublic: true,
          createdBy: req.user._id
        });

        await report.save();
        console.log('✅ Report created for interview decision:', report.reportNumber);
      } catch (reportError) {
        console.error('⚠️ Error creating report:', reportError);
        // Don't fail the interview completion if report creation fails
      }

      // If interview passed AND NOT forwarding to committee, create payment schedule/disbursement
      // If forwarding to committee, payments will be created after committee approval
      if (result === 'passed' && !forwardToCommittee && application.requestedAmount) {
        try {
          // If recurring payments are enabled, generate recurring schedule
          if (isRecurring && recurringConfig) {
            const recurringPaymentService = require('../services/recurringPaymentService');
            const schedule = await recurringPaymentService.generatePaymentSchedule(application._id);
            console.log(`✅ Generated ${schedule.length} recurring payment records`);
          } 
          // Otherwise create regular payments based on distribution timeline
          else if (application.distributionTimeline && application.distributionTimeline.length > 0) {
            const Payment = require('../models/Payment');
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
                  expectedCompletionDate: new Date(timeline.expectedDate),
                  approvedAt: new Date()
                },
                approvals: [{
                  level: 'finance',
                  approver: req.user._id,
                  status: 'approved',
                  approvedAt: new Date(),
                  comments: 'Approved after successful interview'
                }],
                metadata: {
                  notes: `Approved after interview. ${notes || ''}`.trim()
                },
                initiatedBy: req.user._id
              });

              await payment.save();
              console.log('✅ Payment record created:', paymentNumber, 'for phase', i + 1);
            }
          } else {
            // Create single payment if no distribution timeline
            const paymentCount = await Payment.countDocuments();
            const year = new Date().getFullYear();
            const paymentNumber = `PAY${year}${String(paymentCount + 1).padStart(6, '0')}`;

            const payment = new Payment({
              paymentNumber,
              application: application._id,
              beneficiary: application.beneficiary,
              project: application.project,
              scheme: application.scheme,
              amount: application.requestedAmount,
              type: 'full_payment',
              method: 'bank_transfer',
              status: 'pending',
              timeline: {
                expectedCompletionDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
                approvedAt: new Date()
              },
              approvals: [{
                level: 'finance',
                approver: req.user._id,
                status: 'approved',
                approvedAt: new Date(),
                comments: 'Approved after successful interview'
              }],
              metadata: {
                notes: `Approved after interview. ${notes || ''}`.trim()
              },
              initiatedBy: req.user._id
            });

            await payment.save();
            console.log('✅ Payment record created:', paymentNumber);
          }
        } catch (paymentError) {
          console.error('⚠️ Error creating payment record:', paymentError);
          // Don't fail the interview completion if payment creation fails
        }
      }

      res.json({
        success: true,
        message: 'Interview completed successfully',
        data: {
          interviewId: interview._id,
          interviewNumber: interview.interviewNumber,
          applicationId: application._id,
          applicationNumber: application.applicationNumber,
          result: interview.result,
          completedAt: interview.completedAt,
          notes: interview.notes
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Error completing interview:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        id: req.params.id,
        body: req.body
      });
      res.status(500).json({
        success: false,
        message: 'Failed to complete interview',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * @swagger
 * /api/interviews/interview/{interviewId}/complete:
 *   patch:
 *     summary: Mark interview as completed by interview ID
 *     tags: [Interviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: interviewId
 *         required: true
 *         schema:
 *           type: string
 *         description: Interview ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - result
 *             properties:
 *               result:
 *                 type: string
 *                 enum: [passed, failed]
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Interview completed successfully
 */
router.patch('/interview/:interviewId/complete',
  authenticate, crossFranchiseResolver,
  RBACMiddleware.hasPermission('interviews.update'),
  async (req, res) => {
    try {
      const { interviewId } = req.params;
      const { result, notes } = req.body;

      console.log('🔍 Completing interview by ID:', interviewId);
      console.log('📝 Request data:', { result, notes });

      // Find the interview by ID
      const interview = await Interview.findById(interviewId);
      
      if (!interview) {
        console.log('❌ Interview not found');
        return res.status(404).json({
          success: false,
          message: 'Interview not found',
          timestamp: new Date().toISOString()
        });
      }

      console.log('📋 Found interview:', interview.interviewNumber);

      // Get the application for this interview
      const application = await Application.findById(interview.application);
      
      if (!application) {
        console.log('❌ Application not found');
        return res.status(404).json({
          success: false,
          message: 'Application not found for this interview',
          timestamp: new Date().toISOString()
        });
      }

      console.log('📄 Found application:', application.applicationNumber);

      // Check if interview is in a completable state (allow editing of completed interviews)
      if (interview.status !== 'scheduled' && interview.status !== 'completed') {
        console.log('❌ Interview not in completable state:', interview.status);
        return res.status(400).json({
          success: false,
          message: `Interview is ${interview.status} and cannot be completed or edited`,
          timestamp: new Date().toISOString()
        });
      }

      // Check permission
      // Super admin and state admin have full access
      if (req.user.role !== 'super_admin' && req.user.role !== 'state_admin') {
        const hasPermission = await RBACMiddleware.checkApplicationAccess(req.user, application);
        if (!hasPermission) {
          console.log('❌ Access denied');
          return res.status(403).json({
            success: false,
            message: 'Access denied for this application',
            timestamp: new Date().toISOString()
          });
        }
      }

      console.log('✅ Access granted');
      console.log('✅ Completing interview:', interview.interviewNumber);

      // Check if interview was already completed (for editing)
      const wasAlreadyCompleted = interview.status === 'completed';

      // Use the interview model's complete method
      await interview.complete(result, notes, req.user._id);

      console.log('✅ Interview completed successfully', wasAlreadyCompleted ? '(edited)' : '(completed)');

      // Update application status
      if (result === 'passed') {
        application.status = 'approved';
      } else {
        application.status = 'rejected';
      }
      
      if (!application.interview) {
        application.interview = {};
      }
      application.interview.result = result;
      if (!wasAlreadyCompleted) {
        application.interview.completedAt = new Date();
      }
      if (notes) {
        application.interview.notes = notes;
      }

      // Save distribution timeline if provided (for approved applications)
      if (result === 'passed' && req.body.distributionTimeline && Array.isArray(req.body.distributionTimeline)) {
        application.distributionTimeline = req.body.distributionTimeline;
        console.log('💰 Distribution timeline saved:', req.body.distributionTimeline.length, 'phases');
      }

      console.log('💾 Saving application with status:', application.status);
      console.log('💾 Application interview data:', JSON.stringify(application.interview, null, 2));
      
      // Mark the document as modified to ensure save triggers
      application.markModified('interview');
      application.markModified('status');
      
      try {
        const savedApp = await application.save();
        console.log('✅ Application updated successfully, new status:', savedApp.status);
        
        // Generate recurring payment schedule for committee-approved applications with recurring payments
        if (result === 'passed' && application.isRecurring && application.recurringConfig) {
          try {
            console.log('🔄 Generating recurring payment schedule for committee-approved application:', savedApp._id);
            const RecurringPaymentService = require('../services/recurringPaymentService');
            const service = new RecurringPaymentService();
            const generatedPayments = await service.generatePaymentSchedule(savedApp._id);
            console.log(`✅ Generated ${generatedPayments.length} recurring payment records`);
          } catch (recurringError) {
            console.error('❌ Failed to generate recurring payment schedule:', recurringError);
            // Don't fail the whole request, just log the error
          }
        }
      } catch (saveError) {
        console.error('❌ Error saving application:', saveError);
        console.error('❌ Error name:', saveError.name);
        console.error('❌ Error message:', saveError.message);
        if (saveError.errors) {
          console.error('❌ Validation errors:', JSON.stringify(saveError.errors, null, 2));
        }
        console.error('Application data:', {
          id: application._id,
          status: application.status,
          interview: application.interview
        });
        
        // Return error response immediately
        return res.status(400).json({
          success: false,
          message: 'Failed to save application',
          error: saveError.message,
          validationErrors: saveError.errors,
          timestamp: new Date().toISOString()
        });
      }

      // Create a report entry for the approval/rejection decision
      try {
        const Report = require('../models/Report');
        const reportTitle = result === 'passed' 
          ? 'Interview Passed - Application Approved' 
          : 'Interview Failed - Application Rejected';
        
        const report = new Report({
          application: application._id,
          reportDate: new Date(),
          reportType: 'interview',
          title: reportTitle,
          details: notes || `Interview ${result}. ${result === 'passed' ? 'Application has been approved.' : 'Application has been rejected.'}`,
          status: 'submitted',
          priority: result === 'passed' ? 'high' : 'medium',
          followUpRequired: false,
          isPublic: true,
          createdBy: req.user._id
        });

        await report.save();
        console.log('✅ Report created for interview decision:', report.reportNumber);
      } catch (reportError) {
        console.error('⚠️ Error creating report:', reportError);
        // Don't fail the interview completion if report creation fails
      }

      // If interview passed, create payment schedule/disbursement (only if not already created)
      if (result === 'passed' && application.requestedAmount && !wasAlreadyCompleted) {
        try {
          const Payment = require('../models/Payment');
          
          // Create payments based on distribution timeline if available
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
                  expectedCompletionDate: new Date(timeline.expectedDate),
                  approvedAt: new Date()
                },
                approvals: [{
                  level: 'finance',
                  approver: req.user._id,
                  status: 'approved',
                  approvedAt: new Date(),
                  comments: 'Approved after successful interview'
                }],
                metadata: {
                  notes: `Approved after interview. ${notes || ''}`.trim()
                },
                initiatedBy: req.user._id
              });

              await payment.save();
              console.log('✅ Payment record created:', paymentNumber, 'for phase', i + 1);
            }
          } else {
            // Create single payment if no distribution timeline
            const paymentCount = await Payment.countDocuments();
            const year = new Date().getFullYear();
            const paymentNumber = `PAY${year}${String(paymentCount + 1).padStart(6, '0')}`;

            const payment = new Payment({
              paymentNumber,
              application: application._id,
              beneficiary: application.beneficiary,
              project: application.project,
              scheme: application.scheme,
              amount: application.requestedAmount,
              type: 'full_payment',
              method: 'bank_transfer',
              status: 'pending',
              timeline: {
                expectedCompletionDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                approvedAt: new Date()
              },
              approvals: [{
                level: 'finance',
                approver: req.user._id,
                status: 'approved',
                approvedAt: new Date(),
                comments: 'Approved after successful interview'
              }],
              metadata: {
                notes: `Approved after interview. ${notes || ''}`.trim()
              },
              initiatedBy: req.user._id
            });

            await payment.save();
            console.log('✅ Payment record created:', paymentNumber);
          }
        } catch (paymentError) {
          console.error('⚠️ Error creating payment record:', paymentError);
        }
      }

      res.json({
        success: true,
        message: 'Interview completed successfully',
        data: {
          interviewId: interview._id,
          interviewNumber: interview.interviewNumber,
          applicationId: application._id,
          applicationNumber: application.applicationNumber,
          result: interview.result,
          completedAt: interview.completedAt,
          notes: interview.notes
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Error completing interview:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to complete interview',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * @swagger
 * /api/interviews/{applicationId}/cancel:
 *   patch:
 *     summary: Cancel a scheduled interview
 *     tags: [Interviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Interview cancelled successfully
 */
router.patch('/:applicationId/cancel',
  authenticate, crossFranchiseResolver,
  RBACMiddleware.hasPermission('interviews.cancel'),
  async (req, res) => {
    try {
      const { applicationId } = req.params;
      const { reason } = req.body;

      const application = await Application.findOne({
        $or: [
          { _id: applicationId },
          { applicationNumber: applicationId }
        ]
      });

      if (!application) {
        return res.status(404).json({
          success: false,
          message: 'Application not found',
          timestamp: new Date().toISOString()
        });
      }

      // Check permission
      const hasPermission = await RBACMiddleware.checkApplicationAccess(req.user, application);
      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: 'Access denied for this application',
          timestamp: new Date().toISOString()
        });
      }

      // Cancel interview - revert to under_review status
      application.status = 'under_review';
      application.interview.notes = `Interview cancelled: ${reason}`;

      await application.save();

      res.json({
        success: true,
        message: 'Interview cancelled successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error cancelling interview:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to cancel interview',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * @swagger
 * /api/interviews/history/{applicationId}:
 *   get:
 *     summary: Get interview history for an application
 *     tags: [Interviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Interview history retrieved successfully
 */
router.get('/history/:applicationId',
  authenticate, crossFranchiseResolver,
  RBACMiddleware.hasPermission('interviews.read'),
  async (req, res) => {
    try {
      const { applicationId } = req.params;

      // Find the application
      const application = await Application.findOne({
        $or: [
          { _id: applicationId },
          { applicationNumber: applicationId }
        ]
      });

      if (!application) {
        return res.status(404).json({
          success: false,
          message: 'Application not found',
          timestamp: new Date().toISOString()
        });
      }

      // Get interview history
      const history = await Interview.getApplicationHistory(application._id);

      res.json({
        success: true,
        message: 'Interview history retrieved successfully',
        data: {
          applicationId: application.applicationNumber,
          applicantName: application.beneficiary?.name,
          history: history.map(interview => ({
            id: interview._id,
            interviewNumber: interview.interviewNumber,
            scheduledDate: interview.scheduledDate,
            scheduledTime: interview.scheduledTime,
            type: interview.type,
            location: interview.location,
            meetingLink: interview.meetingLink,
            status: interview.status,
            result: interview.result,
            notes: interview.notes,
            rescheduleCount: interview.rescheduleCount,
            rescheduleReason: interview.rescheduleReason,
            scheduledBy: interview.scheduledBy?.name,
            completedBy: interview.completedBy?.name,
            scheduledAt: interview.scheduledAt,
            completedAt: interview.completedAt,
            originalInterview: interview.originalInterview?.interviewNumber
          }))
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error fetching interview history:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch interview history',
        timestamp: new Date().toISOString()
      });
    }
  }
);

module.exports = router;