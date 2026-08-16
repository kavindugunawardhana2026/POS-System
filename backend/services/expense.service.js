'use strict';

const db = require('../config/db');
const { NotFoundError, ValidationError } = require('../errors/HttpErrors');

const VALID_PAYMENT_METHODS = ['cash', 'card', 'upi', 'bank_transfer'];

async function list({ page = 1, limit = 25, search, date_from, date_to, category, payment_method } = {}) {
  const offset = (Number(page) - 1) * Number(limit);
  const params = [];
  const conditions = [];

  if (search) {
    conditions.push('(e.category LIKE ? OR e.notes LIKE ?)');
    const q = `%${search}%`;
    params.push(q, q);
  }
  if (date_from) {
    conditions.push('e.expense_date >= ?');
    params.push(date_from);
  }
  if (date_to) {
    conditions.push('e.expense_date <= ?');
    params.push(date_to);
  }
  if (category) {
    conditions.push('e.category = ?');
    params.push(category);
  }
  if (payment_method) {
    conditions.push('e.payment_method = ?');
    params.push(payment_method);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [[{ total }]] = await db.execute(
    `SELECT COUNT(*) AS total FROM Expenses e ${where}`, params
  );

  const [[{ total_amount }]] = await db.execute(
    `SELECT COALESCE(SUM(e.amount), 0) AS total_amount FROM Expenses e ${where}`, params
  );

  const [rows] = await db.execute(
    `SELECT e.*, u.username, u.first_name, u.last_name
     FROM Expenses e
     LEFT JOIN Users u ON u.user_id = e.user_id
     ${where}
     ORDER BY e.expense_date DESC, e.created_at DESC
     LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
    params
  );

  return {
    data: rows,
    meta: {
      total,
      total_amount: Number(total_amount),
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit)),
    },
  };
}

async function getById(id) {
  const [[row]] = await db.execute(
    `SELECT e.*, u.username, u.first_name, u.last_name
     FROM Expenses e
     LEFT JOIN Users u ON u.user_id = e.user_id
     WHERE e.expense_id = ?`,
    [id]
  );
  if (!row) throw new NotFoundError('Expense');
  return row;
}

async function create(data, actor) {
  const { category, amount, payment_method = 'cash', notes, expense_date } = data;

  if (!category || !String(category).trim()) throw new ValidationError('Category is required');
  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) throw new ValidationError('Amount must be a positive number');
  if (!expense_date) throw new ValidationError('Expense date is required');
  if (!VALID_PAYMENT_METHODS.includes(payment_method)) {
    throw new ValidationError(`payment_method must be one of: ${VALID_PAYMENT_METHODS.join(', ')}`);
  }

  const [result] = await db.execute(
    `INSERT INTO Expenses (category, amount, payment_method, user_id, notes, expense_date)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      String(category).trim(),
      Number(amount),
      payment_method,
      actor.user_id,
      notes || null,
      expense_date,
    ]
  );
  return getById(result.insertId);
}

async function update(id, data, actor) {
  const current = await getById(id);

  const category       = data.category       !== undefined ? String(data.category).trim() : current.category;
  const amount         = data.amount         !== undefined ? Number(data.amount)          : current.amount;
  const payment_method = data.payment_method !== undefined ? data.payment_method          : current.payment_method;
  const notes          = data.notes          !== undefined ? data.notes                   : current.notes;
  const expense_date   = data.expense_date   !== undefined ? data.expense_date            : current.expense_date;

  if (!category) throw new ValidationError('Category is required');
  if (!amount || amount <= 0) throw new ValidationError('Amount must be a positive number');
  if (!VALID_PAYMENT_METHODS.includes(payment_method)) {
    throw new ValidationError(`payment_method must be one of: ${VALID_PAYMENT_METHODS.join(', ')}`);
  }

  await db.execute(
    `UPDATE Expenses SET category=?, amount=?, payment_method=?, notes=?, expense_date=?
     WHERE expense_id = ?`,
    [category, amount, payment_method, notes || null, expense_date, id]
  );
  return getById(id);
}

async function remove(id, actor) {
  await getById(id); // ensure exists
  await db.execute('DELETE FROM Expenses WHERE expense_id = ?', [id]);
}

module.exports = { list, getById, create, update, remove };
