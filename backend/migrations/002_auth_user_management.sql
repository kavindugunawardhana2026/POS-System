-- =============================================================
-- Migration 002: Auth & User Management additions
-- - Users.pin_hash for cashier PIN login
-- - Users.display_name convenience column
-- - Module permissions default setting
-- =============================================================

SET NAMES utf8mb4;

-- Add PIN hash to Users (nullable — only cashiers use it)
ALTER TABLE Users
  ADD COLUMN pin_hash VARCHAR(255) NULL AFTER password_hash,
  ADD COLUMN display_name VARCHAR(100) NULL AFTER last_name;

-- Default module permissions (all enabled)
INSERT IGNORE INTO Settings (setting_key, setting_value) VALUES
  ('module_permissions', JSON_OBJECT(
    'pos',       true,
    'products',  true,
    'invoices',  true,
    'returns',   true,
    'customers', true,
    'suppliers', true,
    'purchases', true,
    'inventory', true,
    'reports',   true,
    'expenses',  true,
    'users',     false,
    'settings',  false
  ));
