const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const db = require('../config/db');
const { authorize } = require('../middleware/auth');
const { AppError, asyncHandler, nowStr, todayStr, like, nn } = require('../utils/helpers');
const { audit } = require('../utils/audit');

const idNum = z.preprocess((v) => (v === '' || v == null ? undefined : Number(v)), z.number().int().positive());
const base = {
  name: z.string().trim().min(2, 'Name is required').max(120),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  phone: z.string().trim().max(30).nullish(),
  avatar_url: z.string().trim().max(500).nullish(),
  department_id: idNum,
  specialization: z.string().trim().min(2, 'Specialization is required').max(120),
  qualification: z.string().trim().max(200).nullish(),
  experience_years: z.preprocess((v) => Number(v || 0), z.number().int().min(0).max(60)),
  consultation_fee: z.preprocess((v) => Number(v || 0), z.number().min(0).max(100000)),
  license_no: z.string().trim().min(3, 'License number is required').max(60),
  bio: z.string().trim().max(1000).nullish(),
  available_days: z.string().trim().max(60).default('Mon,Tue,Wed,Thu,Fri'),
  status: z.enum(['active', 'on_leave', 'inactive']).default('active'),
};
const createSchema = z.object({ ...base, password: z.string().min(8, 'Use at least 8 characters').regex(/[A-Z]/, 'Include an uppercase letter').regex(/[0-9]/, 'Include a number') });
const updateSchema = z.object({ ...base, password: z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/).optional().or(z.literal('')) });

const SELECT = `
  SELECT d.id, d.user_id, d.department_id, d.specialization, d.qualification, d.experience_years, d.consultation_fee, d.license_no,
         d.bio, d.rating, d.available_days, d.status, u.name, u.email, u.phone, u.avatar_url, u.last_login_at, dep.name AS department,
         dep.color AS department_color,
         (SELECT COUNT(*) FROM patients p WHERE p.assigned_doctor_id = d.id) AS patients,
         (SELECT COUNT(*) FROM appointments ap WHERE ap.doctor_id = d.id AND DATE(ap.scheduled_at) = ? AND ap.status <> 'cancelled') AS appointments_today
    FROM doctors d JOIN users u ON u.id = d.user_id LEFT JOIN departments dep ON dep.id = d.department_id`;

router.get('/', authorize('admin', 'receptionist', 'doctor'), asyncHandler(async (req, res) => {
  const where = []; const params = [todayStr()];
  if (req.query.search) {
    const s = like(req.query.search.trim());
    where.push('(u.name LIKE ? OR d.specialization LIKE ? OR dep.name LIKE ?)');
    params.push(s, s, s);
  }
  if (req.query.department_id) { where.push('d.department_id = ?'); params.push(Number(req.query.department_id)); }
  if (req.query.status) { where.push('d.status = ?'); params.push(req.query.status); }
  const W = where.length ? `WHERE ${where.join(' AND ')}` : '';
  res.json(await db.query(`${SELECT} ${W} ORDER BY u.name`, params));
}));

router.get('/:id', authorize('admin', 'receptionist', 'doctor'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const doc = await db.one(`${SELECT} WHERE d.id = ?`, [todayStr(), id]);
  if (!doc) throw new AppError(404, 'Doctor not found');
  const upcoming = await db.query(
    `SELECT ap.id, ap.scheduled_at, ap.status, ap.type, p.first_name, p.last_name, p.patient_code
       FROM appointments ap JOIN patients p ON p.id = ap.patient_id
      WHERE ap.doctor_id = ? AND ap.scheduled_at >= ? AND ap.status IN ('scheduled','checked_in') ORDER BY ap.scheduled_at LIMIT 8`, [id, nowStr()]);
  res.json({ ...doc, upcoming });
}));

router.post('/', authorize('admin'), asyncHandler(async (req, res) => {
  const b = createSchema.parse(req.body);
  const id = await db.transaction(async (conn) => {
    const [u] = await conn.query('INSERT INTO users (name, email, password_hash, role, phone, avatar_url) VALUES (?,?,?,?,?,?)',
      [b.name, b.email, await bcrypt.hash(b.password, 10), 'doctor', nn(b.phone), nn(b.avatar_url)]);
    const [d] = await conn.query(
      `INSERT INTO doctors (user_id, department_id, specialization, qualification, experience_years, consultation_fee, license_no, bio, available_days, status)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [u.insertId, b.department_id, b.specialization, nn(b.qualification), b.experience_years, b.consultation_fee, b.license_no, nn(b.bio), b.available_days, b.status]);
    return d.insertId;
  });
  await audit(req, { action: 'DOCTOR_CREATED', entity: 'doctor', entityId: id, description: `Created doctor account for ${b.name} (${b.specialization})` });
  res.status(201).json(await db.one(`${SELECT} WHERE d.id = ?`, [todayStr(), id]));
}));

router.put('/:id', authorize('admin'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const b = updateSchema.parse(req.body);
  const cur = await db.one('SELECT user_id FROM doctors WHERE id = ?', [id]);
  if (!cur) throw new AppError(404, 'Doctor not found');
  await db.transaction(async (conn) => {
    await conn.query('UPDATE users SET name=?, email=?, phone=?, avatar_url=COALESCE(?, avatar_url), is_active=? WHERE id=?',
      [b.name, b.email, nn(b.phone), nn(b.avatar_url), b.status === 'inactive' ? 0 : 1, cur.user_id]);
    if (b.password) await conn.query('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(b.password, 10), cur.user_id]);
    await conn.query(
      `UPDATE doctors SET department_id=?, specialization=?, qualification=?, experience_years=?, consultation_fee=?, license_no=?, bio=?, available_days=?, status=? WHERE id=?`,
      [b.department_id, b.specialization, nn(b.qualification), b.experience_years, b.consultation_fee, b.license_no, nn(b.bio), b.available_days, b.status, id]);
  });
  await audit(req, { action: 'DOCTOR_UPDATED', entity: 'doctor', entityId: id, description: `Updated doctor profile of ${b.name}${b.password ? ' (password reset)' : ''}`, severity: b.password ? 'warning' : 'info' });
  res.json(await db.one(`${SELECT} WHERE d.id = ?`, [todayStr(), id]));
}));

router.delete('/:id', authorize('admin'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const cur = await db.one('SELECT d.user_id, u.name FROM doctors d JOIN users u ON u.id = d.user_id WHERE d.id = ?', [id]);
  if (!cur) throw new AppError(404, 'Doctor not found');
  try {
    await db.query('DELETE FROM users WHERE id = ?', [cur.user_id]); // cascades to doctors row
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2') throw new AppError(409, `Dr. ${cur.name} has appointments, records or admissions on file. Set the status to "Inactive" instead of deleting.`);
    throw err;
  }
  await audit(req, { action: 'DOCTOR_DELETED', entity: 'doctor', entityId: id, description: `Deleted doctor ${cur.name}`, severity: 'critical' });
  res.json({ message: 'Doctor deleted' });
}));

module.exports = router;
