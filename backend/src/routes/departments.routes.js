const router = require('express').Router();
const { z } = require('zod');
const db = require('../config/db');
const { authorize } = require('../middleware/auth');
const { AppError, asyncHandler, nn } = require('../utils/helpers');
const { audit } = require('../utils/audit');

const schema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(100),
  description: z.string().trim().max(1000).nullish(),
  image_url: z.string().trim().max(500).nullish(),
  icon: z.string().trim().max(40).nullish(),
  color: z.string().trim().max(20).nullish(),
  floor: z.string().trim().max(20).nullish(),
});

const SELECT = `
  SELECT dep.*, (SELECT COUNT(*) FROM doctors d WHERE d.department_id = dep.id) AS doctors,
         (SELECT COUNT(*) FROM staff s WHERE s.department_id = dep.id) AS staff
    FROM departments dep`;

router.get('/', authorize('admin', 'receptionist', 'doctor'), asyncHandler(async (_req, res) => {
  res.json(await db.query(`${SELECT} ORDER BY dep.name`));
}));

router.post('/', authorize('admin'), asyncHandler(async (req, res) => {
  const b = schema.parse(req.body);
  const [r] = await db.pool.query('INSERT INTO departments (name, description, image_url, icon, color, floor) VALUES (?,?,?,?,?,?)',
    [b.name, nn(b.description), nn(b.image_url), nn(b.icon) || 'Stethoscope', nn(b.color) || '#0d9488', nn(b.floor)]);
  await audit(req, { action: 'DEPARTMENT_CREATED', entity: 'department', entityId: r.insertId, description: `Created department ${b.name}` });
  res.status(201).json(await db.one(`${SELECT} WHERE dep.id = ?`, [r.insertId]));
}));

router.put('/:id', authorize('admin'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const b = schema.parse(req.body);
  const r = await db.pool.query('UPDATE departments SET name=?, description=?, image_url=COALESCE(?, image_url), icon=COALESCE(?, icon), color=COALESCE(?, color), floor=? WHERE id=?',
    [b.name, nn(b.description), nn(b.image_url), nn(b.icon), nn(b.color), nn(b.floor), id]);
  if (!r[0].affectedRows) throw new AppError(404, 'Department not found');
  await audit(req, { action: 'DEPARTMENT_UPDATED', entity: 'department', entityId: id, description: `Updated department ${b.name}` });
  res.json(await db.one(`${SELECT} WHERE dep.id = ?`, [id]));
}));

router.delete('/:id', authorize('admin'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const dep = await db.one('SELECT name FROM departments WHERE id = ?', [id]);
  if (!dep) throw new AppError(404, 'Department not found');
  const used = await db.one('SELECT COUNT(*) AS c FROM doctors WHERE department_id = ?', [id]);
  if (used.c > 0) throw new AppError(409, `${dep.name} still has ${used.c} doctor(s). Reassign them first.`);
  await db.query('DELETE FROM departments WHERE id = ?', [id]);
  await audit(req, { action: 'DEPARTMENT_DELETED', entity: 'department', entityId: id, description: `Deleted department ${dep.name}`, severity: 'warning' });
  res.json({ message: 'Department deleted' });
}));

module.exports = router;
