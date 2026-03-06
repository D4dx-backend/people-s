const express = require('express');
const { body } = require('express-validator');
const masterDataController = require('../controllers/masterDataController');
const { authenticate, crossFranchiseResolver, authorize } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);
router.use(crossFranchiseResolver);

// Validation rules
const masterDataValidation = [
  body('type')
    .isIn(['scheme_stages', 'project_stages', 'application_stages', 'distribution_timeline_templates', 'status_configurations'])
    .withMessage('Invalid master data type'),
  body('name')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Name is required and must be less than 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  body('scope')
    .optional()
    .isIn(['global', 'state', 'district', 'area', 'unit', 'project_specific', 'scheme_specific'])
    .withMessage('Invalid scope'),
  body('status')
    .optional()
    .isIn(['draft', 'active', 'inactive', 'archived'])
    .withMessage('Invalid status'),
  body('configuration')
    .isObject()
    .withMessage('Configuration must be an object'),
  body('effectiveFrom')
    .optional()
    .isISO8601()
    .withMessage('Effective from must be a valid date'),
  body('effectiveTo')
    .optional()
    .isISO8601()
    .withMessage('Effective to must be a valid date')
];

const updateMasterDataValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Name must be less than 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  body('scope')
    .optional()
    .isIn(['global', 'state', 'district', 'area', 'unit', 'project_specific', 'scheme_specific'])
    .withMessage('Invalid scope'),
  body('status')
    .optional()
    .isIn(['draft', 'active', 'inactive', 'archived'])
    .withMessage('Invalid status'),
  body('configuration')
    .optional()
    .isObject()
    .withMessage('Configuration must be an object'),
  body('effectiveFrom')
    .optional()
    .isISO8601()
    .withMessage('Effective from must be a valid date'),
  body('effectiveTo')
    .optional()
    .isISO8601()
    .withMessage('Effective to must be a valid date')
];

/**
 * @swagger
 * /api/master-data:
 *   get:
 *     summary: Get all master data configurations
 *     tags: [Master Data]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [scheme_stages, project_stages, application_stages, distribution_timeline_templates, status_configurations]
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: scope
 *         schema:
 *           type: string
 *           enum: [global, state, district, area, unit, project_specific, scheme_specific]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, active, inactive, archived]
 *           default: active
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Master data configurations retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/', masterDataController.getMasterData);

/**
 * @swagger
 * /api/master-data/type/{type}:
 *   get:
 *     summary: Get master data configurations by type
 *     tags: [Master Data]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [scheme_stages, project_stages, application_stages, distribution_timeline_templates, status_configurations]
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: scope
 *         schema:
 *           type: string
 *           enum: [global, state, district, area, unit, project_specific, scheme_specific]
 *     responses:
 *       200:
 *         description: Master data configurations retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/type/:type', masterDataController.getMasterDataByType);

/**
 * @swagger
 * /api/master-data:
 *   post:
 *     summary: Create new master data configuration
 *     tags: [Master Data]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - name
 *               - configuration
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [scheme_stages, project_stages, application_stages, distribution_timeline_templates, status_configurations]
 *               name:
 *                 type: string
 *                 maxLength: 200
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *               category:
 *                 type: string
 *                 maxLength: 100
 *               configuration:
 *                 type: object
 *               scope:
 *                 type: string
 *                 enum: [global, state, district, area, unit, project_specific, scheme_specific]
 *                 default: global
 *               targetRegions:
 *                 type: array
 *                 items:
 *                   type: string
 *               targetProjects:
 *                 type: array
 *                 items:
 *                   type: string
 *               targetSchemes:
 *                 type: array
 *                 items:
 *                   type: string
 *               effectiveFrom:
 *                 type: string
 *                 format: date-time
 *               effectiveTo:
 *                 type: string
 *                 format: date-time
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Master data configuration created successfully
 *       400:
 *         description: Invalid master data configuration
 *       401:
 *         description: Authentication required
 */
router.post('/', 
  authorize('super_admin', 'state_admin', 'district_admin'),
  masterDataValidation,
  masterDataController.createMasterData
);

/**
 * @swagger
 * /api/master-data/{id}:
 *   get:
 *     summary: Get master data configuration by ID
 *     tags: [Master Data]
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
 *         description: Master data configuration retrieved successfully
 *       404:
 *         description: Master data configuration not found
 *       401:
 *         description: Authentication required
 */
router.get('/:id', masterDataController.getMasterDataById);

/**
 * @swagger
 * /api/master-data/{id}:
 *   put:
 *     summary: Update master data configuration
 *     tags: [Master Data]
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
 *                 maxLength: 1000
 *               category:
 *                 type: string
 *                 maxLength: 100
 *               configuration:
 *                 type: object
 *               scope:
 *                 type: string
 *                 enum: [global, state, district, area, unit, project_specific, scheme_specific]
 *               status:
 *                 type: string
 *                 enum: [draft, active, inactive, archived]
 *               targetRegions:
 *                 type: array
 *                 items:
 *                   type: string
 *               targetProjects:
 *                 type: array
 *                 items:
 *                   type: string
 *               targetSchemes:
 *                 type: array
 *                 items:
 *                   type: string
 *               effectiveFrom:
 *                 type: string
 *                 format: date-time
 *               effectiveTo:
 *                 type: string
 *                 format: date-time
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Master data configuration updated successfully
 *       400:
 *         description: Invalid master data configuration
 *       404:
 *         description: Master data configuration not found
 *       401:
 *         description: Authentication required
 */
router.put('/:id', 
  authorize('super_admin', 'state_admin', 'district_admin'),
  updateMasterDataValidation,
  masterDataController.updateMasterData
);

/**
 * @swagger
 * /api/master-data/{id}:
 *   delete:
 *     summary: Delete master data configuration
 *     tags: [Master Data]
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
 *         description: Master data configuration deleted successfully
 *       404:
 *         description: Master data configuration not found
 *       401:
 *         description: Authentication required
 */
router.delete('/:id', 
  authorize('super_admin', 'state_admin'),
  masterDataController.deleteMasterData
);

/**
 * @swagger
 * /api/master-data/{id}/clone:
 *   post:
 *     summary: Clone master data configuration
 *     tags: [Master Data]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: Master data configuration cloned successfully
 *       404:
 *         description: Master data configuration not found
 *       401:
 *         description: Authentication required
 */
router.post('/:id/clone', 
  authorize('super_admin', 'state_admin', 'district_admin'),
  masterDataController.cloneMasterData
);

module.exports = router;