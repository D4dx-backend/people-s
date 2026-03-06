const express = require('express');
const budgetController = require('../controllers/budgetController');
const { authenticate, crossFranchiseResolver, hasPermission } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);
router.use(crossFranchiseResolver);

/**
 * @swagger
 * /api/budget/overview:
 *   get:
 *     summary: Get budget overview and statistics
 *     tags: [Budget]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Budget overview retrieved successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 */
router.get('/overview', 
  hasPermission('finances.read.regional'),
  budgetController.getBudgetOverview
);

/**
 * @swagger
 * /api/budget/projects:
 *   get:
 *     summary: Get budget breakdown by projects
 *     tags: [Budget]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Project budgets retrieved successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 */
router.get('/projects', 
  hasPermission('finances.read.regional'),
  budgetController.getProjectBudgets
);

/**
 * @swagger
 * /api/budget/schemes:
 *   get:
 *     summary: Get budget breakdown by schemes
 *     tags: [Budget]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Scheme budgets retrieved successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 */
router.get('/schemes', 
  hasPermission('finances.read.regional'),
  budgetController.getSchemeBudgets
);

/**
 * @swagger
 * /api/budget/transactions:
 *   get:
 *     summary: Get recent transactions
 *     tags: [Budget]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of transactions to retrieve
 *     responses:
 *       200:
 *         description: Recent transactions retrieved successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 */
router.get('/transactions', 
  hasPermission('finances.read.regional'),
  budgetController.getRecentTransactions
);

/**
 * @swagger
 * /api/budget/monthly-summary:
 *   get:
 *     summary: Get monthly budget summary
 *     tags: [Budget]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *         description: Year for the summary
 *       - in: query
 *         name: months
 *         schema:
 *           type: integer
 *           default: 6
 *         description: Number of months to include
 *     responses:
 *       200:
 *         description: Monthly summary retrieved successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 */
router.get('/monthly-summary', 
  hasPermission('finances.read.regional'),
  budgetController.getMonthlySummary
);

/**
 * @swagger
 * /api/budget/by-category:
 *   get:
 *     summary: Get budget breakdown by category
 *     tags: [Budget]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Budget by category retrieved successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 */
router.get('/by-category', 
  hasPermission('finances.read.regional'),
  budgetController.getBudgetByCategory
);

/**
 * @swagger
 * /api/budget/analytics:
 *   get:
 *     summary: Get budget analytics and insights
 *     tags: [Budget]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Budget analytics retrieved successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 */
router.get('/analytics', 
  hasPermission('finances.read.regional'),
  budgetController.getBudgetAnalytics
);

module.exports = router;