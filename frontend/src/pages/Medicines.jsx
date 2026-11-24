import { useEffect, useState } from 'react';
import { AlertTriangle, CalendarX2, DollarSign, Minus, Package, Pencil, Pill, PackageX, Plus, Trash2, TrendingDown } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useDebounce, useFetch, useForm } from '../hooks';
import { Badge, Button, ConfirmModal, EmptyState, ErrorState, Field, FilterChip, IconButton, Input, Meta, Modal, PageHeader, Pagination, SearchInput, Select, Skeleton, StatCard, TableShell, Td, Th, cx } from '../components/ui';
import { fmtDate, money, toInputDate } from '../lib/format';

function MedicineForm({ open, onClose, med, categories, onSaved }) {
  const toast = useToast(); const f = useForm({}); const [busy, setBusy] = useState(false); const editing = !!med;
  useEffect(() => {
    if (!open) return; f.setErrors({});
    f.setValues(med ? { name: med.name, generic_name: med.generic_name || '', category: med.category, manufacturer: med.manufacturer || '', batch_no: med.batch_no || '', quantity: med.quantity, reorder_level: med.reorder_level, unit: med.unit, unit_price: med.unit_price, expiry_date: med.expiry_date }
      : { name: '', generic_name: '', category: '', manufacturer: '', batch_no: '', quantity: 100, reorder_level: 50, unit: 'tablets', unit_price: 1, expiry_date: '' });
    /* eslint-disable-next-line */
  }, [open, med]);
  const submit = async () => {
    const v = f.values; const e = {};
    if (v.name.trim().length < 2) e.name = 'Name is required'; if (!v.category.trim()) e.category = 'Category is required'; if (v.quantity === '' || Number(v.quantity) < 0) e.quantity = 'Enter a valid quantity'; if (!v.expiry_date) e.expiry_date = 'Select an expiry date';
    if (Object.keys(e).length) return f.setErrors(e);
    setBusy(true);
    try { editing ? await api.put(`/medicines/${med.id}`, v) : await api.post('/medicines', v); toast.success(editing ? 'Medicine updated' : 'Medicine added', v.name); onSaved(); onClose(); }
    catch (err) { f.setErrors(err.fields || {}); toast.error('Could not save medicine', err.message); } finally { setBusy(false); }
  };
  const E = f.errors;
  return (
    <Modal open={open} onClose={onClose} size="lg" icon={editing ? Pencil : Pill} title={editing ? 'Edit medicine' : 'Add medicine'} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={submit}>Save</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Brand / name" required error={E.name}><Input {...f.bind('name')} error={E.name} /></Field><Field label="Generic name"><Input {...f.bind('generic_name')} /></Field>
        <Field label="Category" required error={E.category}><Input list="cats" {...f.bind('category')} error={E.category} /><datalist id="cats">{categories.map((c) => <option key={c.category} value={c.category} />)}</datalist></Field>
        <Field label="Manufacturer"><Input {...f.bind('manufacturer')} /></Field>
        <Field label="Quantity in stock" required error={E.quantity}><Input type="number" min="0" {...f.bind('quantity')} error={E.quantity} /></Field>
        <Field label="Reorder level" hint="Alert when stock falls to this level"><Input type="number" min="0" {...f.bind('reorder_level')} /></Field>
        <Field label="Unit"><Select {...f.bind('unit')}>{['tablets', 'capsules', 'vials', 'ampoules', 'syringes', 'bags', 'sachets', 'inhalers', 'pens', 'bottles'].map((u) => <option key={u}>{u}</option>)}</Select></Field>
        <Field label="Unit price ($)"><Input type="number" min="0" step="0.01" {...f.bind('unit_price')} /></Field>
        <Field label="Batch number"><Input {...f.bind('batch_no')} /></Field><Field label="Expiry date" required error={E.expiry_date}><Input type="date" {...f.bind('expiry_date')} error={E.expiry_date} /></Field>
      </div>
    </Modal>
  );
}

function StockModal({ med, onClose, onSaved }) {
  const toast = useToast(); const [delta, setDelta] = useState(''); const [reason, setReason] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { setDelta(''); setReason(''); }, [med]);
  const apply = async (sign) => {
    const n = Number(delta); if (!n || n < 0) return toast.warning('Enter a quantity greater than 0');
    setBusy(true);
    try { const r = await api.patch(`/medicines/${med.id}/stock`, { delta: sign * n, reason }); toast.success(sign > 0 ? 'Stock added' : 'Stock removed', `${r.name}: ${r.quantity} ${r.unit} now in stock`); onSaved(); onClose(); }
    catch (e) { toast.error('Stock update failed', e.message); } finally { setBusy(false); }
  };
  return (
    <Modal open={!!med} onClose={onClose} size="sm" icon={Package} title="Adjust stock" subtitle={med ? `${med.name}, ${med.quantity} ${med.unit} in stock` : ''}>
      <div className="space-y-4"><Field label="Quantity"><Input type="number" min="1" value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="e.g. 100" autoFocus /></Field><Field label="Reason"><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Delivery received, dispensed, wastage…" /></Field>
        <div className="grid grid-cols-2 gap-3"><Button variant="dangerSoft" icon={Minus} loading={busy} onClick={() => apply(-1)}>Remove</Button><Button icon={Plus} loading={busy} onClick={() => apply(1)}>Add stock</Button></div></div>
    </Modal>
  );
}

export default function Medicines() {
  const { user } = useAuth(); const toast = useToast(); const isAdmin = user.role === 'admin';
  const [search, setSearch] = useState(''); const [stock, setStock] = useState(''); const [cat, setCat] = useState(''); const [sort, setSort] = useState('name'); const [page, setPage] = useState(1); const dSearch = useDebounce(search, 300);
  useEffect(() => setPage(1), [dSearch, stock, cat, sort]);
  const meta = useFetch(() => api.get('/medicines/meta'), []);
  const { data, loading, error, reload } = useFetch(() => api.get('/medicines', { search: dSearch, stock, category: cat, sort, page, limit: 12 }), [dSearch, stock, cat, sort, page]);
  const [form, setForm] = useState(false); const [edit, setEdit] = useState(null); const [adj, setAdj] = useState(null); const [del, setDel] = useState(null);
  const refresh = () => { reload(); meta.reload(); };
  const remove = async () => { try { await api.del(`/medicines/${del.id}`); toast.success('Medicine deleted', del.name); setDel(null); refresh(); } catch (e) { toast.error('Delete failed', e.message); setDel(null); } };
  const s = meta.data?.stats;

  return (
    <>
      <PageHeader icon={Pill} title={isAdmin ? 'Medicine inventory' : 'Medicine formulary'} subtitle={isAdmin ? 'Stock levels, expiry dates and low-stock alerts' : 'Check availability before prescribing'} actions={isAdmin && <Button icon={Plus} onClick={() => setForm(true)}>Add medicine</Button>} />
      {s && (s.low + s.out_of_stock > 0 || s.expired > 0) && (
        <div className="mb-6 flex animate-fade-up flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3.5 text-sm font-semibold text-amber-800"><AlertTriangle size={18} />
          {s.low + s.out_of_stock > 0 && <span>{s.low + s.out_of_stock} item{s.low + s.out_of_stock > 1 ? 's are' : ' is'} low or out of stock.</span>}{s.expired > 0 && <span>{s.expired} expired batch{s.expired > 1 ? 'es' : ''} need disposal.</span>}
          <button onClick={() => setStock('attention')} className="ml-auto font-bold underline-offset-2 hover:underline">Review items</button></div>)}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-5">
        <StatCard icon={Pill} label="Total items" value={s?.total ?? 0} sub="In the formulary" tone="teal" onClick={() => setStock('')} />
        <StatCard icon={TrendingDown} label="Low stock" value={s?.low ?? 0} sub="At or below reorder level" tone="amber" delay={50} onClick={() => setStock('low')} />
        <StatCard icon={PackageX} label="Out of stock" value={s?.out_of_stock ?? 0} sub="Zero units" tone="rose" delay={100} onClick={() => setStock('out')} />
        <StatCard icon={CalendarX2} label="Expiring within 90 days" value={s?.expiring ?? 0} sub={`${s?.expired ?? 0} already expired`} tone="blue" delay={150} onClick={() => setStock('expiring')} />
        <StatCard icon={DollarSign} label="Inventory value" value={money(s?.value ?? 0)} sub="At unit price" tone="navy" delay={200} />
      </div>

      <div className="card mb-5 flex flex-wrap items-center gap-3 p-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search medicine, generic or manufacturer…" className="w-full md:w-80" />
        <div className="w-48"><Select value={cat} onChange={(e) => setCat(e.target.value)}><option value="">All categories</option>{meta.data?.categories.map((c) => <option key={c.category} value={c.category}>{c.category} ({c.items})</option>)}</Select></div>
        <div className="w-40"><Select value={sort} onChange={(e) => setSort(e.target.value)}><option value="name">Name A-Z</option><option value="qty">Lowest stock</option><option value="expiry">Soonest expiry</option></Select></div>
        <div className="flex flex-wrap gap-2">{[['', 'All'], ['attention', 'Needs attention'], ['low', 'Low'], ['out', 'Out'], ['expiring', 'Expiring'], ['expired', 'Expired']].map(([k, l]) => <FilterChip key={l} active={stock === k} onClick={() => setStock(k)}>{l}</FilterChip>)}</div>
      </div>

      {error && !data ? <ErrorState error={error} onRetry={reload} /> : (
        <TableShell label="Medicines">
          <thead><tr><Th>Medicine</Th><Th className="hidden xl:table-cell">Category</Th><Th>Stock level</Th><Th>Expiry</Th><Th className="hidden xl:table-cell">Unit price</Th>{isAdmin && <Th className="text-right">Actions</Th>}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {loading && !data && Array.from({ length: 6 }).map((_, i) => <tr key={i}><Td colSpan={6}><Skeleton className="h-10 w-full" /></Td></tr>)}
            {data?.data.map((m) => {
              const pct = Math.min(100, Math.round((m.quantity / Math.max(m.reorder_level * 2, 1)) * 100)); const out = m.quantity === 0; const low = m.quantity <= m.reorder_level;
              const exp = m.days_to_expiry < 0 ? { t: 'red', l: `Expired ${-m.days_to_expiry}d ago` } : m.days_to_expiry <= 90 ? { t: 'amber', l: `${m.days_to_expiry} days left` } : { t: 'green', l: 'Good' };
              return (
                <tr key={m.id} className="transition hover:bg-teal-50/40">
                  <Td data-primary><div className="flex items-center gap-3"><span className={cx('grid h-10 w-10 place-items-center rounded-xl', out ? 'bg-rose-50 text-rose-500' : 'bg-teal-50 text-teal-600')}><Pill size={18} /></span><div className="min-w-0"><p className="font-bold text-navy-900">{m.name}</p><p className="text-xs text-slate-500"><Meta items={[m.generic_name, m.manufacturer && <span key="m" className="hidden xl:inline">{m.manufacturer}</span>]} /></p><p className="mt-0.5 text-[11px] font-semibold text-teal-700 xl:hidden">{m.category}</p></div></div></Td>
                  <Td data-skip className="hidden xl:table-cell"><Badge tone="navy">{m.category}</Badge></Td>
                  <Td data-wide label="Stock level"><div className="w-full max-w-[260px] sm:w-40 xl:w-48"><div className="mb-1.5 flex items-center justify-between text-xs"><span className="font-bold text-navy-800">{m.quantity.toLocaleString()} <span className="font-medium text-slate-400">{m.unit}</span></span>{out ? <Badge tone="red">Out of stock</Badge> : low ? <Badge tone="amber">Low</Badge> : <span className="font-semibold text-emerald-600">In stock</span>}</div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={cx('h-full rounded-full transition-all duration-700', out ? 'bg-rose-500' : low ? 'bg-amber-400' : 'bg-gradient-to-r from-teal-400 to-emerald-500')} style={{ width: `${Math.max(pct, 3)}%` }} /></div><p className="mt-1 text-xs text-slate-500">Reorder at {m.reorder_level}<span className="xl:hidden">, {money(m.unit_price, 2)} each</span></p></div></Td>
                  <Td label="Expiry"><p className="text-sm font-medium text-slate-700">{fmtDate(m.expiry_date)}</p><Badge tone={exp.t} className="mt-1">{exp.l}</Badge></Td>
                  <Td data-skip className="hidden font-semibold text-navy-800 xl:table-cell">{money(m.unit_price, 2)}</Td>
                  {isAdmin && <Td data-actions className="text-right"><div className="flex justify-end gap-1"><IconButton icon={Package} label="Adjust stock" onClick={() => setAdj(m)} /><IconButton icon={Pencil} label="Edit" onClick={() => setEdit(m)} /><IconButton icon={Trash2} label="Delete" className="hover:!bg-rose-50 hover:!text-rose-600" onClick={() => setDel(m)} /></div></Td>}
                </tr>);
            })}
            {data?.data.length === 0 && <tr><td colSpan={6}><EmptyState icon={Pill} title="No medicines match" text="Try a different filter or search term." /></td></tr>}
          </tbody>
        </TableShell>)}
      {data && <div className="mt-5"><Pagination page={data.page} pages={data.pages} total={data.total} limit={data.limit} onChange={setPage} /></div>}

      <MedicineForm open={form || !!edit} med={edit} categories={meta.data?.categories || []} onClose={() => { setForm(false); setEdit(null); }} onSaved={refresh} />
      <StockModal med={adj} onClose={() => setAdj(null)} onSaved={refresh} />
      <ConfirmModal open={!!del} onClose={() => setDel(null)} onConfirm={remove} title={`Delete ${del?.name}?`} message="Past prescriptions keep the medicine name, but it is removed from inventory." confirmText="Delete medicine" />
    </>
  );
}
