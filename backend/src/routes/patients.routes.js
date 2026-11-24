const router = require('express').Router();
const { z } = require('zod');
const db = require('../config/db');
const { authorize } = require('../middleware/auth');
const { AppError, asyncHandler, nowStr, todayStr, paging, like, nn } = require('../utils/helpers');
const { audit } = require('../utils/audit');

const BLOOD = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const opt = (max) => z.string().trim().max(max).nullish();
const numOpt = (min, max, label) =>
  z.preprocess((v) => (v === '' || v == null ? undefined : Number(v)), z.number({ invalid_type_error: `${label} must be a number` }).min(min, `${label} too low`).max(max, `${label} too high`).optional());

const patientSchema = z.object({
  first_name: z.string().trim().min(1, 'First name is required').max(80),
  last_name: z.string().trim().min(1, 'Last name is required').max(80),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Select a valid date of birth').refine((d) => d <= todayStr(), 'Date of birth cannot be in the future'),
  gender: z.enum(['male', 'female', 'other'], { errorMap: () => ({ message: 'Select a gender' }) }),
  blood_group: z.enum(BLOOD).or(z.literal('')).nullish(),
  phone: z.string().trim().min(7, 'Enter a valid phone number').max(30),
  email: z.string().trim().email('Enter a valid email').or(z.literal('')).nullish(),
  address: opt(255),
  city: opt(80),
  emergency_contact_name: opt(120),
  emergency_contact_phone: opt(30),
  allergies: opt(500),
  chronic_conditions: opt(500),
  insurance_provider: opt(120),
  insurance_no: opt(60),
  photo_url: opt(500),
  assigned_doctor_id: z.preprocess((v) => (v === '' || v == null ? null : Number(v)), z.number().int().positive().nullable()).optional(),
});

const recordSchema = z.object({
  doctor_id: z.preprocess((v) => (v === '' || v == null ? undefined : Number(v)), z.number().int().positive().optional()),
  appointment_id: z.preprocess((v) => (v === '' || v == null ? undefined : Number(v)), z.number().int().positive().optional()),
  visit_type: z.string().trim().max(40).default('Outpatient'),
  chief_complaint: opt(255),
  diagnosis: z.string().trim().min(2, 'Diagnosis is required').max(255),
  treatment: opt(2000),
  notes: opt(2000),
  bp_systolic: numOpt(50, 260, 'Systolic'),
  bp_diastolic: numOpt(30, 160, 'Diastolic'),
  heart_rate: numOpt(20, 250, 'Heart rate'),
  temperature: numOpt(30, 45, 'Temperature'),
  spo2: numOpt(50, 100, 'SpO2'),
  weight_kg: numOpt(1, 400, 'Weight'),
  follow_up_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).nullish(),
});

const rxSchema = z.object({
  record_id: z.preprocess((v) => (v === '' || v == null ? undefined : Number(v)), z.number().int().positive().optional()),
  doctor_id: z.preprocess((v) => (v === '' || v == null ? undefined : Number(v)), z.number().int().positive().optional()),
  notes: opt(500),
  items: z.array(z.object({
    medicine_id: z.preprocess((v) => (v === '' || v == null ? undefined : Number(v)), z.number().int().positive().optional()),
    medicine_name: z.string().trim().min(1, 'Medicine name is required').max(120),
    dosage: z.string().trim().min(1, 'Dosage is required').max(60),
    frequency: z.string().trim().min(1, 'Frequency is required').max(60),
    duration_days: z.preprocess((v) => Number(v), z.number().int().min(1, 'At least 1 day').max(365)),
    instructions: opt(255),
  })).min(1, 'Add at least one medicine'),
});

// SQL snippet: patients a doctor is allowed to see
const DOCTOR_SCOPE = `(p.assigned_doctor_id = ? OR EXISTS (SELECT 1 FROM appointments x WHERE x.patient_id = p.id AND x.doctor_id = ?)
  OR EXISTS (SELECT 1 FROM medical_records r WHERE r.patient_id = p.id AND r.doctor_id = ?)
  OR EXISTS (SELECT 1 FROM admissions ad WHERE ad.patient_id = p.id AND ad.doctor_id = ? AND ad.status = 'admitted'))`;

async function assertPatientAccess(req, patientId) {
  const p = await db.one('SELECT id FROM patients p WHERE p.id = ?', [patientId]);
  if (!p) throw new AppError(404, 'Patient not found');
  if (req.user.role === 'doctor') {
    const d = req.user.doctor_id;
    const ok = await db.one(`SELECT p.id FROM patients p WHERE p.id = ? AND ${DOCTOR_SCOPE}`, [patientId, d, d, d, d]);
    if (!ok) {
      await audit(req, { action: 'ACCESS_DENIED', entity: 'patient', entityId: patientId, description: 'Doctor attempted to open a patient outside their care list', severity: 'warning' });
      throw new AppError(403, 'This patient is not assigned to you');
    }
  }
}

const LIST_SELECT = `
  SELECT p.id, p.patient_code, p.first_name, p.last_name, p.dob, p.gender, p.blood_group, p.phone, p.email, p.city, p.photo_url,
         p.allergies, p.chronic_conditions, p.created_at, p.assigned_doctor_id,
         TIMESTAMPDIFF(YEAR, p.dob, CURDATE()) AS age,
         du.name AS doctor_name, du.avatar_url AS doctor_avatar,
         a.id AS admission_id, a.admitted_at, b.bed_number, w.name AS ward_name,
         (SELECT MAX(r.visit_date) FROM medical_records r WHERE r.patient_id = p.id) AS last_visit,
         (SELECT r.diagnosis FROM medical_records r WHERE r.patient_id = p.id ORDER BY r.visit_date DESC, r.id DESC LIMIT 1) AS last_diagnosis
    FROM patients p
    LEFT JOIN doctors d ON d.id = p.assigned_doctor_id
    LEFT JOIN users du ON du.id = d.user_id
    LEFT JOIN admissions a ON a.patient_id = p.id AND a.status = 'admitted'
    LEFT JOIN beds b ON b.id = a.bed_id
    LEFT JOIN wards w ON w.id = b.ward_id`;

// ------------------------------------------------------------------ list / search
router.get('/', authorize('admin', 'receptionist', 'doctor'), asyncHandler(async (req, res) => {
  const { page, limit, offset } = paging(req.query, 12, 50);
  const where = []; const params = [];
  if (req.user.role === 'doctor') { where.push(DOCTOR_SCOPE); params.push(...Array(4).fill(req.user.doctor_id)); }
  if (req.query.search) {
    const s = like(req.query.search.trim());
    where.push("(CONCAT(p.first_name,' ',p.last_name) LIKE ? OR p.patient_code LIKE ? OR p.phone LIKE ? OR p.email LIKE ?)");
    params.push(s, s, s, s);
  }
  if (['male', 'female', 'other'].includes(req.query.gender)) { where.push('p.gender = ?'); params.push(req.query.gender); }
  if (BLOOD.includes(req.query.blood_group)) { where.push('p.blood_group = ?'); params.push(req.query.blood_group); }
  if (req.query.status === 'admitted') where.push('a.id IS NOT NULL');
  if (req.query.status === 'outpatient') where.push('a.id IS NULL');
  if (req.query.doctor_id) { where.push('p.assigned_doctor_id = ?'); params.push(Number(req.query.doctor_id)); }
  const W = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const sorts = { name: 'p.first_name, p.last_name', recent: 'p.created_at DESC', visit: 'last_visit DESC', age: 'p.dob DESC' };
  const order = sorts[req.query.sort] || sorts.recent;

  const [{ total }] = await db.query(
    `SELECT COUNT(*) AS total FROM patients p LEFT JOIN admissions a ON a.patient_id = p.id AND a.status = 'admitted' ${W}`, params);
  const data = await db.query(`${LIST_SELECT} ${W} ORDER BY ${order}, p.id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  res.json({ data, total, page, limit, pages: Math.ceil(total / limit) });
}));

// ------------------------------------------------------------------ create
router.post('/', authorize('admin', 'receptionist'), asyncHandler(async (req, res) => {
  const b = patientSchema.parse(req.body);
  const id = await db.transaction(async (conn) => {
    const [r] = await conn.query(
      `INSERT INTO patients (patient_code, first_name, last_name, dob, gender, blood_group, phone, email, address, city,
        emergency_contact_name, emergency_contact_phone, allergies, chronic_conditions, insurance_provider, insurance_no,
        photo_url, assigned_doctor_id, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [`TMP-${Date.now()}-${Math.floor(Math.random() * 1e4)}`, b.first_name, b.last_name, b.dob, b.gender, nn(b.blood_group), b.phone, nn(b.email), nn(b.address), nn(b.city),
        nn(b.emergency_contact_name), nn(b.emergency_contact_phone), nn(b.allergies), nn(b.chronic_conditions), nn(b.insurance_provider), nn(b.insurance_no),
        nn(b.photo_url), b.assigned_doctor_id || null, req.user.id]
    );
    await conn.query('UPDATE patients SET patient_code = ? WHERE id = ?', [`MC-${new Date().getFullYear()}-${String(r.insertId).padStart(5, '0')}`, r.insertId]);
    return r.insertId;
  });
  const patient = await db.one(`${LIST_SELECT} WHERE p.id = ?`, [id]);
  await audit(req, { action: 'PATIENT_CREATED', entity: 'patient', entityId: id, description: `Registered new patient ${patient.first_name} ${patient.last_name} (${patient.patient_code})` });
  res.status(201).json(patient);
}));

// ------------------------------------------------------------------ profile
router.get('/:id', authorize('admin', 'receptionist', 'doctor'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  await assertPatientAccess(req, id);
  const patient = await db.one(`${LIST_SELECT} WHERE p.id = ?`, [id]);
  const full = await db.one('SELECT address, emergency_contact_name, emergency_contact_phone, insurance_provider, insurance_no FROM patients WHERE id = ?', [id]);

  const [admission, records, prescriptions, appointments, admissions] = await Promise.all([
    db.one(
      `SELECT a.*, b.bed_number, b.bed_type, b.daily_rate, w.name AS ward_name, w.floor, du.name AS doctor_name, du.avatar_url AS doctor_avatar
         FROM admissions a JOIN beds b ON b.id = a.bed_id JOIN wards w ON w.id = b.ward_id
         LEFT JOIN doctors d ON d.id = a.doctor_id LEFT JOIN users du ON du.id = d.user_id
        WHERE a.patient_id = ? AND a.status = 'admitted'`, [id]),
    db.query(
      `SELECT r.*, du.name AS doctor_name, du.avatar_url AS doctor_avatar, dep.name AS department
         FROM medical_records r JOIN doctors d ON d.id = r.doctor_id JOIN users du ON du.id = d.user_id
         LEFT JOIN departments dep ON dep.id = d.department_id
        WHERE r.patient_id = ? ORDER BY r.visit_date DESC, r.id DESC`, [id]),
    db.query(
      `SELECT rx.*, du.name AS doctor_name FROM prescriptions rx JOIN doctors d ON d.id = rx.doctor_id JOIN users du ON du.id = d.user_id
        WHERE rx.patient_id = ? ORDER BY rx.created_at DESC`, [id]),
    db.query(
      `SELECT ap.*, du.name AS doctor_name, du.avatar_url AS doctor_avatar, d.specialization
         FROM appointments ap JOIN doctors d ON d.id = ap.doctor_id JOIN users du ON du.id = d.user_id
        WHERE ap.patient_id = ? ORDER BY ap.scheduled_at DESC LIMIT 60`, [id]),
    db.query(
      `SELECT a.id, a.admitted_at, a.discharged_at, a.status, a.reason, a.discharge_notes, b.bed_number, w.name AS ward_name, du.name AS doctor_name
         FROM admissions a JOIN beds b ON b.id = a.bed_id JOIN wards w ON w.id = b.ward_id
         LEFT JOIN doctors d ON d.id = a.doctor_id LEFT JOIN users du ON du.id = d.user_id
        WHERE a.patient_id = ? ORDER BY a.admitted_at DESC`, [id]),
  ]);

  if (prescriptions.length) {
    const items = await db.query('SELECT * FROM prescription_items WHERE prescription_id IN (?) ORDER BY id', [prescriptions.map((r) => r.id)]);
    prescriptions.forEach((rx) => { rx.items = items.filter((i) => i.prescription_id === rx.id); });
  }
  const vitals = records
    .filter((r) => r.heart_rate || r.bp_systolic)
    .slice(0, 12).reverse()
    .map((r) => ({ date: r.visit_date, bp_systolic: r.bp_systolic, bp_diastolic: r.bp_diastolic, heart_rate: r.heart_rate, temperature: r.temperature, spo2: r.spo2, weight_kg: r.weight_kg }));

  await audit(req, { action: 'PATIENT_VIEWED', entity: 'patient', entityId: id, description: `Opened profile of ${patient.first_name} ${patient.last_name} (${patient.patient_code})` });
  res.json({ patient: { ...patient, ...full }, admission, records, prescriptions, appointments, admissions, vitals });
}));

// ------------------------------------------------------------------ update
router.put('/:id', authorize('admin', 'receptionist'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const b = patientSchema.parse(req.body);
  const exists = await db.one('SELECT id FROM patients WHERE id = ?', [id]);
  if (!exists) throw new AppError(404, 'Patient not found');
  await db.query(
    `UPDATE patients SET first_name=?, last_name=?, dob=?, gender=?, blood_group=?, phone=?, email=?, address=?, city=?,
       emergency_contact_name=?, emergency_contact_phone=?, allergies=?, chronic_conditions=?, insurance_provider=?, insurance_no=?,
       photo_url=COALESCE(?, photo_url), assigned_doctor_id=? WHERE id=?`,
    [b.first_name, b.last_name, b.dob, b.gender, nn(b.blood_group), b.phone, nn(b.email), nn(b.address), nn(b.city),
      nn(b.emergency_contact_name), nn(b.emergency_contact_phone), nn(b.allergies), nn(b.chronic_conditions), nn(b.insurance_provider), nn(b.insurance_no),
      nn(b.photo_url), b.assigned_doctor_id || null, id]
  );
  const patient = await db.one(`${LIST_SELECT} WHERE p.id = ?`, [id]);
  await audit(req, { action: 'PATIENT_UPDATED', entity: 'patient', entityId: id, description: `Updated record of ${patient.first_name} ${patient.last_name} (${patient.patient_code})` });
  res.json(patient);
}));

// doctors may maintain clinical flags
router.patch('/:id/clinical', authorize('admin', 'doctor'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  await assertPatientAccess(req, id);
  const b = z.object({ allergies: opt(500), chronic_conditions: opt(500) }).parse(req.body);
  await db.query('UPDATE patients SET allergies = ?, chronic_conditions = ? WHERE id = ?', [nn(b.allergies), nn(b.chronic_conditions), id]);
  await audit(req, { action: 'PATIENT_UPDATED', entity: 'patient', entityId: id, description: 'Updated allergies / chronic conditions' });
  res.json({ message: 'Clinical details updated' });
}));

// ------------------------------------------------------------------ delete
router.delete('/:id', authorize('admin'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const p = await db.one('SELECT first_name, last_name, patient_code FROM patients WHERE id = ?', [id]);
  if (!p) throw new AppError(404, 'Patient not found');
  const adm = await db.one("SELECT id FROM admissions WHERE patient_id = ? AND status = 'admitted'", [id]);
  if (adm) throw new AppError(409, 'Patient is currently admitted. Discharge them before deleting the record.');
  await db.query('DELETE FROM patients WHERE id = ?', [id]); // FK RESTRICT on admissions history -> friendly 409 via error handler
  await audit(req, { action: 'PATIENT_DELETED', entity: 'patient', entityId: id, description: `Deleted patient ${p.first_name} ${p.last_name} (${p.patient_code})`, severity: 'critical' });
  res.json({ message: 'Patient deleted' });
}));

// ------------------------------------------------------------------ clinical records
router.post('/:id/records', authorize('admin', 'doctor'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  await assertPatientAccess(req, id);
  const b = recordSchema.parse(req.body);
  const patient = await db.one('SELECT assigned_doctor_id FROM patients WHERE id = ?', [id]);
  const doctorId = req.user.role === 'doctor' ? req.user.doctor_id : (b.doctor_id || patient.assigned_doctor_id);
  if (!doctorId) throw new AppError(422, 'Select the doctor responsible for this record', { doctor_id: 'Required' });
  const [r] = await db.pool.query(
    `INSERT INTO medical_records (patient_id, doctor_id, appointment_id, visit_date, visit_type, chief_complaint, diagnosis, treatment, notes,
       bp_systolic, bp_diastolic, heart_rate, temperature, spo2, weight_kg, follow_up_date)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, doctorId, b.appointment_id || null, nowStr(), b.visit_type, nn(b.chief_complaint), b.diagnosis, nn(b.treatment), nn(b.notes),
      b.bp_systolic ?? null, b.bp_diastolic ?? null, b.heart_rate ?? null, b.temperature ?? null, b.spo2 ?? null, b.weight_kg ?? null, nn(b.follow_up_date)]
  );
  if (b.appointment_id) await db.query("UPDATE appointments SET status = 'completed' WHERE id = ? AND patient_id = ? AND status IN ('scheduled','checked_in')", [b.appointment_id, id]);
  await audit(req, { action: 'RECORD_CREATED', entity: 'patient', entityId: id, description: `Recorded diagnosis "${b.diagnosis}"` });
  res.status(201).json({ id: r.insertId, message: 'Diagnosis recorded' });
}));

router.post('/:id/prescriptions', authorize('admin', 'doctor'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  await assertPatientAccess(req, id);
  const b = rxSchema.parse(req.body);
  const patient = await db.one('SELECT allergies, assigned_doctor_id FROM patients WHERE id = ?', [id]);
  const doctorId = req.user.role === 'doctor' ? req.user.doctor_id : (b.doctor_id || patient.assigned_doctor_id);
  if (!doctorId) throw new AppError(422, 'Select the prescribing doctor', { doctor_id: 'Required' });

  const warnings = [];
  const allergyText = (patient.allergies || '').toLowerCase();
  for (const it of b.items) {
    if (it.medicine_id) {
      const m = await db.one('SELECT name, quantity FROM medicines WHERE id = ?', [it.medicine_id]);
      if (m && m.quantity === 0) warnings.push(`${m.name} is currently out of stock`);
    }
    const first = it.medicine_name.toLowerCase().split(/[\s-]/)[0];
    if (allergyText && first.length > 3 && allergyText.includes(first)) warnings.push(`Patient has a recorded allergy that may match ${it.medicine_name}`);
  }

  const rxId = await db.transaction(async (conn) => {
    const [r] = await conn.query('INSERT INTO prescriptions (patient_id, doctor_id, record_id, notes, status, created_at) VALUES (?,?,?,?,?,?)',
      [id, doctorId, b.record_id || null, nn(b.notes), 'active', nowStr()]);
    await conn.query('INSERT INTO prescription_items (prescription_id, medicine_id, medicine_name, dosage, frequency, duration_days, instructions) VALUES ?',
      [b.items.map((i) => [r.insertId, i.medicine_id || null, i.medicine_name, i.dosage, i.frequency, i.duration_days, nn(i.instructions)])]);
    return r.insertId;
  });
  await audit(req, { action: 'PRESCRIPTION_CREATED', entity: 'patient', entityId: id, description: `Issued prescription #${rxId} with ${b.items.length} medicine(s)` });
  res.status(201).json({ id: rxId, warnings, message: 'Prescription issued' });
}));

module.exports = router;
module.exports.DOCTOR_SCOPE = DOCTOR_SCOPE;
