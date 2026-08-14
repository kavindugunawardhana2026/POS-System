'use strict';

const { Router } = require('express');
const ctrl = require('../../controllers/promotion.controller');
const { authenticate, authorize } = require('../../middlewares/auth');

const router = Router();
router.use(authenticate);

router.get('/active', ctrl.active); // Needs to be above /:id
router.get('/',    ctrl.list);
router.get('/:id', ctrl.getById);

router.use(authorize('admin', 'manager'));
router.post('/',   ctrl.create);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
