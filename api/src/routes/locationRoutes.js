/**
 * Location Routes - Cascading Location Selection API
 * 
 * This module provides endpoints for managing and retrieving locations in a hierarchical structure:
 * State > District > Area > Unit
 * 
 * PRIMARY USE CASE: Profile Updates with Cascading Location Selection
 * 
 * WORKFLOW FOR CASCADING FILTERS:
 * 
 * 1. User selects District:
 *    GET /api/locations/by-type/district
 *    Returns: List of all districts
 * 
 * 2. User selects a district (e.g., Malappuram with ID: 507f1f77bcf86cd799439011):
 *    GET /api/locations/by-type/area?parent=507f1f77bcf86cd799439011
 *    Returns: List of areas in Malappuram district
 * 
 * 3. User selects an area (e.g., Tirur with ID: 507f1f77bcf86cd799439021):
 *    GET /api/locations/by-type/unit?parent=507f1f77bcf86cd799439021
 *    Returns: List of units in Tirur area
 * 
 * ALTERNATIVE APPROACHES:
 * 
 * A. Using the general locations endpoint with filters:
 *    - Districts: GET /api/locations?type=district&limit=100
 *    - Areas by District: GET /api/locations?type=area&parent={districtId}&limit=100
 *    - Units by Area: GET /api/locations?type=unit&parent={areaId}&limit=100
 * 
 * B. Using hierarchy endpoint for tree view:
 *    - GET /api/locations/hierarchy
 *    Returns: Complete hierarchical tree structure
 * 
 * EXAMPLE RESPONSE STRUCTURE:
 * {
 *   "success": true,
 *   "data": {
 *     "locations": [
 *       {
 *         "_id": "507f1f77bcf86cd799439021",
 *         "name": "Tirur",
 *         "code": "TRR",
 *         "type": "area",
 *         "parent": {
 *           "_id": "507f1f77bcf86cd799439011",
 *           "name": "Malappuram",
 *           "type": "district",
 *           "code": "MALAPPURAM"
 *         },
 *         "isActive": true
 *       }
 *     ]
 *   }
 * }
 */

const express = require('express');
const locationController = require('../controllers/locationController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { commonSchemas } = require('../middleware/validation');
const Joi = require('joi');
const { createExportHandler } = require('../middleware/exportHandler');
const exportConfigs = require('../config/exportConfigs');
const Location = require('../models/Location');

const router = express.Router();

// Location validation schemas
const locationSchemas = {
  create: Joi.object({
    name: Joi.string().trim().min(2).max(100).required(),
    type: Joi.string().valid('state', 'district', 'area', 'unit').required(),
    code: Joi.string().trim().uppercase().pattern(/^[A-Z0-9_-]+$/).when('type', {
      is: 'district',
      then: Joi.optional(), // Code is auto-generated for districts
      otherwise: Joi.required()
    }),
    parent: commonSchemas.objectId.when('type', {
      is: Joi.valid('state', 'district'),
      then: Joi.forbidden(),
      otherwise: Joi.required()
    })
  }),

  update: Joi.object({
    name: Joi.string().trim().min(2).max(100),
    code: Joi.string().trim().uppercase().pattern(/^[A-Z0-9_-]+$/),
    parent: commonSchemas.objectId,
    isActive: Joi.boolean()
  }).min(1),

  query: Joi.object({
    type: Joi.string().valid('state', 'district', 'area', 'unit'),
    parent: commonSchemas.objectId,
    search: Joi.string().trim().min(2).max(100),
    isActive: Joi.boolean().truthy('true', '1').falsy('false', '0'),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(2000).default(10),
    sort: Joi.string().default('name'),
    order: Joi.string().valid('asc', 'desc').default('asc')
  })
};

/**
 * @swagger
 * /api/locations:
 *   get:
 *     tags:
 *       - Locations
 *     summary: Get all locations with filtering and pagination
 *     description: |
 *       Retrieve locations with support for filtering by type, parent, search, and pagination.
 *       Used for profile updates and cascading location selection.
 *       
 *       **Cascading Filter Examples:**
 *       - Get all districts: `?type=district`
 *       - Get areas in a district: `?type=area&parent={districtId}`
 *       - Get units in an area: `?type=unit&parent={areaId}`
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [state, district, area, unit]
 *         description: Filter by location type
 *       - in: query
 *         name: parent
 *         schema:
 *           type: string
 *         description: Filter by parent location ID (for cascading selection)
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name or code
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Filter by active status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           default: name
 *         description: Field to sort by
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: asc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Locations retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     locations:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           code:
 *                             type: string
 *                           type:
 *                             type: string
 *                             enum: [state, district, area, unit]
 *                           parent:
 *                             type: object
 *                             properties:
 *                               _id:
 *                                 type: string
 *                               name:
 *                                 type: string
 *                               type:
 *                                 type: string
 *                               code:
 *                                 type: string
 *                           isActive:
 *                             type: boolean
 *                           contactPerson:
 *                             type: object
 *                             properties:
 *                               name:
 *                                 type: string
 *                               phone:
 *                                 type: string
 *                               email:
 *                                 type: string
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                           updatedAt:
 *                             type: string
 *                             format: date-time
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         pages:
 *                           type: integer
 *             examples:
 *               Get Districts:
 *                 value:
 *                   success: true
 *                   data:
 *                     locations:
 *                       - _id: "507f1f77bcf86cd799439011"
 *                         name: "Malappuram"
 *                         code: "MALAPPURAM"
 *                         type: "district"
 *                         isActive: true
 *                         createdAt: "2024-01-15T10:30:00.000Z"
 *                         updatedAt: "2024-01-15T10:30:00.000Z"
 *                     pagination:
 *                       page: 1
 *                       limit: 10
 *                       total: 14
 *                       pages: 2
 *               Get Areas by District:
 *                 value:
 *                   success: true
 *                   data:
 *                     locations:
 *                       - _id: "507f1f77bcf86cd799439012"
 *                         name: "Tirur"
 *                         code: "TRR"
 *                         type: "area"
 *                         parent:
 *                           _id: "507f1f77bcf86cd799439011"
 *                           name: "Malappuram"
 *                           type: "district"
 *                           code: "MALAPPURAM"
 *                         isActive: true
 *                     pagination:
 *                       page: 1
 *                       limit: 10
 *                       total: 8
 *                       pages: 1
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       500:
 *         description: Server error
 */
// Export locations as CSV or JSON
router.get('/export',
  authenticate,
  authorize('super_admin', 'state_admin', 'district_admin', 'area_admin', 'unit_admin'),
  createExportHandler(Location, exportConfigs.location)
);

router.get('/',
  authenticate,
  authorize('super_admin', 'state_admin', 'district_admin', 'area_admin', 'unit_admin', 'project_coordinator', 'scheme_coordinator'),
  validate(locationSchemas.query, 'query'),
  locationController.getLocations
);

/**
 * @swagger
 * /api/locations/hierarchy:
 *   get:
 *     tags:
 *       - Locations
 *     summary: Get location hierarchy tree
 *     description: |
 *       Retrieve the complete hierarchical tree structure of locations.
 *       Useful for displaying nested location selection or organizational charts.
 *       
 *       Returns locations in a tree format: State > District > Area > Unit
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: parentId
 *         schema:
 *           type: string
 *         description: Optional parent ID to get hierarchy from a specific node
 *     responses:
 *       200:
 *         description: Hierarchy retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     hierarchy:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           code:
 *                             type: string
 *                           type:
 *                             type: string
 *                           children:
 *                             type: array
 *                             items:
 *                               type: object
 *             example:
 *               success: true
 *               data:
 *                 hierarchy:
 *                   - _id: "507f1f77bcf86cd799439011"
 *                     name: "Malappuram"
 *                     code: "MALAPPURAM"
 *                     type: "district"
 *                     children:
 *                       - _id: "507f1f77bcf86cd799439021"
 *                         name: "Tirur"
 *                         code: "TRR"
 *                         type: "area"
 *                         children:
 *                           - _id: "507f1f77bcf86cd799439031"
 *                             name: "Tirur West"
 *                             code: "TRR_W"
 *                             type: "unit"
 *                             children: []
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/hierarchy',
  authenticate,
  authorize('super_admin', 'state_admin', 'district_admin', 'area_admin', 'unit_admin', 'project_coordinator', 'scheme_coordinator'),
  locationController.getHierarchy
);

/**
 * @route   GET /api/locations/statistics
 * @desc    Get location statistics
 * @access  Private (Admin roles)
 */
router.get('/statistics',
  authenticate,
  authorize('super_admin', 'state_admin', 'district_admin'),
  locationController.getLocationStatistics
);

/**
 * @swagger
 * /api/locations/by-type/{type}:
 *   get:
 *     tags:
 *       - Locations
 *     summary: Get locations by type (for profile updates)
 *     description: |
 *       Retrieve all locations of a specific type with optional parent filtering.
 *       **Primary endpoint for cascading location selection in profile updates.**
 *       
 *       **Use Cases:**
 *       1. Get all districts: `GET /api/locations/by-type/district`
 *       2. Get areas in a district: `GET /api/locations/by-type/area?parent={districtId}`
 *       3. Get units in an area: `GET /api/locations/by-type/unit?parent={areaId}`
 *       
 *       Returns simplified location data optimized for dropdowns and forms.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [state, district, area, unit]
 *         description: Location type to retrieve
 *       - in: query
 *         name: parent
 *         schema:
 *           type: string
 *         description: |
 *           Parent location ID for cascading filter.
 *           - For areas: provide district ID
 *           - For units: provide area ID
 *       - in: query
 *         name: active
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: Locations retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     locations:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           code:
 *                             type: string
 *                           type:
 *                             type: string
 *                           parent:
 *                             type: object
 *                             properties:
 *                               _id:
 *                                 type: string
 *                               name:
 *                                 type: string
 *                               type:
 *                                 type: string
 *                               code:
 *                                 type: string
 *                           isActive:
 *                             type: boolean
 *                           contactPerson:
 *                             type: object
 *                             properties:
 *                               name:
 *                                 type: string
 *                               phone:
 *                                 type: string
 *             examples:
 *               All Districts:
 *                 summary: Get all districts in Kerala
 *                 value:
 *                   success: true
 *                   data:
 *                     locations:
 *                       - _id: "507f1f77bcf86cd799439011"
 *                         name: "Malappuram"
 *                         code: "MALAPPURAM"
 *                         type: "district"
 *                         isActive: true
 *                       - _id: "507f1f77bcf86cd799439012"
 *                         name: "Kozhikode"
 *                         code: "KOZHIKODE"
 *                         type: "district"
 *                         isActive: true
 *               Areas by District:
 *                 summary: Get areas in Malappuram district
 *                 value:
 *                   success: true
 *                   data:
 *                     locations:
 *                       - _id: "507f1f77bcf86cd799439021"
 *                         name: "Tirur"
 *                         code: "TRR"
 *                         type: "area"
 *                         parent:
 *                           _id: "507f1f77bcf86cd799439011"
 *                           name: "Malappuram"
 *                           type: "district"
 *                           code: "MALAPPURAM"
 *                         isActive: true
 *                       - _id: "507f1f77bcf86cd799439022"
 *                         name: "Manjeri"
 *                         code: "MNJ"
 *                         type: "area"
 *                         parent:
 *                           _id: "507f1f77bcf86cd799439011"
 *                           name: "Malappuram"
 *                           type: "district"
 *                           code: "MALAPPURAM"
 *                         isActive: true
 *               Units by Area:
 *                 summary: Get units in Tirur area
 *                 value:
 *                   success: true
 *                   data:
 *                     locations:
 *                       - _id: "507f1f77bcf86cd799439031"
 *                         name: "Tirur West"
 *                         code: "TRR_W"
 *                         type: "unit"
 *                         parent:
 *                           _id: "507f1f77bcf86cd799439021"
 *                           name: "Tirur"
 *                           type: "area"
 *                           code: "TRR"
 *                         isActive: true
 *                       - _id: "507f1f77bcf86cd799439032"
 *                         name: "Tirur East"
 *                         code: "TRR_E"
 *                         type: "unit"
 *                         parent:
 *                           _id: "507f1f77bcf86cd799439021"
 *                           name: "Tirur"
 *                           type: "area"
 *                           code: "TRR"
 *                         isActive: true
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       500:
 *         description: Server error
 */
router.get('/by-type/:type',
  authenticate,
  authorize('super_admin', 'state_admin', 'district_admin', 'area_admin', 'unit_admin', 'project_coordinator', 'scheme_coordinator'),
  locationController.getLocationsByType
);

/**
 * @route   POST /api/locations
 * @desc    Create new location
 * @access  Private (Super Admin, State Admin, District Admin)
 */
router.post('/',
  authenticate,
  authorize('super_admin', 'state_admin', 'district_admin'),
  validate(locationSchemas.create),
  locationController.createLocation
);

/**
 * @swagger
 * /api/locations/{id}:
 *   get:
 *     tags:
 *       - Locations
 *     summary: Get location by ID
 *     description: |
 *       Retrieve detailed information about a specific location including its parent hierarchy.
 *       Useful for displaying location details in profile view or validation.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Location ID
 *     responses:
 *       200:
 *         description: Location retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     location:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         code:
 *                           type: string
 *                         type:
 *                           type: string
 *                           enum: [state, district, area, unit]
 *                         parent:
 *                           type: object
 *                           properties:
 *                             _id:
 *                               type: string
 *                             name:
 *                               type: string
 *                             type:
 *                               type: string
 *                             code:
 *                               type: string
 *                         isActive:
 *                           type: boolean
 *                         contactPerson:
 *                           type: object
 *                           properties:
 *                             name:
 *                               type: string
 *                             phone:
 *                               type: string
 *                             email:
 *                               type: string
 *                         childrenCount:
 *                           type: integer
 *                           description: Number of child locations
 *                         createdBy:
 *                           type: object
 *                           properties:
 *                             _id:
 *                               type: string
 *                             name:
 *                               type: string
 *                             email:
 *                               type: string
 *                         createdAt:
 *                           type: string
 *                           format: date-time
 *                         updatedAt:
 *                           type: string
 *                           format: date-time
 *             example:
 *               success: true
 *               data:
 *                 location:
 *                   _id: "507f1f77bcf86cd799439021"
 *                   name: "Tirur"
 *                   code: "TRR"
 *                   type: "area"
 *                   parent:
 *                     _id: "507f1f77bcf86cd799439011"
 *                     name: "Malappuram"
 *                     type: "district"
 *                     code: "MALAPPURAM"
 *                   isActive: true
 *                   contactPerson:
 *                     name: "Ahmed Ali"
 *                     phone: "+919876543210"
 *                     email: "ahmed@tirur.org"
 *                   childrenCount: 5
 *                   createdAt: "2024-01-15T10:30:00.000Z"
 *                   updatedAt: "2024-01-15T10:30:00.000Z"
 *       404:
 *         description: Location not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - No access to this location
 *       500:
 *         description: Server error
 */
router.get('/:id',
  authenticate,
  authorize('super_admin', 'state_admin', 'district_admin', 'area_admin', 'unit_admin', 'project_coordinator', 'scheme_coordinator'),
  validate(Joi.object({ id: commonSchemas.objectId }), 'params'),
  locationController.getLocationById
);

/**
 * @route   PUT /api/locations/:id
 * @desc    Update location
 * @access  Private (Super Admin, State Admin, District Admin)
 */
router.put('/:id',
  authenticate,
  authorize('super_admin', 'state_admin', 'district_admin'),
  validate(Joi.object({ id: commonSchemas.objectId }), 'params'),
  validate(locationSchemas.update),
  locationController.updateLocation
);

/**
 * @route   DELETE /api/locations/:id
 * @desc    Delete location (soft delete)
 * @access  Private (Super Admin, State Admin)
 */
router.delete('/:id',
  authenticate,
  authorize('super_admin', 'state_admin'),
  validate(Joi.object({ id: commonSchemas.objectId }), 'params'),
  locationController.deleteLocation
);

module.exports = router;