const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactMessageController');
const { authenticate, crossFranchiseResolver } = require('../middleware/auth');
const { hasAnyPermission } = require('../middleware/rbacMiddleware');

// Public: submit a message
router.post('/public', contactController.submit);

// Protected: manage messages
router.use(authenticate);
router.use(crossFranchiseResolver);

router.get('/', hasAnyPermission(['website.read', 'website.write']), contactController.getAll);
router.put('/:id', hasAnyPermission(['website.write']), contactController.updateStatus);
router.delete('/:id', hasAnyPermission(['website.delete']), contactController.remove);

module.exports = router;
