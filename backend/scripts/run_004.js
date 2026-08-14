'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) === 3306 ? 3307 : Number(process.env.DB_PORT) || 3307,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });
  const sql = fs.readFileSync(path.join(__dirname, '../migrations/004_promotions_schema.sql'), 'utf8');
  await conn.query(sql);
  console.log('004 migrated.');
  await conn.end();
}
run().catch(e => { console.error(e); process.exit(1); });
