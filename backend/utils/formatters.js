'use strict';

const db = require('../config/db');

/**
 * Generate a human-readable invoice number.
 * Format: INV-YYYYMMDD-XXXX
 * @param {number} sequence - daily sequence number
 */
function generateInvoiceNumber(sequence) {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `INV-${today}-${String(sequence).padStart(4, '0')}`;
}

/**
 * Generate a return number.
 * Format: RET-YYYYMMDD-XXXX
 */
function generateReturnNumber(sequence) {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `RET-${today}-${String(sequence).padStart(4, '0')}`;
}

/**
 * Format a number as currency string.
 * @param {number} amount
 * @param {string} currency - default 'LKR'
 */
function formatCurrency(amount, currency = process.env.CURRENCY || 'LKR') {
  return new Intl.NumberFormat('en-LK', { style: 'currency', currency }).format(amount);
}

/**
 * Round a number to 2 decimal places.
 */
function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Generate the next unique SKU for the Products table.
 * Format: SKU-XXXXXX (6-digit zero-padded sequence, looks at the highest existing number).
 * Retries internally until a free value is found.
 */
async function generateProductSku() {
  // Pull the max numeric suffix across existing SKUs; if none exist, start at 1.
  const [[row]] = await db.execute(
    `SELECT MAX(CAST(SUBSTRING(sku, 5) AS UNSIGNED)) AS max_seq
     FROM Products
     WHERE sku REGEXP '^SKU-[0-9]+$'`
  );
  const next = (row?.max_seq || 0) + 1;
  let candidate = `SKU-${String(next).padStart(6, '0')}`;
  let safety = 0;
  while (safety < 100) {
    const [[exists]] = await db.execute(
      `SELECT 1 FROM Products WHERE sku = ? LIMIT 1`,
      [candidate]
    );
    if (!exists) return candidate;
    safety += 1;
    candidate = `SKU-${String(next + safety).padStart(6, '0')}`;
  }
  // Fallback: timestamp-based SKU if we somehow never find a free one.
  return `SKU-${Date.now().toString().slice(-10)}`;
}

module.exports = {
  generateInvoiceNumber,
  generateReturnNumber,
  formatCurrency,
  round2,
  generateProductSku,
};
