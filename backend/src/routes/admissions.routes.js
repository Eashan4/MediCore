const router = require('express').Router();
const { z } = require('zod');
const db = require('../config/db');
const { authorize } = require('../middleware/auth');
const { AppError, asyncHandler, paging, like } = require('../utils/helpers');
const { audit } = require('../utils/audit');
const { allocateBed, dischargePatient } = require('../services/admission.service');

const idNum = z.preprocess((v) => (v === '' || v == null ? undefined : Number(v)), z.number().int().positive());

const SELECT = `
  SELECT a.id, a.patient_id, a.bed_id, a.doctor_id, a.admitted_at, a.discharged_at, a.reason, a.status, a.discharge_notes,
         p.first_name, p.last_name, p.patient_code, p.photo_url, p.gender, TIMESTAMPDIFF(YEAR, p.dob, CURDATE()) AS age,
         b.bed_number, b.bed_type, b.daily_rate, w.name AS ward_name, du.name AS doctor_name, du.avatar_url AS doctor_avatar,
         ab.name AS admitted_by_name,
         GREATEST(1, DATEDIFF(COALESCE(a.discharged_at, NOW()), a.admitted_at) + 1) AS days
    FROM admissions a
    JOIN patients p ON p.id = a.patient_id
    JOIN beds b ON b.id = a.bed_id
    JOIN wards w ON w.id = b.ward_id
    LEFT JOIN doctors d ON d.id = a.doctor_id
    LEFT JOIN users du ON du.id = d.user_id
    LEFT JOIN users ab ON ab.id = a.admitted_by`;

router.get('/', authorize('admin', 'receptionist', 'doctor'), asyncHandler(async (req, res) => {
  const { page, limit, offset } = paging(req.query, 15, 100);
  const where = []; const params = [];
  if (req.user.role === 'doctor') { where.push('a.doctor_id = ?'); params.push(req.user.doctor_id); }
  if (['admitted', 'discharged'].includes(req.query.status)) { where.push('a.status = ?'); params.push(req.query.status); }
  if (req.query.ward_id) { where.push('b.ward_id = ?'); params.push(Number(req.query.ward_id)); }
  if (req.query.search) {
    const s = like(req.query.search.trim());
    where.push("(CONCAT(p.first_name,' ',p.last_name) LIKE ? OR p.patient_code LIKE ? OR b.bed_number LIKE ?)");
    params.push(s, s, s);
  }
  const W = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [{ total }] = await db.query(`SELECT COUNT(*) AS total FROM admissions a JOIN patients p ON p.id = a.patient_id JOIN beds b ON b.id = a.bed_id ${W}`, params);
  const data = await db.query(`${SELECT} ${W} ORDER BY (a.status = 'admitted') DESC, COALESCE(a.discharged_at, a.admitted_at) DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  const [stats] = await db.query(
    `SELECT SUM(status='admitted') AS current, SUM(status='admitted' AND DATE(admitted_at) = CURDATE()) AS today,
            SUM(status='discharged' AND DATE(discharged_at) = CURDATE()) AS discharged_today FROM admissions`);
  res.json({ data, total, page, limit, pages: Math.ceil(total / limit), stats: { current: Number(stats.current || 0), today: Number(stats.today || 0), discharged_today: Number(stats.discharged_today || 0) } });
}));

router.post('/', authorize('admin', 'receptionist'), asyncHandler(async (req, res) => {
  const b = z.object({ patient_id: idNum, bed_id: idNum, doctor_id: idNum.optional(), reason: z.string().trim().min(2, 'Reason for admission is required').max(255) }).parse(req.body);
  const out = await db.transaction((conn) => allocateBed(conn, { bedId: b.bed_id, patientId: b.patient_id, doctorId: b.doctor_id, reason: b.reason, userId: req.user.id }));
  await audit(req, { action: 'PATIENT_ADMITTED', entity: 'admission', entityId: out.admissionId,
    description: `Admitted ${out.patient.first_name} ${out.patient.last_name} (${out.patient.patient_code}) to ${out.bed.ward_name} ${out.bed.bed_number}` });
  res.status(201).json(await db.one(`${SELECT} WHERE a.id = ?`, [out.admissionId]));
}));

router.post('/:id/discharge', authorize('admin', 'receptionist'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const b = z.object({ notes: z.string().trim().max(1000).nullish(), send_to_cleaning: z.boolean().optional() }).parse(req.body || {});
  const exists = await db.one('SELECT id FROM admissions WHERE id = ?', [id]);
  if (!exists) throw new AppError(404, 'Admission not found');
  const out = await db.transaction((conn) => dischargePatient(conn, { admissionId: id, notes: b.notes, userId: req.user.id, sendToCleaning: b.send_to_cleaning }));
  await audit(req, { action: 'PATIENT_DISCHARGED', entity: 'admission', entityId: id,
    description: `Discharged ${out.info.first_name} ${out.info.last_name} (${out.info.patient_code}) from bed ${out.info.bed_number}` });
  res.json(await db.one(`${SELECT} WHERE a.id = ?`, [id]));
}));

module.exports = router;
