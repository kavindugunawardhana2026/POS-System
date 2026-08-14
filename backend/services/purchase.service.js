'use strict';

// TODO: Implement purchase service methods
const db = require('../config/db');
const { NotFoundError } = require('../errors/HttpErrors');

async function list(query) {
  const [rows] = await db.execute('SELECT * FROM purchases LIMIT 50');
  return { data: rows };
}

async function getById(id) {
  throw new NotFoundError('purchase');
}

async function create(data, actor) {
  throw new Error('Not implemented');
}

async function update(id, data, actor) {
  throw new Error('Not implemented');
}

async function remove(id, actor) {
  throw new Error('Not implemented');
}

module.exports = { list, getById, create, update, remove };
