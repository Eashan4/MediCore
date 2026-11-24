const router = require('express').Router();
const db = require('../config/db');
const { authorize } = require('../middleware/auth');
const { asyncHandler, paging, like, nowStr, todayStr, addDays } = require('../utils/helpers');

router.use(authorize('admin'));

router.get('/', asyncHandler(async (req, res) => {
  const { page, limit, offset } = paging(req.query, 20, 100);
  const where = []; const params = [];
  if (req.query.search) {
    const s = like(req.query.search.trim());
    where.push('(user_name LIKE ? OR description LIKE ? OR action LIKE ? OR ip_address LIKE ?)');
    params.push(s, s, s, s);
  }
  if (req.query.action) { where.push('action = ?'); params.push(req.query.action); }
  if (req.query.severity) { where.push('severity = ?'); params.push(req.query.severity); }
  if (req.query.role) { where.push('user_role = ?'); params.push(req.query.role); }
  if (req.query.entity) { where.push('entity = ?'); params.push(req.query.entity); }
  if (req.query.user_id) { where.push('user_id = ?'); params.push(Number(req.query.user_id)); }
  if (req.query.from) { where.push('created_at >= ?'); params.push(`${req.query.from} 00:00:00`); }
  if (req.query.to) { where.push('created_at <= ?'); params.push(`${req.query.to} 23:59:59`); }
  const W = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [{ total }] = await db.query(`SELECT COUNT(*) AS total FROM audit_logs ${W}`, params);
  const data = await db.query(`SELECT * FROM audit_logs ${W} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  res.json({ data, total, page, limit, pages: Math.ceil(total / limit) });
}));

router.get('/actions', asyncHandler(async (_req, res) => {
  const rows = await db.query('SELECT DISTINCT action FROM audit_logs ORDER BY action');
  res.json(rows.map((r) => r.action));
}));

// Security monitoring dashboard
router.get('/stats', asyncHandler(async (_req, res) => {
  const now = new Date();
  const d1 = nowStr(addDays(-1, now));
  const d14 = `${todayStr(addDays(-13, now))} 00:00:00`;
  const d7 = nowStr(addDays(-7, now));

  const [totals] = await db.query(
    `SELECT COUNT(*) AS events_24h,
            SUM(action = 'LOGIN') AS logins_24h,
            SUM(action = 'LOGIN_FAILED') AS failed_24h,
            SUM(severity = 'warning') AS warnings_24h,
            SUM(severity = 'critical') AS critical_24h,
            COUNT(DISTINCT user_id) AS active_users_24h,
            SUM(entity = 'patient' AND action <> 'PATIENT_VIEWED') AS patient_changes_24h
       FROM audit_logs WHERE created_at >= ?`, [d1]);

  const perDay = await db.query(
    `SELECT DATE(created_at) AS day, COUNT(*) AS events, SUM(action = 'LOGIN') AS logins, SUM(action = 'LOGIN_FAILED') AS failed,
            SUM(severity <> 'info') AS flagged
       FROM audit_logs WHERE created_at >= ? GROUP BY DATE(created_at) ORDER BY day`, [d14]);

  const byHour = await db.query('SELECT HOUR(created_at) AS hour, COUNT(*) AS events FROM audit_logs WHERE created_at >= ? GROUP BY HOUR(created_at)', [d7]);
  const byEntity = await db.query(
    `SELECT COALESCE(entity, 'other') AS entity, COUNT(*) AS events FROM audit_logs WHERE created_at >= ? GROUP BY entity ORDER BY events DESC LIMIT 8`, [d7]);
  const byRole = await db.query(
    `SELECT COALESCE(user_role, 'anonymous') AS role, COUNT(*) AS events FROM audit_logs WHERE created_at >= ? GROUP BY user_role ORDER BY events DESC`, [d7]);
  const topUsers = await db.query(
    `SELECT l.user_id, l.user_name, l.user_role, u.avatar_url, COUNT(*) AS events, MAX(l.created_at) AS last_seen
       FROM audit_logs l LEFT JOIN users u ON u.id = l.user_id
      WHERE l.created_at >= ? AND l.user_id IS NOT NULL GROUP BY l.user_id, l.user_name, l.user_role, u.avatar_url ORDER BY events DESC LIMIT 6`, [d7]);
  const suspicious = await db.query(
    `SELECT ip_address, COUNT(*) AS attempts, MAX(created_at) AS last_attempt,
            SUBSTRING_INDEX(GROUP_CONCAT(DISTINCT SUBSTRING_INDEX(SUBSTRING_INDEX(description, 'for ', -1), ' -', 1) SEPARATOR ', '), ', ', 3) AS targets
       FROM audit_logs WHERE action = 'LOGIN_FAILED' AND created_at >= ? GROUP BY ip_address HAVING attempts >= 3 ORDER BY attempts DESC LIMIT 5`, [d7]);
  const recentAlerts = await db.query(
    `SELECT * FROM audit_logs WHERE severity IN ('warning','critical') ORDER BY created_at DESC, id DESC LIMIT 8`);
  const [lastLogins] = await db.query(`SELECT COUNT(*) AS c FROM users WHERE last_login_at >= ?`, [d1]);

  const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, events: Number((byHour.find((r) => r.hour === h) || {}).events || 0) }));
  const num = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Number(v) || 0]));
  res.json({
    totals: { ...num(totals), users_logged_in_24h: lastLogins.c },
    per_day: perDay.map((r) => ({ ...r, events: +r.events, logins: +r.logins, failed: +r.failed, flagged: +r.flagged })),
    by_hour: hours,
    by_entity: byEntity.map((r) => ({ ...r, events: +r.events })),
    by_role: byRole.map((r) => ({ ...r, events: +r.events })),
    top_users: topUsers.map((r) => ({ ...r, events: +r.events })),
    suspicious: suspicious.map((r) => ({ ...r, attempts: +r.attempts })),
    recent_alerts: recentAlerts,
  });
}));

module.exports = router;
