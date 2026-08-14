'use strict';

// TODO: Implement report service methods
const db = require('../config/db');
const { NotFoundError } = require('../errors/HttpErrors');

async function list(query) {
  const [rows] = await db.execute('SELECT * FROM reports LIMIT 50');
  return { data: rows };
}

async function getById(id) {
  throw new NotFoundError('report');
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
