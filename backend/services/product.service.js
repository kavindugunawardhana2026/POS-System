'use strict';

const db = require('../config/db');
const { NotFoundError } = require('../errors/HttpErrors');

async function listProducts({ page = 1, limit = 20, search, category_id }) {
  const offset = (page - 1) * limit;
  const params = [];
  let where = 'WHERE p.deleted_at IS NULL';

  if (search) {
    where += ' AND (p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  if (category_id) {
    where += ' AND p.category_id = ?';
    params.push(category_id);
  }

  const [[{ total }]] = await db.execute(
    `SELECT COUNT(*) AS total FROM Products p ${where}`, params
  );
  const [rows] = await db.execute(
    `SELECT p.*, c.name AS category_name
     FROM Products p
     LEFT JOIN Categories c ON c.category_id = p.category_id
     ${where}
     ORDER BY p.name ASC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  return { data: rows, meta: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) } };
}

async function getProduct(id) {
  const [[product]] = await db.execute(
    `SELECT p.*, c.name AS category_name
     FROM Products p LEFT JOIN Categories c ON c.category_id = p.category_id
     WHERE p.product_id = ? AND p.deleted_at IS NULL`, [id]
  );
  if (!product) throw new NotFoundError('Product');
  return product;
}

async function createProduct(data) {
  const { category_id, sku, barcode, name, description, brand, image_url,
          cost_price, retail_price, wholesale_price, min_wholesale_quantity,
          measurement_unit, stock_quantity, low_stock_threshold } = data;

  const [result] = await db.execute(
    `INSERT INTO Products
      (category_id, sku, barcode, name, description, brand, image_url,
       cost_price, retail_price, wholesale_price, min_wholesale_quantity,
       measurement_unit, stock_quantity, low_stock_threshold)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [category_id ?? null, sku ?? null, barcode ?? null, name, description ?? null,
     brand ?? null, image_url ?? null, cost_price ?? 0, retail_price,
     wholesale_price ?? null, min_wholesale_quantity ?? null,
     measurement_unit ?? 'units', stock_quantity ?? 0, low_stock_threshold ?? 0]
  );
  return getProduct(result.insertId);
}

async function updateProduct(id, data) {
  const product = await getProduct(id); // ensures exists
  const fields = [];
  const params = [];

  const allowed = ['category_id','sku','barcode','name','description','brand','image_url',
                   'cost_price','retail_price','wholesale_price','min_wholesale_quantity',
                   'measurement_unit','stock_quantity','low_stock_threshold','is_active','expiry_date'];

  for (const key of allowed) {
    if (key in data) { fields.push(`${key} = ?`); params.push(data[key]); }
  }

  if (fields.length === 0) return product;

  params.push(id);
  await db.execute(`UPDATE Products SET ${fields.join(', ')} WHERE product_id = ?`, params);
  return getProduct(id);
}

async function deleteProduct(id) {
  await getProduct(id);
  await db.execute(`UPDATE Products SET deleted_at = NOW() WHERE product_id = ?`, [id]);
}

async function getLowStockProducts() {
  const [rows] = await db.execute(
    `SELECT * FROM Products
     WHERE stock_quantity <= low_stock_threshold AND deleted_at IS NULL AND is_active = 1
     ORDER BY stock_quantity ASC`
  );
  return rows;
}

module.exports = { listProducts, getProduct, createProduct, updateProduct, deleteProduct, getLowStockProducts };
