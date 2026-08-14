'use strict';

const db = require('../config/db');
const { NotFoundError, ValidationError } = require('../errors/HttpErrors');
const { generateProductSku } = require('../utils/formatters');

const PRODUCT_COLUMNS = [
  'category_id','sku','barcode','name','description','brand','image_url',
  'cost_price','retail_price','wholesale_price','min_wholesale_quantity',
  'measurement_unit','stock_quantity','low_stock_threshold','is_active','is_taxable','expiry_date'
];

const ALLOWED_UNITS = new Set(['kg','grams','units','liters','ml','pack']);

function normalizeUnit(value) {
  if (value === null || value === undefined || value === '') return 'units';
  const v = String(value).trim().toLowerCase();
  // Map common UI labels to enum values.
  const aliases = {
    'unit': 'units', 'piece': 'units', 'pieces': 'units', 'pcs': 'units',
    'kilogram': 'kg', 'kilograms': 'kg', 'gram': 'grams', 'litre': 'liters', 'liters': 'liters',
    'millilitre': 'ml', 'millilitres': 'ml', 'milliliter': 'ml', 'milliliters': 'ml',
    'packet': 'pack', 'packs': 'pack',
  };
  const mapped = aliases[v] ?? v;
  if (!ALLOWED_UNITS.has(mapped)) {
    throw new ValidationError(`Invalid measurement_unit: ${value}`);
  }
  return mapped;
}

function toNumberOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

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
  const {
    category_id, sku, barcode, name, description, brand, image_url,
    cost_price, retail_price, wholesale_price, min_wholesale_quantity,
    measurement_unit, stock_quantity, low_stock_threshold,
  } = data;

  if (!name || !retail_price) throw new ValidationError('name and retail_price are required');

  const unit = normalizeUnit(measurement_unit);
  const finalSku = sku && String(sku).trim() ? String(sku).trim() : await generateProductSku();

  const [result] = await db.execute(
    `INSERT INTO Products
      (category_id, sku, barcode, name, description, brand, image_url,
       cost_price, retail_price, wholesale_price, min_wholesale_quantity,
       measurement_unit, stock_quantity, low_stock_threshold)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [category_id ?? null, finalSku, barcode ?? null, name, description ?? null,
     brand ?? null, image_url ?? null, cost_price ?? 0, retail_price,
     wholesale_price ?? null, min_wholesale_quantity ?? null,
     unit, stock_quantity ?? 0, low_stock_threshold ?? 0]
  );
  return getProduct(result.insertId);
}

async function updateProduct(id, data) {
  const product = await getProduct(id); // ensures exists
  const fields = [];
  const params = [];

  for (const key of PRODUCT_COLUMNS) {
    if (key in data) {
      let value = data[key];
      if (key === 'measurement_unit') value = normalizeUnit(value);
      fields.push(`${key} = ?`);
      params.push(value);
    }
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

/**
 * Bulk import products from parsed rows.
 * Expected row shape (already lower-cased keys by the parser):
 *   { sku?, barcode, name, category?, category_id?, cost_price, retail_price,
 *     wholesale_price?, measurement_unit?, stock_quantity?, low_stock_threshold?,
 *     description?, brand? }
 * Returns { inserted, failed, errors: [{ row, message }] }.
 */
async function bulkCreateProducts(rawRows) {
  const inserted = [];
  const errors = [];

  // Pre-load categories keyed by slug for fast lookup
  const [categoryRows] = await db.execute(
    `SELECT category_id, name, slug FROM Categories WHERE deleted_at IS NULL`
  );
  const catBySlug = new Map();
  const catByName = new Map();
  for (const c of categoryRows) {
    catBySlug.set(String(c.slug || '').toLowerCase(), c.category_id);
    catByName.set(String(c.name || '').toLowerCase(), c.category_id);
  }

  for (let i = 0; i < rawRows.length; i += 1) {
    const row = rawRows[i] || {};
    try {
      const name = String(row.name || '').trim();
      const retailRaw = toNumberOrNull(row.retail_price ?? row.price);
      if (!name) throw new ValidationError('name is required');
      if (retailRaw === null || retailRaw <= 0) throw new ValidationError('retail_price must be > 0');

      let categoryId = toNumberOrNull(row.category_id);
      if (!categoryId && row.category) {
        const key = String(row.category).trim().toLowerCase();
        categoryId = catBySlug.get(key) || catByName.get(key) || null;
      }

      const unit = normalizeUnit(row.measurement_unit ?? row.unit);

      const skuInput = row.sku ? String(row.sku).trim() : '';
      const sku = skuInput || await generateProductSku();

      const [result] = await db.execute(
        `INSERT INTO Products
          (category_id, sku, barcode, name, description, brand,
           cost_price, retail_price, wholesale_price, min_wholesale_quantity,
           measurement_unit, stock_quantity, low_stock_threshold)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          categoryId,
          sku,
          row.barcode ? String(row.barcode).trim() : null,
          name,
          row.description ? String(row.description).trim() : null,
          row.brand ? String(row.brand).trim() : null,
          toNumberOrNull(row.cost_price) ?? 0,
          retailRaw,
          toNumberOrNull(row.wholesale_price),
          toNumberOrNull(row.min_wholesale_quantity),
          unit,
          toNumberOrNull(row.stock_quantity) ?? 0,
          toNumberOrNull(row.low_stock_threshold) ?? 0,
        ]
      );
      inserted.push({ row: i + 1, product_id: result.insertId, sku, name });
    } catch (err) {
      errors.push({ row: i + 1, message: err.message || 'Failed to import row' });
    }
  }

  return { inserted, failed: errors.length, errors };
}

module.exports = {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getLowStockProducts,
  bulkCreateProducts,
};
