'use strict';

const { Router } = require('express');
const ctrl = require('../../controllers/shift.controller');
const { authenticate, authorize } = require('../../middlewares/auth');

const router = Router();
router.use(authenticate);

router.get('/',    ctrl.list);
router.get('/:id', ctrl.getById);
router.post('/',   ctrl.create);
router.put('/:id', ctrl.update);
router.delete('/:id', authorize('admin'), ctrl.remove);

module.exports = router;
