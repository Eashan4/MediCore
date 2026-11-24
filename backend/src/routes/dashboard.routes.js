const router = require('express').Router();
const db = require('../config/db');
const { authorize } = require('../middleware/auth');
const { asyncHandler, nowStr, todayStr, addDays } = require('../utils/helpers');
const { DOCTOR_SCOPE } = require('./patients.routes');

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** [{day:'2026-01-05', ...}] -> 7 (or n) consecutive days ending today, with zero-filled gaps. */
function fillDays(rows, keys, n = 7, endOffset = 0) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = addDays(endOffset - i);
    const key = todayStr(d);
    const hit = rows.find((r) => String(r.day).slice(0, 10) === key) || {};
    const o = { date: key, label: DAY[d.getDay()], isToday: i === endOffset };
    keys.forEach((k) => { o[k] = Number(hit[k] || 0); });
    out.push(o);
  }
  return out;
}

const bedCounts = async () => {
  const [c] = await db.query(
    `SELECT COUNT(*) AS total, SUM(status='available') AS available, SUM(status='occupied') AS occupied, SUM(status='maintenance') AS maintenance FROM beds`);
  const t = +c.total;
  return { total: t, available: +c.available, occupied: +c.occupied, maintenance: +c.maintenance, occupancy: t ? Math.round((c.occupied / t) * 100) : 0 };
};

const wardOccupancy = () => db.query(
  `SELECT w.id, w.name, COUNT(b.id) AS total, SUM(b.status='occupied') AS occupied, SUM(b.status='available') AS available, SUM(b.status='maintenance') AS maintenance
     FROM wards w LEFT JOIN beds b ON b.ward_id = w.id GROUP BY w.id, w.name ORDER BY w.id`
).then((r) => r.map((w) => ({ ...w, total: +w.total, occupied: +w.occupied, available: +w.available, maintenance: +w.maintenance, pct: w.total ? Math.round((w.occupied / w.total) * 100) : 0 })));

const todayAppointments = (extraWhere = '', params = []) => db.query(
  `SELECT ap.id, ap.scheduled_at, ap.duration_min, ap.type, ap.status, ap.reason, ap.patient_id, ap.doctor_id,
          p.first_name, p.last_name, p.patient_code, p.photo_url AS patient_photo, p.gender, TIMESTAMPDIFF(YEAR, p.dob, CURDATE()) AS age,
          du.name AS doctor_name, du.avatar_url AS doctor_avatar, d.specialization
     FROM appointments ap JOIN patients p ON p.id = ap.patient_id JOIN doctors d ON d.id = ap.doctor_id JOIN users du ON du.id = d.user_id
    WHERE DATE(ap.scheduled_at) = ? ${extraWhere} ORDER BY ap.scheduled_at`, [todayStr(), ...params]);

const activeEmergencies = (limit = 5) => db.query(
  `SELECT e.id, e.request_code, e.patient_name, e.age, e.gender, e.condition_desc, e.urgency, e.status, e.arrival_mode, e.created_at, du.name AS doctor_name,
          TIMESTAMPDIFF(MINUTE, e.created_at, NOW()) AS waiting_minutes
     FROM emergency_requests e LEFT JOIN doctors d ON d.id = e.assigned_doctor_id LEFT JOIN users du ON du.id = d.user_id
    WHERE e.status IN ('pending','in_treatment') ORDER BY FIELD(e.urgency,'critical','high','medium','low'), e.created_at LIMIT ?`, [limit]);

// ============================================================ ADMIN
router.get('/admin', authorize('admin'), asyncHandler(async (_req, res) => {
  const d7 = `${todayStr(addDays(-6))} 00:00:00`;
  const d14 = `${todayStr(addDays(-13))} 00:00:00`;
  const today = todayStr();

  const [[pt], [doc], [appt], [emg]] = await Promise.all([
    db.query('SELECT COUNT(*) AS total, SUM(created_at >= ?) AS week FROM patients', [d7]),
    db.query("SELECT COUNT(*) AS total, SUM(status='active') AS active, SUM(status='on_leave') AS on_leave FROM doctors"),
    db.query("SELECT COUNT(*) AS total, SUM(status='completed') AS completed, SUM(status IN ('scheduled','checked_in')) AS remaining FROM appointments WHERE DATE(scheduled_at) = ?", [today]),
    db.query("SELECT SUM(status IN ('pending','in_treatment')) AS active, SUM(status IN ('pending','in_treatment') AND urgency='critical') AS critical, SUM(DATE(created_at) = ?) AS today FROM emergency_requests", [today]),
  ]);

  const [beds, wards, regRows, apptRows, admRows, disRows, emgRows, dxRows, deptRows, occRows, upcoming, emergencies, lowStock, [medStats], activity] = await Promise.all([
    bedCounts(),
    wardOccupancy(),
    db.query('SELECT DATE(created_at) AS day, COUNT(*) AS n FROM patients WHERE created_at >= ? GROUP BY DATE(created_at)', [d7]),
    db.query("SELECT DATE(scheduled_at) AS day, COUNT(*) AS n FROM appointments WHERE scheduled_at >= ? AND scheduled_at < ? AND status <> 'cancelled' GROUP BY DATE(scheduled_at)", [d7, `${todayStr(addDays(1))} 00:00:00`]),
    db.query('SELECT DATE(admitted_at) AS day, COUNT(*) AS n FROM admissions WHERE admitted_at >= ? GROUP BY DATE(admitted_at)', [d7]),
    db.query('SELECT DATE(discharged_at) AS day, COUNT(*) AS n FROM admissions WHERE discharged_at >= ? GROUP BY DATE(discharged_at)', [d7]),
    db.query('SELECT DATE(created_at) AS day, COUNT(*) AS n FROM emergency_requests WHERE created_at >= ? GROUP BY DATE(created_at)', [d7]),
    db.query(
      `SELECT diagnosis AS name, COUNT(*) AS value FROM medical_records WHERE visit_date >= ? GROUP BY diagnosis ORDER BY value DESC`, [`${todayStr(addDays(-120))} 00:00:00`]),
    db.query(
      `SELECT dep.name, dep.color, COUNT(ap.id) AS appointments FROM departments dep
         JOIN doctors d ON d.department_id = dep.id LEFT JOIN appointments ap ON ap.doctor_id = d.id AND ap.status <> 'cancelled' AND ap.scheduled_at >= ? AND ap.scheduled_at < ?
        GROUP BY dep.id, dep.name, dep.color ORDER BY appointments DESC`, [d7, `${todayStr(addDays(8))} 00:00:00`]),
    db.query("SELECT admitted_at, discharged_at FROM admissions WHERE discharged_at IS NULL OR discharged_at >= ?", [d14]),
    db.query(
      `SELECT ap.id, ap.scheduled_at, ap.status, ap.type, ap.reason, p.first_name, p.last_name, p.patient_code, p.photo_url AS patient_photo, du.name AS doctor_name, du.avatar_url AS doctor_avatar, d.specialization
         FROM appointments ap JOIN patients p ON p.id = ap.patient_id JOIN doctors d ON d.id = ap.doctor_id JOIN users du ON du.id = d.user_id
        WHERE ap.scheduled_at >= ? AND ap.status IN ('scheduled','checked_in') ORDER BY ap.scheduled_at LIMIT 6`, [nowStr(addDays(0, new Date(Date.now() - 20 * 60000)))]),
    activeEmergencies(5),
    db.query('SELECT id, name, quantity, reorder_level, unit, category FROM medicines WHERE quantity <= reorder_level ORDER BY quantity / GREATEST(reorder_level,1) LIMIT 6'),
    db.query('SELECT SUM(quantity <= reorder_level) AS low, SUM(expiry_date < ?) AS expired, SUM(expiry_date >= ? AND expiry_date <= ?) AS expiring FROM medicines', [today, today, todayStr(addDays(60))]),
    db.query('SELECT id, user_name, user_role, action, description, severity, created_at FROM audit_logs ORDER BY created_at DESC, id DESC LIMIT 7'),
  ]);

  // Bed occupancy trend (last 14 days) rebuilt from admission history
  const trend = [];
  for (let i = 13; i >= 0; i--) {
    const d = addDays(-i); const endOfDay = `${todayStr(d)} 23:59:59`;
    const inUse = occRows.filter((a) => a.admitted_at <= endOfDay && (!a.discharged_at || a.discharged_at > endOfDay)).length;
    trend.push({ date: todayStr(d), label: `${d.getDate()}/${d.getMonth() + 1}`, occupied: Math.min(inUse, beds.total), pct: beds.total ? Math.round((Math.min(inUse, beds.total) / beds.total) * 100) : 0 });
  }
  trend[trend.length - 1].occupied = beds.occupied; trend[trend.length - 1].pct = beds.occupancy;

  const top = dxRows.slice(0, 5);
  const others = dxRows.slice(5).reduce((s, r) => s + Number(r.value), 0);
  const diagnoses = [...top.map((r) => ({ name: r.name, value: +r.value })), ...(others ? [{ name: 'Other', value: others }] : [])];

  const reg = fillDays(regRows.map((r) => ({ ...r, registrations: r.n })), ['registrations']);
  const apt = fillDays(apptRows.map((r) => ({ ...r, appointments: r.n })), ['appointments']);
  const adm = fillDays(admRows.map((r) => ({ ...r, admissions: r.n })), ['admissions']);
  const dis = fillDays(disRows.map((r) => ({ ...r, discharges: r.n })), ['discharges']);
  const emr = fillDays(emgRows.map((r) => ({ ...r, emergencies: r.n })), ['emergencies']);

  res.json({
    stats: {
      patients: { total: +pt.total, week: +pt.week || 0, spark: reg.map((r) => r.registrations) },
      doctors: { total: +doc.total, active: +doc.active, on_leave: +doc.on_leave },
      appointments: { today: +appt.total, completed: +appt.completed || 0, remaining: +appt.remaining || 0, spark: apt.map((r) => r.appointments) },
      emergency: { active: +emg.active || 0, critical: +emg.critical || 0, today: +emg.today || 0, spark: emr.map((r) => r.emergencies) },
      beds: { ...beds, spark: trend.slice(-7).map((t) => t.pct) },
    },
    weekly: adm.map((a, i) => ({ label: a.label, date: a.date, isToday: a.isToday, admissions: a.admissions, discharges: dis[i].discharges })),
    occupancy_trend: trend,
    wards,
    diagnoses,
    departments: deptRows.map((r) => ({ ...r, appointments: +r.appointments })),
    upcoming,
    emergencies,
    low_stock: lowStock,
    medicine_alerts: { low: +medStats.low || 0, expired: +medStats.expired || 0, expiring: +medStats.expiring || 0 },
    activity,
  });
}));

// ============================================================ DOCTOR
router.get('/doctor', authorize('doctor'), asyncHandler(async (req, res) => {
  const me = req.user.doctor_id;
  const today = todayStr();
  const d7 = `${todayStr(addDays(-6))} 00:00:00`;

  const profile = await db.one(
    `SELECT d.id, d.specialization, d.rating, d.experience_years, dep.name AS department, u.name, u.avatar_url
       FROM doctors d JOIN users u ON u.id = d.user_id LEFT JOIN departments dep ON dep.id = d.department_id WHERE d.id = ?`, [me]);

  const [[pc], agenda, admitted, weekRows, dxRows, recent, followUps, emergencies, [vitalsAvg]] = await Promise.all([
    db.query(`SELECT COUNT(*) AS total FROM patients p WHERE ${DOCTOR_SCOPE}`, [me, me, me, me]),
    todayAppointments('AND ap.doctor_id = ?', [me]),
    db.query(
      `SELECT a.id AS admission_id, a.admitted_at, a.reason, b.bed_number, w.name AS ward_name, p.id AS patient_id, p.first_name, p.last_name, p.patient_code, p.photo_url, p.gender,
              TIMESTAMPDIFF(YEAR, p.dob, CURDATE()) AS age,
              (SELECT r.diagnosis FROM medical_records r WHERE r.patient_id = p.id ORDER BY r.visit_date DESC, r.id DESC LIMIT 1) AS diagnosis,
              (SELECT r.heart_rate FROM medical_records r WHERE r.patient_id = p.id ORDER BY r.visit_date DESC, r.id DESC LIMIT 1) AS heart_rate,
              (SELECT r.spo2 FROM medical_records r WHERE r.patient_id = p.id ORDER BY r.visit_date DESC, r.id DESC LIMIT 1) AS spo2
         FROM admissions a JOIN patients p ON p.id = a.patient_id JOIN beds b ON b.id = a.bed_id JOIN wards w ON w.id = b.ward_id
        WHERE a.doctor_id = ? AND a.status = 'admitted' ORDER BY a.admitted_at DESC`, [me]),
    db.query(
      `SELECT DATE(scheduled_at) AS day, COUNT(*) AS total, SUM(status='completed') AS completed FROM appointments
        WHERE doctor_id = ? AND scheduled_at >= ? AND scheduled_at < ? AND status <> 'cancelled' GROUP BY DATE(scheduled_at)`, [me, d7, `${todayStr(addDays(1))} 00:00:00`]),
    db.query('SELECT diagnosis AS name, COUNT(*) AS value FROM medical_records WHERE doctor_id = ? GROUP BY diagnosis ORDER BY value DESC LIMIT 6', [me]),
    db.query(
      `SELECT r.id, r.visit_date, r.diagnosis, r.patient_id, p.first_name, p.last_name, p.patient_code, p.photo_url
         FROM medical_records r JOIN patients p ON p.id = r.patient_id WHERE r.doctor_id = ? ORDER BY r.visit_date DESC, r.id DESC LIMIT 5`, [me]),
    db.query(
      `SELECT r.patient_id, r.follow_up_date, r.diagnosis, p.first_name, p.last_name, p.photo_url, p.patient_code
         FROM medical_records r JOIN patients p ON p.id = r.patient_id
        WHERE r.doctor_id = ? AND r.follow_up_date BETWEEN ? AND ? ORDER BY r.follow_up_date LIMIT 6`, [me, today, todayStr(addDays(10))]),
    db.query(
      `SELECT e.id, e.request_code, e.patient_name, e.urgency, e.status, e.condition_desc, TIMESTAMPDIFF(MINUTE, e.created_at, NOW()) AS waiting_minutes
         FROM emergency_requests e WHERE e.status IN ('pending','in_treatment') AND (e.assigned_doctor_id = ? OR e.assigned_doctor_id IS NULL)
        ORDER BY FIELD(e.urgency,'critical','high','medium','low') LIMIT 4`, [me]),
    db.query('SELECT ROUND(AVG(heart_rate)) AS hr FROM medical_records WHERE doctor_id = ?', [me]),
  ]);

  const nowMs = Date.now();
  const next = agenda.find((a) => ['scheduled', 'checked_in'].includes(a.status) && new Date(a.scheduled_at.replace(' ', 'T')).getTime() >= nowMs - 30 * 60000) || null;
  const week = fillDays(weekRows, ['total', 'completed']);

  res.json({
    profile,
    stats: {
      patients: +pc.total,
      appointments_today: agenda.length,
      completed_today: agenda.filter((a) => a.status === 'completed').length,
      remaining_today: agenda.filter((a) => ['scheduled', 'checked_in'].includes(a.status)).length,
      admitted: admitted.length,
      follow_ups: followUps.length,
      avg_hr: vitalsAvg?.hr || null,
    },
    agenda, next, admitted, week, diagnoses: dxRows.map((r) => ({ ...r, value: +r.value })), recent, follow_ups: followUps, emergencies,
  });
}));

// ============================================================ RECEPTIONIST
router.get('/reception', authorize('receptionist'), asyncHandler(async (_req, res) => {
  const today = todayStr();
  const d7 = `${todayStr(addDays(-6))} 00:00:00`;
  const [beds, wards, queue, emergencies, regRows, apptRows, bedGrid, recentAdm, [admToday], [reg]] = await Promise.all([
    bedCounts(),
    wardOccupancy(),
    todayAppointments(),
    activeEmergencies(4),
    db.query('SELECT DATE(created_at) AS day, COUNT(*) AS n FROM patients WHERE created_at >= ? GROUP BY DATE(created_at)', [d7]),
    db.query("SELECT DATE(scheduled_at) AS day, COUNT(*) AS n FROM appointments WHERE scheduled_at >= ? AND scheduled_at < ? AND status <> 'cancelled' GROUP BY DATE(scheduled_at)", [d7, `${todayStr(addDays(1))} 00:00:00`]),
    db.query('SELECT b.id, b.bed_number, b.status, b.ward_id, b.bed_type FROM beds b ORDER BY b.ward_id, b.id'),
    db.query(
      `SELECT a.id, a.patient_id, a.admitted_at, a.status, p.first_name, p.last_name, p.patient_code, p.photo_url, b.bed_number, w.name AS ward_name
         FROM admissions a JOIN patients p ON p.id = a.patient_id JOIN beds b ON b.id = a.bed_id JOIN wards w ON w.id = b.ward_id
        WHERE a.status = 'admitted' ORDER BY a.admitted_at DESC LIMIT 5`),
    db.query("SELECT SUM(DATE(admitted_at) = ?) AS admitted, SUM(DATE(discharged_at) = ?) AS discharged FROM admissions", [today, today]),
    db.query('SELECT SUM(DATE(created_at) = ?) AS today, COUNT(*) AS total FROM patients', [today]),
  ]);
  const regSeries = fillDays(regRows.map((r) => ({ ...r, registrations: r.n })), ['registrations']);
  const apptSeries = fillDays(apptRows.map((r) => ({ ...r, appointments: r.n })), ['appointments']);
  wards.forEach((w) => { w.beds = bedGrid.filter((b) => b.ward_id === w.id); });
  res.json({
    stats: {
      registered_today: +reg.today || 0,
      patients_total: +reg.total,
      appointments_today: queue.length,
      waiting: queue.filter((a) => a.status === 'checked_in').length,
      pending_checkin: queue.filter((a) => a.status === 'scheduled').length,
      admitted_today: +admToday.admitted || 0,
      discharged_today: +admToday.discharged || 0,
      beds, emergencies: emergencies.length,
      spark_reg: regSeries.map((r) => r.registrations),
    },
    queue, wards, emergencies, recent_admissions: recentAdm,
    weekly: regSeries.map((r, i) => ({ label: r.label, isToday: r.isToday, registrations: r.registrations, appointments: apptSeries[i].appointments })),
  });
}));

module.exports = router;
