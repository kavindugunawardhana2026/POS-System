'use strict';

const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

/**
 * In-memory multer storage. We parse Excel/CSV in-memory; nothing touches disk.
 * 5 MB cap is plenty for typical product import sheets.
 */
const storage = multer.memoryStorage();

const ALLOWED_MIME = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel',                                          // .xls
  'text/csv',
  'application/csv',
  'application/octet-stream',                                         // browser may send this for .xlsx
]);

const ALLOWED_EXT = new Set(['.xlsx', '.xls', '.csv']);

function fileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    return cb(new Error(`Unsupported file type: ${ext}. Allowed: .xlsx, .xls, .csv`));
  }
  if (file.mimetype && !ALLOWED_MIME.has(file.mimetype)) {
    // Be lenient: some browsers send wrong MIME for .xlsx; ext check already passed.
    if (ext === '.xlsx' || ext === '.xls' || ext === '.csv') return cb(null, true);
    return cb(new Error(`Unsupported MIME type: ${file.mimetype}`));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

/**
 * Normalize a header label into a canonical snake_case key.
 * "Cost Price" → "cost_price", "wholesale-price" → "wholesale_price", "SKU" → "sku"
 */
function normalizeKey(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[_\-\s]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

/**
 * Parse an uploaded file buffer (.xlsx or .csv) into a normalized array of
 * row objects keyed by snake_case, lowercased header names.
 * - .xlsx / .xls  → parsed via `xlsx`
 * - .csv          → parsed via `csv-parse/sync`
 *
 * The parser is intentionally permissive:
 * - Header row may use any of the supported column names (case-insensitive,
 *   spaces / hyphens / underscores all collapse to `_`).
 * - Empty rows are skipped.
 * - Cells are left as strings/numbers exactly as parsed by the library.
 */
async function parseSpreadsheet(file) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const buf = file.buffer;

  if (ext === '.csv') {
    const { parse } = require('csv-parse/sync');
    const records = parse(buf, {
      columns: (header) => header.map((h) => normalizeKey(h)),
      skip_empty_lines: true,
      trim: true,
      bom: true,
      relax_column_count: true,
    });
    return records;
  }

  // .xlsx / .xls
  const XLSX = require('xlsx');
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });
  const firstSheet = wb.SheetNames[0];
  if (!firstSheet) return [];
  const sheet = wb.Sheets[firstSheet];
  // defval keeps empty cells as undefined instead of dropping them
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true });
  return rows.map((r) => {
    const out = {};
    for (const [k, v] of Object.entries(r)) {
      out[normalizeKey(k)] = v;
    }
    return out;
  });
}

module.exports = { upload, parseSpreadsheet };
