'use strict';

const { Router } = require('express');
const ctrl = require('../../controllers/invoice.controller');
const { authenticate, authorize } = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const { createInvoiceSchema } = require('../../validators/invoice.validator');

const router = Router();
router.use(authenticate);

router.get('/',      ctrl.list);
router.get('/:id',   ctrl.getById);
router.post('/',     validate(createInvoiceSchema), ctrl.create);
router.patch('/:id/cancel', authorize('admin','manager'), ctrl.cancel);
router.patch('/:id/void',   authorize('admin'), ctrl.void);

module.exports = router;
