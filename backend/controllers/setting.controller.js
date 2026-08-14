'use strict';

const settingService = require('../services/setting.service');

async function list(req, res, next) {
  try {
    const data = await settingService.getAllSettings();
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    const all = await settingService.getAllSettings();
    res.json({ success: true, data: all[req.params.id] ?? null });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  next(); // alias to update
}

async function update(req, res, next) {
  try {
    const { key, value } = req.body;
    const result = await settingService.setSetting(key, value);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  res.status(405).json({ success: false, message: 'Settings cannot be deleted' });
}

// ─── Module permissions ────────────────────────────────────────

async function getModulePermissions(req, res, next) {
  try {
    const data = await settingService.getModulePermissions();
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function updateModulePermissions(req, res, next) {
  try {
    const data = await settingService.setModulePermissions(req.body);
    res.json({ success: true, data, message: 'Module permissions updated' });
  } catch (err) { next(err); }
}

module.exports = {
  list, getById, create, update, remove,
  getModulePermissions, updateModulePermissions,
};
