const express = require('express');
const formConfigurationController = require('../controllers/formConfigurationController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

/**
 * @swagger
 * /api/form-configurations:
 *   get:
 *     summary: Get all form configurations (admin only)
 *     tags: [Form Configurations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in title and description
 *       - in: query
 *         name: enabled
 *         schema:
 *           type: boolean
 *         description: Filter by enabled status
 *       - in: query
 *         name: published
 *         schema:
 *           type: boolean
 *         description: Filter by published status
 *     responses:
 *       200:
 *         description: Form configurations retrieved successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 */
router.get('/',
  authorize('super_admin', 'state_admin', 'district_admin', 'area_admin', 'unit_admin', 'project_coordinator', 'scheme_coordinator'),
  formConfigurationController.getAllFormConfigurations
);

// Note: Basic CRUD operations for form configurations are handled in schemeRoutes.js
// This file contains additional form configuration management routes

/**
 * @swagger
 * /api/schemes/{schemeId}/form-config/publish:
 *   patch:
 *     summary: Publish or unpublish form configuration
 *     tags: [Form Configurations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: schemeId
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
 *             required:
 *               - isPublished
 *             properties:
 *               isPublished:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Publish status updated successfully
 *       404:
 *         description: Scheme or form configuration not found
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 */
router.patch('/schemes/:schemeId/form-config/publish', 
  authorize('super_admin', 'state_admin', 'district_admin', 'project_coordinator'),
  formConfigurationController.togglePublishStatus
);

/**
 * @swagger
 * /api/schemes/{schemeId}/form-config/analytics:
 *   get:
 *     summary: Get form configuration analytics
 *     tags: [Form Configurations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: schemeId
 *         required: true
 *         schema:
 *           type: string
 *         description: Scheme ID
 *     responses:
 *       200:
 *         description: Form analytics retrieved successfully
 *       404:
 *         description: Scheme or form configuration not found
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 */
router.get('/schemes/:schemeId/form-config/analytics', 
  authorize('super_admin', 'state_admin', 'district_admin', 'project_coordinator', 'scheme_coordinator'),
  formConfigurationController.getFormAnalytics
);

/**
 * @swagger
 * /api/schemes/{schemeId}/form-config/duplicate:
 *   post:
 *     summary: Duplicate form configuration to another scheme
 *     tags: [Form Configurations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: schemeId
 *         required: true
 *         schema:
 *           type: string
 *         description: Source scheme ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - targetSchemeId
 *             properties:
 *               targetSchemeId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Form configuration duplicated successfully
 *       400:
 *         description: Validation error or target already has configuration
 *       404:
 *         description: Source/target scheme not found
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 */
router.post('/schemes/:schemeId/form-config/duplicate', 
  authorize('super_admin', 'state_admin', 'district_admin', 'project_coordinator'),
  formConfigurationController.duplicateFormConfiguration
);

// Renewal form configuration routes
router.get('/schemes/:schemeId/renewal-form-config',
  authorize('super_admin', 'state_admin', 'district_admin', 'project_coordinator', 'scheme_coordinator'),
  formConfigurationController.getRenewalFormConfiguration
);

router.put('/schemes/:schemeId/renewal-form-config',
  authorize('super_admin', 'state_admin', 'district_admin', 'project_coordinator'),
  formConfigurationController.updateRenewalFormConfiguration
);

router.delete('/schemes/:schemeId/renewal-form-config',
  authorize('super_admin', 'state_admin', 'district_admin', 'project_coordinator'),
  formConfigurationController.deleteRenewalFormConfiguration
);

module.exports = router;