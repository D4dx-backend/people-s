const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

// Import models
const Report = require('../models/Report');
const Application = require('../models/Application');

// Import middleware
const { authenticate, crossFranchiseResolver } = require('../middleware/auth');
const RBACMiddleware = require('../middleware/rbacMiddleware');

/**
 * @swagger
 * /api/reports/application/{applicationId}:
 *   get:
 *     summary: Get reports for an application
 *     tags: [Reports]
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Application ID or Application Number
 *     responses:
 *       200:
 *         description: Reports retrieved successfully
 */
router.get('/application/:applicationId',
  authenticate, crossFranchiseResolver,
  RBACMiddleware.hasPermission('reports.read'),
  async (req, res) => {
    try {
      const { applicationId } = req.params;
      
      console.log('🔍 GET Reports - applicationId:', applicationId);
      console.log('🔍 GET Reports - user:', req.user.email);

      // Step 1: Find the application by application number or ObjectId
      let application;
      
      // Try to find by applicationNumber first
      application = await Application.findOne({ 
        applicationNumber: applicationId 
      });
      
      // If not found and applicationId looks like an ObjectId, try finding by _id
      if (!application && mongoose.Types.ObjectId.isValid(applicationId)) {
        application = await Application.findById(applicationId);
      }

      console.log('🔍 GET Reports - applicationId received:', applicationId);
      console.log('🔍 GET Reports - applicationId type:', typeof applicationId);
      console.log('🔍 GET Reports - applicationId length:', applicationId?.length);
      console.log('🔍 GET Reports - application found:', application ? application.applicationNumber : 'NOT FOUND');
      
      if (!application) {
        // Additional debugging - let's see what applications exist
        const allApps = await Application.find({}).limit(3).select('applicationNumber');
        console.log('🔍 GET Reports - Available applications:', allApps.map(a => a.applicationNumber));
      }

      if (!application) {
        console.log('❌ GET Reports - Application not found');
        return res.status(404).json({
          success: false,
          message: 'Application not found',
          timestamp: new Date().toISOString()
        });
      }

      // Step 2: Check permissions (simplified for now)
      console.log('✅ GET Reports - Application found, checking permissions...');

      // Step 3: Get reports for this application using the ObjectId
      const reports = await Report.find({ 
        application: application._id 
      })
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

      console.log('🔍 GET Reports - Found reports count:', reports.length);

      // Step 4: Format response
      const formattedReports = reports.map(report => ({
        id: report._id,
        reportNumber: report.reportNumber,
        reportDate: report.reportDate,
        reportType: report.reportType,
        title: report.title,
        details: report.details,
        status: report.status,
        priority: report.priority,
        followUpRequired: report.followUpRequired,
        followUpDate: report.followUpDate,
        followUpNotes: report.followUpNotes,
        isPublic: report.isPublic,
        createdBy: report.createdBy?.name || 'Unknown',
        createdAt: report.createdAt,
        updatedAt: report.updatedAt
      }));

      console.log('✅ GET Reports - Success, returning', formattedReports.length, 'reports');

      res.json({
        success: true,
        message: 'Reports retrieved successfully',
        data: {
          applicationId: application.applicationNumber,
          applicationObjectId: application._id,
          reports: formattedReports
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ GET Reports - Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch reports',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * @swagger
 * /api/reports/application/{applicationId}:
 *   post:
 *     summary: Create a new report for an application
 *     tags: [Reports]
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Application ID or Application Number
 *     responses:
 *       201:
 *         description: Report created successfully
 */
router.post('/application/:applicationId',
  authenticate, crossFranchiseResolver,
  async (req, res, next) => {
    try {
      // Custom middleware: Check permission OR application access
      const rbacService = require('../services/rbacService');
      const { applicationId } = req.params;
      
      console.log('🔍 [REPORTS] Checking access for report creation:', {
        userId: req.user._id,
        userRole: req.user.role,
        applicationId
      });
      
      // First, try permission check
      const context = {
        user: req.user,
        ip: req.ip,
        timestamp: new Date()
      };
      
      let hasPermission = await rbacService.hasPermission(
        req.user._id,
        'reports.create',
        context
      );
      
      console.log('🔍 [REPORTS] Permission check result:', hasPermission);
      
      // If no permission, check if user can access the application
      // This allows unit_admin/area_admin/district_admin to create reports for applications they can access
      if (!hasPermission && ['unit_admin', 'area_admin', 'district_admin'].includes(req.user.role)) {
        console.log('🔍 [REPORTS] Fallback: Checking application access');
        
        // Find the application
        let application = await Application.findOne({ applicationNumber: applicationId });
        if (!application && mongoose.Types.ObjectId.isValid(applicationId)) {
          application = await Application.findById(applicationId)
            .populate('unit')
            .populate('area')
            .populate('district');
        }
        
        if (application) {
          // Check if user can access this application using the same logic as application access
          // This matches the logic in applicationController.hasAccessToApplication
          const getId = (ref) => {
            if (!ref) return null;
            if (typeof ref === 'object' && ref._id) return ref._id.toString();
            return ref.toString();
          };
          
          let canAccess = false;
          
          // Super admin and state admin have access to everything
          if (req.user.role === 'super_admin' || req.user.role === 'state_admin') {
            canAccess = true;
          } else if (req.user.adminScope) {
            // Check adminScope.regions array
            if (req.user.adminScope.regions && req.user.adminScope.regions.length > 0) {
              const userRegions = req.user.adminScope.regions.map(r => getId(r));
              const appUnitId = getId(application.unit);
              const appAreaId = getId(application.area);
              const appDistrictId = getId(application.district);
              
              if (req.user.role === 'unit_admin' && appUnitId && userRegions.includes(appUnitId)) {
                canAccess = true;
              } else if (req.user.role === 'area_admin' && appAreaId && userRegions.includes(appAreaId)) {
                canAccess = true;
              } else if (req.user.role === 'district_admin' && appDistrictId && userRegions.includes(appDistrictId)) {
                canAccess = true;
              }
            }
            
            // Check direct district/area/unit properties if not already granted
            if (!canAccess) {
              const userUnitId = req.user.adminScope.unit ? getId(req.user.adminScope.unit) : null;
              const userAreaId = req.user.adminScope.area ? getId(req.user.adminScope.area) : null;
              const userDistrictId = req.user.adminScope.district ? getId(req.user.adminScope.district) : null;
              
              const appUnitId = getId(application.unit);
              const appAreaId = getId(application.area);
              const appDistrictId = getId(application.district);
              
              if (req.user.role === 'unit_admin' && userUnitId && appUnitId === userUnitId) {
                canAccess = true;
              } else if (req.user.role === 'area_admin' && userAreaId && appAreaId === userAreaId) {
                canAccess = true;
              } else if (req.user.role === 'district_admin' && userDistrictId && appDistrictId === userDistrictId) {
                canAccess = true;
              }
            }
          }
          
          hasPermission = canAccess;
          console.log('🔍 [REPORTS] Application access check result:', hasPermission);
          
          if (hasPermission) {
            console.log('✅ [REPORTS] Access granted via application access check');
            // Store application in request for later use
            req.application = application;
          }
        }
      }
      
      if (!hasPermission) {
        console.log('❌ [REPORTS] Access denied - no permission or application access');
        return res.status(403).json({
          success: false,
          message: 'Access denied. Insufficient permissions to create reports for this application.',
          requiredPermission: 'reports.create'
        });
      }
      
      console.log('✅ [REPORTS] Access granted');
      next();
    } catch (error) {
      console.error('❌ [REPORTS] Access check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to verify access permissions'
      });
    }
  },
  async (req, res) => {
    try {
      const { applicationId } = req.params;
      const reportData = req.body;

      console.log('📝 POST Reports - applicationId:', applicationId);
      console.log('📝 POST Reports - user:', req.user.email);
      console.log('📝 POST Reports - data:', JSON.stringify(reportData, null, 2));

      // Step 1: Find the application by application number or ObjectId
      // (Application may already be in req.application from middleware)
      let application = req.application;
      
      if (!application) {
        // Try to find by applicationNumber first
        application = await Application.findOne({ 
          applicationNumber: applicationId 
        });
        
        // If not found and applicationId looks like an ObjectId, try finding by _id
        if (!application && mongoose.Types.ObjectId.isValid(applicationId)) {
          application = await Application.findById(applicationId)
            .populate('unit')
            .populate('area')
            .populate('district');
        }
      }

      console.log('📝 POST Reports - applicationId received:', applicationId);
      console.log('📝 POST Reports - application found:', application ? application.applicationNumber : 'NOT FOUND');

      if (!application) {
        console.log('❌ POST Reports - Application not found');
        return res.status(404).json({
          success: false,
          message: 'Application not found',
          timestamp: new Date().toISOString()
        });
      }

      // Step 2: Create the report with the application's ObjectId
      // Always set report date to today (not editable)
      const reportDate = new Date();
      
      // Prepare report data
      const reportPayload = {
        application: application._id, // Use the ObjectId here
        reportDate: reportDate, // Always today's date
        reportType: reportData.reportType || 'interview',
        title: reportData.title,
        details: reportData.details || '', // Ensure details is not undefined
        status: reportData.status || 'submitted',
        priority: reportData.priority || 'medium',
        followUpRequired: reportData.followUpRequired || false,
        followUpDate: reportData.followUpDate ? new Date(reportData.followUpDate) : undefined,
        followUpNotes: reportData.followUpNotes || '',
        isPublic: reportData.isPublic || false,
        createdBy: req.user._id
      };

      console.log('📝 POST Reports - Creating report with application ObjectId:', application._id);
      console.log('📝 POST Reports - Report payload:', JSON.stringify(reportPayload, null, 2));

      const report = new Report(reportPayload);

      // Validate before saving
      const validationError = report.validateSync();
      if (validationError) {
        console.error('❌ POST Reports - Validation error before save:', validationError);
        return res.status(400).json({
          success: false,
          message: 'Report validation failed',
          errors: validationError.errors,
          timestamp: new Date().toISOString()
        });
      }

      await report.save();
      await report.populate('createdBy', 'name email');

      console.log('✅ POST Reports - Report created successfully:', report.reportNumber);

      res.status(201).json({
        success: true,
        message: 'Report created successfully',
        data: {
          report: {
            id: report._id,
            reportNumber: report.reportNumber,
            reportDate: report.reportDate,
            reportType: report.reportType,
            title: report.title,
            details: report.details,
            status: report.status,
            priority: report.priority,
            followUpRequired: report.followUpRequired,
            followUpDate: report.followUpDate,
            followUpNotes: report.followUpNotes,
            isPublic: report.isPublic,
            createdBy: report.createdBy?.name,
            createdAt: report.createdAt
          }
        },
        timestamp: new Date().toISOString()
      });

     } catch (error) {
       console.error('❌ POST Reports - Error:', error);
       console.error('❌ POST Reports - Error name:', error.name);
       console.error('❌ POST Reports - Error message:', error.message);
       console.error('❌ POST Reports - Error stack:', error.stack);
       
       // Log validation errors if it's a Mongoose validation error
       if (error.name === 'ValidationError' && error.errors) {
         console.error('❌ POST Reports - Validation errors:', JSON.stringify(error.errors, null, 2));
       }
       
       // Handle duplicate key error (report number collision)
       if ((error.code === 11000 || error.name === 'MongoServerError') && error.keyPattern?.reportNumber) {
         console.error('❌ POST Reports - Duplicate report number detected:', error.keyValue?.reportNumber);
         console.error('❌ POST Reports - Retrying with new report number...');
         
         // Retry once with a new report instance (which will generate a new number)
         try {
           const retryReport = new Report(reportPayload);
           // Force regeneration of report number by clearing it
           retryReport.reportNumber = undefined;
           await retryReport.save();
           await retryReport.populate('createdBy', 'name email');
           
           console.log('✅ POST Reports - Report created successfully on retry:', retryReport.reportNumber);
           
           return res.status(201).json({
             success: true,
             message: 'Report created successfully',
             data: {
               report: {
                 id: retryReport._id,
                 reportNumber: retryReport.reportNumber,
                 reportDate: retryReport.reportDate,
                 reportType: retryReport.reportType,
                 title: retryReport.title,
                 details: retryReport.details,
                 status: retryReport.status,
                 priority: retryReport.priority,
                 followUpRequired: retryReport.followUpRequired,
                 followUpDate: retryReport.followUpDate,
                 followUpNotes: retryReport.followUpNotes,
                 isPublic: retryReport.isPublic,
                 createdBy: retryReport.createdBy?.name,
                 createdAt: retryReport.createdAt
               }
             },
             timestamp: new Date().toISOString()
           });
         } catch (retryError) {
           console.error('❌ POST Reports - Retry also failed:', retryError);
           return res.status(500).json({
             success: false,
             message: 'Failed to create report due to duplicate report number. Please try again.',
             error: process.env.NODE_ENV === 'development' ? retryError.message : undefined,
             timestamp: new Date().toISOString()
           });
         }
       }
       
       // Log the report payload that failed (if available)
       if (reportPayload) {
         console.error('❌ POST Reports - Report payload that failed:', {
           application: reportPayload.application,
           reportType: reportPayload.reportType,
           title: reportPayload.title,
           status: reportPayload.status,
           priority: reportPayload.priority
         });
       }
       
       res.status(500).json({
         success: false,
         message: 'Failed to create report',
         error: process.env.NODE_ENV === 'development' ? error.message : undefined,
         validationErrors: error.name === 'ValidationError' && error.errors ? error.errors : undefined,
         timestamp: new Date().toISOString()
       });
     }
  }
);



/**
 * @swagger
 * /api/reports/{reportId}:
 *   put:
 *     summary: Update a report (only by creator or admin)
 *     tags: [Reports]
 */
router.put('/:reportId',
  authenticate, crossFranchiseResolver,
  async (req, res, next) => {
    try {
      // Custom middleware: Check permission OR application access
      const rbacService = require('../services/rbacService');
      const { reportId } = req.params;
      
      console.log('🔍 [REPORTS-UPDATE] Checking access for report update:', {
        userId: req.user._id,
        userRole: req.user.role,
        reportId
      });
      
      // First, find the report to get the application
      const report = await Report.findById(reportId).populate('application');
      if (!report) {
        return res.status(404).json({
          success: false,
          message: 'Report not found',
          timestamp: new Date().toISOString()
        });
      }
      
      // Check if user is the creator of the report
      const isCreator = report.createdBy.toString() === req.user._id.toString();
      if (isCreator) {
        console.log('✅ [REPORTS-UPDATE] Access granted: User is creator');
        req.report = report;
        return next();
      }
      
      // Check permission
      const context = {
        user: req.user,
        ip: req.ip,
        timestamp: new Date()
      };
      
      let hasPermission = await rbacService.hasPermission(
        req.user._id,
        'reports.update',
        context
      );
      
      console.log('🔍 [REPORTS-UPDATE] Permission check result:', hasPermission);
      
      // If no permission, check if user can access the application
      if (!hasPermission && ['unit_admin', 'area_admin', 'district_admin'].includes(req.user.role)) {
        console.log('🔍 [REPORTS-UPDATE] Fallback: Checking application access');
        
        // Get the application from the report
        let application = report.application;
        if (!application || typeof application === 'string') {
          application = await Application.findById(report.application)
            .populate('unit')
            .populate('area')
            .populate('district');
        }
        
        if (application) {
          // Use the same access check logic as application access
          const getId = (ref) => {
            if (!ref) return null;
            if (typeof ref === 'object' && ref._id) return ref._id.toString();
            return ref.toString();
          };
          
          let canAccess = false;
          
          // Super admin and state admin have access to everything
          if (req.user.role === 'super_admin' || req.user.role === 'state_admin') {
            canAccess = true;
          } else if (req.user.adminScope) {
            // Check adminScope.regions array
            if (req.user.adminScope.regions && req.user.adminScope.regions.length > 0) {
              const userRegions = req.user.adminScope.regions.map(r => getId(r));
              const appUnitId = getId(application.unit);
              const appAreaId = getId(application.area);
              const appDistrictId = getId(application.district);
              
              if (req.user.role === 'unit_admin' && appUnitId && userRegions.includes(appUnitId)) {
                canAccess = true;
              } else if (req.user.role === 'area_admin' && appAreaId && userRegions.includes(appAreaId)) {
                canAccess = true;
              } else if (req.user.role === 'district_admin' && appDistrictId && userRegions.includes(appDistrictId)) {
                canAccess = true;
              }
            }
            
            // Check direct district/area/unit properties if not already granted
            if (!canAccess) {
              const userUnitId = req.user.adminScope.unit ? getId(req.user.adminScope.unit) : null;
              const userAreaId = req.user.adminScope.area ? getId(req.user.adminScope.area) : null;
              const userDistrictId = req.user.adminScope.district ? getId(req.user.adminScope.district) : null;
              
              const appUnitId = getId(application.unit);
              const appAreaId = getId(application.area);
              const appDistrictId = getId(application.district);
              
              if (req.user.role === 'unit_admin' && userUnitId && appUnitId === userUnitId) {
                canAccess = true;
              } else if (req.user.role === 'area_admin' && userAreaId && appAreaId === userAreaId) {
                canAccess = true;
              } else if (req.user.role === 'district_admin' && userDistrictId && appDistrictId === userDistrictId) {
                canAccess = true;
              }
            }
          }
          
          hasPermission = canAccess;
          console.log('🔍 [REPORTS-UPDATE] Application access check result:', hasPermission);
        }
      }
      
      // Also check if user is admin (super_admin, state_admin, district_admin can update any report)
      if (!hasPermission) {
        const isAdmin = ['super_admin', 'state_admin', 'district_admin'].includes(req.user.role);
        if (isAdmin) {
          hasPermission = true;
          console.log('✅ [REPORTS-UPDATE] Access granted: User is admin');
        }
      }
      
      if (!hasPermission) {
        console.log('❌ [REPORTS-UPDATE] Access denied - no permission or application access');
        return res.status(403).json({
          success: false,
          message: 'Access denied. Insufficient permissions to update this report.',
          requiredPermission: 'reports.update'
        });
      }
      
      console.log('✅ [REPORTS-UPDATE] Access granted');
      req.report = report;
      next();
    } catch (error) {
      console.error('❌ [REPORTS-UPDATE] Access check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to verify access permissions'
      });
    }
  },
  async (req, res) => {
    try {
      const { reportId } = req.params;
      const updateData = req.body;

      console.log('✏️ PUT Reports - reportId:', reportId);
      console.log('✏️ PUT Reports - user:', req.user.email);

      // Report is already in req.report from middleware
      const report = req.report;

      // Update fields (but don't allow changing reportDate - it stays as original creation date)
      Object.keys(updateData).forEach(key => {
        if (key === 'followUpDate') {
          report[key] = updateData[key] ? new Date(updateData[key]) : undefined;
        } else if (key !== 'createdBy' && key !== 'reportDate') { // Prevent changing creator and report date
          report[key] = updateData[key];
        }
      });

      // Set updatedBy to current user
      report.updatedBy = req.user._id;

      await report.save();
      await report.populate('createdBy', 'name email');

      console.log('✅ PUT Reports - Report updated successfully');

      res.json({
        success: true,
        message: 'Report updated successfully',
        data: { 
          report: {
            id: report._id,
            reportNumber: report.reportNumber,
            reportDate: report.reportDate,
            reportType: report.reportType,
            title: report.title,
            details: report.details,
            status: report.status,
            priority: report.priority,
            followUpRequired: report.followUpRequired,
            followUpDate: report.followUpDate,
            followUpNotes: report.followUpNotes,
            isPublic: report.isPublic,
            createdBy: report.createdBy?.name,
            createdAt: report.createdAt,
            updatedAt: report.updatedAt
          }
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ PUT Reports - Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update report',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * @swagger
 * /api/reports/{reportId}:
 *   delete:
 *     summary: Delete a report (with captcha confirmation)
 *     tags: [Reports]
 */
router.delete('/:reportId',
  authenticate, crossFranchiseResolver,
  async (req, res, next) => {
    try {
      // Custom middleware: Check permission OR application access
      const rbacService = require('../services/rbacService');
      const { reportId } = req.params;
      
      console.log('🔍 [REPORTS-DELETE] Checking access for report deletion:', {
        userId: req.user._id,
        userRole: req.user.role,
        reportId
      });
      
      // First, find the report to get the application
      const report = await Report.findById(reportId).populate('application');
      if (!report) {
        return res.status(404).json({
          success: false,
          message: 'Report not found',
          timestamp: new Date().toISOString()
        });
      }
      
      // Check if user is the creator of the report
      const isCreator = report.createdBy.toString() === req.user._id.toString();
      if (isCreator) {
        console.log('✅ [REPORTS-DELETE] Access granted: User is creator');
        req.report = report;
        return next();
      }
      
      // Check permission
      const context = {
        user: req.user,
        ip: req.ip,
        timestamp: new Date()
      };
      
      let hasPermission = await rbacService.hasPermission(
        req.user._id,
        'reports.delete',
        context
      );
      
      console.log('🔍 [REPORTS-DELETE] Permission check result:', hasPermission);
      
      // If no permission, check if user can access the application
      if (!hasPermission && ['unit_admin', 'area_admin', 'district_admin'].includes(req.user.role)) {
        console.log('🔍 [REPORTS-DELETE] Fallback: Checking application access');
        
        // Get the application from the report
        let application = report.application;
        if (!application || typeof application === 'string') {
          application = await Application.findById(report.application)
            .populate('unit')
            .populate('area')
            .populate('district');
        }
        
        if (application) {
          // Use the same access check logic as application access
          const getId = (ref) => {
            if (!ref) return null;
            if (typeof ref === 'object' && ref._id) return ref._id.toString();
            return ref.toString();
          };
          
          let canAccess = false;
          
          // Super admin and state admin have access to everything
          if (req.user.role === 'super_admin' || req.user.role === 'state_admin') {
            canAccess = true;
          } else if (req.user.adminScope) {
            // Check adminScope.regions array
            if (req.user.adminScope.regions && req.user.adminScope.regions.length > 0) {
              const userRegions = req.user.adminScope.regions.map(r => getId(r));
              const appUnitId = getId(application.unit);
              const appAreaId = getId(application.area);
              const appDistrictId = getId(application.district);
              
              if (req.user.role === 'unit_admin' && appUnitId && userRegions.includes(appUnitId)) {
                canAccess = true;
              } else if (req.user.role === 'area_admin' && appAreaId && userRegions.includes(appAreaId)) {
                canAccess = true;
              } else if (req.user.role === 'district_admin' && appDistrictId && userRegions.includes(appDistrictId)) {
                canAccess = true;
              }
            }
            
            // Check direct district/area/unit properties if not already granted
            if (!canAccess) {
              const userUnitId = req.user.adminScope.unit ? getId(req.user.adminScope.unit) : null;
              const userAreaId = req.user.adminScope.area ? getId(req.user.adminScope.area) : null;
              const userDistrictId = req.user.adminScope.district ? getId(req.user.adminScope.district) : null;
              
              const appUnitId = getId(application.unit);
              const appAreaId = getId(application.area);
              const appDistrictId = getId(application.district);
              
              if (req.user.role === 'unit_admin' && userUnitId && appUnitId === userUnitId) {
                canAccess = true;
              } else if (req.user.role === 'area_admin' && userAreaId && appAreaId === userAreaId) {
                canAccess = true;
              } else if (req.user.role === 'district_admin' && userDistrictId && appDistrictId === userDistrictId) {
                canAccess = true;
              }
            }
          }
          
          hasPermission = canAccess;
          console.log('🔍 [REPORTS-DELETE] Application access check result:', hasPermission);
        }
      }
      
      // Also check if user is admin (super_admin, state_admin, district_admin can delete any report)
      if (!hasPermission) {
        const isAdmin = ['super_admin', 'state_admin', 'district_admin'].includes(req.user.role);
        if (isAdmin) {
          hasPermission = true;
          console.log('✅ [REPORTS-DELETE] Access granted: User is admin');
        }
      }
      
      if (!hasPermission) {
        console.log('❌ [REPORTS-DELETE] Access denied - no permission or application access');
        return res.status(403).json({
          success: false,
          message: 'Access denied. Insufficient permissions to delete this report.',
          requiredPermission: 'reports.delete'
        });
      }
      
      console.log('✅ [REPORTS-DELETE] Access granted');
      req.report = report;
      next();
    } catch (error) {
      console.error('❌ [REPORTS-DELETE] Access check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to verify access permissions'
      });
    }
  },
  async (req, res) => {
    try {
      const { reportId } = req.params;
      const { captcha } = req.body;

      console.log('🗑️ DELETE Reports - reportId:', reportId);
      console.log('🗑️ DELETE Reports - user:', req.user.email);

      // Validate captcha confirmation
      if (!captcha || captcha.toLowerCase() !== 'delete') {
        return res.status(400).json({
          success: false,
          message: 'Please type "DELETE" to confirm deletion',
          timestamp: new Date().toISOString()
        });
      }

      // Report is already in req.report from middleware
      const report = req.report;

      await Report.findByIdAndDelete(reportId);

      console.log('✅ DELETE Reports - Report deleted successfully');

      res.json({
        success: true,
        message: 'Report deleted successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ DELETE Reports - Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete report',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString()
      });
    }
  }
);

module.exports = router;