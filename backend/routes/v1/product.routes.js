'use strict';

const { Router } = require('express');
const ctrl = require('../../controllers/product.controller');
const { authenticate, authorize } = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const { createProductSchema, updateProductSchema } = require('../../validators/product.validator');

const router = Router();
router.use(authenticate);

router.get('/',     ctrl.list);
router.get('/low-stock', ctrl.lowStock);
router.get('/:id',  ctrl.getById);
router.post('/',    authorize('admin','manager'), validate(createProductSchema), ctrl.create);
router.put('/:id',  authorize('admin','manager'), validate(updateProductSchema), ctrl.update);
router.delete('/:id', authorize('admin'), ctrl.remove);

module.exports = router;
