'use strict';

const dashboardService = require('../services/dashboard.service');

async function getMetrics(req, res, next) {
  try {
    const data = await dashboardService.getMetrics();
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function getSalesTrend(req, res, next) {
  try {
    const days = parseInt(req.query.days, 10) || 7;
    const data = await dashboardService.getSalesTrend(days);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function getLowStock(req, res, next) {
  try {
    const limit = parseInt(req.query.limit, 10) || 10;
    const data = await dashboardService.getLowStock(limit);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function getRecentTransactions(req, res, next) {
  try {
    const limit = parseInt(req.query.limit, 10) || 5;
    const data = await dashboardService.getRecentTransactions(limit);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

module.exports = {
  getMetrics,
  getSalesTrend,
  getLowStock,
  getRecentTransactions
};
