'use strict';

const { Router } = require('express');
const ctrl = require('../../controllers/dashboard.controller');
const { authenticate } = require('../../middlewares/auth');

const router = Router();

// Protect all dashboard routes
router.use(authenticate);

router.get('/metrics',             ctrl.getMetrics);
router.get('/sales-trend',         ctrl.getSalesTrend);
router.get('/low-stock',           ctrl.getLowStock);
router.get('/recent-transactions', ctrl.getRecentTransactions);

module.exports = router;
