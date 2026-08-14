'use strict';

const reportService = require('../services/report.service');

async function salesSummary(req, res, next) {
  try {
    const data = await reportService.salesSummary(req.query);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function topProducts(req, res, next) {
  try {
    const data = await reportService.topProducts(req.query);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function salesByPeriod(req, res, next) {
  try {
    const data = await reportService.salesByPeriod(req.query);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function paymentMethods(req, res, next) {
  try {
    const data = await reportService.paymentMethods(req.query);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

module.exports = { salesSummary, topProducts, salesByPeriod, paymentMethods };
