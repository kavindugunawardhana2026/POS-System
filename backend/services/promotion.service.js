'use strict';

const db = require('../config/db');
const { NotFoundError } = require('../errors/HttpErrors');

async function list(query) {
  const { is_active } = query;
  let where = 'WHERE 1=1';
  const params = [];
  
  if (is_active !== undefined) {
    where += ' AND is_active = ?';
    params.push(is_active === 'true' || is_active === '1' ? 1 : 0);
  }

  const [rows] = await db.execute(
    `SELECT * FROM Promotions ${where} ORDER BY created_at DESC LIMIT 50`, params
  );
  return { data: rows };
}

async function getById(id) {
  const [rows] = await db.execute('SELECT * FROM Promotions WHERE promotion_id = ?', [id]);
  if (rows.length === 0) throw new NotFoundError('Promotion');
  return rows[0];
}

async function create(data) {
  const { name, type, value, min_purchase_amount, start_date, end_date, is_active } = data;
  
  const [result] = await db.execute(
    `INSERT INTO Promotions (name, type, value, min_purchase_amount, start_date, end_date, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [name, type, value, min_purchase_amount || 0, start_date || null, end_date || null, is_active !== undefined ? is_active : 1]
  );
  return getById(result.insertId);
}

async function update(id, data) {
  const promotion = await getById(id);
  
  const name = data.name !== undefined ? data.name : promotion.name;
  const type = data.type !== undefined ? data.type : promotion.type;
  const value = data.value !== undefined ? data.value : promotion.value;
  const min_purchase_amount = data.min_purchase_amount !== undefined ? data.min_purchase_amount : promotion.min_purchase_amount;
  const start_date = data.start_date !== undefined ? data.start_date : promotion.start_date;
  const end_date = data.end_date !== undefined ? data.end_date : promotion.end_date;
  const is_active = data.is_active !== undefined ? data.is_active : promotion.is_active;

  await db.execute(
    `UPDATE Promotions 
     SET name = ?, type = ?, value = ?, min_purchase_amount = ?, start_date = ?, end_date = ?, is_active = ?
     WHERE promotion_id = ?`,
    [name, type, value, min_purchase_amount, start_date, end_date, is_active, id]
  );
  
  return getById(id);
}

async function remove(id) {
  await getById(id);
  await db.execute('DELETE FROM Promotions WHERE promotion_id = ?', [id]);
}

// Function to fetch active promotions applicable right now
async function getActivePromotions() {
  const [rows] = await db.execute(`
    SELECT * FROM Promotions 
    WHERE is_active = 1 
    AND (start_date IS NULL OR start_date <= CURDATE())
    AND (end_date IS NULL OR end_date >= CURDATE())
  `);
  return rows;
}

module.exports = { list, getById, create, update, remove, getActivePromotions };
