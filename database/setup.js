/**
 * MediCore database bootstrap.
 *   node ../database/setup.js            -> create database, tables and demo data (drops existing tables)
 *   node ../database/setup.js --schema   -> create database and tables only (no demo data)
 *   node ../database/setup.js --if-empty -> do nothing when the schema already exists (safe to run on every start)
 *
 * Reads connection settings from backend/.env (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME).
 */
const path = require('path');
const fs = require('fs');
const { createRequire } = require('module');

const backendDir = path.join(__dirname, '..', 'backend');
const req = createRequire(path.join(backendDir, 'package.json'));
req('dotenv').config({ path: path.join(backendDir, '.env') });
const mysql = req('mysql2/promise');
const bcrypt = req('bcryptjs');
const seed = require('./seed');

const schemaOnly = process.argv.includes('--schema');
const ifEmpty = process.argv.includes('--if-empty');

(async () => {
  const cfg = {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  };
  const dbName = process.env.DB_NAME || 'medicore';
  if (!/^[A-Za-z0-9_]+$/.test(dbName)) throw new Error('DB_NAME may only contain letters, numbers and underscores');

  console.log(`> Connecting to MySQL at ${cfg.host}:${cfg.port} as ${cfg.user} ...`);
  const conn = await mysql.createConnection({ ...cfg, multipleStatements: true });
  const offset = -new Date().getTimezoneOffset();
  const tz = `${offset >= 0 ? '+' : '-'}${String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0')}:${String(Math.abs(offset) % 60).padStart(2, '0')}`;
  await conn.query(`SET time_zone = '${tz}'`);

  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.query(`USE \`${dbName}\``);
  if (ifEmpty) {
    const [rows] = await conn.query("SHOW TABLES LIKE 'users'");
    if (rows.length) {
      console.log(`> Database "${dbName}" already initialised, nothing to do.`);
      await conn.end();
      return;
    }
  }
  console.log(`> Database "${dbName}" ready. Creating tables ...`);
  await conn.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

  if (!schemaOnly) {
    console.log('> Seeding realistic demo data (this takes a few seconds) ...');
    await seed(conn, { bcrypt });
  }
  await conn.end();
  console.log('\nAll done. Start the API with:  npm run dev   (inside /backend)');
  if (!schemaOnly) {
    console.log('\nDemo logins:');
    console.log('  Admin         admin@medicore.com      /  Admin@123');
    console.log('  Doctor        doctor@medicore.com     /  Doctor@123');
    console.log('  Receptionist  reception@medicore.com  /  Reception@123');
  }
})().catch((err) => {
  console.error('\nSetup failed:', err.message);
  if (err.code === 'ER_ACCESS_DENIED_ERROR') console.error('Check DB_USER / DB_PASSWORD in backend/.env');
  process.exit(1);
});
