'use strict';

const productService = require('../services/product.service');
const { parseSpreadsheet } = require('../middlewares/upload');
const { ValidationError } = require('../errors/HttpErrors');

async function list(req, res, next) {
  try {
    const { page = 1, limit = 20, search, category_id } = req.query;
    const data = await productService.listProducts({ page, limit, search, category_id });
    res.json({ success: true, ...data });
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    const product = await productService.getProduct(req.params.id);
    res.json({ success: true, data: product });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const product = await productService.createProduct(req.body);
    res.status(201).json({ success: true, data: product, message: 'Product created successfully' });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const product = await productService.updateProduct(req.params.id, req.body);
    res.json({ success: true, data: product, message: 'Product updated successfully' });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    await productService.deleteProduct(req.params.id);
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (err) { next(err); }
}

async function lowStock(req, res, next) {
  try {
    const products = await productService.getLowStockProducts();
    res.json({ success: true, data: products });
  } catch (err) { next(err); }
}

/**
 * POST /products/bulk-upload
 * multipart/form-data with field "file" (.xlsx, .xls, or .csv)
 * Returns counts + per-row errors.
 */
async function bulkUpload(req, res, next) {
  try {
    if (!req.file) throw new ValidationError('No file uploaded. Use field name "file".');
    const rows = await parseSpreadsheet(req.file);
    if (!rows.length) {
      throw new ValidationError('Uploaded file is empty or has no data rows');
    }
    const result = await productService.bulkCreateProducts(rows);
    const status = result.failed === 0 ? 200 : 207; // 207 Multi-Status when partial
    res.status(status).json({
      success: result.failed === 0,
      message:
        result.failed === 0
          ? `Imported ${result.inserted.length} product(s) successfully`
          : `Imported ${result.inserted.length} product(s); ${result.failed} failed`,
      data: result,
    });
  } catch (err) { next(err); }
}

module.exports = { list, getById, create, update, remove, lowStock, bulkUpload };
