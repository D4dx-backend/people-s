const express = require('express');
const dashboardController = require('../controllers/dashboardController');
const { authenticate, crossFranchiseResolver, hasPermission } = require('../middleware/auth');
const RBACMiddleware = require('../middleware/rbacMiddleware');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);
router.use(crossFranchiseResolver);

/**
 * @swagger
 * /api/dashboard/overview:
 *   get:
 *     summary: Get dashboard overview statistics
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard overview retrieved successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 */
router.get('/overview', 
  RBACMiddleware.hasAnyPermission([
    'users.read.regional',
    'beneficiaries.read.regional',
    'applications.read.regional'
  ]),
  dashboardController.getOverview
);

/**
 * @swagger
 * /api/dashboard/recent-applications:
 *   get:
 *     summary: Get recent applications
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of recent applications to retrieve
 *     responses:
 *       200:
 *         description: Recent applications retrieved successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 */
router.get('/recent-applications', 
  hasPermission('applications.read.regional'),
  dashboardController.getRecentApplications
);

/**
 * @swagger
 * /api/dashboard/recent-payments:
 *   get:
 *     summary: Get recent payments
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of recent payments to retrieve
 *     responses:
 *       200:
 *         description: Recent payments retrieved successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 */
router.get('/recent-payments', 
  hasPermission('finances.read.regional'),
  dashboardController.getRecentPayments
);

/**
 * @swagger
 * /api/dashboard/monthly-trends:
 *   get:
 *     summary: Get monthly trends
 *     tags: [Dashboard]
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
 *         description: Monthly trends retrieved successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 */
router.get('/monthly-trends', 
  hasPermission('reports.read.regional'),
  dashboardController.getMonthlyTrends
);

/**
 * @swagger
 * /api/dashboard/project-performance:
 *   get:
 *     summary: Get project performance data
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Project performance data retrieved successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 */
router.get('/project-performance', 
  hasPermission('projects.read.assigned'),
  dashboardController.getProjectPerformance
);

module.exports = router;