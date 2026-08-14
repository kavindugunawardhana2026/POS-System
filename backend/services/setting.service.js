'use strict';

const db = require('../config/db');

const MODULE_PERMISSIONS_KEY = 'module_permissions';

/**
 * Get all key-value settings as a plain object.
 */
async function getAllSettings() {
  const [rows] = await db.execute(`SELECT setting_key, setting_value FROM Settings`);
  return rows.reduce((acc, row) => {
    try { acc[row.setting_key] = JSON.parse(row.setting_value); }
    catch { acc[row.setting_key] = row.setting_value; }
    return acc;
  }, {});
}

/**
 * Get module permissions object.
 * Returns { pos: true, returns: false, ... }
 */
async function getModulePermissions() {
  const [[row]] = await db.execute(
    `SELECT setting_value FROM Settings WHERE setting_key = ?`,
    [MODULE_PERMISSIONS_KEY]
  );
  if (!row) return {};
  try { return JSON.parse(row.setting_value); }
  catch { return {}; }
}

/**
 * Update module permissions.
 * @param {Record<string, boolean>} permissions - full or partial permissions map
 */
async function setModulePermissions(permissions) {
  const current = await getModulePermissions();
  const merged = { ...current, ...permissions };
  await db.execute(
    `INSERT INTO Settings (setting_key, setting_value)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [MODULE_PERMISSIONS_KEY, JSON.stringify(merged)]
  );
  return merged;
}

/**
 * Update a single generic setting.
 */
async function setSetting(key, value) {
  const stored = typeof value === 'object' ? JSON.stringify(value) : String(value);
  await db.execute(
    `INSERT INTO Settings (setting_key, setting_value)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [key, stored]
  );
  return { key, value };
}

module.exports = { getAllSettings, getModulePermissions, setModulePermissions, setSetting };
