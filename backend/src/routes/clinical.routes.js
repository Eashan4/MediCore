const router = require('express').Router();
const db = require('../config/db');
const { authorize } = require('../middleware/auth');
const { asyncHandler, paging, like } = require('../utils/helpers');

router.use(authorize('admin', 'doctor'));

// Diagnoses / medical records (doctors only see their own)
router.get('/records', asyncHandler(async (req, res) => {
  const { page, limit, offset } = paging(req.query, 12, 50);
  const where = []; const params = [];
  if (req.user.role === 'doctor') { where.push('r.doctor_id = ?'); params.push(req.user.doctor_id); }
  if (req.query.search) {
    const s = like(req.query.search.trim());
    where.push("(CONCAT(p.first_name,' ',p.last_name) LIKE ? OR p.patient_code LIKE ? OR r.diagnosis LIKE ?)");
    params.push(s, s, s);
  }
  const W = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [{ total }] = await db.query(`SELECT COUNT(*) AS total FROM medical_records r JOIN patients p ON p.id = r.patient_id ${W}`, params);
  const data = await db.query(
    `SELECT r.id, r.patient_id, r.visit_date, r.visit_type, r.chief_complaint, r.diagnosis, r.treatment, r.bp_systolic, r.bp_diastolic, r.heart_rate, r.temperature, r.spo2,
            p.first_name, p.last_name, p.patient_code, p.photo_url, du.name AS doctor_name
       FROM medical_records r JOIN patients p ON p.id = r.patient_id JOIN doctors d ON d.id = r.doctor_id JOIN users du ON du.id = d.user_id
       ${W} ORDER BY r.visit_date DESC, r.id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  res.json({ data, total, page, limit, pages: Math.ceil(total / limit) });
}));

router.get('/prescriptions', asyncHandler(async (req, res) => {
  const { page, limit, offset } = paging(req.query, 10, 50);
  const where = []; const params = [];
  if (req.user.role === 'doctor') { where.push('rx.doctor_id = ?'); params.push(req.user.doctor_id); }
  if (['active', 'completed'].includes(req.query.status)) { where.push('rx.status = ?'); params.push(req.query.status); }
  if (req.query.search) {
    const s = like(req.query.search.trim());
    where.push("(CONCAT(p.first_name,' ',p.last_name) LIKE ? OR p.patient_code LIKE ? OR EXISTS (SELECT 1 FROM prescription_items i WHERE i.prescription_id = rx.id AND i.medicine_name LIKE ?))");
    params.push(s, s, s);
  }
  const W = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [{ total }] = await db.query(`SELECT COUNT(*) AS total FROM prescriptions rx JOIN patients p ON p.id = rx.patient_id ${W}`, params);
  const data = await db.query(
    `SELECT rx.id, rx.patient_id, rx.created_at, rx.status, rx.notes, p.first_name, p.last_name, p.patient_code, p.photo_url, du.name AS doctor_name
       FROM prescriptions rx JOIN patients p ON p.id = rx.patient_id JOIN doctors d ON d.id = rx.doctor_id JOIN users du ON du.id = d.user_id
       ${W} ORDER BY rx.created_at DESC, rx.id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  if (data.length) {
    const items = await db.query('SELECT * FROM prescription_items WHERE prescription_id IN (?) ORDER BY id', [data.map((r) => r.id)]);
    data.forEach((rx) => { rx.items = items.filter((i) => i.prescription_id === rx.id); });
  }
  res.json({ data, total, page, limit, pages: Math.ceil(total / limit) });
}));

module.exports = router;
