const express = require('express');
const router = express.Router();
const recurringPaymentController = require('../controllers/recurringPaymentController');
const { authenticate, crossFranchiseResolver } = require('../middleware/auth');
const { body, param, query } = require('express-validator');

// Apply authentication to all routes
router.use(authenticate);
router.use(crossFranchiseResolver);

/**
 * @route   POST /api/recurring-payments/generate-schedule/:applicationId
 * @desc    Generate recurring payment schedule for an application
 * @access  Private
 */
router.post(
  '/generate-schedule/:applicationId',
  [
    param('applicationId').isMongoId().withMessage('Invalid application ID'),
    body('recurringConfig.period')
      .isIn(['monthly', 'quarterly', 'semi_annually', 'annually'])
      .withMessage('Invalid recurring period'),
    body('recurringConfig.numberOfPayments')
      .isInt({ min: 1, max: 60 })
      .withMessage('Number of payments must be between 1 and 60'),
    body('recurringConfig.amountPerPayment')
      .isFloat({ min: 0 })
      .withMessage('Amount per payment must be a positive number'),
    body('recurringConfig.startDate')
      .isISO8601()
      .withMessage('Invalid start date format')
  ],
  recurringPaymentController.generateSchedule
);

/**
 * @route   GET /api/recurring-payments/applications
 * @desc    Get all applications with recurring payments
 * @access  Private
 */
router.get(
  '/applications',
  [
    query('scheme').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid scheme ID'),
    query('project').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid project ID'),
    query('status').optional({ checkFalsy: true }).isIn(['active', 'paused', 'completed', 'cancelled']),
    query('state').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid state ID'),
    query('district').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid district ID')
  ],
  recurringPaymentController.getRecurringApplications
);

/**
 * @route   GET /api/recurring-payments/applications/:applicationId/schedule
 * @desc    Get recurring payment schedule for a specific application
 * @access  Private
 */
router.get(
  '/applications/:applicationId/schedule',
  [
    param('applicationId').isMongoId().withMessage('Invalid application ID')
  ],
  recurringPaymentController.getApplicationSchedule
);

/**
 * @route   GET /api/recurring-payments/upcoming
 * @desc    Get upcoming recurring payments
 * @access  Private
 */
router.get(
  '/upcoming',
  [
    query('days').optional().isInt({ min: 1, max: 365 }).withMessage('Days must be between 1 and 365'),
    query('scheme').optional().isMongoId().withMessage('Invalid scheme ID'),
    query('project').optional().isMongoId().withMessage('Invalid project ID')
  ],
  recurringPaymentController.getUpcomingPayments
);

/**
 * @route   GET /api/recurring-payments/overdue
 * @desc    Get overdue recurring payments
 * @access  Private
 */
router.get(
  '/overdue',
  [
    query('scheme').optional().isMongoId().withMessage('Invalid scheme ID'),
    query('project').optional().isMongoId().withMessage('Invalid project ID')
  ],
  recurringPaymentController.getOverduePayments
);

/**
 * @route   GET /api/recurring-payments/forecast
 * @desc    Get budget forecast based on recurring payments
 * @access  Private
 */
router.get(
  '/forecast',
  [
    query('months').optional().isInt({ min: 1, max: 60 }).withMessage('Months must be between 1 and 60'),
    query('scheme').optional().isMongoId().withMessage('Invalid scheme ID'),
    query('project').optional().isMongoId().withMessage('Invalid project ID')
  ],
  recurringPaymentController.getBudgetForecast
);

/**
 * @route   GET /api/recurring-payments/dashboard
 * @desc    Get dashboard statistics for recurring payments
 * @access  Private
 */
router.get(
  '/dashboard',
  [
    query('scheme').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid scheme ID'),
    query('project').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid project ID'),
    query('status').optional({ checkFalsy: true }).isIn(['active', 'paused', 'completed', 'cancelled'])
  ],
  recurringPaymentController.getDashboardStats
);

/**
 * @route   GET /api/recurring-payments/:paymentId
 * @desc    Get single recurring payment details
 * @access  Private
 */
router.get(
  '/:paymentId',
  [
    param('paymentId').isMongoId().withMessage('Invalid payment ID')
  ],
  recurringPaymentController.getRecurringPayment
);

/**
 * @route   POST /api/recurring-payments/:paymentId/record
 * @desc    Record a recurring payment as completed
 * @access  Private
 */
router.post(
  '/:paymentId/record',
  [
    param('paymentId').isMongoId().withMessage('Invalid payment ID'),
    body('amount').optional().isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
    body('method')
      .isIn(['bank_transfer', 'cheque', 'cash', 'digital_wallet', 'upi'])
      .withMessage('Invalid payment method'),
    body('transactionReference').optional().isString()
  ],
  recurringPaymentController.recordPayment
);

/**
 * @route   PUT /api/recurring-payments/:paymentId
 * @desc    Update a recurring payment
 * @access  Private
 */
router.put(
  '/:paymentId',
  [
    param('paymentId').isMongoId().withMessage('Invalid payment ID'),
    body('scheduledDate').optional().isISO8601().withMessage('Invalid scheduled date'),
    body('dueDate').optional().isISO8601().withMessage('Invalid due date'),
    body('amount').optional().isFloat({ min: 0 }).withMessage('Amount must be positive'),
    body('description').optional().isString().isLength({ max: 500 }),
    body('notes').optional().isString().isLength({ max: 1000 })
  ],
  recurringPaymentController.updateRecurringPayment
);

/**
 * @route   DELETE /api/recurring-payments/:paymentId/cancel
 * @desc    Cancel a recurring payment
 * @access  Private
 */
router.delete(
  '/:paymentId/cancel',
  [
    param('paymentId').isMongoId().withMessage('Invalid payment ID'),
    body('reason').notEmpty().withMessage('Cancellation reason is required')
  ],
  recurringPaymentController.cancelRecurringPayment
);

/**
 * @route   POST /api/recurring-payments/update-overdue
 * @desc    Update overdue statuses (for cron jobs)
 * @access  Private (Admin only)
 */
router.post(
  '/update-overdue',
  recurringPaymentController.updateOverdueStatuses
);

module.exports = router;
