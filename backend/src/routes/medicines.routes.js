const router = require('express').Router();
const { z } = require('zod');
const db = require('../config/db');
const { authorize } = require('../middleware/auth');
const { AppError, asyncHandler, paging, like, nn, todayStr, addDays } = require('../utils/helpers');
const { audit } = require('../utils/audit');

const schema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(120),
  generic_name: z.string().trim().max(120).nullish(),
  category: z.string().trim().min(2, 'Category is required').max(60),
  manufacturer: z.string().trim().max(120).nullish(),
  batch_no: z.string().trim().max(40).nullish(),
  quantity: z.preprocess((v) => Number(v), z.number({ invalid_type_error: 'Enter a number' }).int().min(0, 'Cannot be negative').max(10000000)),
  reorder_level: z.preprocess((v) => Number(v ?? 50), z.number().int().min(0).max(10000000)),
  unit: z.string().trim().min(1).max(20).default('tablets'),
  unit_price: z.preprocess((v) => Number(v || 0), z.number().min(0).max(100000)),
  expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Select an expiry date'),
});

router.get('/', authorize('admin', 'doctor'), asyncHandler(async (req, res) => {
  const { page, limit, offset } = paging(req.query, 15, 200);
  const where = []; const params = [];
  if (req.query.search) { const s = like(req.query.search.trim()); where.push('(name LIKE ? OR generic_name LIKE ? OR manufacturer LIKE ?)'); params.push(s, s, s); }
  if (req.query.category) { where.push('category = ?'); params.push(req.query.category); }
  const today = todayStr(); const soon = todayStr(addDays(90));
  switch (req.query.stock) {
    case 'low': where.push('quantity > 0 AND quantity <= reorder_level'); break;
    case 'out': where.push('quantity = 0'); break;
    case 'expiring': where.push('expiry_date >= ? AND expiry_date <= ?'); params.push(today, soon); break;
    case 'expired': where.push('expiry_date < ?'); params.push(today); break;
    case 'attention': where.push('(quantity <= reorder_level OR expiry_date <= ?)'); params.push(soon); break;
    default: break;
  }
  const W = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [{ total }] = await db.query(`SELECT COUNT(*) AS total FROM medicines ${W}`, params);
  const data = await db.query(
    `SELECT *, DATEDIFF(expiry_date, ?) AS days_to_expiry, (quantity <= reorder_level) AS is_low FROM medicines ${W}
      ORDER BY ${req.query.sort === 'qty' ? 'quantity ASC' : req.query.sort === 'expiry' ? 'expiry_date ASC' : 'name ASC'} LIMIT ? OFFSET ?`,
    [today, ...params, limit, offset]);
  res.json({ data, total, page, limit, pages: Math.ceil(total / limit) });
}));

router.get('/meta', authorize('admin', 'doctor'), asyncHandler(async (_req, res) => {
  const today = todayStr(); const soon = todayStr(addDays(90));
  const [s] = await db.query(
    `SELECT COUNT(*) AS total, SUM(quantity > 0 AND quantity <= reorder_level) AS low, SUM(quantity = 0) AS out_of_stock,
            SUM(expiry_date >= ? AND expiry_date <= ?) AS expiring, SUM(expiry_date < ?) AS expired, ROUND(SUM(quantity * unit_price), 2) AS value
       FROM medicines`, [today, soon, today]);
  const categories = await db.query('SELECT category, COUNT(*) AS items FROM medicines GROUP BY category ORDER BY category');
  res.json({ stats: { total: +s.total, low: +s.low || 0, out_of_stock: +s.out_of_stock || 0, expiring: +s.expiring || 0, expired: +s.expired || 0, value: +s.value || 0 }, categories });
}));

router.get('/search', authorize('admin', 'doctor'), asyncHandler(async (req, res) => {
  const s = like((req.query.q || '').trim());
  res.json(await db.query('SELECT id, name, generic_name, quantity, unit, expiry_date FROM medicines WHERE name LIKE ? OR generic_name LIKE ? ORDER BY name LIMIT 12', [s, s]));
}));

router.post('/', authorize('admin'), asyncHandler(async (req, res) => {
  const b = schema.parse(req.body);
  const [r] = await db.pool.query(
    'INSERT INTO medicines (name, generic_name, category, manufacturer, batch_no, quantity, reorder_level, unit, unit_price, expiry_date) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [b.name, nn(b.generic_name), b.category, nn(b.manufacturer), nn(b.batch_no), b.quantity, b.reorder_level, b.unit, b.unit_price, b.expiry_date]);
  await audit(req, { action: 'MEDICINE_CREATED', entity: 'medicine', entityId: r.insertId, description: `Added medicine ${b.name} (${b.quantity} ${b.unit})` });
  res.status(201).json(await db.one('SELECT * FROM medicines WHERE id = ?', [r.insertId]));
}));

router.put('/:id', authorize('admin'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const b = schema.parse(req.body);
  const r = await db.pool.query(
    'UPDATE medicines SET name=?, generic_name=?, category=?, manufacturer=?, batch_no=?, quantity=?, reorder_level=?, unit=?, unit_price=?, expiry_date=? WHERE id=?',
    [b.name, nn(b.generic_name), b.category, nn(b.manufacturer), nn(b.batch_no), b.quantity, b.reorder_level, b.unit, b.unit_price, b.expiry_date, id]);
  if (!r[0].affectedRows) throw new AppError(404, 'Medicine not found');
  await audit(req, { action: 'MEDICINE_UPDATED', entity: 'medicine', entityId: id, description: `Updated medicine ${b.name}` });
  res.json(await db.one('SELECT * FROM medicines WHERE id = ?', [id]));
}));

// Quick stock adjustment (+/-)
router.patch('/:id/stock', authorize('admin'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const b = z.object({ delta: z.preprocess(Number, z.number().int().min(-1000000).max(1000000)), reason: z.string().trim().max(200).nullish() }).parse(req.body);
  const out = await db.transaction(async (conn) => {
    const [[m]] = await conn.query('SELECT id, name, quantity, unit FROM medicines WHERE id = ? FOR UPDATE', [id]);
    if (!m) throw new AppError(404, 'Medicine not found');
    if (m.quantity + b.delta < 0) throw new AppError(409, `Only ${m.quantity} ${m.unit} in stock - cannot remove ${Math.abs(b.delta)}`);
    await conn.query('UPDATE medicines SET quantity = quantity + ? WHERE id = ?', [b.delta, id]);
    return m;
  });
  await audit(req, { action: 'MEDICINE_STOCK_ADJUSTED', entity: 'medicine', entityId: id, description: `${out.name}: stock ${b.delta > 0 ? '+' : ''}${b.delta}${b.reason ? ` (${b.reason})` : ''}` });
  res.json(await db.one('SELECT *, (quantity <= reorder_level) AS is_low FROM medicines WHERE id = ?', [id]));
}));

router.delete('/:id', authorize('admin'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const m = await db.one('SELECT name FROM medicines WHERE id = ?', [id]);
  if (!m) throw new AppError(404, 'Medicine not found');
  await db.query('DELETE FROM medicines WHERE id = ?', [id]); // prescription_items.medicine_id -> SET NULL
  await audit(req, { action: 'MEDICINE_DELETED', entity: 'medicine', entityId: id, description: `Deleted medicine ${m.name}`, severity: 'warning' });
  res.json({ message: 'Medicine deleted' });
}));

module.exports = router;
