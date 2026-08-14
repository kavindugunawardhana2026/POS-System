'use strict';

const { Router } = require('express');
const authRoutes     = require('./auth.routes');
const userRoutes     = require('./user.routes');
const categoryRoutes = require('./category.routes');
const productRoutes  = require('./product.routes');
const invoiceRoutes  = require('./invoice.routes');
const returnRoutes   = require('./return.routes');
const customerRoutes = require('./customer.routes');
const supplierRoutes = require('./supplier.routes');
const purchaseRoutes = require('./purchase.routes');
const reportRoutes   = require('./report.routes');
const settingRoutes  = require('./setting.routes');
const shiftRoutes    = require('./shift.routes');
const expenseRoutes  = require('./expense.routes');

const router = Router();

router.use('/auth',      authRoutes);
router.use('/users',     userRoutes);
router.use('/categories',categoryRoutes);
router.use('/products',  productRoutes);
router.use('/invoices',  invoiceRoutes);
router.use('/returns',   returnRoutes);
router.use('/customers', customerRoutes);
router.use('/suppliers', supplierRoutes);
router.use('/purchases', purchaseRoutes);
router.use('/reports',   reportRoutes);
router.use('/settings',  settingRoutes);
router.use('/shifts',    shiftRoutes);
router.use('/expenses',  expenseRoutes);

module.exports = router;
