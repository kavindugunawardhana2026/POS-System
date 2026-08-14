'use strict';

const { round2 } = require('./formatters');

/**
 * Calculate invoice totals from line items.
 * @param {Array} items - [{ unit_price, quantity, discount }]
 * @param {number} invoiceDiscount - invoice-level discount
 * @returns {{ subtotal, discount, total_amount }}
 */
function calculateInvoiceTotals(items, invoiceDiscount = 0) {
  const subtotal = items.reduce((sum, item) => {
    const lineTotal = round2(item.unit_price * item.quantity);
    const lineDiscount = round2(item.discount || 0);
    return sum + lineTotal - lineDiscount;
  }, 0);

  const discount = round2(invoiceDiscount);
  const total_amount = round2(subtotal - discount);

  return { subtotal: round2(subtotal), discount, total_amount };
}

/**
 * Determine the unit price for an item based on sale type and quantity.
 * Applies wholesale price if sale_type is 'wholesale' and quantity >= min_wholesale_quantity.
 */
function resolveUnitPrice(product, quantity, saleType) {
  if (
    saleType === 'wholesale' &&
    product.wholesale_price != null &&
    product.min_wholesale_quantity != null &&
    quantity >= product.min_wholesale_quantity
  ) {
    return product.wholesale_price;
  }
  return product.retail_price;
}

module.exports = { calculateInvoiceTotals, resolveUnitPrice };
