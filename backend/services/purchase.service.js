'use strict';

const db = require('../config/db');
const { NotFoundError, ValidationError } = require('../errors/HttpErrors');
const { round2 } = require('../utils/formatters');

async function list({ from, to, supplier_id, page = 1, limit = 25 } = {}) {
  const offset = (Number(page) - 1) * Number(limit);
  const params = [];
  let where = 'WHERE 1=1';

  if (from)        { where += ' AND DATE(p.purchase_date) >= ?'; params.push(from); }
  if (to)          { where += ' AND DATE(p.purchase_date) <= ?'; params.push(to); }
  if (supplier_id) { where += ' AND p.supplier_id = ?'; params.push(supplier_id); }

  const [[{ total }]] = await db.execute(
    `SELECT COUNT(*) AS total FROM Purchases p ${where}`, params
  );

  const [rows] = await db.execute(
    `SELECT p.*, s.name AS supplier_name, u.username AS created_by,
       (SELECT COUNT(*) FROM Purchase_Items pi WHERE pi.purchase_id = p.purchase_id) AS item_count
     FROM Purchases p
     LEFT JOIN Suppliers s ON s.supplier_id = p.supplier_id
     LEFT JOIN Users u ON u.user_id = p.user_id
     ${where}
     ORDER BY p.purchase_date DESC
     LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
    params
  );

  return { data: rows, meta: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) } };
}

async function getById(id) {
  const [[purchase]] = await db.execute(
    `SELECT p.*, s.name AS supplier_name, u.username AS created_by
     FROM Purchases p
     LEFT JOIN Suppliers s ON s.supplier_id = p.supplier_id
     LEFT JOIN Users u ON u.user_id = p.user_id
     WHERE p.purchase_id = ?`,
    [id]
  );
  if (!purchase) throw new NotFoundError('Purchase');

  const [items] = await db.execute(
    `SELECT pi.*, pr.name AS product_name, pr.sku
     FROM Purchase_Items pi
     JOIN Products pr ON pr.product_id = pi.product_id
     WHERE pi.purchase_id = ?`,
    [id]
  );

  return { ...purchase, items };
}

async function create(data, actor) {
  const { supplier_id, reference_no, notes, purchase_date, items } = data;

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new ValidationError('At least one item is required');
  }

  // Validate all items have required fields
  for (const it of items) {
    if (!it.product_id) throw new ValidationError('Each item must have a product_id');
    if (!it.quantity || Number(it.quantity) <= 0) throw new ValidationError('Each item must have a positive quantity');
    if (!it.unit_cost || Number(it.unit_cost) < 0) throw new ValidationError('Each item must have a valid unit cost');
  }

  // Calculate totals
  const itemsCalc = items.map(it => ({
    product_id: it.product_id,
    quantity:   round2(Number(it.quantity)),
    unit_cost:  round2(Number(it.unit_cost)),
    subtotal:   round2(Number(it.quantity) * Number(it.unit_cost)),
  }));
  const total_amount = round2(itemsCalc.reduce((s, it) => s + it.subtotal, 0));
  const net_amount   = total_amount; // No tax for now

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Validate products exist
    for (const it of itemsCalc) {
      const [[product]] = await conn.execute('SELECT product_id FROM Products WHERE product_id = ?', [it.product_id]);
      if (!product) throw new ValidationError(`Product ID ${it.product_id} not found`);
    }

    // Insert purchase header
    const [result] = await conn.execute(
      `INSERT INTO Purchases (supplier_id, user_id, reference_no, total_amount, tax_amount, net_amount, notes, purchase_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [supplier_id || null, actor.user_id, reference_no || null, total_amount, 0, net_amount,
       notes || null, purchase_date || new Date().toISOString().slice(0, 10)]
    );
    const purchaseId = result.insertId;

    // Insert items + update stock + log movements
    for (const it of itemsCalc) {
      await conn.execute(
        `INSERT INTO Purchase_Items (purchase_id, product_id, quantity, unit_cost, subtotal)
         VALUES (?, ?, ?, ?, ?)`,
        [purchaseId, it.product_id, it.quantity, it.unit_cost, it.subtotal]
      );

      await conn.execute(
        `UPDATE Products SET stock_quantity = stock_quantity + ? WHERE product_id = ?`,
        [it.quantity, it.product_id]
      );

      await conn.execute(
        `INSERT INTO Stock_Movements (product_id, change_type, reference_type, reference_id, quantity, unit_cost, user_id)
         VALUES (?, 'purchase', 'purchase', ?, ?, ?, ?)`,
        [it.product_id, purchaseId, it.quantity, it.unit_cost, actor.user_id]
      );
    }

    await conn.commit();
    conn.release();
    return getById(purchaseId);
  } catch (err) {
    await conn.rollback();
    conn.release();
    throw err;
  }
}

async function remove(id, actor) {
  const purchase = await getById(id);

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Reverse stock for each item
    for (const it of purchase.items) {
      await conn.execute(
        `UPDATE Products SET stock_quantity = stock_quantity - ? WHERE product_id = ?`,
        [it.quantity, it.product_id]
      );

      await conn.execute(
        `INSERT INTO Stock_Movements (product_id, change_type, reference_type, reference_id, quantity, unit_cost, user_id)
         VALUES (?, 'adjustment', 'purchase_reversal', ?, ?, ?, ?)`,
        [it.product_id, id, -it.quantity, it.unit_cost, actor.user_id]
      );
    }

    await conn.execute('DELETE FROM Purchase_Items WHERE purchase_id = ?', [id]);
    await conn.execute('DELETE FROM Purchases WHERE purchase_id = ?', [id]);

    await conn.commit();
    conn.release();
  } catch (err) {
    await conn.rollback();
    conn.release();
    throw err;
  }
}

module.exports = { list, getById, create, remove };
