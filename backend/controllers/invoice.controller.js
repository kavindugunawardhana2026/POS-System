'use strict';

const invoiceService = require('../services/invoice.service');

async function list(req, res, next) {
  try {
    const { page = 1, limit = 20, status, from, to, customer_id } = req.query;
    const data = await invoiceService.listInvoices({ page, limit, status, from, to, customer_id });
    res.json({ success: true, ...data });
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    const invoice = await invoiceService.getInvoice(req.params.id);
    res.json({ success: true, data: invoice });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const invoice = await invoiceService.createInvoice(req.body, req.user);
    res.status(201).json({ success: true, data: invoice, message: 'Invoice created successfully' });
  } catch (err) { next(err); }
}

async function cancel(req, res, next) {
  try {
    await invoiceService.cancelInvoice(req.params.id, req.user);
    res.json({ success: true, message: 'Invoice cancelled' });
  } catch (err) { next(err); }
}

async function voidInvoice(req, res, next) {
  try {
    await invoiceService.voidInvoice(req.params.id, req.user);
    res.json({ success: true, message: 'Invoice voided' });
  } catch (err) { next(err); }
}

module.exports = { list, getById, create, cancel, void: voidInvoice };
