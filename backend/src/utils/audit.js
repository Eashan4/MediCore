const db = require('../config/db');
const { nowStr } = require('./helpers');

const clientIp = (req) => {
  const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').toString().split(',')[0].trim();
  return ip.replace('::ffff:', '').replace('::1', '127.0.0.1').slice(0, 64);
};

/**
 * Record an audit event. Never throws - auditing must not break the request.
 * @param req    express request (used for user / ip / user-agent)
 * @param entry  { action, entity, entityId, description, severity, user }
 */
async function audit(req, { action, entity = null, entityId = null, description = null, severity = 'info', user = null }) {
  try {
    const u = user || req.user || {};
    await db.query(
      `INSERT INTO audit_logs (user_id, user_name, user_role, action, entity, entity_id, description, severity, ip_address, user_agent, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        u.id || null,
        u.name || 'Anonymous',
        u.role || null,
        action,
        entity,
        entityId != null ? String(entityId) : null,
        description ? String(description).slice(0, 500) : null,
        severity,
        clientIp(req),
        (req.headers['user-agent'] || '').slice(0, 255),
        nowStr(),
      ]
    );
  } catch (err) {
    console.error('[audit] failed to write log:', err.message);
  }
}

module.exports = { audit, clientIp };
