import { useEffect, useRef, useState } from 'react';
import { Loader2, Search, UserPlus, X } from 'lucide-react';
import { api } from '../../api/client';
import { useClickOutside, useDebounce } from '../../hooks';
import { fullName } from '../../lib/format';
import { Avatar, Meta, Select, cx } from './index';

/* ---- cached lookups (doctors / departments change rarely) ---- */
let doctorsCache = null; let deptCache = null;
export const invalidateLookups = () => { doctorsCache = null; deptCache = null; };
export function useDoctors() {
  const [list, setList] = useState(doctorsCache || []);
  useEffect(() => {
    if (doctorsCache) return;
    api.get('/doctors').then((d) => { doctorsCache = d; setList(d); }).catch(() => {});
  }, []);
  return list;
}
export function useDepartments() {
  const [list, setList] = useState(deptCache || []);
  useEffect(() => {
    if (deptCache) return;
    api.get('/departments').then((d) => { deptCache = d; setList(d); }).catch(() => {});
  }, []);
  return list;
}

export function DoctorSelect({ value, onChange, error, placeholder = 'Select doctor', onlyActive = true, allowEmpty = true, ...p }) {
  const doctors = useDoctors();
  const list = onlyActive ? doctors.filter((d) => d.status === 'active' || d.id === Number(value)) : doctors;
  return (
    <Select value={value ?? ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : '')} error={error} {...p}>
      {allowEmpty && <option value="">{placeholder}</option>}
      {list.map((d) => <option key={d.id} value={d.id}>Dr. {d.name}, {d.specialization}</option>)}
    </Select>
  );
}

export function DepartmentSelect({ value, onChange, error, placeholder = 'Select department', ...p }) {
  const list = useDepartments();
  return (
    <Select value={value ?? ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : '')} error={error} {...p}>
      <option value="">{placeholder}</option>
      {list.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
    </Select>
  );
}

/* ---- async patient search select ---- */
export function PatientPicker({ value, onChange, error, placeholder = 'Search patient by name, ID or phone…', disabled, excludeAdmitted }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);
  const dq = useDebounce(q, 250);
  useClickOutside(ref, () => setOpen(false), open);

  useEffect(() => {
    if (!open) return undefined;
    let live = true;
    setLoading(true);
    api.get('/patients', { search: dq, limit: 8, sort: 'name', status: excludeAdmitted ? 'outpatient' : undefined })
      .then((r) => { if (live) setResults(r.data); })
      .catch(() => { if (live) setResults([]); })
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [dq, open, excludeAdmitted]);

  if (value) {
    return (
      <div className={cx('flex items-center gap-3 rounded-xl border bg-white p-2 pr-3', error ? 'border-rose-400' : 'border-slate-200')}>
        <Avatar src={value.photo_url} name={fullName(value)} size={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-navy-900">{fullName(value)}</p>
          <p className="truncate text-xs text-slate-500"><Meta items={[value.patient_code, value.age != null && `${value.age}y`, value.gender]} /></p>
        </div>
        {!disabled && <button type="button" onClick={() => { onChange(null); setQ(''); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Clear patient"><X size={16} /></button>}
      </div>
    );
  }
  return (
    <div ref={ref} className="relative">
      <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
      <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder={placeholder} disabled={disabled}
        className={cx('input pl-10', error && 'input-error')} />
      {loading && <Loader2 size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />}
      {open && (
        <div className="absolute z-30 mt-2 max-h-72 w-full animate-pop overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-lift">
          {results.length === 0 && !loading && <p className="flex items-center gap-2 px-3 py-4 text-sm text-slate-500"><UserPlus size={16} /> No matching patients{excludeAdmitted ? ' (admitted patients are hidden)' : ''}</p>}
          {results.map((p) => (
            <button type="button" key={p.id} onClick={() => { onChange(p); setOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-teal-50">
              <Avatar src={p.photo_url} name={fullName(p)} size={34} />
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-navy-900">{fullName(p)}</p><p className="truncate text-xs text-slate-500"><Meta items={[p.patient_code, `${p.age}y`, p.phone]} /></p></div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---- Recharts tooltip ---- */
export function ChartTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 px-3.5 py-2.5 text-xs shadow-lift backdrop-blur">
      {label != null && <p className="mb-1.5 font-bold text-navy-900">{label}</p>}
      {payload.filter((p) => p.value != null).map((p) => (
        <p key={p.dataKey || p.name} className="flex items-center gap-2 py-0.5 text-slate-600">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.fill || p.stroke }} />
          <span>{p.name}</span><b className="ml-auto pl-4 text-navy-900">{formatter ? formatter(p.value, p) : p.value}</b>
        </p>
      ))}
    </div>
  );
}
