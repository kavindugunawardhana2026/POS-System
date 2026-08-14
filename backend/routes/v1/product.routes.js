'use strict';

const { Router } = require('express');
const ctrl = require('../../controllers/product.controller');
const { authenticate, authorize } = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const { upload } = require('../../middlewares/upload');
const { createProductSchema, updateProductSchema } = require('../../validators/product.validator');

const router = Router();
router.use(authenticate);

// ── Static routes first (must come before /:id) ──────────────────────
router.get('/',          ctrl.list);
router.get('/low-stock', ctrl.lowStock);

// Bulk upload (Excel/CSV) — admin/manager only
router.post(
  '/bulk-upload',
  authorize('admin', 'manager'),
  upload.single('file'),
  ctrl.bulkUpload
);

// ── Parameterised routes ──────────────────────────────────────────────
router.get('/:id',    ctrl.getById);
router.post('/',      authorize('admin','manager'), validate(createProductSchema), ctrl.create);
router.put('/:id',    authorize('admin','manager'), validate(updateProductSchema), ctrl.update);
router.delete('/:id', authorize('admin'), ctrl.remove);

module.exports = router;
