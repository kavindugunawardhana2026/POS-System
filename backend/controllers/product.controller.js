'use strict';

const productService = require('../services/product.service');

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

module.exports = { list, getById, create, update, remove, lowStock };
