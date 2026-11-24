const router = require('express').Router();
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const db = require('../config/db');
const { authenticate, signToken } = require('../middleware/auth');
const { AppError, asyncHandler, nowStr, addDays } = require('../utils/helpers');
const { audit, clientIp } = require('../utils/audit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again in a few minutes.' },
});

const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

async function publicUser(id) {
  return db.one(
    `SELECT u.id, u.name, u.email, u.role, u.phone, u.avatar_url, u.last_login_at,
            d.id AS doctor_id, d.specialization, dep.name AS department
       FROM users u
       LEFT JOIN doctors d ON d.user_id = u.id
       LEFT JOIN departments dep ON dep.id = d.department_id
      WHERE u.id = ?`,
    [id]
  );
}

router.post('/login', loginLimiter, asyncHandler(async (req, res) => {
  const { email, password } = z.object({
    email: z.string().trim().toLowerCase().email('Enter a valid email'),
    password: z.string().min(1, 'Password is required'),
  }).parse(req.body);

  const user = await db.one('SELECT * FROM users WHERE email = ?', [email]);
  const valid = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);

  if (!user || !valid || !user.is_active) {
    const ip = clientIp(req);
    const recent = await db.one(
      "SELECT COUNT(*) AS c FROM audit_logs WHERE action = 'LOGIN_FAILED' AND ip_address = ? AND created_at >= ?",
      [ip, nowStr(addDays(0, new Date(Date.now() - 10 * 60 * 1000)))]
    );
    await audit(req, {
      action: 'LOGIN_FAILED',
      entity: 'auth',
      description: user && !user.is_active
        ? `Login blocked for disabled account ${email}`
        : `Failed login for ${email} - invalid ${user ? 'password' : 'credentials'}`,
      severity: recent && recent.c >= 4 ? 'critical' : 'warning',
    });
    throw new AppError(401, 'Invalid email or password');
  }

  await db.query('UPDATE users SET last_login_at = ? WHERE id = ?', [nowStr(), user.id]);
  const profile = await publicUser(user.id);
  await audit(req, { action: 'LOGIN', entity: 'auth', entityId: user.id, description: `${user.name} signed in as ${user.role}`, user });
  res.json({ token: signToken(user), user: profile });
}));

router.get('/me', authenticate, asyncHandler(async (req, res) => {
  res.json({ user: await publicUser(req.user.id) });
}));

router.post('/logout', authenticate, asyncHandler(async (req, res) => {
  await audit(req, { action: 'LOGOUT', entity: 'auth', entityId: req.user.id, description: `${req.user.name} signed out` });
  res.json({ message: 'Signed out' });
}));

router.put('/password', authenticate, asyncHandler(async (req, res) => {
  const body = z.object({
    current_password: z.string().min(1, 'Current password is required'),
    new_password: z.string().min(8, 'Use at least 8 characters').max(100)
      .regex(/[A-Z]/, 'Include an uppercase letter').regex(/[0-9]/, 'Include a number'),
  }).parse(req.body);
  const row = await db.one('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
  if (!(await bcrypt.compare(body.current_password, row.password_hash))) {
    throw new AppError(422, 'Current password is incorrect', { current_password: 'Incorrect password' });
  }
  await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(body.new_password, 10), req.user.id]);
  await audit(req, { action: 'PASSWORD_CHANGED', entity: 'auth', entityId: req.user.id, description: `${req.user.name} changed their password`, severity: 'warning' });
  res.json({ message: 'Password updated' });
}));

module.exports = router;
