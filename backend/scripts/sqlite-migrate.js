'use strict';

/**
 * SQLite Migration Runner
 *
 * Reads all .sql migration files and converts MySQL-specific syntax to SQLite
 * before executing. This avoids having to manually rewrite all migration files.
 *
 * Usage:
 *   SQLITE_DB_PATH=/path/to/db.sqlite node scripts/sqlite-migrate.js
 *   (or just: node scripts/sqlite-migrate.js  → uses dev DB in ./data/)
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const fs   = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// ── DB Path ──────────────────────────────────────────────────────────────────
const dbPath = process.env.SQLITE_DB_PATH || path.join(__dirname, '..', 'data', 'positiq_dev.db');
const dbDir  = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = OFF'); // disable during migrations (re-enabled after)

// ── MySQL → SQLite SQL Converter ─────────────────────────────────────────────
function convertToSQLite(sql) {
  return sql
    // Remove MySQL session vars
    .replace(/^SET NAMES .+;$/gm, '')
    .replace(/^SET FOREIGN_KEY_CHECKS.+;$/gm, '')
    // AUTO_INCREMENT PRIMARY KEY → INTEGER PRIMARY KEY AUTOINCREMENT
    .replace(/BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT')
    .replace(/INT AUTO_INCREMENT PRIMARY KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT')
    .replace(/BIGINT UNSIGNED NOT NULL/gi, 'INTEGER NOT NULL')
    .replace(/BIGINT UNSIGNED NULL/gi, 'INTEGER NULL')
    .replace(/BIGINT UNSIGNED/gi, 'INTEGER')
    .replace(/TINYINT UNSIGNED NOT NULL/gi, 'INTEGER NOT NULL')
    .replace(/TINYINT\(\d+\)/gi, 'INTEGER')
    .replace(/TINYINT/gi, 'INTEGER')
    // VARCHAR/CHAR → TEXT
    .replace(/VARCHAR\(\d+\)/gi, 'TEXT')
    .replace(/CHAR\(\d+\)/gi, 'TEXT')
    // DECIMAL / FLOAT → REAL
    .replace(/DECIMAL\(\d+,\d+\)/gi, 'REAL')
    // TEXT types
    .replace(/LONGTEXT/gi, 'TEXT')
    .replace(/MEDIUMTEXT/gi, 'TEXT')
    // ENUM(…) → TEXT (SQLite uses CHECK constraints, but we skip for simplicity)
    .replace(/ENUM\([^)]+\)/gi, 'TEXT')
    // BOOLEAN → INTEGER
    .replace(/BOOLEAN/gi, 'INTEGER')
    // TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP → TEXT DEFAULT CURRENT_TIMESTAMP
    .replace(/TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP/gi, 'TEXT DEFAULT CURRENT_TIMESTAMP')
    // TIMESTAMP → TEXT
    .replace(/TIMESTAMP/gi, 'TEXT')
    // DATETIME → TEXT
    .replace(/DATETIME/gi, 'TEXT')
    // DATE → TEXT
    // (DATE is fine as-is in SQLite)
    // JSON → TEXT
    .replace(/\bJSON\b/gi, 'TEXT')
    // Remove ENGINE=InnoDB … table options
    .replace(/\)?\s*ENGINE=InnoDB[^;]*/gi, ')')
    .replace(/DEFAULT CHARSET=\w+(\s+COLLATE=\w+)?/gi, '')
    // Remove INDEX declarations inside CREATE TABLE (SQLite doesn't support named inline indexes)
    .replace(/,\s*(?:UNIQUE\s+)?INDEX\s+\w+\s*\([^)]+\)/gi, '')
    // Remove inline FOREIGN KEY declarations from CREATE TABLE
    // Pattern: ,\n  FOREIGN KEY (col) REFERENCES table(col) ON DELETE ACTION
    // Must NOT consume the next comma-separated column definition
    .replace(/,\s*FOREIGN KEY\s*\([^)]+\)\s*REFERENCES\s*\w+\s*\([^)]+\)(?:\s*ON\s+(?:DELETE|UPDATE)\s+\w+(?:\s+\w+)?)*/gi, '')
    // Remove leftover comma before closing paren caused by above removals
    .replace(/,(\s*\))/g, '$1')
    // MySQL ALTER TABLE: AFTER <column> is not supported in SQLite — remove
    .replace(/\bAFTER\s+\w+/gi, '')
    // MySQL ALTER TABLE multi-column ADD COLUMN → separate statements
    // (handled below in splitAlterTable)
    // MySQL ON DUPLICATE KEY UPDATE → SQLite INSERT OR REPLACE
    .replace(/ON DUPLICATE KEY UPDATE[^;]+/gi, '')
    .replace(/^INSERT IGNORE INTO/gim, 'INSERT OR IGNORE INTO')
    // JSON_OBJECT(…) → simple JSON string (replace with literal for Settings seed)
    .replace(/JSON_OBJECT\([^)]+\)/gi, "'{}'" )
    // Remove UNIQUE from column definition if it causes issues (keep UNIQUE on its own line)
    // Remove trailing whitespace
    .replace(/[ \t]+$/gm, '')
    // Collapse multiple blank lines
    .replace(/\n{3,}/g, '\n\n');
}

/**
 * SQLite doesn't support ALTER TABLE … ADD COLUMN col1, ADD COLUMN col2 (multi-add).
 * Split into individual ALTER TABLE statements.
 */
function splitAlterTable(sql) {
  const result = [];
  const alterRegex = /ALTER TABLE (\w+)\s+([\s\S]+?)(?=ALTER TABLE|\s*$)/gi;
  let match;

  while ((match = alterRegex.exec(sql + '\nALTER TABLE')) !== null) {
    const table = match[1];
    const body  = match[2].trim().replace(/;$/, '');

    // Split on ,  ADD COLUMN — but only at top level (not inside parens)
    const adds = body.split(/,\s*(?:ADD COLUMN|ADD)\s+/i);
    for (let i = 0; i < adds.length; i++) {
      const col = adds[i].trim().replace(/^ADD COLUMN\s+|^ADD\s+/i, '');
      if (col) result.push(`ALTER TABLE ${table} ADD COLUMN ${col};`);
    }
  }

  return result.length ? result.join('\n') : sql;
}

// ── Run Migrations ───────────────────────────────────────────────────────────
const migrationsDir = path.join(__dirname, '../migrations');
const files = fs.readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort();

console.log(`🔄  Running ${files.length} migration file(s) against: ${dbPath}\n`);

for (const file of files) {
  const raw  = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
  let   sql  = convertToSQLite(raw);
  sql = splitAlterTable(sql);

  console.log(`  ▶ ${file}`);

  // Split on semicolons, filter blank lines, run each statement
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 3); // skip empty/comment-only chunks

  for (const stmt of statements) {
    try {
      sqlite.exec(stmt + ';');
    } catch (err) {
      // "duplicate column" is OK on re-runs (ALTER TABLE adds that already exist)
      if (err.message.includes('duplicate column name') ||
          err.message.includes('already exists')) {
        console.warn(`    ⚠  Skipped (already applied): ${stmt.slice(0, 60)}…`);
      } else {
        console.error(`    ❌ Failed statement:\n${stmt}\n\nError: ${err.message}`);
        process.exit(1);
      }
    }
  }
}

sqlite.pragma('foreign_keys = ON');
console.log('\n✅  All migrations complete. SQLite DB is ready.');
sqlite.close();
