'use strict';

const db = require('../config/db');
const { NotFoundError, ConflictError, ValidationError } = require('../errors/HttpErrors');

async function list({ search = '', page = 1, limit = 25 } = {}) {
  const offset = (Number(page) - 1) * Number(limit);
  const params = [];
  let where = 'WHERE deleted_at IS NULL';

  if (search) {
    where += ' AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)';
    const q = `${search}%`;
    params.push(q, q, q);
  }

  const [[{ total }]] = await db.execute(
    `SELECT COUNT(*) AS total FROM Customers ${where}`, params
  );

  const [rows] = await db.execute(
    `SELECT customer_id, name, phone, email, city, country,
            loyalty_points, notes, created_at,
            (SELECT COUNT(*) FROM Invoices i WHERE i.customer_id = c.customer_id AND i.deleted_at IS NULL) AS invoice_count
     FROM Customers c
     ${where}
     ORDER BY name ASC
     LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
    params
  );

  return { data: rows, meta: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) } };
}

async function getById(id) {
  const [[row]] = await db.execute(
    `SELECT c.*,
       (SELECT COUNT(*) FROM Invoices i WHERE i.customer_id = c.customer_id AND i.deleted_at IS NULL) AS invoice_count,
       (SELECT COALESCE(SUM(total_amount), 0) FROM Invoices i WHERE i.customer_id = c.customer_id AND i.deleted_at IS NULL AND i.status NOT IN ('cancelled','void')) AS total_spend
     FROM Customers c
     WHERE c.customer_id = ? AND c.deleted_at IS NULL`,
    [id]
  );
  if (!row) throw new NotFoundError('Customer');
  return row;
}

async function create(data) {
  const { name, phone, email, gstin, address_line1, address_line2, city, state, postal_code, country = 'Sri Lanka', notes } = data;
  if (!name || !name.trim()) throw new ValidationError('Customer name is required');

  // Uniqueness checks
  if (phone) {
    const [[ex]] = await db.execute('SELECT 1 FROM Customers WHERE phone = ? AND deleted_at IS NULL LIMIT 1', [phone]);
    if (ex) throw new ConflictError('A customer with this phone number already exists');
  }
  if (email) {
    const [[ex]] = await db.execute('SELECT 1 FROM Customers WHERE email = ? AND deleted_at IS NULL LIMIT 1', [email]);
    if (ex) throw new ConflictError('A customer with this email already exists');
  }

  const [result] = await db.execute(
    `INSERT INTO Customers (name, phone, email, gstin, address_line1, address_line2, city, state, postal_code, country, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [name.trim(), phone || null, email || null, gstin || null, address_line1 || null,
     address_line2 || null, city || null, state || null, postal_code || null, country, notes || null]
  );
  return getById(result.insertId);
}

async function update(id, data) {
  const current = await getById(id);

  const name         = data.name         !== undefined ? data.name         : current.name;
  const phone        = data.phone        !== undefined ? data.phone        : current.phone;
  const email        = data.email        !== undefined ? data.email        : current.email;
  const gstin        = data.gstin        !== undefined ? data.gstin        : current.gstin;
  const address_line1= data.address_line1!== undefined ? data.address_line1: current.address_line1;
  const address_line2= data.address_line2!== undefined ? data.address_line2: current.address_line2;
  const city         = data.city         !== undefined ? data.city         : current.city;
  const state        = data.state        !== undefined ? data.state        : current.state;
  const postal_code  = data.postal_code  !== undefined ? data.postal_code  : current.postal_code;
  const country      = data.country      !== undefined ? data.country      : current.country;
  const notes        = data.notes        !== undefined ? data.notes        : current.notes;

  if (!name || !name.trim()) throw new ValidationError('Customer name is required');

  // Uniqueness checks (excluding self)
  if (phone && phone !== current.phone) {
    const [[ex]] = await db.execute('SELECT 1 FROM Customers WHERE phone = ? AND customer_id != ? AND deleted_at IS NULL LIMIT 1', [phone, id]);
    if (ex) throw new ConflictError('A customer with this phone number already exists');
  }
  if (email && email !== current.email) {
    const [[ex]] = await db.execute('SELECT 1 FROM Customers WHERE email = ? AND customer_id != ? AND deleted_at IS NULL LIMIT 1', [email, id]);
    if (ex) throw new ConflictError('A customer with this email already exists');
  }

  await db.execute(
    `UPDATE Customers SET name=?, phone=?, email=?, gstin=?, address_line1=?, address_line2=?,
     city=?, state=?, postal_code=?, country=?, notes=?, updated_at=NOW()
     WHERE customer_id = ?`,
    [name.trim(), phone || null, email || null, gstin || null, address_line1 || null,
     address_line2 || null, city || null, state || null, postal_code || null, country, notes || null, id]
  );
  return getById(id);
}

async function remove(id) {
  await getById(id);

  // Guard: refuse if customer has any non-cancelled invoices
  const [[{ cnt }]] = await db.execute(
    `SELECT COUNT(*) AS cnt FROM Invoices WHERE customer_id = ? AND deleted_at IS NULL AND status NOT IN ('cancelled','void')`,
    [id]
  );
  if (cnt > 0) throw new ConflictError(`Cannot delete: customer has ${cnt} active invoice(s)`);

  await db.execute('UPDATE Customers SET deleted_at = NOW() WHERE customer_id = ?', [id]);
}

module.exports = { list, getById, create, update, remove };
