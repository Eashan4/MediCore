const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const env = require('./config/env');
const db = require('./config/db');
const { authenticate } = require('./middleware/auth');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: env.clientOrigin.split(',').map((s) => s.trim()), credentials: true }));
app.use(express.json({ limit: '1mb' }));
if (env.nodeEnv !== 'test') app.use(morgan('dev'));

app.get('/api/health', async (_req, res) => {
  try { await db.query('SELECT 1'); res.json({ status: 'ok', database: 'connected', time: new Date().toISOString() }); }
  catch { res.status(503).json({ status: 'degraded', database: 'unreachable' }); }
});

app.use('/api/auth', require('./routes/auth.routes'));

// Everything below requires a valid JWT. Role checks live inside each router (authorize(...)).
app.use('/api', authenticate);
app.use('/api/dashboard', require('./routes/dashboard.routes'));
app.use('/api/patients', require('./routes/patients.routes'));
app.use('/api/appointments', require('./routes/appointments.routes'));
app.use('/api/beds', require('./routes/beds.routes'));
app.use('/api/admissions', require('./routes/admissions.routes'));
app.use('/api/doctors', require('./routes/doctors.routes'));
app.use('/api/departments', require('./routes/departments.routes'));
app.use('/api/staff', require('./routes/staff.routes'));
app.use('/api/emergency', require('./routes/emergency.routes'));
app.use('/api/medicines', require('./routes/medicines.routes'));
app.use('/api/clinical', require('./routes/clinical.routes'));
app.use('/api/audit', require('./routes/audit.routes'));

app.use(notFound);
app.use(errorHandler);

// Only listen when run directly (node src/server.js); tests import `app` and bind their own port.
if (require.main === module) {
  (async () => {
    try {
      await db.query('SELECT 1');
    } catch (err) {
      console.error(`\nCould not connect to MySQL at ${env.db.host}:${env.db.port} (${err.code || err.message}).`);
      console.error('Check DB_* settings in backend/.env and make sure you ran:  npm run db:setup\n');
      process.exit(1);
    }
    app.listen(env.port, () => console.log(`MediCore API running on http://localhost:${env.port}`));
  })();
}

module.exports = app;
