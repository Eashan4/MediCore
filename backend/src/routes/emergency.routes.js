const router = require('express').Router();
const { z } = require('zod');
const db = require('../config/db');
const { authorize } = require('../middleware/auth');
const { AppError, asyncHandler, nowStr, todayStr, paging, like, nn } = require('../utils/helpers');
const { audit } = require('../utils/audit');
const { allocateBed } = require('../services/admission.service');

const idNum = z.preprocess((v) => (v === '' || v == null ? undefined : Number(v)), z.number().int().positive());
const schema = z.object({
  patient_id: idNum.optional(),
  patient_name: z.string().trim().min(2, 'Patient name is required').max(160),
  age: z.preprocess((v) => (v === '' || v == null ? undefined : Number(v)), z.number().int().min(0).max(120).optional()),
  gender: z.enum(['male', 'female', 'other']).default('male'),
  phone: z.string().trim().max(30).nullish(),
  condition_desc: z.string().trim().min(5, 'Describe the condition').max(2000),
  urgency: z.enum(['critical', 'high', 'medium', 'low']),
  arrival_mode: z.enum(['ambulance', 'walk_in', 'referral']).default('walk_in'),
  assigned_doctor_id: idNum.optional(),
  notes: z.string().trim().max(500).nullish(),
});

const SELECT = `
  SELECT e.*, du.name AS doctor_name, du.avatar_url AS doctor_avatar, d.specialization,
         TIMESTAMPDIFF(MINUTE, e.created_at, COALESCE(e.resolved_at, NOW())) AS waiting_minutes
    FROM emergency_requests e
    LEFT JOIN doctors d ON d.id = e.assigned_doctor_id
    LEFT JOIN users du ON du.id = d.user_id`;

router.get('/', authorize('admin', 'receptionist', 'doctor'), asyncHandler(async (req, res) => {
  const { page, limit, offset } = paging(req.query, 30, 100);
  const where = []; const params = [];
  if (req.query.status === 'active') where.push("e.status IN ('pending','in_treatment')");
  else if (req.query.status) { where.push('e.status = ?'); params.push(req.query.status); }
  if (req.query.urgency) { where.push('e.urgency = ?'); params.push(req.query.urgency); }
  if (req.query.search) { const s = like(req.query.search.trim()); where.push('(e.patient_name LIKE ? OR e.request_code LIKE ? OR e.condition_desc LIKE ?)'); params.push(s, s, s); }
  const W = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [{ total }] = await db.query(`SELECT COUNT(*) AS total FROM emergency_requests e ${W}`, params);
  const data = await db.query(`${SELECT} ${W}
     ORDER BY (e.status IN ('pending','in_treatment')) DESC, FIELD(e.urgency,'critical','high','medium','low'), e.created_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  const [stats] = await db.query(
    `SELECT SUM(status IN ('pending','in_treatment')) AS active, SUM(status='pending') AS pending,
            SUM(status IN ('pending','in_treatment') AND urgency='critical') AS critical,
            SUM(DATE(created_at) = ?) AS today FROM emergency_requests`, [todayStr()]);
  res.json({ data, total, page, limit, pages: Math.ceil(total / limit), stats: { active: +stats.active || 0, pending: +stats.pending || 0, critical: +stats.critical || 0, today: +stats.today || 0 } });
}));

router.post('/', authorize('admin', 'receptionist'), asyncHandler(async (req, res) => {
  const b = schema.parse(req.body);
  const id = await db.transaction(async (conn) => {
    const [r] = await conn.query(
      `INSERT INTO emergency_requests (request_code, patient_id, patient_name, age, gender, phone, condition_desc, urgency, status, arrival_mode, assigned_doctor_id, notes, created_by, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [`TMP-${Date.now()}`, b.patient_id || null, b.patient_name, b.age ?? null, b.gender, nn(b.phone), b.condition_desc, b.urgency,
        b.assigned_doctor_id ? 'in_treatment' : 'pending', b.arrival_mode, b.assigned_doctor_id || null, nn(b.notes), req.user.id, nowStr()]);
    await conn.query('UPDATE emergency_requests SET request_code = ? WHERE id = ?', [`EMR-${1000 + r.insertId}`, r.insertId]);
    return r.insertId;
  });
  const row = await db.one(`${SELECT} WHERE e.id = ?`, [id]);
  await audit(req, { action: 'EMERGENCY_CREATED', entity: 'emergency', entityId: id, description: `${row.urgency.toUpperCase()} emergency ${row.request_code}: ${row.patient_name}`, severity: row.urgency === 'critical' ? 'warning' : 'info' });
  res.status(201).json(row);
}));

router.put('/:id', authorize('admin', 'receptionist'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const b = schema.parse(req.body);
  const r = await db.pool.query(
    `UPDATE emergency_requests SET patient_name=?, age=?, gender=?, phone=?, condition_desc=?, urgency=?, arrival_mode=?, assigned_doctor_id=?, notes=? WHERE id=?`,
    [b.patient_name, b.age ?? null, b.gender, nn(b.phone), b.condition_desc, b.urgency, b.arrival_mode, b.assigned_doctor_id || null, nn(b.notes), id]);
  if (!r[0].affectedRows) throw new AppError(404, 'Emergency request not found');
  await audit(req, { action: 'EMERGENCY_UPDATED', entity: 'emergency', entityId: id, description: `Updated emergency request #${id}` });
  res.json(await db.one(`${SELECT} WHERE e.id = ?`, [id]));
}));

router.patch('/:id/status', authorize('admin', 'receptionist', 'doctor'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const b = z.object({ status: z.enum(['pending', 'in_treatment', 'resolved', 'cancelled']), assigned_doctor_id: idNum.optional() }).parse(req.body);
  const cur = await db.one('SELECT id, status, assigned_doctor_id FROM emergency_requests WHERE id = ?', [id]);
  if (!cur) throw new AppError(404, 'Emergency request not found');
  if (req.user.role === 'doctor' && cur.assigned_doctor_id && cur.assigned_doctor_id !== req.user.doctor_id) throw new AppError(403, 'This case is assigned to another doctor');
  if (cur.status === 'admitted') throw new AppError(409, 'Admitted cases are managed from the Admissions screen');
  let doctorId = b.assigned_doctor_id || cur.assigned_doctor_id;
  if (req.user.role === 'doctor' && b.status === 'in_treatment' && !doctorId) doctorId = req.user.doctor_id; // doctor takes the case
  const done = ['resolved', 'cancelled'].includes(b.status);
  await db.query('UPDATE emergency_requests SET status = ?, assigned_doctor_id = ?, resolved_at = ? WHERE id = ?', [b.status, doctorId || null, done ? nowStr() : null, id]);
  await audit(req, { action: 'EMERGENCY_STATUS', entity: 'emergency', entityId: id, description: `Emergency #${id}: ${cur.status} -> ${b.status}` });
  res.json(await db.one(`${SELECT} WHERE e.id = ?`, [id]));
}));

// Admit an emergency patient straight into a bed (registers the patient if needed)
router.post('/:id/admit', authorize('admin', 'receptionist'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const b = z.object({ bed_id: idNum, doctor_id: idNum.optional() }).parse(req.body);
  const out = await db.transaction(async (conn) => {
    const [[e]] = await conn.query('SELECT * FROM emergency_requests WHERE id = ? FOR UPDATE', [id]);
    if (!e) throw new AppError(404, 'Emergency request not found');
    if (!['pending', 'in_treatment'].includes(e.status)) throw new AppError(409, `This request is already ${e.status}`);
    let patientId = e.patient_id;
    if (!patientId) {
      const parts = e.patient_name.trim().split(/\s+/);
      const first = parts.shift(); const last = parts.join(' ') || 'Unknown';
      const dob = `${new Date().getFullYear() - (e.age ?? 30)}-01-01`;
      const [p] = await conn.query(
        'INSERT INTO patients (patient_code, first_name, last_name, dob, gender, phone, created_by) VALUES (?,?,?,?,?,?,?)',
        [`TMP-${Date.now()}`, first, last, dob, e.gender, e.phone, req.user.id]);
      patientId = p.insertId;
      await conn.query('UPDATE patients SET patient_code = ? WHERE id = ?', [`MC-${new Date().getFullYear()}-${String(patientId).padStart(5, '0')}`, patientId]);
    }
    const docId = b.doctor_id || e.assigned_doctor_id || null;
    const alloc = await allocateBed(conn, { bedId: b.bed_id, patientId, doctorId: docId, reason: `Emergency: ${e.condition_desc.slice(0, 200)}`, userId: req.user.id });
    await conn.query("UPDATE emergency_requests SET status = 'admitted', patient_id = ?, assigned_doctor_id = ?, resolved_at = ? WHERE id = ?", [patientId, docId, nowStr(), id]);
    return { alloc, patientId };
  });
  await audit(req, { action: 'EMERGENCY_ADMITTED', entity: 'emergency', entityId: id, description: `Admitted ${out.alloc.patient.first_name} ${out.alloc.patient.last_name} to bed ${out.alloc.bed.bed_number} from emergency` });
  res.json({ message: `Admitted to ${out.alloc.bed.ward_name} bed ${out.alloc.bed.bed_number}`, patient_id: out.patientId, request: await db.one(`${SELECT} WHERE e.id = ?`, [id]) });
}));

router.delete('/:id', authorize('admin'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const r = await db.pool.query('DELETE FROM emergency_requests WHERE id = ?', [id]);
  if (!r[0].affectedRows) throw new AppError(404, 'Emergency request not found');
  await audit(req, { action: 'EMERGENCY_DELETED', entity: 'emergency', entityId: id, description: `Deleted emergency request #${id}`, severity: 'warning' });
  res.json({ message: 'Emergency request deleted' });
}));

module.exports = router;
