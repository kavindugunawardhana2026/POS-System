'use strict';

const { Router } = require('express');
const ctrl = require('../../controllers/report.controller');
const { authenticate } = require('../../middlewares/auth');

const router = Router();
router.use(authenticate);

router.get('/sales-summary',  ctrl.salesSummary);
router.get('/top-products',   ctrl.topProducts);
router.get('/sales-by-period', ctrl.salesByPeriod);
router.get('/payment-methods', ctrl.paymentMethods);

module.exports = router;
