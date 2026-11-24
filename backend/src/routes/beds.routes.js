const router = require('express').Router();
const { z } = require('zod');
const db = require('../config/db');
const { authorize } = require('../middleware/auth');
const { AppError, asyncHandler, nn } = require('../utils/helpers');
const { audit } = require('../utils/audit');
const { allocateBed, dischargePatient } = require('../services/admission.service');

const idNum = z.preprocess((v) => (v === '' || v == null ? undefined : Number(v)), z.number().int().positive());
const bedSchema = z.object({
  ward_id: idNum,
  bed_number: z.string().trim().min(1, 'Bed number is required').max(20),
  bed_type: z.enum(['standard', 'icu', 'private', 'isolation']).default('standard'),
  daily_rate: z.preprocess((v) => Number(v || 0), z.number().min(0).max(100000)).default(0),
});

const BED_SELECT = `
  SELECT b.id, b.ward_id, b.bed_number, b.bed_type, b.status, b.daily_rate, b.notes, w.name AS ward_name,
         a.id AS admission_id, a.admitted_at, a.reason AS admission_reason,
         p.id AS patient_id, p.first_name, p.last_name, p.patient_code, p.photo_url, p.gender, p.blood_group,
         TIMESTAMPDIFF(YEAR, p.dob, CURDATE()) AS age, p.allergies,
         d.id AS doctor_id, du.name AS doctor_name,
         (SELECT r.diagnosis FROM medical_records r WHERE r.patient_id = p.id ORDER BY r.visit_date DESC, r.id DESC LIMIT 1) AS diagnosis
    FROM beds b
    JOIN wards w ON w.id = b.ward_id
    LEFT JOIN admissions a ON a.bed_id = b.id AND a.status = 'admitted'
    LEFT JOIN patients p ON p.id = a.patient_id
    LEFT JOIN doctors d ON d.id = a.doctor_id
    LEFT JOIN users du ON du.id = d.user_id`;

const summarize = (beds) => {
  const c = { total: beds.length, available: 0, occupied: 0, maintenance: 0 };
  beds.forEach((b) => { c[b.status] += 1; });
  c.occupancy = c.total ? Math.round(((c.occupied) / c.total) * 100) : 0;
  return c;
};

// All wards with their beds + occupant details
router.get('/', authorize('admin', 'receptionist', 'doctor'), asyncHandler(async (req, res) => {
  const [wards, beds] = await Promise.all([db.query('SELECT * FROM wards ORDER BY id'), db.query(`${BED_SELECT} ORDER BY b.ward_id, b.id`)]);
  const result = wards.map((w) => {
    const wb = beds.filter((b) => b.ward_id === w.id);
    return { ...w, counts: summarize(wb), beds: wb };
  });
  res.json({ summary: summarize(beds), wards: result, updated_at: new Date().toISOString() });
}));

router.get('/wards', authorize('admin', 'receptionist', 'doctor'), asyncHandler(async (_req, res) => {
  res.json(await db.query('SELECT id, name, type, floor FROM wards ORDER BY id'));
}));

router.get('/available', authorize('admin', 'receptionist', 'doctor'), asyncHandler(async (_req, res) => {
  res.json(await db.query(
    `SELECT b.id, b.bed_number, b.bed_type, b.daily_rate, w.id AS ward_id, w.name AS ward_name
       FROM beds b JOIN wards w ON w.id = b.ward_id WHERE b.status = 'available' ORDER BY w.id, b.id`));
}));

// Admin: bed CRUD
router.post('/', authorize('admin'), asyncHandler(async (req, res) => {
  const b = bedSchema.parse(req.body);
  const [r] = await db.pool.query('INSERT INTO beds (ward_id, bed_number, bed_type, daily_rate) VALUES (?,?,?,?)', [b.ward_id, b.bed_number, b.bed_type, b.daily_rate]);
  await audit(req, { action: 'BED_CREATED', entity: 'bed', entityId: r.insertId, description: `Added bed ${b.bed_number}` });
  res.status(201).json(await db.one(`${BED_SELECT} WHERE b.id = ?`, [r.insertId]));
}));

router.put('/:id', authorize('admin'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const b = bedSchema.parse(req.body);
  const res0 = await db.pool.query('UPDATE beds SET ward_id=?, bed_number=?, bed_type=?, daily_rate=? WHERE id=?', [b.ward_id, b.bed_number, b.bed_type, b.daily_rate, id]);
  if (!res0[0].affectedRows) throw new AppError(404, 'Bed not found');
  await audit(req, { action: 'BED_UPDATED', entity: 'bed', entityId: id, description: `Updated bed ${b.bed_number}` });
  res.json(await db.one(`${BED_SELECT} WHERE b.id = ?`, [id]));
}));

router.delete('/:id', authorize('admin'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const bed = await db.one('SELECT bed_number, status FROM beds WHERE id = ?', [id]);
  if (!bed) throw new AppError(404, 'Bed not found');
  if (bed.status === 'occupied') throw new AppError(409, 'Cannot delete an occupied bed');
  await db.query('DELETE FROM beds WHERE id = ?', [id]);
  await audit(req, { action: 'BED_DELETED', entity: 'bed', entityId: id, description: `Deleted bed ${bed.bed_number}`, severity: 'warning' });
  res.json({ message: 'Bed deleted' });
}));

// Maintenance toggle (available <-> maintenance)
router.patch('/:id/status', authorize('admin', 'receptionist'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const b = z.object({ status: z.enum(['available', 'maintenance']), notes: z.string().trim().max(255).nullish() }).parse(req.body);
  await db.transaction(async (conn) => {
    const [[bed]] = await conn.query('SELECT id, bed_number, status FROM beds WHERE id = ? FOR UPDATE', [id]);
    if (!bed) throw new AppError(404, 'Bed not found');
    if (bed.status === 'occupied') throw new AppError(409, `Bed ${bed.bed_number} is occupied. Discharge the patient first.`);
    await conn.query('UPDATE beds SET status = ?, notes = ? WHERE id = ?', [b.status, b.status === 'maintenance' ? nn(b.notes) || 'Under maintenance' : null, id]);
  });
  const bed = await db.one(`${BED_SELECT} WHERE b.id = ?`, [id]);
  await audit(req, { action: b.status === 'maintenance' ? 'BED_MAINTENANCE' : 'BED_RELEASED', entity: 'bed', entityId: id,
    description: `Bed ${bed.bed_number} (${bed.ward_name}) marked ${b.status}` });
  res.json(bed);
}));

// Allocate a bed to a patient
router.post('/:id/allocate', authorize('admin', 'receptionist'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const b = z.object({ patient_id: idNum, doctor_id: idNum.optional(), reason: z.string().trim().max(255).nullish() }).parse(req.body);
  const out = await db.transaction((conn) => allocateBed(conn, { bedId: id, patientId: b.patient_id, doctorId: b.doctor_id, reason: b.reason, userId: req.user.id }));
  await audit(req, { action: 'BED_ALLOCATED', entity: 'bed', entityId: id,
    description: `Allocated ${out.bed.ward_name} bed ${out.bed.bed_number} to ${out.patient.first_name} ${out.patient.last_name} (${out.patient.patient_code})` });
  res.status(201).json({ message: `Bed ${out.bed.bed_number} allocated to ${out.patient.first_name} ${out.patient.last_name}`, bed: await db.one(`${BED_SELECT} WHERE b.id = ?`, [id]) });
}));

// Discharge whoever is in this bed
router.post('/:id/discharge', authorize('admin', 'receptionist'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const b = z.object({ notes: z.string().trim().max(1000).nullish(), send_to_cleaning: z.boolean().optional() }).parse(req.body || {});
  const out = await db.transaction((conn) => dischargePatient(conn, { bedId: id, notes: b.notes, userId: req.user.id, sendToCleaning: b.send_to_cleaning }));
  await audit(req, { action: 'BED_DISCHARGED', entity: 'bed', entityId: id,
    description: `Discharged ${out.info.first_name} ${out.info.last_name} (${out.info.patient_code}) from bed ${out.info.bed_number}` });
  res.json({ message: `${out.info.first_name} ${out.info.last_name} discharged from ${out.info.bed_number}`, bed: await db.one(`${BED_SELECT} WHERE b.id = ?`, [id]) });
}));

module.exports = router;
