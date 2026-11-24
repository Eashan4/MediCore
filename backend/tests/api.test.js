// Integration tests: run against the real MySQL DB from backend/.env.
// They only create their own rows (tagged "ZZTest") and delete them afterwards.
process.env.NODE_ENV = 'test';
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/server');
const db = require('../src/config/db');

const CREDS = {
  admin: ['admin@medicore.com', 'Admin@123'],
  doctor: ['doctor@medicore.com', 'Doctor@123'],
  receptionist: ['reception@medicore.com', 'Reception@123'],
};
const tokens = {};
let server, base;
const created = { patients: [], beds: [], staff: [] };

async function api(method, path, { token, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}
const login = (email, password) => api('POST', '/api/auth/login', { body: { email, password } });
const patientBody = (n) => ({ first_name: 'ZZTest', last_name: `Patient${n}`, dob: '1990-01-01', gender: 'other', phone: '5550001234' });

before(async () => {
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', r); });
  base = `http://127.0.0.1:${server.address().port}`;
  for (const [role, [email, password]] of Object.entries(CREDS)) {
    const r = await login(email, password);
    assert.equal(r.status, 200, `seed ${role} login failed - is the DB seeded?`);
    tokens[role] = r.body.token;
  }
});

after(async () => {
  // Remove everything the tests created (admissions first: FK RESTRICT).
  const del = async (sql, ids) => { if (ids.length) await db.pool.query(sql, [ids]); };
  await del('DELETE FROM admissions WHERE patient_id IN (?)', created.patients);
  await del('DELETE FROM admissions WHERE bed_id IN (?)', created.beds);
  await del('DELETE FROM beds WHERE id IN (?)', created.beds);
  await del('DELETE FROM patients WHERE id IN (?)', created.patients);
  if (created.staff.length) {
    const [rows] = await db.pool.query('SELECT user_id FROM staff WHERE id IN (?) AND user_id IS NOT NULL', [created.staff]);
    await del('DELETE FROM staff WHERE id IN (?)', created.staff);
    await del('DELETE FROM users WHERE id IN (?)', rows.map((r) => r.user_id));
  }
  await new Promise((r) => server.close(r));
  await db.pool.end();
});

describe('health', () => {
  test('GET /api/health reports DB connected', async () => {
    const r = await api('GET', '/api/health');
    assert.equal(r.status, 200);
    assert.equal(r.body.status, 'ok');
  });
});

describe('auth', () => {
  test('login succeeds with a token and user profile', async () => {
    const r = await login(...CREDS.admin);
    assert.equal(r.status, 200);
    assert.ok(r.body.token);
    assert.equal(r.body.user.role, 'admin');
    assert.equal(r.body.user.password_hash, undefined);
  });

  test('wrong password and unknown email both give 401', async () => {
    assert.equal((await login(CREDS.admin[0], 'Wrong@123')).status, 401);
    assert.equal((await login('nobody@medicore.com', 'Wrong@123')).status, 401);
  });

  test('malformed login payload is rejected as validation error', async () => {
    const r = await login('not-an-email', '');
    assert.ok([400, 422].includes(r.status));
  });

  test('protected routes return 401 without or with a bad token', async () => {
    assert.equal((await api('GET', '/api/patients')).status, 401);
    assert.equal((await api('GET', '/api/auth/me', { token: 'garbage' })).status, 401);
  });

  test('GET /auth/me returns the signed-in user', async () => {
    const r = await api('GET', '/api/auth/me', { token: tokens.doctor });
    assert.equal(r.status, 200);
    assert.equal(r.body.user.email, CREDS.doctor[0]);
  });
});

describe('role enforcement', () => {
  test('receptionist gets 403 on /staff and /audit', async () => {
    assert.equal((await api('GET', '/api/staff', { token: tokens.receptionist })).status, 403);
    assert.equal((await api('GET', '/api/audit', { token: tokens.receptionist })).status, 403);
  });

  test('doctor gets 403 on POST /patients', async () => {
    assert.equal((await api('POST', '/api/patients', { token: tokens.doctor, body: patientBody('Role') })).status, 403);
  });

  test('admin gets 200 on /staff, /audit and /patients', async () => {
    for (const p of ['/api/staff', '/api/audit', '/api/patients']) {
      assert.equal((await api('GET', p, { token: tokens.admin })).status, 200, p);
    }
  });
});

describe('patients', () => {
  test('invalid payload returns 400/422 with field errors', async () => {
    const r = await api('POST', '/api/patients', { token: tokens.receptionist, body: { first_name: '', dob: '2999-01-01', gender: 'x', phone: '1' } });
    assert.ok([400, 422].includes(r.status), `got ${r.status}`);
    assert.ok(r.body.fields.first_name && r.body.fields.dob && r.body.fields.gender);
  });

  test('malformed JSON returns 400', async () => {
    const res = await fetch(`${base}/api/patients`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.admin}` }, body: '{bad' });
    assert.equal(res.status, 400);
  });

  test('receptionist can create a patient', async () => {
    const r = await api('POST', '/api/patients', { token: tokens.receptionist, body: patientBody('Create') });
    assert.equal(r.status, 201);
    created.patients.push(r.body.id);
    assert.match(r.body.patient_code, /^MC-\d{4}-\d{5}$/);
  });
});

describe('bed allocation', () => {
  let bedA, bedB, p1, p2;
  before(async () => {
    const mk = async (n) => {
      const r = await api('POST', '/api/patients', { token: tokens.admin, body: patientBody(n) });
      created.patients.push(r.body.id);
      return r.body.id;
    };
    [p1, p2] = [await mk('Bed1'), await mk('Bed2')];
    const mkBed = async (n) => {
      const r = await api('POST', '/api/beds', { token: tokens.admin, body: { ward_id: 1, bed_number: `ZZ-${n}-${Date.now() % 100000}`, bed_type: 'standard', daily_rate: 10 } });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      created.beds.push(r.body.id);
      return r.body.id;
    };
    [bedA, bedB] = [await mkBed('A'), await mkBed('B')];
  });

  test('allocating an occupied bed, or an already admitted patient, gives 409 (not 500)', async () => {
    const ok = await api('POST', `/api/beds/${bedA}/allocate`, { token: tokens.receptionist, body: { patient_id: p1, reason: 'test' } });
    assert.equal(ok.status, 201, JSON.stringify(ok.body));
    const sameBed = await api('POST', `/api/beds/${bedA}/allocate`, { token: tokens.receptionist, body: { patient_id: p2 } });
    assert.equal(sameBed.status, 409);
    const samePatient = await api('POST', `/api/beds/${bedB}/allocate`, { token: tokens.receptionist, body: { patient_id: p1 } });
    assert.equal(samePatient.status, 409);
    const missing = await api('POST', `/api/beds/${bedB}/allocate`, { token: tokens.receptionist, body: { patient_id: 99999999 } });
    assert.equal(missing.status, 404);
  });

  test('concurrent allocation of one bed: exactly one wins, none 500', async () => {
    const [a, b] = await Promise.all([
      api('POST', `/api/beds/${bedB}/allocate`, { token: tokens.admin, body: { patient_id: p2 } }),
      api('POST', '/api/admissions', { token: tokens.admin, body: { patient_id: p2, bed_id: bedB, reason: 'race' } }),
    ]);
    assert.deepEqual([a.status, b.status].sort(), [201, 409], JSON.stringify([a.body, b.body]));
  });

  test('doctor cannot allocate beds', async () => {
    assert.equal((await api('POST', `/api/beds/${bedA}/allocate`, { token: tokens.doctor, body: { patient_id: p1 } })).status, 403);
  });

  test('discharge frees the patient and bed for reuse', async () => {
    assert.equal((await api('POST', `/api/beds/${bedA}/discharge`, { token: tokens.admin, body: {} })).status, 200);
    const r = await api('POST', `/api/beds/${bedA}/allocate`, { token: tokens.admin, body: { patient_id: p1 } });
    assert.equal(r.status, 201, JSON.stringify(r.body));
  });
});

describe('password change', () => {
  const email = `zztest.${Date.now()}@medicore.com`;
  const oldPw = 'Oldpass1';
  const newPw = 'Newpass2';

  test('wrong current pw and weak pw rejected; change works; old pw dies', async () => {
    const s = await api('POST', '/api/staff', { token: tokens.admin, body: { name: 'ZZTest Staff', designation: 'Tester', email, create_login: true, password: oldPw } });
    assert.equal(s.status, 201, JSON.stringify(s.body));
    created.staff.push(s.body.id);

    const t = (await login(email, oldPw)).body.token;
    assert.ok(t);
    const bad = await api('PUT', '/api/auth/password', { token: t, body: { current_password: 'nope', new_password: newPw } });
    assert.equal(bad.status, 422);
    const weak = await api('PUT', '/api/auth/password', { token: t, body: { current_password: oldPw, new_password: 'short' } });
    assert.ok([400, 422].includes(weak.status));
    assert.equal((await api('PUT', '/api/auth/password', { token: t, body: { current_password: oldPw, new_password: newPw } })).status, 200);

    assert.equal((await login(email, oldPw)).status, 401);
    assert.equal((await login(email, newPw)).status, 200);
  });
});
