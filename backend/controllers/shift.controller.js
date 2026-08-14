'use strict';

const shiftService = require('../services/shift.service');

async function list(req, res, next) {
  try {
    const data = await shiftService.list(req.query);
    res.json({ success: true, ...data });
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    const item = await shiftService.getById(req.params.id);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const item = await shiftService.create(req.body, req.user);
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const item = await shiftService.update(req.params.id, req.body, req.user);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    await shiftService.remove(req.params.id, req.user);
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (err) { next(err); }
}

module.exports = { list, getById, create, update, remove };
