'use strict';

/**
 * SQLite database adapter with mysql2 compatibility shim.
 *
 * All backend services call:
 *   db.execute(sql, params) → [rows, fields]
 *   db.getConnection()      → fake connection with beginTransaction / commit / rollback / execute / release
 *
 * This shim maps those calls onto better-sqlite3's synchronous API,
 * wrapped in Promises so all async/await code in services continues
 * to work without any changes.
 *
 * DB file location:
 *   - Production (Electron): passed via SQLITE_DB_PATH env var from main.js
 *   - Development (plain node): stored at ./data/positiq_dev.db
 */

const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');

// ── Determine DB file path ───────────────────────────────────────────────────
const dbPath = process.env.SQLITE_DB_PATH || path.join(__dirname, '..', 'data', 'positiq_dev.db');

// Ensure directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// ── Open database ────────────────────────────────────────────────────────────
const sqlite = new Database(dbPath);

// Enable WAL mode for better concurrent read performance
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

console.log(`✅ SQLite connected → ${dbPath}`);

// ── SQL dialect compatibility helper ─────────────────────────────────────────
/**
 * Convert mysql2-style positional ? params to SQLite-compatible ? params.
 * SQLite also uses ?, so no conversion needed for basic queries.
 * However we normalise NULL handling and remove mysql2-only clauses.
 */
function normalizeSql(sql) {
  // Remove MySQL-only FOR UPDATE lock hint (SQLite uses transactions instead)
  let clean = sql.replace(/\bFOR UPDATE\b/gi, '');
  // Translate INSERT IGNORE to SQLite's INSERT OR IGNORE
  clean = clean.replace(/\bINSERT\s+IGNORE\s+INTO\b/gi, 'INSERT OR IGNORE INTO');
  // Translate NOW() to SQLite's datetime('now')
  clean = clean.replace(/\bNOW\(\)/gi, "datetime('now')");
  return clean;
}

/**
 * SQLite strictly refuses booleans. mysql2 converts them.
 * We map booleans to 1 / 0.
 */
function normalizeParams(params) {
  return params.map(p => (typeof p === 'boolean' ? (p ? 1 : 0) : p));
}

/**
 * Execute a SELECT / INSERT / UPDATE / DELETE statement.
 * Returns Promise<[[rows], {}]> mimicking mysql2/promise pool.execute().
 *
 * For INSERT → rows = [] but we attach insertId on the array.
 * For SELECT/UPDATE/DELETE → rows = array of row objects.
 */
function execute(sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      const cleanSql = normalizeSql(sql).trim();
      const upperSql = cleanSql.replace(/\s+/g, ' ').toUpperCase();
      const safeParams = normalizeParams(params);

      if (upperSql.startsWith('SELECT') || upperSql.startsWith('WITH')) {
        const stmt = sqlite.prepare(cleanSql);
        const rows = stmt.all(...safeParams);
        resolve([rows, {}]);
      } else {
        const stmt = sqlite.prepare(cleanSql);
        const info = stmt.run(...safeParams);
        // Mimic mysql2 result: attach insertId so service code like result.insertId works
        const result = { insertId: info.lastInsertRowid, affectedRows: info.changes };
        resolve([[result], {}]);
      }
    } catch (err) {
      reject(err);
    }
  });
}

// ── Transaction (fake connection) ─────────────────────────────────────────────
/**
 * Mimics mysql2 pool.getConnection().
 * Returns a fake connection object supporting:
 *   conn.beginTransaction()
 *   conn.execute(sql, params)
 *   conn.commit()
 *   conn.rollback()
 *   conn.release()
 */
function getConnection() {
  return new Promise((resolve) => {
    // We run the transaction manually using better-sqlite3's synchronous API.
    // We buffer all statements and execute them atomically on commit.
    let inTransaction = false;

    const conn = {
      beginTransaction: () => {
        return new Promise((res) => {
          sqlite.exec('BEGIN');
          inTransaction = true;
          res();
        });
      },

      execute: (sql, params = []) => {
        return new Promise((res, rej) => {
          try {
            const cleanSql = normalizeSql(sql).trim();
            const upperSql = cleanSql.replace(/\s+/g, ' ').toUpperCase();
            const safeParams = normalizeParams(params);

            if (upperSql.startsWith('SELECT') || upperSql.startsWith('WITH')) {
              const stmt = sqlite.prepare(cleanSql);
              const rows = stmt.all(...safeParams);
              res([rows, {}]);
            } else {
              const stmt = sqlite.prepare(cleanSql);
              const info = stmt.run(...safeParams);
              const result = { insertId: info.lastInsertRowid, affectedRows: info.changes };
              res([[result], {}]);
            }
          } catch (err) {
            rej(err);
          }
        });
      },

      commit: () => {
        return new Promise((res) => {
          sqlite.exec('COMMIT');
          inTransaction = false;
          res();
        });
      },

      rollback: () => {
        return new Promise((res) => {
          try {
            if (inTransaction) {
              sqlite.exec('ROLLBACK');
              inTransaction = false;
            }
          } catch (_) { /* ignore if nothing to roll back */ }
          res();
        });
      },

      release: () => Promise.resolve(), // no-op for SQLite (single connection)
    };

    resolve(conn);
  });
}

// ── Public API matching mysql2 pool interface ─────────────────────────────────
module.exports = { execute, getConnection, _sqlite: sqlite };
