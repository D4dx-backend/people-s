const express = require('express');
const router = express.Router();
const volunteerController = require('../controllers/volunteerController');
const { authenticate, crossFranchiseResolver } = require('../middleware/auth');
const { hasAnyPermission } = require('../middleware/rbacMiddleware');

// Public: submit a volunteer application
router.post('/public', volunteerController.submit);

// Protected: manage volunteers
router.use(authenticate);
router.use(crossFranchiseResolver);

router.get('/', hasAnyPermission(['website.read', 'website.write']), volunteerController.getAll);
router.put('/:id', hasAnyPermission(['website.write']), volunteerController.updateStatus);
router.delete('/:id', hasAnyPermission(['website.delete']), volunteerController.remove);

module.exports = router;
