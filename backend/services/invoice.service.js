'use strict';

const db = require('../config/db');
const { NotFoundError } = require('../errors/HttpErrors');
const AppError = require('../errors/AppError');
const { generateInvoiceNumber, round2 } = require('../utils/formatters');
const { calculateInvoiceTotals, resolveUnitPrice } = require('../utils/calculators');
const returnSvc = require('./return.service');

/**
 * Get next daily invoice sequence number.
 */
async function getNextSequence() {
  const today = new Date().toISOString().slice(0, 10);
  const [[{ count }]] = await db.execute(
    `SELECT COUNT(*) AS count FROM Invoices WHERE DATE(created_at) = ?`, [today]
  );
  return count + 1;
}

async function listInvoices({ page = 1, limit = 20, status, from, to, customer_id }) {
  const offset = (page - 1) * limit;
  const params = [];
  let where = 'WHERE i.deleted_at IS NULL';

  if (status) { where += ' AND i.status = ?'; params.push(status); }
  if (from)   { where += ' AND DATE(i.created_at) >= ?'; params.push(from); }
  if (to)     { where += ' AND DATE(i.created_at) <= ?'; params.push(to); }
  if (customer_id) { where += ' AND i.customer_id = ?'; params.push(customer_id); }

  const [[{ total }]] = await db.execute(
    `SELECT COUNT(*) AS total FROM Invoices i ${where}`, params
  );
  const [rows] = await db.execute(
    `SELECT i.*, u.username AS cashier, c.name AS customer_name
     FROM Invoices i
     LEFT JOIN Users u ON u.user_id = i.user_id
     LEFT JOIN Customers c ON c.customer_id = i.customer_id
     ${where} ORDER BY i.created_at DESC LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
    params
  );

  return { data: rows, meta: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) } };
}

async function getInvoice(id) {
  const [[invoice]] = await db.execute(
    `SELECT i.*, u.username AS cashier, c.name AS customer_name
     FROM Invoices i
     LEFT JOIN Users u ON u.user_id = i.user_id
     LEFT JOIN Customers c ON c.customer_id = i.customer_id
     WHERE i.invoice_id = ? AND i.deleted_at IS NULL`, [id]
  );
  if (!invoice) throw new NotFoundError('Invoice');

  const [items] = await db.execute(
    `SELECT * FROM Invoice_Items WHERE invoice_id = ?`, [id]
  );
  const [payments] = await db.execute(
    `SELECT * FROM Invoice_Payments WHERE invoice_id = ?`, [id]
  );

  return { ...invoice, items, payments };
}

async function createInvoice(body, actor) {
  const {
    items, payments, customer_id, sale_type = 'retail',
    discount = 0, notes, shift_id, credit_note_number, is_quote = false,
  } = body;

  if (!items || items.length === 0) throw new AppError('Invoice must have at least one item', 400, 'EMPTY_INVOICE');

  // Validate credit note BEFORE opening transaction
  let creditNote = null;
  if (credit_note_number) {
    creditNote = await returnSvc.validateCreditNote(credit_note_number);
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const invoiceItems = [];
    for (const item of items) {
      const [[product]] = await conn.execute(
        `SELECT * FROM Products WHERE product_id = ? AND deleted_at IS NULL AND is_active = 1 FOR UPDATE`,
        [item.product_id]
      );
      if (!product) throw new NotFoundError(`Product #${item.product_id}`);

      const qty = Number(item.quantity);
      if (product.stock_quantity < qty) {
        throw new AppError(`Insufficient stock for '${product.name}'`, 400, 'INSUFFICIENT_STOCK');
      }

      const unit_price = item.unit_price ?? resolveUnitPrice(product, qty, sale_type);
      const lineDiscount = round2(item.discount || 0);
      const subtotal = round2(unit_price * qty - lineDiscount);

      invoiceItems.push({
        product_id: product.product_id,
        quantity: qty,
        unit_price,
        discount: lineDiscount,
        tax_amount: 0,
        subtotal,
        product_name: product.name,
        product_sku: product.sku,
        unit_cost_at_sale: product.cost_price,
      });

      // Decrement stock only if not a quote
      if (!is_quote) {
        await conn.execute(
          `UPDATE Products SET stock_quantity = stock_quantity - ? WHERE product_id = ?`,
          [qty, product.product_id]
        );
      }
    }

    const { subtotal, discount: invoiceDiscount, total_amount: baseTotal } = calculateInvoiceTotals(invoiceItems, discount);

    // Apply credit note deduction if provided
    let creditDeduction = 0;
    if (creditNote) {
      creditDeduction = round2(Math.min(creditNote.credit_remaining, baseTotal));
    }
    const total_amount = round2(baseTotal - creditDeduction);

    const paidAmount = is_quote ? 0 : (payments || []).reduce((s, p) => s + Number(p.amount), 0);
    const changeDue  = is_quote ? 0 : round2(Math.max(0, paidAmount - total_amount));
    const balanceDue = is_quote ? total_amount : round2(Math.max(0, total_amount - paidAmount));
    const status = is_quote ? 'draft' : (balanceDue > 0 ? (paidAmount > 0 ? 'partial' : 'unpaid') : 'paid');

    const seq = await getNextSequence();
    const invoice_number = is_quote ? `QT-${generateInvoiceNumber(seq)}` : generateInvoiceNumber(seq);

    const [invoiceResult] = await conn.execute(
      `INSERT INTO Invoices
        (invoice_number, user_id, customer_id, shift_id, subtotal, discount, tax_amount,
         total_amount, paid_amount, change_due, balance_due, sale_type, status, notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [invoice_number, actor.user_id, customer_id ?? null, shift_id ?? null,
       subtotal, round2(invoiceDiscount + creditDeduction), 0, total_amount, paidAmount,
       changeDue, balanceDue, sale_type, status, notes ?? null]
    );
    const invoiceId = invoiceResult.insertId;

    // Redeem the credit note inside the same transaction
    if (creditNote && creditDeduction > 0) {
      await returnSvc.redeemCreditNote(conn, credit_note_number, creditDeduction);
      // Log as a credit_note payment
      await conn.execute(
        `INSERT INTO Invoice_Payments (invoice_id, payment_method, amount, reference_no, received_by)
         VALUES (?, 'credit', ?, ?, ?)`,
        [invoiceId, creditDeduction, credit_note_number, actor.user_id]
      );
    }

    for (const it of invoiceItems) {
      await conn.execute(
        `INSERT INTO Invoice_Items
          (invoice_id, product_id, quantity, unit_price, discount, tax_amount, subtotal,
           product_name, product_sku, unit_cost_at_sale)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [invoiceId, it.product_id, it.quantity, it.unit_price, it.discount,
         it.tax_amount, it.subtotal, it.product_name, it.product_sku, it.unit_cost_at_sale]
      );

      if (!is_quote) {
        await conn.execute(
          `INSERT INTO Stock_Movements
            (product_id, change_type, reference_type, reference_id, quantity, unit_cost, user_id)
           VALUES (?, 'sale', 'invoice', ?, ?, ?, ?)`,
          [it.product_id, invoiceId, -it.quantity, it.unit_cost_at_sale, actor.user_id]
        );
      }
    }

    if (!is_quote && payments && payments.length > 0) {
      for (const pay of payments) {
        await conn.execute(
          `INSERT INTO Invoice_Payments (invoice_id, payment_method, amount, reference_no, received_by)
           VALUES (?,?,?,?,?)`,
          [invoiceId, pay.payment_method, pay.amount, pay.reference_no ?? null, actor.user_id]
        );
      }
    }

    await conn.commit();
    conn.release();
    return getInvoice(invoiceId);
  } catch (err) {
    await conn.rollback();
    conn.release();
    throw err;
  }
}

async function cancelInvoice(id, actor) {
  const invoice = await getInvoice(id);
  if (['cancelled','void','refunded'].includes(invoice.status)) {
    throw new AppError(`Invoice is already ${invoice.status}`, 400, 'INVALID_STATUS');
  }
  await db.execute(`UPDATE Invoices SET status = 'cancelled' WHERE invoice_id = ?`, [id]);
}

async function voidInvoice(id, actor) {
  const invoice = await getInvoice(id);
  await db.execute(`UPDATE Invoices SET status = 'void' WHERE invoice_id = ?`, [id]);
}

module.exports = { listInvoices, getInvoice, createInvoice, cancelInvoice, voidInvoice };
