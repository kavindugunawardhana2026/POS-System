'use strict';

const db = require('../config/db');

/**
 * Middleware factory that logs every mutating action to Audit_Log.
 * @param {string} entityType - e.g., 'invoice', 'product'
 * @param {string} action     - 'create' | 'update' | 'delete' | 'refund'
 * @param {function} [getEntityId] - (req) => id, defaults to req.params.id
 */
function auditLogger(entityType, action, getEntityId) {
  return async (req, _res, next) => {
    try {
      const entityId = getEntityId ? getEntityId(req) : req.params.id;
      await db.execute(
        `INSERT INTO Audit_Log (user_id, entity_type, entity_id, action, ip_address, user_agent)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          req.user?.user_id ?? null,
          entityType,
          entityId ?? 0,
          action,
          req.ip,
          req.headers['user-agent'] ?? null,
        ]
      );
    } catch (_err) {
      // Audit failures must never block the request
    }
    next();
  };
}

module.exports = auditLogger;
