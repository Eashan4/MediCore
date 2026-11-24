const { ZodError } = require('zod');
const { AppError } = require('../utils/helpers');

const notFound = (req, _res, next) => next(new AppError(404, `Route not found: ${req.method} ${req.originalUrl}`));

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    const fields = {};
    err.issues.forEach((i) => { fields[i.path.join('.') || '_'] = i.message; });
    return res.status(422).json({ message: 'Please check the highlighted fields', fields });
  }
  if (err instanceof AppError) {
    return res.status(err.status).json({ message: err.message, ...(err.details ? { fields: err.details } : {}) });
  }
  // MySQL errors -> friendly messages
  if (err && err.code === 'ER_DUP_ENTRY') {
    const m = /for key '(?:\w+\.)?(\w+)'/.exec(err.message);
    const key = m ? m[1] : '';
    if (key === 'uq_adm_active_bed') return res.status(409).json({ message: 'This bed is already occupied by another patient' });
    if (key === 'uq_adm_active_patient') return res.status(409).json({ message: 'This patient is already admitted to a bed' });
    if (key === 'uq_users_email') return res.status(409).json({ message: 'That email address is already in use', fields: { email: 'Already in use' } });
    return res.status(409).json({ message: 'A record with the same unique value already exists' });
  }
  if (err && (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED')) {
    return res.status(409).json({ message: 'This record is linked to other data and cannot be deleted. Consider deactivating it instead.' });
  }
  if (err && err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(422).json({ message: 'A selected patient, doctor or related record does not exist' });
  }
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Malformed JSON body' });
  }
  console.error('[error]', err);
  res.status(500).json({ message: 'Something went wrong on the server' });
};

module.exports = { notFound, errorHandler };
