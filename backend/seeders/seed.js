'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const db = require('../config/db');

async function seed() {
  console.log('🌱 Seeding database...');

  // Admin user
  const passwordHash = await bcrypt.hash('Admin@1234', 12);
  await db.execute(
    `INSERT IGNORE INTO Users (username, email, password_hash, first_name, last_name, role, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['admin', 'admin@posstore.com', passwordHash, 'Admin', 'User', 'admin', true]
  );
  console.log('  ✅ Admin user: admin / Admin@1234');

  // Default categories
  const categories = [
    { name: 'Beverages', slug: 'beverages' },
    { name: 'Dairy', slug: 'dairy' },
    { name: 'Bakery', slug: 'bakery' },
    { name: 'Snacks', slug: 'snacks' },
    { name: 'Cleaning', slug: 'cleaning' },
    { name: 'Electronics', slug: 'electronics' },
  ];

  for (const cat of categories) {
    await db.execute(
      `INSERT IGNORE INTO Categories (name, slug, is_active) VALUES (?, ?, 1)`,
      [cat.name, cat.slug]
    );
  }
  console.log('  ✅ Default categories inserted');

  // Sample products
  const [[beverageRow]] = await db.execute(`SELECT category_id FROM Categories WHERE slug='beverages'`);
  if (beverageRow) {
    await db.execute(
      `INSERT IGNORE INTO Products
        (category_id, sku, barcode, name, cost_price, retail_price, wholesale_price,
         min_wholesale_quantity, measurement_unit, stock_quantity, low_stock_threshold, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [beverageRow.category_id, 'SKU-001', '4901234567890', 'Water Bottle 1L',
       40.00, 60.00, 50.00, 12.000, 'units', 100.000, 10.000]
    );
    console.log('  ✅ Sample product inserted');
  }

  console.log('🎉 Seeding complete!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seeding failed:', err.message);
  process.exit(1);
});
