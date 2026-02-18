const express = require('express');
const schemeTargetController = require('../controllers/schemeTargetController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/scheme-targets/{schemeId}/form-fields:
 *   get:
 *     summary: Get form fields eligible for criteria mapping
 *     tags: [Scheme Targets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: schemeId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Form fields retrieved
 */
router.get('/:schemeId/form-fields', schemeTargetController.getFormFields);

/**
 * @swagger
 * /api/scheme-targets/{schemeId}/progress:
 *   get:
 *     summary: Get target progress auto-tracked from applications
 *     tags: [Scheme Targets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: schemeId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Progress data retrieved
 */
router.get('/:schemeId/progress', schemeTargetController.getProgress);

/**
 * @swagger
 * /api/scheme-targets/{schemeId}:
 *   get:
 *     summary: Get target configuration for a scheme
 *     tags: [Scheme Targets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: schemeId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Target configuration retrieved
 */
router.get('/:schemeId', schemeTargetController.getTargets);

/**
 * @swagger
 * /api/scheme-targets/{schemeId}:
 *   put:
 *     summary: Create or update target configuration for a scheme
 *     tags: [Scheme Targets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: schemeId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [totalTarget]
 *             properties:
 *               totalTarget:
 *                 type: number
 *               description:
 *                 type: string
 *               monthlyTargets:
 *                 type: array
 *     responses:
 *       200:
 *         description: Targets saved successfully
 */
router.put('/:schemeId', 
  authorize('super_admin', 'state_admin', 'district_admin', 'project_coordinator'),
  schemeTargetController.upsertTargets
);

/**
 * @swagger
 * /api/scheme-targets/{schemeId}:
 *   delete:
 *     summary: Delete target configuration for a scheme
 *     tags: [Scheme Targets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: schemeId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Targets deleted successfully
 */
router.delete('/:schemeId', 
  authorize('super_admin', 'state_admin', 'district_admin'),
  schemeTargetController.deleteTargets
);

module.exports = router;
