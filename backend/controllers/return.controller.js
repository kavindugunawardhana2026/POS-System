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

async function update(req, res, next) {
  try {
    const item = await returnService.update(req.params.id, req.body, req.user);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    await returnService.remove(req.params.id, req.user);
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (err) { next(err); }
}

module.exports = { list, getById, create, update, remove };
