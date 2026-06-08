const express = require('express');
const router = express.Router();
const faqController = require('../controllers/faqController');
const { authenticate, crossFranchiseResolver } = require('../middleware/auth');
const { hasAnyPermission } = require('../middleware/rbacMiddleware');

// Public
router.get('/public', faqController.getPublic);

// Protected
router.use(authenticate);
router.use(crossFranchiseResolver);

router.get('/', hasAnyPermission(['website.read', 'website.write']), faqController.getAll);
router.post('/', hasAnyPermission(['website.write']), faqController.create);
router.put('/:id', hasAnyPermission(['website.write']), faqController.update);
router.delete('/:id', hasAnyPermission(['website.delete']), faqController.remove);

module.exports = router;
