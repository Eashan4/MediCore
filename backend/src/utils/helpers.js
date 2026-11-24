class AppError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const p2 = (n) => String(n).padStart(2, '0');

/** Local "YYYY-MM-DD HH:mm:ss" string (matches the DB session time zone). */
function nowStr(d = new Date()) {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
}
const todayStr = (d = new Date()) => nowStr(d).slice(0, 10);
function addDays(n, from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() + n);
  return d;
}

/** Parse ?page=&limit= into safe values. */
function paging(q, defLimit = 20, maxLimit = 100) {
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(q.limit, 10) || defLimit));
  return { page, limit, offset: (page - 1) * limit };
}

/** Escape LIKE wildcards in user input. */
const like = (s) => `%${String(s).replace(/[\\%_]/g, '\\$&')}%`;

/** Convert "" / undefined to null for optional DB fields. */
const nn = (v) => (v === undefined || v === '' ? null : v);

module.exports = { AppError, asyncHandler, nowStr, todayStr, addDays, paging, like, nn };
