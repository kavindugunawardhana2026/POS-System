'use strict';

const { Router } = require('express');
const ctrl = require('../../controllers/return.controller');
const { authenticate, authorize } = require('../../middlewares/auth');

const router = Router();
router.use(authenticate);

router.get('/',                              ctrl.list);
router.get('/credit/:return_number',         ctrl.validateCredit);   // POS credit note check
router.get('/:id',                           ctrl.getById);
router.post('/',                             ctrl.create);

module.exports = router;
