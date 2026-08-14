'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../config/db');
const { UnauthorizedError } = require('../errors/HttpErrors');

// ─── Helpers ──────────────────────────────────────────────────
function signAccess(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });
}

function signRefresh(payload) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
}

/** Build the standard token + user response object. */
async function buildAuthResponse(res, user, req) {
  const payload = {
    user_id: user.user_id,
    username: user.username,
    role: user.role,
  };

  const accessToken = signAccess(payload);
  const refreshToken = signRefresh(payload);

  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await db.execute(
    `INSERT INTO Refresh_Tokens (user_id, token_hash, device_info, expires_at) VALUES (?, ?, ?, ?)`,
    [user.user_id, tokenHash, req.headers['user-agent'] ?? null, expiresAt]
  );

  // Reset lockout & update last login
  await db.execute(
    `UPDATE Users SET failed_attempts = 0, locked_until = NULL, last_login_at = NOW() WHERE user_id = ?`,
    [user.user_id]
  );

  return res.json({
    success: true,
    data: {
      accessToken,
      refreshToken,
      user: {
        user_id: user.user_id,
        username: user.username,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
      },
    },
  });
}

/** Shared lockout logic after a failed attempt. */
async function handleFailedAttempt(user) {
  const attempts = (user.failed_attempts || 0) + 1;
  const lockUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
  await db.execute(
    `UPDATE Users SET failed_attempts = ?, locked_until = ? WHERE user_id = ?`,
    [attempts, lockUntil, user.user_id]
  );
}

// ─── Controllers ──────────────────────────────────────────────

/**
 * POST /auth/login
 * Standard Username + Password login (Admin / Manager / Cashier).
 */
async function login(req, res, next) {
  try {
    const { username, password } = req.body;
    if (!username || !password) throw new UnauthorizedError('Username and password required');

    const [[user]] = await db.execute(
      `SELECT * FROM Users WHERE (username = ? OR email = ?) AND deleted_at IS NULL LIMIT 1`,
      [username, username]
    );

    if (!user || !user.is_active) throw new UnauthorizedError('Invalid credentials');

    // Lockout check
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const minutesLeft = Math.ceil((new Date(user.locked_until) - Date.now()) / 60000);
      throw new UnauthorizedError(`Account locked. Try again in ${minutesLeft} minute(s).`);
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      await handleFailedAttempt(user);
      throw new UnauthorizedError('Invalid credentials');
    }

    return buildAuthResponse(res, user, req);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /auth/login-pin
 * 6-digit PIN login (Cashiers only — fast POS access).
 * Body: { pin: "123456" }
 * The cashier must be selected from a list first; we look them up by user_id + pin.
 */
async function loginPin(req, res, next) {
  try {
    const { user_id, pin } = req.body;
    if (!user_id || !pin) throw new UnauthorizedError('User and PIN required');
    if (!/^\d{6}$/.test(String(pin))) throw new UnauthorizedError('PIN must be 6 digits');

    const [[user]] = await db.execute(
      `SELECT * FROM Users WHERE user_id = ? AND role = 'cashier' AND deleted_at IS NULL LIMIT 1`,
      [user_id]
    );

    if (!user || !user.is_active) throw new UnauthorizedError('Cashier not found or inactive');
    if (!user.pin_hash) throw new UnauthorizedError('PIN not configured for this cashier');

    // Lockout check
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const minutesLeft = Math.ceil((new Date(user.locked_until) - Date.now()) / 60000);
      throw new UnauthorizedError(`Account locked. Try again in ${minutesLeft} minute(s).`);
    }

    const valid = await bcrypt.compare(String(pin), user.pin_hash);
    if (!valid) {
      await handleFailedAttempt(user);
      throw new UnauthorizedError('Incorrect PIN');
    }

    return buildAuthResponse(res, user, req);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /auth/cashiers
 * Returns list of active cashiers for the PIN selection screen (no auth required).
 */
async function listCashiers(req, res, next) {
  try {
    const [rows] = await db.execute(
      `SELECT user_id, username, first_name, last_name, display_name, avatar_url
       FROM Users
       WHERE role = 'cashier' AND is_active = 1 AND deleted_at IS NULL AND pin_hash IS NOT NULL
       ORDER BY first_name ASC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /auth/refresh
 */
async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) throw new UnauthorizedError('Refresh token required');

    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    const [[stored]] = await db.execute(
      `SELECT * FROM Refresh_Tokens WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > NOW()`,
      [tokenHash]
    );
    if (!stored) throw new UnauthorizedError('Invalid or expired refresh token');

    const newAccess = signAccess({
      user_id: payload.user_id,
      username: payload.username,
      role: payload.role,
    });
    res.json({ success: true, data: { accessToken: newAccess } });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /auth/logout
 */
async function logout(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      await db.execute(
        `UPDATE Refresh_Tokens SET revoked_at = NOW() WHERE token_hash = ?`,
        [tokenHash]
      );
    }
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, loginPin, listCashiers, refresh, logout };
