'use strict';

const promotionService = require('../services/promotion.service');

async function list(req, res, next) {
  try {
    const data = await promotionService.list(req.query);
    res.json({ success: true, ...data });
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    const item = await promotionService.getById(req.params.id);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const item = await promotionService.create(req.body);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const item = await promotionService.update(req.params.id, req.body);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    await promotionService.remove(req.params.id);
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (err) { next(err); }
}

async function active(req, res, next) {
  try {
    const data = await promotionService.getActivePromotions();
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

module.exports = { list, getById, create, update, remove, active };
