'use strict';

const { Router } = require('express');
const ctrl = require('../../controllers/user.controller');
const { authenticate, authorize } = require('../../middlewares/auth');

const router = Router();
router.use(authenticate);

// Admin + Manager: read users
router.get('/',    authorize('admin', 'manager'), ctrl.list);
router.get('/:id', authorize('admin', 'manager'), ctrl.getById);

// Admin only: create / modify / delete users
router.post('/',             authorize('admin'), ctrl.create);
router.put('/:id',           authorize('admin'), ctrl.update);
router.delete('/:id',        authorize('admin'), ctrl.remove);

// PIN management (admin only)
router.post('/:id/set-pin',   authorize('admin'), ctrl.setPin);
router.delete('/:id/pin',     authorize('admin'), ctrl.clearPin);
router.post('/:id/unlock',    authorize('admin'), ctrl.unlock);

module.exports = router;
