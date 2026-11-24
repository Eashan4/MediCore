const mysql = require('mysql2/promise');
const env = require('./env');

// Align the MySQL session time zone with the Node process so NOW() and JS dates agree.
const offsetMin = -new Date().getTimezoneOffset();
const tz = `${offsetMin >= 0 ? '+' : '-'}${String(Math.floor(Math.abs(offsetMin) / 60)).padStart(2, '0')}:${String(Math.abs(offsetMin) % 60).padStart(2, '0')}`;

const pool = mysql.createPool({
  ...env.db,
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true, // DATE/DATETIME are returned as plain strings (no timezone surprises)
  decimalNumbers: true,
  charset: 'utf8mb4',
});

pool.pool.on('connection', (conn) => {
  conn.query(`SET time_zone = '${tz}'`);
});

/** Run a query and return the rows. */
async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

/** Run a query and return the first row (or null). */
async function one(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

/** Run fn inside a transaction; rolls back on error. fn receives a connection. */
async function transaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { pool, query, one, transaction };
