'use strict';

const { Router } = require('express');
const ctrl = require('../../controllers/setting.controller');
const { authenticate, authorize } = require('../../middlewares/auth');

const router = Router();
router.use(authenticate);

// All roles can read settings (frontend needs module_permissions)
router.get('/',                        ctrl.list);
router.get('/module-permissions',      ctrl.getModulePermissions);

// Admin only: mutate
router.put('/',                        authorize('admin'), ctrl.update);
router.put('/module-permissions',      authorize('admin'), ctrl.updateModulePermissions);

module.exports = router;
