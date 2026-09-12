'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const db = require('../config/db');

async function seed() {
  console.log('🌱 Seeding database...');

  // ── 1. Admin user ─────────────────────────────────────────────────────────
  const adminHash = await bcrypt.hash('Admin@1234', 12);
  await db.execute(
    `INSERT OR IGNORE INTO Users
       (username, email, password_hash, first_name, last_name, role, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['admin', 'admin@positiq.lk', adminHash, 'Admin', 'User', 'admin', 1]
  );
  console.log('  ✅ Admin user: admin / Admin@1234');

  // ── 2. Default cashier ────────────────────────────────────────────────────
  const cashierHash = await bcrypt.hash('Cashier@1234', 12);
  const pinHash     = await bcrypt.hash('234567', 10);

  const [cashierResult] = await db.execute(
    `INSERT OR IGNORE INTO Users
       (username, email, password_hash, pin_hash, first_name, last_name, role, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ['cashier1', 'cashier1@positiq.lk', cashierHash, pinHash, 'Cashier', 'One', 'cashier', 1]
  );
  console.log('  ✅ Cashier user: cashier1 / PIN 234567');

  // ── 3. Default settings ───────────────────────────────────────────────────
  const settings = [
    ['store_name',             'My Shop'],
    ['address',                ''],
    ['phone',                  ''],
    ['currency',               'LKR'],
    ['locale',                 'en'],
    ['receipt_header',         'Thank you for shopping with us!'],
    ['receipt_footer',         'Visit again!'],
    ['thermal_printer',        '80mm'],
    ['low_stock_alert',        '1'],
    ['loyalty_earn_rate',      '1'],
    ['loyalty_redemption_value','1'],
  ];

  for (const [key, value] of settings) {
    await db.execute(
      `INSERT OR IGNORE INTO Settings (setting_key, setting_value) VALUES (?, ?)`,
      [key, value]
    );
  }
  console.log('  ✅ Default settings inserted');

  // ── 4. Default categories ─────────────────────────────────────────────────
  const categories = [
    { name: 'Beverages',   slug: 'beverages' },
    { name: 'Dairy',       slug: 'dairy' },
    { name: 'Bakery',      slug: 'bakery' },
    { name: 'Snacks',      slug: 'snacks' },
    { name: 'Cleaning',    slug: 'cleaning' },
    { name: 'Electronics', slug: 'electronics' },
  ];

  for (const cat of categories) {
    await db.execute(
      `INSERT OR IGNORE INTO Categories (name, slug, is_active) VALUES (?, ?, 1)`,
      [cat.name, cat.slug]
    );
  }
  console.log('  ✅ Default categories inserted (6)');

  console.log('\n🎉 Seeding complete!');
  console.log('   Admin:   admin     / Admin@1234');
  console.log('   Cashier: cashier1  / PIN 234567');
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Seeding failed:', err.message);
    process.exit(1);
  });
