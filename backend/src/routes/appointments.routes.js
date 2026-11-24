const router = require('express').Router();
const { z } = require('zod');
const db = require('../config/db');
const { authorize } = require('../middleware/auth');
const { AppError, asyncHandler, nowStr, paging, like, nn, todayStr, addDays } = require('../utils/helpers');
const { audit } = require('../utils/audit');

const idNum = z.preprocess((v) => (v === '' || v == null ? undefined : Number(v)), z.number().int().positive());
const apptSchema = z.object({
  patient_id: idNum,
  doctor_id: idNum,
  scheduled_at: z.string().regex(/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$/, 'Pick a date and time'),
  duration_min: z.preprocess((v) => Number(v || 30), z.number().int().min(10).max(240)).default(30),
  type: z.enum(['consultation', 'follow_up', 'checkup', 'procedure', 'emergency']).default('consultation'),
  reason: z.string().trim().max(255).nullish(),
  notes: z.string().trim().max(1000).nullish(),
});

const SELECT = `
  SELECT ap.id, ap.patient_id, ap.doctor_id, ap.scheduled_at, ap.duration_min, ap.type, ap.status, ap.reason, ap.notes, ap.created_at,
         p.first_name, p.last_name, p.patient_code, p.photo_url AS patient_photo, p.gender, TIMESTAMPDIFF(YEAR, p.dob, CURDATE()) AS age, p.phone,
         du.name AS doctor_name, du.avatar_url AS doctor_avatar, d.specialization, dep.name AS department
    FROM appointments ap
    JOIN patients p ON p.id = ap.patient_id
    JOIN doctors d ON d.id = ap.doctor_id
    JOIN users du ON du.id = d.user_id
    LEFT JOIN departments dep ON dep.id = d.department_id`;

const norm = (s) => { const t = s.replace('T', ' '); return t.length === 16 ? `${t}:00` : t; };

async function assertSlotFree({ doctorId, patientId, start, duration, ignoreId = 0 }) {
  const end = new Date(new Date(start.replace(' ', 'T')).getTime() + duration * 60000);
  const endStr = nowStr(end);
  const doc = await db.one('SELECT status FROM doctors WHERE id = ?', [doctorId]);
  if (!doc) throw new AppError(422, 'Selected doctor does not exist');
  if (doc.status !== 'active') throw new AppError(409, 'This doctor is currently unavailable (on leave / inactive)', { doctor_id: 'Doctor unavailable' });
  const overlapSql = `SELECT ap.id FROM appointments ap WHERE ap.status IN ('scheduled','checked_in') AND ap.id <> ?
     AND ap.scheduled_at < ? AND DATE_ADD(ap.scheduled_at, INTERVAL ap.duration_min MINUTE) > ?`;
  const clash = await db.one(`${overlapSql} AND ap.doctor_id = ?`, [ignoreId, endStr, start, doctorId]);
  if (clash) throw new AppError(409, 'That time slot is already booked for this doctor. Please choose another time.', { scheduled_at: 'Slot already booked' });
  const pclash = await db.one(`${overlapSql} AND ap.patient_id = ?`, [ignoreId, endStr, start, patientId]);
  if (pclash) throw new AppError(409, 'This patient already has an appointment at that time', { patient_id: 'Patient is busy at that time' });
}

router.get('/', authorize('admin', 'receptionist', 'doctor'), asyncHandler(async (req, res) => {
  const { page, limit, offset } = paging(req.query, 15, 200);
  const where = []; const params = [];
  if (req.user.role === 'doctor') { where.push('ap.doctor_id = ?'); params.push(req.user.doctor_id); }
  else if (req.query.doctor_id) { where.push('ap.doctor_id = ?'); params.push(Number(req.query.doctor_id)); }
  if (req.query.patient_id) { where.push('ap.patient_id = ?'); params.push(Number(req.query.patient_id)); }
  if (req.query.status) { where.push('ap.status = ?'); params.push(req.query.status); }
  if (req.query.date) { where.push('DATE(ap.scheduled_at) = ?'); params.push(req.query.date); }
  if (req.query.range === 'upcoming') { where.push('ap.scheduled_at >= ?'); params.push(nowStr()); }
  if (req.query.range === 'week') { where.push('DATE(ap.scheduled_at) BETWEEN ? AND ?'); params.push(todayStr(), todayStr(addDays(6))); }
  if (req.query.from) { where.push('DATE(ap.scheduled_at) >= ?'); params.push(req.query.from); }
  if (req.query.to) { where.push('DATE(ap.scheduled_at) <= ?'); params.push(req.query.to); }
  if (req.query.search) {
    const s = like(req.query.search.trim());
    where.push("(CONCAT(p.first_name,' ',p.last_name) LIKE ? OR p.patient_code LIKE ? OR du.name LIKE ?)");
    params.push(s, s, s);
  }
  const W = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const dir = req.query.order === 'desc' ? 'DESC' : 'ASC';
  const [{ total }] = await db.query(`SELECT COUNT(*) AS total FROM appointments ap JOIN patients p ON p.id = ap.patient_id JOIN doctors d ON d.id = ap.doctor_id JOIN users du ON du.id = d.user_id ${W}`, params);
  const data = await db.query(`${SELECT} ${W} ORDER BY ap.scheduled_at ${dir} LIMIT ? OFFSET ?`, [...params, limit, offset]);
  res.json({ data, total, page, limit, pages: Math.ceil(total / limit) });
}));

router.post('/', authorize('admin', 'receptionist'), asyncHandler(async (req, res) => {
  const b = apptSchema.parse(req.body);
  const start = norm(b.scheduled_at);
  if (new Date(start.replace(' ', 'T')) < new Date(Date.now() - 15 * 60000)) throw new AppError(422, 'Appointments cannot be scheduled in the past', { scheduled_at: 'Choose a future time' });
  const patient = await db.one('SELECT id FROM patients WHERE id = ?', [b.patient_id]);
  if (!patient) throw new AppError(422, 'Patient not found', { patient_id: 'Select a patient' });
  await assertSlotFree({ doctorId: b.doctor_id, patientId: b.patient_id, start, duration: b.duration_min });
  const [r] = await db.pool.query(
    'INSERT INTO appointments (patient_id, doctor_id, scheduled_at, duration_min, type, reason, notes, created_by) VALUES (?,?,?,?,?,?,?,?)',
    [b.patient_id, b.doctor_id, start, b.duration_min, b.type, nn(b.reason), nn(b.notes), req.user.id]);
  const row = await db.one(`${SELECT} WHERE ap.id = ?`, [r.insertId]);
  await audit(req, { action: 'APPOINTMENT_CREATED', entity: 'appointment', entityId: r.insertId, description: `Scheduled ${row.first_name} ${row.last_name} with Dr. ${row.doctor_name} on ${start.slice(0, 16)}` });
  res.status(201).json(row);
}));

router.put('/:id', authorize('admin', 'receptionist'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const b = apptSchema.parse(req.body);
  const cur = await db.one('SELECT id, status FROM appointments WHERE id = ?', [id]);
  if (!cur) throw new AppError(404, 'Appointment not found');
  if (['completed', 'cancelled'].includes(cur.status)) throw new AppError(409, `A ${cur.status} appointment cannot be edited`);
  const start = norm(b.scheduled_at);
  await assertSlotFree({ doctorId: b.doctor_id, patientId: b.patient_id, start, duration: b.duration_min, ignoreId: id });
  await db.query('UPDATE appointments SET patient_id=?, doctor_id=?, scheduled_at=?, duration_min=?, type=?, reason=?, notes=? WHERE id=?',
    [b.patient_id, b.doctor_id, start, b.duration_min, b.type, nn(b.reason), nn(b.notes), id]);
  const row = await db.one(`${SELECT} WHERE ap.id = ?`, [id]);
  await audit(req, { action: 'APPOINTMENT_UPDATED', entity: 'appointment', entityId: id, description: `Rescheduled appointment #${id} to ${start.slice(0, 16)}` });
  res.json(row);
}));

router.patch('/:id/status', authorize('admin', 'receptionist', 'doctor'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { status } = z.object({ status: z.enum(['scheduled', 'checked_in', 'completed', 'cancelled', 'no_show']) }).parse(req.body);
  const cur = await db.one('SELECT id, doctor_id, status FROM appointments WHERE id = ?', [id]);
  if (!cur) throw new AppError(404, 'Appointment not found');
  if (req.user.role === 'doctor') {
    if (cur.doctor_id !== req.user.doctor_id) throw new AppError(403, 'This appointment belongs to another doctor');
    if (!['checked_in', 'completed', 'no_show'].includes(status)) throw new AppError(403, 'Doctors can only start, complete or mark no-show');
  }
  await db.query('UPDATE appointments SET status = ? WHERE id = ?', [status, id]);
  await audit(req, { action: 'APPOINTMENT_STATUS', entity: 'appointment', entityId: id, description: `Appointment #${id} changed ${cur.status} -> ${status}` });
  res.json(await db.one(`${SELECT} WHERE ap.id = ?`, [id]));
}));

router.delete('/:id', authorize('admin'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const r = await db.pool.query('DELETE FROM appointments WHERE id = ?', [id]);
  if (!r[0].affectedRows) throw new AppError(404, 'Appointment not found');
  await audit(req, { action: 'APPOINTMENT_DELETED', entity: 'appointment', entityId: id, description: `Deleted appointment #${id}`, severity: 'warning' });
  res.json({ message: 'Appointment deleted' });
}));

module.exports = router;
