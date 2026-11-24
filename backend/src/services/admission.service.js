/**
 * Bed allocation / discharge logic shared by the Beds, Admissions and Emergency modules.
 * Every function expects to run inside a transaction (conn) so that the row locks
 * taken with SELECT ... FOR UPDATE really prevent double bookings. The database adds a
 * second safety net through UNIQUE keys on the generated active_bed_key / active_patient_key columns.
 */
const { AppError, nowStr } = require('../utils/helpers');

async function allocateBed(conn, { bedId, patientId, doctorId, reason, userId }) {
  const [[bed]] = await conn.query(
    `SELECT b.id, b.bed_number, b.status, w.name AS ward_name
       FROM beds b JOIN wards w ON w.id = b.ward_id WHERE b.id = ? FOR UPDATE`,
    [bedId]
  );
  if (!bed) throw new AppError(404, 'Bed not found');
  if (bed.status === 'occupied') throw new AppError(409, `Bed ${bed.bed_number} is already occupied`);
  if (bed.status === 'maintenance') throw new AppError(409, `Bed ${bed.bed_number} is under maintenance and cannot be allocated`);

  const [[patient]] = await conn.query('SELECT id, first_name, last_name, patient_code, assigned_doctor_id FROM patients WHERE id = ? FOR UPDATE', [patientId]);
  if (!patient) throw new AppError(404, 'Patient not found');

  const [[active]] = await conn.query(
    `SELECT b.bed_number FROM admissions a JOIN beds b ON b.id = a.bed_id WHERE a.patient_id = ? AND a.status = 'admitted'`,
    [patientId]
  );
  if (active) throw new AppError(409, `${patient.first_name} ${patient.last_name} is already admitted in bed ${active.bed_number}`);

  const docId = doctorId || patient.assigned_doctor_id || null;
  if (docId) {
    const [[doc]] = await conn.query('SELECT id FROM doctors WHERE id = ?', [docId]);
    if (!doc) throw new AppError(422, 'Selected doctor does not exist');
  }

  const [res] = await conn.query(
    `INSERT INTO admissions (patient_id, bed_id, doctor_id, admitted_at, reason, status, admitted_by)
     VALUES (?,?,?,?,?, 'admitted', ?)`,
    [patientId, bedId, docId, nowStr(), reason || null, userId]
  );
  await conn.query("UPDATE beds SET status = 'occupied', notes = NULL WHERE id = ?", [bedId]);
  if (!patient.assigned_doctor_id && docId) await conn.query('UPDATE patients SET assigned_doctor_id = ? WHERE id = ?', [docId, patientId]);

  return { admissionId: res.insertId, bed, patient };
}

/** Discharge by admission id OR by bed id (whichever is supplied). */
async function dischargePatient(conn, { admissionId, bedId, notes, userId, sendToCleaning }) {
  const [[adm]] = admissionId
    ? await conn.query("SELECT * FROM admissions WHERE id = ? AND status = 'admitted' FOR UPDATE", [admissionId])
    : await conn.query("SELECT * FROM admissions WHERE bed_id = ? AND status = 'admitted' FOR UPDATE", [bedId]);
  if (!adm) throw new AppError(409, 'No active admission found - the patient may already have been discharged');

  await conn.query(
    "UPDATE admissions SET status = 'discharged', discharged_at = ?, discharge_notes = ?, discharged_by = ? WHERE id = ?",
    [nowStr(), notes || null, userId, adm.id]
  );
  await conn.query('UPDATE beds SET status = ?, notes = ? WHERE id = ?', [
    sendToCleaning ? 'maintenance' : 'available',
    sendToCleaning ? 'Cleaning after discharge' : null,
    adm.bed_id,
  ]);
  const [[info]] = await conn.query(
    `SELECT p.first_name, p.last_name, p.patient_code, b.bed_number
       FROM patients p JOIN beds b ON b.id = ? WHERE p.id = ?`,
    [adm.bed_id, adm.patient_id]
  );
  return { admission: adm, info };
}

module.exports = { allocateBed, dischargePatient };
