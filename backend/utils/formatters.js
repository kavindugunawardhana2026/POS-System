'use strict';

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

module.exports = { generateInvoiceNumber, generateReturnNumber, formatCurrency, round2 };
