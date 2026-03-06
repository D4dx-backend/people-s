const express = require('express');
const donationController = require('../controllers/donationController');
const { authenticate, crossFranchiseResolver } = require('../middleware/auth');
const RBACMiddleware = require('../middleware/rbacMiddleware');
const { createExportHandler } = require('../middleware/exportHandler');
const exportConfigs = require('../config/exportConfigs');
const Donation = require('../models/Donation');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);
router.use(crossFranchiseResolver);

/**
 * @swagger
 * /api/donations:
 *   get:
 *     summary: Get all donations with pagination and filtering
 *     tags: [Donations]
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
 *         description: Number of donations per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for donor name or payment number
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, processing, completed, failed, cancelled]
 *         description: Filter by status
 *       - in: query
 *         name: method
 *         schema:
 *           type: string
 *           enum: [online, bank_transfer, cash, cheque, card]
 *         description: Filter by payment method
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter donations from this date
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter donations to this date
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: createdAt
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Donations retrieved successfully
 *       401:
 *         description: Authentication required
 */
// Export donations as CSV or JSON
router.get('/export',
  RBACMiddleware.hasPermission('donors.read.regional'),
  createExportHandler(Donation, exportConfigs.donation)
);

router.get('/', 
  RBACMiddleware.hasPermission('donors.read.regional'),
  donationController.getDonations
);

/**
 * @swagger
 * /api/donations/{id}:
 *   get:
 *     summary: Get single donation by ID
 *     tags: [Donations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Donation ID
 *     responses:
 *       200:
 *         description: Donation retrieved successfully
 *       404:
 *         description: Donation not found
 *       401:
 *         description: Authentication required
 */
router.get('/:id', 
  RBACMiddleware.hasPermission('donors.read.regional'),
  donationController.getDonation
);

/**
 * @swagger
 * /api/donations:
 *   post:
 *     summary: Create new donation
 *     tags: [Donations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - method
 *             properties:
 *               donor:
 *                 type: string
 *                 description: Donor ID (optional for anonymous donations)
 *               amount:
 *                 type: number
 *                 description: Donation amount
 *               method:
 *                 type: string
 *                 enum: [online, bank_transfer, cash, cheque, card]
 *               project:
 *                 type: string
 *                 description: Project ID (optional)
 *               scheme:
 *                 type: string
 *                 description: Scheme ID (optional)
 *               notes:
 *                 type: string
 *                 description: Additional notes
 *     responses:
 *       201:
 *         description: Donation created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 */
router.post('/', 
  RBACMiddleware.hasPermission('donors.create'),
  RBACMiddleware.auditLog('donation_creation'),
  donationController.createDonation
);

/**
 * @swagger
 * /api/donations/{id}:
 *   put:
 *     summary: Update donation
 *     tags: [Donations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Donation ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Donation updated successfully
 *       404:
 *         description: Donation not found
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 */
router.put('/:id', 
  RBACMiddleware.hasPermission('donors.update.regional'),
  RBACMiddleware.auditLog('donation_update'),
  donationController.updateDonation
);

/**
 * @swagger
 * /api/donations/{id}/status:
 *   patch:
 *     summary: Update donation status
 *     tags: [Donations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Donation ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, processing, completed, failed, cancelled]
 *     responses:
 *       200:
 *         description: Donation status updated successfully
 *       404:
 *         description: Donation not found
 *       400:
 *         description: Invalid status
 *       401:
 *         description: Authentication required
 */
router.patch('/:id/status', 
  RBACMiddleware.hasPermission('donors.update.regional'),
  RBACMiddleware.auditLog('donation_status_update'),
  donationController.updateDonationStatus
);

/**
 * @swagger
 * /api/donations/stats:
 *   get:
 *     summary: Get donation statistics
 *     tags: [Donations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Donation statistics retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/analytics/stats', 
  RBACMiddleware.hasPermission('donors.read.regional'),
  donationController.getDonationStats
);

/**
 * @swagger
 * /api/donations/recent:
 *   get:
 *     summary: Get recent donations
 *     tags: [Donations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of recent donations to retrieve
 *     responses:
 *       200:
 *         description: Recent donations retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/analytics/recent', 
  RBACMiddleware.hasPermission('donors.read.regional'),
  donationController.getRecentDonations
);

/**
 * @swagger
 * /api/donations/trends:
 *   get:
 *     summary: Get donation trends
 *     tags: [Donations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: months
 *         schema:
 *           type: integer
 *           default: 6
 *         description: Number of months to include in trends
 *     responses:
 *       200:
 *         description: Donation trends retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/analytics/trends', 
  RBACMiddleware.hasPermission('donors.read.regional'),
  donationController.getDonationTrends
);

module.exports = router;