'use strict';

const db = require('../config/db');
const { NotFoundError, ValidationError } = require('../errors/HttpErrors');
const AppError = require('../errors/AppError');
const { generateReturnNumber, round2 } = require('../utils/formatters');

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getNextReturnSequence() {
  const today = new Date().toISOString().slice(0, 10);
  const [[{ count }]] = await db.execute(
    `SELECT COUNT(*) AS count FROM Returns WHERE DATE(created_at) = ?`, [today]
  );
  return count + 1;
}

// ─── Credit Note helpers ──────────────────────────────────────────────────────

/**
 * Get a credit note (Return) by return_number — used at POS checkout to redeem.
 */
async function getCreditByNumber(return_number) {
  const [[row]] = await db.execute(
    `SELECT return_id, return_number, total_refund, credit_remaining, status
     FROM Returns WHERE return_number = ?`,
    [return_number]
  );
  return row || null;
}

// ─── List / Get ───────────────────────────────────────────────────────────────

async function list({ page = 1, limit = 20, invoice_id, status } = {}) {
  const offset = (page - 1) * limit;
  const params = [];
  let where = 'WHERE 1=1';

  if (invoice_id) { where += ' AND r.invoice_id = ?';  params.push(invoice_id); }
  if (status)     { where += ' AND r.status = ?';      params.push(status); }

  const [[{ total }]] = await db.execute(
    `SELECT COUNT(*) AS total FROM Returns r ${where}`, params
  );
  const [rows] = await db.execute(
    `SELECT r.*, i.invoice_number, u.username AS cashier, c.name AS customer_name
     FROM Returns r
     LEFT JOIN Invoices  i ON i.invoice_id  = r.invoice_id
     LEFT JOIN Users     u ON u.user_id     = r.user_id
     LEFT JOIN Customers c ON c.customer_id = r.customer_id
     ${where} ORDER BY r.created_at DESC
     LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
    params
  );

  return { data: rows, meta: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) } };
}

async function getById(id) {
  const [[ret]] = await db.execute(
    `SELECT r.*, i.invoice_number, u.username AS cashier, c.name AS customer_name
     FROM Returns r
     LEFT JOIN Invoices  i ON i.invoice_id  = r.invoice_id
     LEFT JOIN Users     u ON u.user_id     = r.user_id
     LEFT JOIN Customers c ON c.customer_id = r.customer_id
     WHERE r.return_id = ?`, [id]
  );
  if (!ret) throw new NotFoundError('Return');

  const [items] = await db.execute(
    `SELECT ri.*, p.name AS product_name, p.sku
     FROM Return_Items ri
     LEFT JOIN Products p ON p.product_id = ri.product_id
     WHERE ri.return_id = ?`, [id]
  );

  return { ...ret, items };
}

// ─── Create Return ────────────────────────────────────────────────────────────

/**
 * Create a return + credit note in a single transaction.
 *
 * Body shape:
 * {
 *   invoice_id: number,
 *   reason: string,
 *   refund_method: 'cash'|'card'|...|'credit_note',
 *   notes?: string,
 *   items: [{ invoice_item_id, product_id, quantity_returned, refund_amount, restock? }]
 * }
 */
async function create(body, actor) {
  const {
    invoice_id, reason, refund_method = 'credit_note',
    notes, items,
  } = body;

  if (!invoice_id)         throw new ValidationError('invoice_id is required');
  if (!items?.length)      throw new ValidationError('At least one item is required');
  if (!reason?.trim())     throw new ValidationError('Reason is required');

  // Verify invoice exists
  const [[invoice]] = await db.execute(
    `SELECT * FROM Invoices WHERE invoice_id = ? AND deleted_at IS NULL`, [invoice_id]
  );
  if (!invoice) throw new NotFoundError('Invoice');
  if (['cancelled', 'void'].includes(invoice.status)) {
    throw new AppError(`Cannot return a ${invoice.status} invoice`, 400, 'INVALID_INVOICE_STATUS');
  }

  const totalRefund = round2(
    items.reduce((s, it) => s + Number(it.refund_amount || 0), 0)
  );
  if (totalRefund <= 0) throw new ValidationError('Total refund must be greater than 0');

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const seq = await getNextReturnSequence();
    const return_number = generateReturnNumber(seq);

    // credit_remaining starts equal to total_refund for 'credit_note' returns
    const creditRemaining = refund_method === 'credit_note' ? totalRefund : 0;

    const [result] = await conn.execute(
      `INSERT INTO Returns
         (return_number, invoice_id, user_id, customer_id, total_refund,
          refund_method, reason, status, credit_remaining, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?)`,
      [return_number, invoice_id, actor.user_id, invoice.customer_id ?? null,
       totalRefund, refund_method, reason.trim(), creditRemaining, notes ?? null]
    );
    const returnId = result.insertId;

    for (const it of items) {
      const qty = Number(it.quantity_returned);
      const refund = round2(Number(it.refund_amount));
      const restock = it.restock !== false; // default true

      await conn.execute(
        `INSERT INTO Return_Items
           (return_id, invoice_item_id, product_id, quantity_returned, refund_amount, restock)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [returnId, it.invoice_item_id, it.product_id, qty, refund, restock ? 1 : 0]
      );

      if (restock) {
        // Add stock back
        await conn.execute(
          `UPDATE Products SET stock_quantity = stock_quantity + ? WHERE product_id = ?`,
          [qty, it.product_id]
        );
        // Log stock movement
        await conn.execute(
          `INSERT INTO Stock_Movements
             (product_id, change_type, reference_type, reference_id, quantity, user_id)
           VALUES (?, 'return', 'return', ?, ?, ?)`,
          [it.product_id, returnId, qty, actor.user_id]
        );
      }
    }

    // Update invoice status to refunded / partially_refunded
    const [[totals]] = await conn.execute(
      `SELECT SUM(total_refund) AS refunded FROM Returns
       WHERE invoice_id = ? AND status = 'completed'`,
      [invoice_id]
    );
    const totalRefunded = round2(Number(totals?.refunded || 0));
    const newStatus = totalRefunded >= Number(invoice.total_amount)
      ? 'refunded'
      : 'partially_refunded';

    await conn.execute(
      `UPDATE Invoices SET status = ? WHERE invoice_id = ?`,
      [newStatus, invoice_id]
    );

    await conn.commit();
    conn.release();
    return getById(returnId);
  } catch (err) {
    await conn.rollback();
    conn.release();
    throw err;
  }
}

// ─── Redeem Credit Note at POS ───────────────────────────────────────────────

/**
 * Validate a credit note and return its available balance.
 * Called by POS when cashier enters a return number.
 */
async function validateCreditNote(return_number) {
  const credit = await getCreditByNumber(return_number);
  if (!credit) throw new NotFoundError(`Credit note ${return_number}`);
  if (credit.status !== 'completed') {
    throw new AppError(`Credit note is ${credit.status}`, 400, 'CREDIT_NOT_REDEEMABLE');
  }
  const remaining = round2(Number(credit.credit_remaining || 0));
  if (remaining <= 0) {
    throw new AppError('Credit note has been fully redeemed', 400, 'CREDIT_EXHAUSTED');
  }
  return { return_id: credit.return_id, return_number, credit_remaining: remaining };
}

/**
 * Redeem (deduct) an amount from a credit note.
 * Called inside the invoice creation transaction.
 */
async function redeemCreditNote(conn, return_number, amount_to_deduct) {
  const credit = await getCreditByNumber(return_number);
  if (!credit) throw new NotFoundError(`Credit note ${return_number}`);

  const newRemaining = round2(Math.max(0, Number(credit.credit_remaining) - amount_to_deduct));
  const newStatus    = newRemaining <= 0 ? 'used' : 'completed';

  await conn.execute(
    `UPDATE Returns SET credit_remaining = ?, status = ? WHERE return_id = ?`,
    [newRemaining, newStatus, credit.return_id]
  );
  return { deducted: amount_to_deduct, remaining_after: newRemaining };
}

module.exports = { list, getById, create, validateCreditNote, redeemCreditNote, getCreditByNumber };
