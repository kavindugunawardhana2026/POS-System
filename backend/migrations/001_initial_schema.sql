-- =============================================================
-- POS System — Initial Database Schema
-- Engine: InnoDB | Charset: utf8mb4 | Collation: utf8mb4_unicode_ci
-- Run order matters: referenced tables must exist before referencing ones.
-- =============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- -------------------------------------------------------------
-- 1. Users
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Users (
  user_id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username        VARCHAR(50)  NOT NULL UNIQUE,
  email           VARCHAR(120) UNIQUE,
  phone           VARCHAR(20)  UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,
  first_name      VARCHAR(50),
  last_name       VARCHAR(50),
  avatar_url      VARCHAR(255),
  role            ENUM('admin','manager','cashier') NOT NULL DEFAULT 'cashier',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at   DATETIME NULL,
  failed_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  locked_until    DATETIME NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      DATETIME NULL,
  INDEX idx_users_role   (role),
  INDEX idx_users_active (is_active, deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 2. Refresh Tokens
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Refresh_Tokens (
  token_id    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     BIGINT UNSIGNED NOT NULL,
  token_hash  CHAR(64) NOT NULL UNIQUE,
  device_info VARCHAR(255),
  expires_at  DATETIME NOT NULL,
  revoked_at  DATETIME NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
  INDEX idx_rt_user    (user_id),
  INDEX idx_rt_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- 3. Audit Log
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Audit_Log (
  audit_id    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     BIGINT UNSIGNED,
  entity_type VARCHAR(50)  NOT NULL,
  entity_id   BIGINT UNSIGNED NOT NULL,
  action      ENUM('create','update','delete','login','refund') NOT NULL,
  before_json JSON,
  after_json  JSON,
  ip_address  VARCHAR(45),
  user_agent  VARCHAR(255),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE SET NULL,
  INDEX idx_audit_entity (entity_type, entity_id),
  INDEX idx_audit_user   (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- 4. Categories
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Categories (
  category_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  parent_id   BIGINT UNSIGNED NULL,
  name        VARCHAR(100) NOT NULL,
  slug        VARCHAR(120) NOT NULL UNIQUE,
  description TEXT,
  image_url   VARCHAR(255),
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at  DATETIME NULL,
  FOREIGN KEY (parent_id) REFERENCES Categories(category_id) ON DELETE SET NULL,
  INDEX idx_categories_parent (parent_id),
  INDEX idx_categories_slug   (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 5. Products
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Products (
  product_id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id            BIGINT UNSIGNED,
  sku                    VARCHAR(50)  UNIQUE,
  barcode                VARCHAR(50)  UNIQUE,
  name                   VARCHAR(255) NOT NULL,
  description            TEXT,
  brand                  VARCHAR(100),
  image_url              VARCHAR(255),
  cost_price             DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  retail_price           DECIMAL(12,2) NOT NULL,
  wholesale_price        DECIMAL(12,2) NULL,
  min_wholesale_quantity DECIMAL(10,3) NULL,
  measurement_unit       ENUM('kg','grams','units','liters','ml','pack') NOT NULL DEFAULT 'units',
  stock_quantity         DECIMAL(12,3) NOT NULL DEFAULT 0.000,
  low_stock_threshold    DECIMAL(12,3) NOT NULL DEFAULT 0.000,
  is_active              BOOLEAN NOT NULL DEFAULT TRUE,
  is_taxable             BOOLEAN NOT NULL DEFAULT FALSE,
  expiry_date            DATE NULL,
  created_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at             DATETIME NULL,
  FOREIGN KEY (category_id) REFERENCES Categories(category_id) ON DELETE SET NULL,
  INDEX idx_products_category (category_id),
  INDEX idx_products_barcode  (barcode),
  INDEX idx_products_name     (name),
  INDEX idx_products_stock    (stock_quantity, low_stock_threshold)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 6. Customers
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Customers (
  customer_id   BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  phone         VARCHAR(20)  UNIQUE,
  email         VARCHAR(120) UNIQUE,
  gstin         VARCHAR(20),
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city          VARCHAR(80),
  state         VARCHAR(80),
  postal_code   VARCHAR(20),
  country       VARCHAR(80) NOT NULL DEFAULT 'Sri Lanka',
  loyalty_points INT NOT NULL DEFAULT 0,
  notes         TEXT,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at    DATETIME NULL,
  INDEX idx_customers_phone (phone),
  INDEX idx_customers_name  (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 7. Suppliers
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Suppliers (
  supplier_id    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(150) NOT NULL,
  contact_person VARCHAR(120),
  phone          VARCHAR(20),
  email          VARCHAR(120),
  gstin          VARCHAR(20),
  address        TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at     DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 8. Shifts
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Shifts (
  shift_id      BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       BIGINT UNSIGNED NOT NULL,
  opened_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at     DATETIME NULL,
  opening_cash  DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  closing_cash  DECIMAL(12,2) NULL,
  expected_cash DECIMAL(12,2) NULL,
  variance      DECIMAL(12,2) NULL,
  notes         TEXT,
  status        ENUM('open','closed') NOT NULL DEFAULT 'open',
  FOREIGN KEY (user_id) REFERENCES Users(user_id),
  INDEX idx_shifts_user_date (user_id, opened_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- 9. Invoices
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Invoices (
  invoice_id     BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  invoice_number VARCHAR(30)  NOT NULL UNIQUE,
  user_id        BIGINT UNSIGNED NOT NULL,
  customer_id    BIGINT UNSIGNED NULL,
  shift_id       BIGINT UNSIGNED NULL,
  subtotal       DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  discount       DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  tax_amount     DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  round_off      DECIMAL(6,2)  NOT NULL DEFAULT 0.00,
  total_amount   DECIMAL(12,2) NOT NULL,
  paid_amount    DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  change_due     DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  balance_due    DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  sale_type      ENUM('retail','wholesale') NOT NULL DEFAULT 'retail',
  status         ENUM('draft','paid','partial','unpaid','refunded','partially_refunded','cancelled','void') NOT NULL DEFAULT 'paid',
  notes          TEXT,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at     DATETIME NULL,
  FOREIGN KEY (user_id)     REFERENCES Users(user_id),
  FOREIGN KEY (customer_id) REFERENCES Customers(customer_id) ON DELETE SET NULL,
  FOREIGN KEY (shift_id)    REFERENCES Shifts(shift_id) ON DELETE SET NULL,
  INDEX idx_invoices_date     (created_at),
  INDEX idx_invoices_status   (status),
  INDEX idx_invoices_user     (user_id, created_at),
  INDEX idx_invoices_customer (customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 10. Invoice Items
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Invoice_Items (
  invoice_item_id   BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  invoice_id        BIGINT UNSIGNED NOT NULL,
  product_id        BIGINT UNSIGNED NOT NULL,
  quantity          DECIMAL(12,3) NOT NULL,
  unit_price        DECIMAL(12,2) NOT NULL,
  discount          DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  tax_amount        DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  subtotal          DECIMAL(12,2) NOT NULL,
  product_name      VARCHAR(255) NOT NULL,
  product_sku       VARCHAR(50),
  unit_cost_at_sale DECIMAL(12,2),
  FOREIGN KEY (invoice_id) REFERENCES Invoices(invoice_id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES Products(product_id),
  INDEX idx_ii_invoice (invoice_id),
  INDEX idx_ii_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- 11. Invoice Payments (split payments support)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Invoice_Payments (
  payment_id     BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  invoice_id     BIGINT UNSIGNED NOT NULL,
  payment_method ENUM('cash','card','upi','wallet','bank_transfer','credit','cheque') NOT NULL,
  amount         DECIMAL(12,2) NOT NULL,
  reference_no   VARCHAR(80),
  received_by    BIGINT UNSIGNED,
  paid_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id)  REFERENCES Invoices(invoice_id) ON DELETE CASCADE,
  FOREIGN KEY (received_by) REFERENCES Users(user_id),
  INDEX idx_payments_invoice (invoice_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- 12. Purchases (stock-in)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Purchases (
  purchase_id   BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  supplier_id   BIGINT UNSIGNED,
  user_id       BIGINT UNSIGNED NOT NULL,
  reference_no  VARCHAR(50),
  total_amount  DECIMAL(12,2) NOT NULL,
  tax_amount    DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  net_amount    DECIMAL(12,2) NOT NULL,
  notes         TEXT,
  purchase_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES Suppliers(supplier_id) ON DELETE SET NULL,
  FOREIGN KEY (user_id)     REFERENCES Users(user_id),
  INDEX idx_purchases_date (purchase_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS Purchase_Items (
  purchase_item_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  purchase_id      BIGINT UNSIGNED NOT NULL,
  product_id       BIGINT UNSIGNED NOT NULL,
  quantity         DECIMAL(12,3) NOT NULL,
  unit_cost        DECIMAL(12,2) NOT NULL,
  subtotal         DECIMAL(12,2) NOT NULL,
  FOREIGN KEY (purchase_id) REFERENCES Purchases(purchase_id) ON DELETE CASCADE,
  FOREIGN KEY (product_id)  REFERENCES Products(product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- 13. Stock Movements (every stock change logged here)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Stock_Movements (
  movement_id    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id     BIGINT UNSIGNED NOT NULL,
  change_type    ENUM('purchase','sale','return','adjustment','transfer','damage') NOT NULL,
  reference_type VARCHAR(40),
  reference_id   BIGINT UNSIGNED,
  quantity       DECIMAL(12,3) NOT NULL,
  unit_cost      DECIMAL(12,2) NULL,
  user_id        BIGINT UNSIGNED,
  reason         VARCHAR(255),
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES Products(product_id),
  FOREIGN KEY (user_id)    REFERENCES Users(user_id),
  INDEX idx_sm_product (product_id, created_at),
  INDEX idx_sm_ref     (reference_type, reference_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- 14. Returns
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Returns (
  return_id     BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  return_number VARCHAR(30)  NOT NULL UNIQUE,
  invoice_id    BIGINT UNSIGNED NOT NULL,
  user_id       BIGINT UNSIGNED NOT NULL,
  customer_id   BIGINT UNSIGNED,
  total_refund  DECIMAL(12,2) NOT NULL,
  refund_method ENUM('cash','card','upi','wallet','bank_transfer','credit_note') NOT NULL DEFAULT 'cash',
  status        ENUM('pending','completed','rejected') NOT NULL DEFAULT 'completed',
  reason        TEXT,
  return_date   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id)  REFERENCES Invoices(invoice_id),
  FOREIGN KEY (user_id)     REFERENCES Users(user_id),
  FOREIGN KEY (customer_id) REFERENCES Customers(customer_id) ON DELETE SET NULL,
  INDEX idx_returns_invoice (invoice_id),
  INDEX idx_returns_date    (return_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS Return_Items (
  return_item_id    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  return_id         BIGINT UNSIGNED NOT NULL,
  invoice_item_id   BIGINT UNSIGNED NOT NULL,
  product_id        BIGINT UNSIGNED NOT NULL,
  quantity_returned DECIMAL(12,3) NOT NULL,
  refund_amount     DECIMAL(12,2) NOT NULL,
  restock           BOOLEAN NOT NULL DEFAULT TRUE,
  FOREIGN KEY (return_id)       REFERENCES Returns(return_id) ON DELETE CASCADE,
  FOREIGN KEY (invoice_item_id) REFERENCES Invoice_Items(invoice_item_id),
  FOREIGN KEY (product_id)      REFERENCES Products(product_id),
  INDEX idx_ri_return (return_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- 15. Expenses
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Expenses (
  expense_id     BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category       VARCHAR(80) NOT NULL,
  amount         DECIMAL(12,2) NOT NULL,
  payment_method ENUM('cash','card','upi','bank_transfer') NOT NULL DEFAULT 'cash',
  user_id        BIGINT UNSIGNED NOT NULL,
  notes          TEXT,
  expense_date   DATE NOT NULL,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES Users(user_id),
  INDEX idx_expenses_date (expense_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- 16. Settings (key-value store)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Settings (
  setting_key   VARCHAR(80) PRIMARY KEY,
  setting_value TEXT,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Default settings
INSERT IGNORE INTO Settings (setting_key, setting_value) VALUES
  ('store_name',        'My POS Store'),
  ('address',           ''),
  ('phone',             ''),
  ('currency',          'LKR'),
  ('locale',            'en'),
  ('receipt_header',    'Thank you for shopping with us!'),
  ('receipt_footer',    'Visit again!'),
  ('thermal_printer',   '80mm'),
  ('low_stock_alert',   '1');

SET FOREIGN_KEY_CHECKS = 1;
