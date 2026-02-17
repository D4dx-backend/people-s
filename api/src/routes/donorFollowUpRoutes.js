const express = require('express');
const donorFollowUpController = require('../controllers/donorFollowUpController');
const { authenticate } = require('../middleware/auth');
const RBACMiddleware = require('../middleware/rbacMiddleware');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// Dashboard & analytics (must come before :id routes)
router.get('/dashboard',
  RBACMiddleware.hasAnyPermission(['donors.read', 'donors.read.regional', 'donors.read.all']),
  donorFollowUpController.getDashboardStats.bind(donorFollowUpController)
);

router.get('/upcoming',
  RBACMiddleware.hasAnyPermission(['donors.read', 'donors.read.regional', 'donors.read.all']),
  donorFollowUpController.getUpcoming.bind(donorFollowUpController)
);

router.get('/overdue',
  RBACMiddleware.hasAnyPermission(['donors.read', 'donors.read.regional', 'donors.read.all']),
  donorFollowUpController.getOverdue.bind(donorFollowUpController)
);

router.get('/lapsed',
  RBACMiddleware.hasAnyPermission(['donors.read', 'donors.read.regional', 'donors.read.all']),
  donorFollowUpController.getLapsed.bind(donorFollowUpController)
);

// Get follow-ups for a specific donor
router.get('/by-donor/:donorId',
  RBACMiddleware.hasAnyPermission(['donors.read', 'donors.read.regional', 'donors.read.all']),
  donorFollowUpController.getByDonor.bind(donorFollowUpController)
);

// Manual trigger for processing reminders (admin only)
router.post('/process-reminders',
  RBACMiddleware.hasAnyPermission(['donors.update', 'donors.update.regional']),
  donorFollowUpController.triggerProcessing.bind(donorFollowUpController)
);

// CRUD operations
router.get('/',
  RBACMiddleware.hasAnyPermission(['donors.read', 'donors.read.regional', 'donors.read.all']),
  donorFollowUpController.getFollowUps.bind(donorFollowUpController)
);

router.post('/',
  RBACMiddleware.hasPermission('donors.create'),
  donorFollowUpController.createFollowUp.bind(donorFollowUpController)
);

router.get('/:id',
  RBACMiddleware.hasAnyPermission(['donors.read', 'donors.read.regional', 'donors.read.all']),
  donorFollowUpController.getFollowUpById.bind(donorFollowUpController)
);

router.put('/:id',
  RBACMiddleware.hasAnyPermission(['donors.update', 'donors.update.regional']),
  donorFollowUpController.updateFollowUp.bind(donorFollowUpController)
);

// Actions
router.patch('/:id/assign',
  RBACMiddleware.hasAnyPermission(['donors.update', 'donors.update.regional']),
  donorFollowUpController.assignFollowUp.bind(donorFollowUpController)
);

router.patch('/:id/complete',
  RBACMiddleware.hasAnyPermission(['donors.update', 'donors.update.regional']),
  donorFollowUpController.completeFollowUp.bind(donorFollowUpController)
);

router.patch('/:id/cancel',
  RBACMiddleware.hasAnyPermission(['donors.update', 'donors.update.regional']),
  donorFollowUpController.cancelFollowUp.bind(donorFollowUpController)
);

router.post('/:id/notes',
  RBACMiddleware.hasAnyPermission(['donors.update', 'donors.update.regional']),
  donorFollowUpController.addNote.bind(donorFollowUpController)
);

router.post('/:id/send-reminder',
  RBACMiddleware.hasAnyPermission(['donors.update', 'donors.update.regional']),
  donorFollowUpController.sendReminder.bind(donorFollowUpController)
);

module.exports = router;
