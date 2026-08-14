'use strict';

const mysql = require('mysql2/promise');
const logger = require('../utils/logger');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  database: process.env.DB_NAME || 'pos_db',
  user: process.env.DB_USER || 'pos_user',
  password: process.env.DB_PASSWORD || 'pos_password',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
});

// Test connection on startup
pool.getConnection()
  .then((conn) => {
    logger.info('✅ MySQL connected');
    conn.release();
  })
  .catch((err) => {
    logger.error({ err }, '❌ MySQL connection failed');
  });

module.exports = pool;
