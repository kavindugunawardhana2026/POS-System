'use strict';

const db = require('../config/db');
const { NotFoundError, ValidationError } = require('../errors/HttpErrors');

function slugify(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '-');
}

async function list({ page = 1, limit = 50, search } = {}) {
  const offset = (Number(page) - 1) * Number(limit);
  const params = [];
  let where = 'WHERE deleted_at IS NULL';

  if (search) {
    where += ' AND (name LIKE ? OR slug LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like);
  }

  const [[{ total }]] = await db.execute(
    `SELECT COUNT(*) AS total FROM Categories ${where}`, params
  );
  const [rows] = await db.execute(
    `SELECT * FROM Categories ${where} ORDER BY sort_order ASC, name ASC LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  return {
    data: rows,
    meta: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) },
  };
}

async function getById(id) {
  const [[row]] = await db.execute(
    `SELECT * FROM Categories WHERE category_id = ? AND deleted_at IS NULL`, [id]
  );
  if (!row) throw new NotFoundError('Category');
  return row;
}

async function create(data, _actor) {
  const { name, description, image_url, sort_order, is_active, parent_id } = data;
  if (!name || !String(name).trim()) throw new ValidationError('name is required');

  const slug = slugify(name);

  // Ensure slug is unique
  const [[existing]] = await db.execute(
    `SELECT category_id FROM Categories WHERE slug = ? AND deleted_at IS NULL LIMIT 1`, [slug]
  );
  if (existing) throw new ValidationError(`A category with slug "${slug}" already exists`);

  const [result] = await db.execute(
    `INSERT INTO Categories (parent_id, name, slug, description, image_url, sort_order, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      parent_id ?? null,
      String(name).trim(),
      slug,
      description ?? null,
      image_url ?? null,
      sort_order ?? 0,
      is_active !== false,
    ]
  );
  return getById(result.insertId);
}

async function update(id, data, _actor) {
  await getById(id); // ensure exists

  const { name, description, image_url, sort_order, is_active, parent_id } = data;
  const fields = [];
  const params = [];

  if (name !== undefined) {
    fields.push('name = ?', 'slug = ?');
    params.push(String(name).trim(), slugify(name));
  }
  if (description !== undefined) { fields.push('description = ?'); params.push(description); }
  if (image_url    !== undefined) { fields.push('image_url = ?');   params.push(image_url);   }
  if (sort_order   !== undefined) { fields.push('sort_order = ?');  params.push(sort_order);  }
  if (is_active    !== undefined) { fields.push('is_active = ?');   params.push(is_active);   }
  if (parent_id    !== undefined) { fields.push('parent_id = ?');   params.push(parent_id);   }

  if (fields.length === 0) return getById(id);

  params.push(id);
  await db.execute(`UPDATE Categories SET ${fields.join(', ')} WHERE category_id = ?`, params);
  return getById(id);
}

async function remove(id, _actor) {
  await getById(id);
  await db.execute(`UPDATE Categories SET deleted_at = NOW() WHERE category_id = ?`, [id]);
}

module.exports = { list, getById, create, update, remove };
