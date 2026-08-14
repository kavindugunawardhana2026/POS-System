'use strict';

const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { NotFoundError, ConflictError } = require('../errors/HttpErrors');
const AppError = require('../errors/AppError');

// ─── Helpers ──────────────────────────────────────────────────

function safeUser(u) {
  const { password_hash, pin_hash, ...safe } = u;
  return safe;
}

// ─── CRUD ─────────────────────────────────────────────────────

async function listUsers({ page = 1, limit = 20, role, search } = {}) {
  const offset = (page - 1) * limit;
  const params = [];
  let where = 'WHERE deleted_at IS NULL';

  if (role) { where += ' AND role = ?'; params.push(role); }
  if (search) {
    where += ' AND (username LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR email LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }

  const [[{ total }]] = await db.execute(
    `SELECT COUNT(*) AS total FROM Users ${where}`, params
  );
  const [rows] = await db.execute(
    `SELECT user_id, username, email, phone, first_name, last_name, display_name,
            avatar_url, role, is_active, last_login_at, failed_attempts, locked_until,
            created_at, updated_at,
            CASE WHEN pin_hash IS NOT NULL THEN 1 ELSE 0 END AS has_pin
     FROM Users ${where} ORDER BY first_name ASC LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  return {
    data: rows,
    meta: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) },
  };
}

async function getUserById(id) {
  const [[user]] = await db.execute(
    `SELECT user_id, username, email, phone, first_name, last_name, display_name,
            avatar_url, role, is_active, last_login_at, failed_attempts, locked_until,
            created_at, updated_at,
            CASE WHEN pin_hash IS NOT NULL THEN 1 ELSE 0 END AS has_pin
     FROM Users WHERE user_id = ? AND deleted_at IS NULL`, [id]
  );
  if (!user) throw new NotFoundError('User');
  return user;
}

async function createUser(data) {
  const {
    username, email, phone, password, first_name, last_name,
    display_name, role = 'cashier', is_active = true,
  } = data;

  // Duplicate check
  const [[existing]] = await db.execute(
    `SELECT user_id FROM Users WHERE username = ? AND deleted_at IS NULL`, [username]
  );
  if (existing) throw new ConflictError(`Username '${username}' is already taken`);

  const passwordHash = await bcrypt.hash(password, 12);

  const [result] = await db.execute(
    `INSERT INTO Users (username, email, phone, password_hash, first_name, last_name, display_name, role, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [username, email ?? null, phone ?? null, passwordHash,
     first_name ?? null, last_name ?? null, display_name ?? null, role, is_active ? 1 : 0]
  );

  return getUserById(result.insertId);
}

async function updateUser(id, data) {
  const user = await getUserById(id);

  const allowed = ['email', 'phone', 'first_name', 'last_name', 'display_name',
                   'avatar_url', 'role', 'is_active'];
  const fields = [];
  const params = [];

  for (const key of allowed) {
    if (key in data) {
      fields.push(`${key} = ?`);
      params.push(data[key]);
    }
  }

  if (data.password) {
    fields.push('password_hash = ?');
    params.push(await bcrypt.hash(data.password, 12));
  }

  if (fields.length === 0) return user;

  params.push(id);
  await db.execute(`UPDATE Users SET ${fields.join(', ')} WHERE user_id = ?`, params);
  return getUserById(id);
}

async function deleteUser(id, actorId) {
  if (Number(id) === Number(actorId)) {
    throw new AppError('You cannot delete your own account', 400, 'SELF_DELETE');
  }
  await getUserById(id); // throws if not found
  await db.execute(`UPDATE Users SET deleted_at = NOW() WHERE user_id = ?`, [id]);
}

// ─── PIN management ───────────────────────────────────────────

/**
 * Admin sets or resets a cashier's 6-digit PIN.
 */
async function setPin(id, pin) {
  const user = await getUserById(id);
  if (user.role !== 'cashier') {
    throw new AppError('Only cashiers can have a PIN', 400, 'INVALID_ROLE');
  }
  if (!/^\d{6}$/.test(String(pin))) {
    throw new AppError('PIN must be exactly 6 digits', 400, 'INVALID_PIN');
  }

  const pinHash = await bcrypt.hash(String(pin), 10);
  await db.execute(`UPDATE Users SET pin_hash = ? WHERE user_id = ?`, [pinHash, id]);
  return { success: true, message: 'PIN updated successfully' };
}

/**
 * Admin clears a cashier's PIN (disables PIN login for that user).
 */
async function clearPin(id) {
  await getUserById(id);
  await db.execute(`UPDATE Users SET pin_hash = NULL WHERE user_id = ?`, [id]);
  return { success: true, message: 'PIN cleared' };
}

/**
 * Unlock a locked user account (admin action).
 */
async function unlockUser(id) {
  await getUserById(id);
  await db.execute(
    `UPDATE Users SET failed_attempts = 0, locked_until = NULL WHERE user_id = ?`, [id]
  );
  return { success: true, message: 'User unlocked' };
}

module.exports = {
  listUsers, getUserById, createUser, updateUser, deleteUser,
  setPin, clearPin, unlockUser,
};
