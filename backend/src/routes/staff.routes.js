const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const db = require('../config/db');
const { authorize } = require('../middleware/auth');
const { AppError, asyncHandler, like, nn, todayStr } = require('../utils/helpers');
const { audit } = require('../utils/audit');

const schema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(120),
  designation: z.string().trim().min(2, 'Designation is required').max(80),
  department_id: z.preprocess((v) => (v === '' || v == null ? null : Number(v)), z.number().int().positive().nullable()).optional(),
  email: z.string().trim().toLowerCase().email('Enter a valid email').or(z.literal('')).nullish(),
  phone: z.string().trim().max(30).nullish(),
  shift: z.enum(['morning', 'evening', 'night']).default('morning'),
  status: z.enum(['active', 'on_leave', 'inactive']).default('active'),
  joined_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).nullish(),
  avatar_url: z.string().trim().max(500).nullish(),
  // optional: give a receptionist a system login
  create_login: z.boolean().optional(),
  password: z.string().optional(),
});

const SELECT = `SELECT s.*, dep.name AS department, u.role AS login_role
  FROM staff s LEFT JOIN departments dep ON dep.id = s.department_id LEFT JOIN users u ON u.id = s.user_id`;

router.get('/', authorize('admin'), asyncHandler(async (req, res) => {
  const where = []; const params = [];
  if (req.query.search) { const s = like(req.query.search.trim()); where.push('(s.name LIKE ? OR s.designation LIKE ? OR dep.name LIKE ?)'); params.push(s, s, s); }
  if (req.query.department_id) { where.push('s.department_id = ?'); params.push(Number(req.query.department_id)); }
  if (req.query.shift) { where.push('s.shift = ?'); params.push(req.query.shift); }
  if (req.query.status) { where.push('s.status = ?'); params.push(req.query.status); }
  res.json(await db.query(`${SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY s.name`, params));
}));

router.post('/', authorize('admin'), asyncHandler(async (req, res) => {
  const b = schema.parse(req.body);
  let userId = null;
  const id = await db.transaction(async (conn) => {
    if (b.create_login) {
      if (!b.email) throw new AppError(422, 'An email is required to create a login', { email: 'Required for login' });
      if (!b.password || b.password.length < 8 || !/[A-Z]/.test(b.password) || !/[0-9]/.test(b.password)) {
        throw new AppError(422, 'Password needs 8+ characters, an uppercase letter and a number', { password: 'Weak password' });
      }
      const [u] = await conn.query('INSERT INTO users (name, email, password_hash, role, phone, avatar_url) VALUES (?,?,?,?,?,?)',
        [b.name, b.email, await bcrypt.hash(b.password, 10), 'receptionist', nn(b.phone), nn(b.avatar_url)]);
      userId = u.insertId;
    }
    const [r] = await conn.query(
      'INSERT INTO staff (user_id, name, designation, department_id, email, phone, shift, status, joined_on, avatar_url) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [userId, b.name, b.designation, b.department_id || null, nn(b.email), nn(b.phone), b.shift, b.status, nn(b.joined_on) || todayStr(), nn(b.avatar_url)]);
    return r.insertId;
  });
  await audit(req, { action: 'STAFF_CREATED', entity: 'staff', entityId: id, description: `Added staff member ${b.name} (${b.designation})${userId ? ' with receptionist login' : ''}` });
  res.status(201).json(await db.one(`${SELECT} WHERE s.id = ?`, [id]));
}));

router.put('/:id', authorize('admin'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const b = schema.parse(req.body);
  const r = await db.pool.query(
    'UPDATE staff SET name=?, designation=?, department_id=?, email=?, phone=?, shift=?, status=?, joined_on=COALESCE(?, joined_on), avatar_url=COALESCE(?, avatar_url) WHERE id=?',
    [b.name, b.designation, b.department_id || null, nn(b.email), nn(b.phone), b.shift, b.status, nn(b.joined_on), nn(b.avatar_url), id]);
  if (!r[0].affectedRows) throw new AppError(404, 'Staff member not found');
  const row = await db.one(`${SELECT} WHERE s.id = ?`, [id]);
  if (row.user_id) await db.query('UPDATE users SET name = ?, is_active = ? WHERE id = ?', [b.name, b.status === 'inactive' ? 0 : 1, row.user_id]);
  await audit(req, { action: 'STAFF_UPDATED', entity: 'staff', entityId: id, description: `Updated staff profile of ${b.name}` });
  res.json(row);
}));

router.delete('/:id', authorize('admin'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const s = await db.one('SELECT name, user_id FROM staff WHERE id = ?', [id]);
  if (!s) throw new AppError(404, 'Staff member not found');
  await db.query('DELETE FROM staff WHERE id = ?', [id]);
  if (s.user_id) {
    try { await db.query('DELETE FROM users WHERE id = ?', [s.user_id]); } catch { await db.query('UPDATE users SET is_active = 0 WHERE id = ?', [s.user_id]); }
  }
  await audit(req, { action: 'STAFF_DELETED', entity: 'staff', entityId: id, description: `Removed staff member ${s.name}`, severity: 'warning' });
  res.json({ message: 'Staff member removed' });
}));

module.exports = router;
