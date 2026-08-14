'use strict';

const db = require('../config/db');
const { NotFoundError, ConflictError, ValidationError } = require('../errors/HttpErrors');

async function list({ search = '', page = 1, limit = 25, is_active } = {}) {
  const offset = (Number(page) - 1) * Number(limit);
  const params = [];
  let where = 'WHERE 1=1';

  if (search) {
    where += ' AND (name LIKE ? OR contact_person LIKE ? OR phone LIKE ? OR email LIKE ?)';
    const q = `${search}%`;
    params.push(q, q, q, q);
  }
  if (is_active !== undefined && is_active !== '') {
    where += ' AND is_active = ?';
    params.push(is_active === 'true' || is_active === '1' ? 1 : 0);
  }

  const [[{ total }]] = await db.execute(
    `SELECT COUNT(*) AS total FROM Suppliers ${where}`, params
  );

  const [rows] = await db.execute(
    `SELECT s.*,
       (SELECT COUNT(*) FROM Purchases p WHERE p.supplier_id = s.supplier_id) AS purchase_count
     FROM Suppliers s
     ${where}
     ORDER BY name ASC
     LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
    params
  );

  return { data: rows, meta: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) } };
}

async function getById(id) {
  const [[row]] = await db.execute(
    `SELECT s.*,
       (SELECT COUNT(*) FROM Purchases p WHERE p.supplier_id = s.supplier_id) AS purchase_count
     FROM Suppliers s WHERE s.supplier_id = ?`,
    [id]
  );
  if (!row) throw new NotFoundError('Supplier');
  return row;
}

async function create(data) {
  const { name, contact_person, phone, email, gstin, address, is_active = true } = data;
  if (!name || !name.trim()) throw new ValidationError('Supplier name is required');

  const [result] = await db.execute(
    `INSERT INTO Suppliers (name, contact_person, phone, email, gstin, address, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [name.trim(), contact_person || null, phone || null, email || null,
     gstin || null, address || null, is_active ? 1 : 0]
  );
  return getById(result.insertId);
}

async function update(id, data) {
  const current = await getById(id);

  const name           = data.name           !== undefined ? data.name           : current.name;
  const contact_person = data.contact_person !== undefined ? data.contact_person : current.contact_person;
  const phone          = data.phone          !== undefined ? data.phone          : current.phone;
  const email          = data.email          !== undefined ? data.email          : current.email;
  const gstin          = data.gstin          !== undefined ? data.gstin          : current.gstin;
  const address        = data.address        !== undefined ? data.address        : current.address;
  const is_active      = data.is_active      !== undefined ? data.is_active      : current.is_active;

  if (!name || !name.trim()) throw new ValidationError('Supplier name is required');

  await db.execute(
    `UPDATE Suppliers SET name=?, contact_person=?, phone=?, email=?, gstin=?, address=?, is_active=?, updated_at=NOW()
     WHERE supplier_id = ?`,
    [name.trim(), contact_person || null, phone || null, email || null,
     gstin || null, address || null, is_active ? 1 : 0, id]
  );
  return getById(id);
}

async function remove(id) {
  await getById(id);

  // Guard: refuse if supplier has purchases
  const [[{ cnt }]] = await db.execute(
    'SELECT COUNT(*) AS cnt FROM Purchases WHERE supplier_id = ?', [id]
  );
  if (cnt > 0) throw new ConflictError(`Cannot delete: supplier has ${cnt} purchase record(s). Deactivate instead.`);

  await db.execute('DELETE FROM Suppliers WHERE supplier_id = ?', [id]);
}

module.exports = { list, getById, create, update, remove };
