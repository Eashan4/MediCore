const jwt = require('jsonwebtoken');
const env = require('../config/env');
const db = require('../config/db');
const { AppError, asyncHandler } = require('../utils/helpers');
const { audit } = require('../utils/audit');

/** Verifies the Bearer token and loads the user (so deactivated accounts are cut off immediately). */
const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new AppError(401, 'Authentication required');

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    throw new AppError(401, 'Session expired or invalid. Please sign in again.');
  }

  const user = await db.one(
    `SELECT u.id, u.name, u.email, u.role, u.phone, u.avatar_url, u.is_active, d.id AS doctor_id
       FROM users u LEFT JOIN doctors d ON d.user_id = u.id WHERE u.id = ?`,
    [payload.id]
  );
  if (!user || !user.is_active) throw new AppError(401, 'Account is disabled or no longer exists');
  req.user = user;
  next();
});

/** Role-based access control. Usage: authorize('admin', 'receptionist') */
const authorize = (...roles) => async (req, _res, next) => {
  if (!req.user) return next(new AppError(401, 'Authentication required'));
  if (!roles.includes(req.user.role)) {
    await audit(req, {
      action: 'ACCESS_DENIED',
      entity: 'security',
      description: `${req.user.role} attempted ${req.method} ${req.originalUrl.split('?')[0]} (requires ${roles.join('/')})`,
      severity: 'warning',
    });
    return next(new AppError(403, 'You do not have permission to perform this action'));
  }
  next();
};

const signToken = (user) =>
  jwt.sign({ id: user.id, role: user.role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

module.exports = { authenticate, authorize, signToken };
