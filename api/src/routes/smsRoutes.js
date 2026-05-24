const express = require('express');
const smsController = require('../controllers/smsController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const Joi = require('joi');

const router = express.Router();

// SMS validation schemas
const smsSchemas = {
  sendSMS: Joi.object({
    phone: Joi.string().pattern(/^[6-9]\d{9}$/).required(),
    message: Joi.string().max(1000),
    templateKey: Joi.string(),
    variables: Joi.object().default({}),
    priority: Joi.string().valid('low', 'normal', 'high', 'critical').default('normal')
  }).xor('message', 'templateKey'),

  sendBulkSMS: Joi.object({
    recipients: Joi.array().items(
      Joi.object({
        phone: Joi.string().pattern(/^[6-9]\d{9}$/).required(),
        name: Joi.string().required()
      })
    ).min(1).max(1000).required(),
    message: Joi.string().max(1000),
    templateKey: Joi.string(),
    variables: Joi.object().default({}),
    priority: Joi.string().valid('low', 'normal', 'high', 'critical').default('normal')
  }).xor('message', 'templateKey'),

  previewTemplate: Joi.object({
    variables: Joi.object().required()
  }),


};

/**
 * @swagger
 * /api/sms/send:
 *   post:
 *     summary: Send single SMS
 *     tags: [SMS]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *             properties:
 *               phone:
 *                 type: string
 *                 pattern: '^[6-9]\d{9}$'
 *                 description: Indian mobile number
 *               message:
 *                 type: string
 *                 maxLength: 1000
 *                 description: SMS message (required if templateKey not provided)
 *               templateKey:
 *                 type: string
 *                 description: Template key (required if message not provided)
 *               variables:
 *                 type: object
 *                 description: Template variables
 *               priority:
 *                 type: string
 *                 enum: [low, normal, high, critical]
 *                 default: normal
 *     responses:
 *       200:
 *         description: SMS queued successfully
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 */
router.post('/send',
  authenticate,
  authorize('state_admin', 'district_admin', 'area_admin', 'unit_admin', 'area_president'),
  validate(smsSchemas.sendSMS),
  smsController.sendSMS
);

/**
 * @swagger
 * /api/sms/send-bulk:
 *   post:
 *     summary: Send bulk SMS
 *     tags: [SMS]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - recipients
 *             properties:
 *               recipients:
 *                 type: array
 *                 minItems: 1
 *                 maxItems: 1000
 *                 items:
 *                   type: object
 *                   required:
 *                     - phone
 *                     - name
 *                   properties:
 *                     phone:
 *                       type: string
 *                       pattern: '^[6-9]\d{9}$'
 *                     name:
 *                       type: string
 *               message:
 *                 type: string
 *                 maxLength: 1000
 *               templateKey:
 *                 type: string
 *               variables:
 *                 type: object
 *               priority:
 *                 type: string
 *                 enum: [low, normal, high, critical]
 *                 default: normal
 *     responses:
 *       200:
 *         description: Bulk SMS queued successfully
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 */
router.post('/send-bulk',
  authenticate,
  authorize('state_admin', 'district_admin'),
  validate(smsSchemas.sendBulkSMS),
  smsController.sendBulkSMS
);

/**
 * @swagger
 * /api/sms/templates:
 *   get:
 *     summary: Get SMS templates
 *     tags: [SMS]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [authentication, application, payment, interview, document, reminder, system, emergency]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Templates retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/templates',
  authenticate,
  smsController.getTemplates
);

/**
 * @swagger
 * /api/sms/templates/{templateKey}:
 *   get:
 *     summary: Get specific template
 *     tags: [SMS]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateKey
 *         required: true
 *         schema:
 *           type: string
 *         description: Template key (e.g., authentication.otp_login)
 *     responses:
 *       200:
 *         description: Template retrieved successfully
 *       404:
 *         description: Template not found
 *       401:
 *         description: Authentication required
 */
router.get('/templates/:templateKey',
  authenticate,
  smsController.getTemplate
);

/**
 * @swagger
 * /api/sms/templates/{templateKey}/preview:
 *   post:
 *     summary: Preview template with variables
 *     tags: [SMS]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateKey
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - variables
 *             properties:
 *               variables:
 *                 type: object
 *                 description: Template variables
 *     responses:
 *       200:
 *         description: Template preview generated
 *       400:
 *         description: Invalid template variables
 *       404:
 *         description: Template not found
 *       401:
 *         description: Authentication required
 */
router.post('/templates/:templateKey/preview',
  authenticate,
  validate(smsSchemas.previewTemplate),
  smsController.previewTemplate
);

/**
 * @swagger
 * /api/sms/status/{messageId}:
 *   get:
 *     summary: Get SMS delivery status
 *     tags: [SMS]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Delivery status retrieved
 *       400:
 *         description: Invalid message ID
 *       401:
 *         description: Authentication required
 */
router.get('/status/:messageId',
  authenticate,
  smsController.getDeliveryStatus
);



/**
 * @swagger
 * /api/sms/account/balance:
 *   get:
 *     summary: Get DXing account balance
 *     tags: [SMS]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Account balance retrieved
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 */
router.get('/account/balance',
  authenticate,
  authorize('state_admin', 'district_admin'),
  smsController.getAccountBalance
);



/**
 * @swagger
 * /api/sms/test-connection:
 *   post:
 *     summary: Test SMS service connection
 *     tags: [SMS]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Connection test successful
 *       503:
 *         description: Service unavailable
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 */
router.post('/test-connection',
  authenticate,
  authorize('state_admin', 'district_admin'),
  smsController.testConnection
);



/**
 * @swagger
 * /api/sms/usage-stats:
 *   get:
 *     summary: Get DXing API usage statistics
 *     tags: [SMS]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Usage statistics retrieved
 *       400:
 *         description: Invalid date range
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 */
router.get('/usage-stats',
  authenticate,
  authorize('state_admin', 'district_admin'),
  smsController.getUsageStatistics
);

module.exports = router;