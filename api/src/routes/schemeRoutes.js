const express = require('express');
const schemeController = require('../controllers/schemeController');
const { authenticate, authorize } = require('../middleware/auth');
const { createExportHandler } = require('../middleware/exportHandler');
const exportConfigs = require('../config/exportConfigs');
const Scheme = require('../models/Scheme');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// Export schemes as CSV or JSON
router.get('/export', createExportHandler(Scheme, exportConfigs.scheme));

/**
 * @swagger
 * /api/schemes/stats:
 *   get:
 *     summary: Get scheme statistics
 *     tags: [Schemes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Scheme statistics retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/stats', schemeController.getSchemeStats);

/**
 * @swagger
 * /api/schemes/active:
 *   get:
 *     summary: Get active schemes accepting applications
 *     tags: [Schemes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active schemes retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/active', schemeController.getActiveSchemes);

/**
 * @swagger
 * /api/schemes:
 *   get:
 *     summary: Get all schemes with filtering and pagination
 *     tags: [Schemes]
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
 *           enum: [draft, active, suspended, closed, completed]
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [education, healthcare, housing, livelihood, emergency_relief, infrastructure, social_welfare, other]
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high, critical]
 *       - in: query
 *         name: project
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Schemes retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/', schemeController.getSchemes);

/**
 * @swagger
 * /api/schemes:
 *   post:
 *     summary: Create new scheme
 *     tags: [Schemes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - code
 *               - description
 *               - category
 *               - project
 *               - targetRegions
 *               - budget
 *               - benefits
 *               - applicationSettings
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 200
 *               code:
 *                 type: string
 *                 pattern: '^[A-Z0-9_-]+$'
 *               description:
 *                 type: string
 *                 maxLength: 2000
 *               category:
 *                 type: string
 *                 enum: [education, healthcare, housing, livelihood, emergency_relief, infrastructure, social_welfare, other]
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, critical]
 *                 default: medium
 *               project:
 *                 type: string
 *               targetRegions:
 *                 type: array
 *                 items:
 *                   type: string
 *               budget:
 *                 type: object
 *                 properties:
 *                   total:
 *                     type: number
 *                     minimum: 0
 *               benefits:
 *                 type: object
 *                 properties:
 *                   type:
 *                     type: string
 *                     enum: [cash, kind, service, scholarship, loan, subsidy]
 *                   amount:
 *                     type: number
 *                     minimum: 0
 *               applicationSettings:
 *                 type: object
 *                 properties:
 *                   startDate:
 *                     type: string
 *                     format: date
 *                   endDate:
 *                     type: string
 *                     format: date
 *     responses:
 *       201:
 *         description: Scheme created successfully
 *       400:
 *         description: Invalid scheme data
 *       401:
 *         description: Authentication required
 */
router.post('/', 
  authorize('super_admin', 'state_admin', 'district_admin', 'project_coordinator'),
  schemeController.createScheme
);

/**
 * @swagger
 * /api/schemes/{id}:
 *   get:
 *     summary: Get scheme by ID
 *     tags: [Schemes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Scheme retrieved successfully
 *       404:
 *         description: Scheme not found
 *       401:
 *         description: Authentication required
 */
router.get('/:id', schemeController.getSchemeById);

/**
 * @swagger
 * /api/schemes/{id}:
 *   put:
 *     summary: Update scheme
 *     tags: [Schemes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *               name:
 *                 type: string
 *                 maxLength: 200
 *               description:
 *                 type: string
 *                 maxLength: 2000
 *               category:
 *                 type: string
 *                 enum: [education, healthcare, housing, livelihood, emergency_relief, infrastructure, social_welfare, other]
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, critical]
 *               status:
 *                 type: string
 *                 enum: [draft, active, suspended, closed, completed]
 *               budget:
 *                 type: object
 *                 properties:
 *                   total:
 *                     type: number
 *                     minimum: 0
 *                   allocated:
 *                     type: number
 *                     minimum: 0
 *                   spent:
 *                     type: number
 *                     minimum: 0
 *     responses:
 *       200:
 *         description: Scheme updated successfully
 *       400:
 *         description: Invalid scheme data
 *       404:
 *         description: Scheme not found
 *       401:
 *         description: Authentication required
 */
router.put('/:id', 
  authorize('super_admin', 'state_admin', 'district_admin', 'project_coordinator'),
  schemeController.updateScheme
);

/**
 * @swagger
 * /api/schemes/{id}:
 *   delete:
 *     summary: Delete scheme
 *     tags: [Schemes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Scheme deleted successfully
 *       404:
 *         description: Scheme not found
 *       401:
 *         description: Authentication required
 */
router.delete('/:id', 
  authorize('super_admin', 'state_admin', 'district_admin'),
  schemeController.deleteScheme
);

/**
 * @swagger
 * /api/schemes/{id}/form-config:
 *   get:
 *     summary: Get form configuration for a scheme
 *     tags: [Schemes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Scheme ID
 *     responses:
 *       200:
 *         description: Form configuration retrieved successfully
 *       404:
 *         description: Scheme not found
 *       401:
 *         description: Authentication required
 */
router.get('/:id/form-config', 
  // Note: Route-level authorization removed for read operations
  // The controller checks scheme access via canUserAccess which is more granular
  // This allows anyone who can view applications to also view form configs
  (req, res, next) => {
    console.log('🔍 GET /:id/form-config route hit:', {
      id: req.params.id,
      userRole: req.user?.role,
      userId: req.user?._id
    });
    next();
  },
  schemeController.getFormConfiguration
);

/**
 * @swagger
 * /api/schemes/{id}/form-config:
 *   put:
 *     summary: Update form configuration for a scheme
 *     tags: [Schemes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Scheme ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               enabled:
 *                 type: boolean
 *               emailNotifications:
 *                 type: boolean
 *               pages:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Form configuration updated successfully
 *       404:
 *         description: Scheme not found
 *       401:
 *         description: Authentication required
 */
router.put('/:id/form-config', 
  authorize('super_admin', 'state_admin', 'district_admin', 'project_coordinator'),
  schemeController.updateFormConfiguration
);

/**
 * @swagger
 * /api/schemes/{id}/update-applications-timeline:
 *   post:
 *     summary: Update distribution timeline for all applications of a scheme
 *     tags: [Schemes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Scheme ID
 *     responses:
 *       200:
 *         description: Applications timeline updated successfully
 *       404:
 *         description: Scheme not found
 *       401:
 *         description: Authentication required
 */
router.post('/:id/update-applications-timeline',
  authorize('super_admin', 'state_admin', 'district_admin'),
  schemeController.updateApplicationsTimeline
);

module.exports = router;