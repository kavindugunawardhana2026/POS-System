'use strict';

const db = require('../config/db');
const { NotFoundError } = require('../errors/HttpErrors');
const AppError = require('../errors/AppError');

async function list(query) {
  const { status, user_id } = query;
  let where = 'WHERE 1=1';
  const params = [];
  if (status) { where += ' AND s.status = ?'; params.push(status); }
  if (user_id) { where += ' AND s.user_id = ?'; params.push(user_id); }

  const [rows] = await db.execute(
    `SELECT s.*, u.username as cashier_name
     FROM Shifts s
     LEFT JOIN Users u ON s.user_id = u.user_id
     ${where} ORDER BY s.opened_at DESC LIMIT 50`, params
  );
  return { data: rows };
}

async function getById(id) {
  const [rows] = await db.execute(
    `SELECT s.*, u.username as cashier_name
     FROM Shifts s
     LEFT JOIN Users u ON s.user_id = u.user_id
     WHERE s.shift_id = ?`, [id]
  );
  if (rows.length === 0) throw new NotFoundError('Shift');
  return rows[0];
}

async function create(data, actor) {
  const { opening_cash = 0, notes } = data;
  
  // Check if an open shift already exists for this user
  const [openShifts] = await db.execute(
    `SELECT * FROM Shifts WHERE user_id = ? AND status = 'open'`, [actor.user_id]
  );
  if (openShifts.length > 0) {
    throw new AppError('You already have an open shift. Please close it first.', 400, 'SHIFT_OPEN');
  }

  const [result] = await db.execute(
    `INSERT INTO Shifts (user_id, opening_cash, notes, status) VALUES (?, ?, ?, 'open')`,
    [actor.user_id, opening_cash, notes ?? null]
  );
  return getById(result.insertId);
}

async function update(id, data, actor) {
  const { closing_cash, notes } = data;
  const shift = await getById(id);
  
  if (shift.status === 'closed') {
    throw new AppError('Shift is already closed.', 400, 'SHIFT_CLOSED');
  }

  // Calculate expected cash
  const [payments] = await db.execute(
    `SELECT COALESCE(SUM(amount), 0) as total_cash_received
     FROM Invoice_Payments
     WHERE invoice_id IN (SELECT invoice_id FROM Invoices WHERE shift_id = ?)
     AND payment_method = 'cash'`,
    [id]
  );
  const expectedCash = Number(shift.opening_cash) + Number(payments[0].total_cash_received);
  let variance = null;
  let closed_at = null;
  let status = 'open';

  // If closing_cash is provided, we are closing the shift
  if (closing_cash !== undefined && closing_cash !== null) {
    variance = Number(closing_cash) - expectedCash;
    closed_at = new Date();
    status = 'closed';
  }

  await db.execute(
    `UPDATE Shifts
     SET closing_cash = ?, expected_cash = ?, variance = ?, notes = ?, status = ?, closed_at = ?
     WHERE shift_id = ?`,
    [closing_cash ?? null, expectedCash, variance, notes ?? shift.notes, status, closed_at, id]
  );

  return getById(id);
}

async function remove(id, actor) {
  const shift = await getById(id);
  await db.execute('DELETE FROM Shifts WHERE shift_id = ?', [id]);
}

async function current(actor) {
  const [rows] = await db.execute(
    `SELECT s.*, u.username as cashier_name
     FROM Shifts s
     LEFT JOIN Users u ON s.user_id = u.user_id
     WHERE s.user_id = ? AND s.status = 'open'
     ORDER BY s.opened_at DESC LIMIT 1`, [actor.user_id]
  );
  return rows[0] || null;
}

module.exports = { list, getById, create, update, remove, current };
