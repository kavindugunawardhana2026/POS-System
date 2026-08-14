'use strict';

const returnService = require('../services/return.service');

async function list(req, res, next) {
  try {
    const data = await returnService.list(req.query);
    res.json({ success: true, ...data });
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    const item = await returnService.getById(req.params.id);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const item = await returnService.create(req.body, req.user);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
}

async function validateCredit(req, res, next) {
  try {
    const { return_number } = req.params;
    const credit = await returnService.validateCreditNote(return_number);
    res.json({ success: true, data: credit });
  } catch (err) { next(err); }
}

module.exports = { list, getById, create, validateCredit };
