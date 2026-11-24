import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, FileText, HeartPulse, Pill, Stethoscope } from 'lucide-react';
import { api } from '../api/client';
import { useDebounce, useFetch } from '../hooks';
import { Avatar, Badge, cx, EmptyState, ErrorState, FilterChip, Meta, PageHeader, Pagination, SearchInput, Skeleton, Tabs } from '../components/ui';
import { drName, fmtDate, fmtDateTime, fullName, titleCase } from '../lib/format';

function Prescriptions() {
  const [search, setSearch] = useState(''); const [status, setStatus] = useState(''); const [page, setPage] = useState(1); const [open, setOpen] = useState(null); const d = useDebounce(search, 300);
  useEffect(() => setPage(1), [d, status]);
  const { data, loading, error, reload } = useFetch(() => api.get('/clinical/prescriptions', { search: d, status, page, limit: 8 }), [d, status, page]);
  return (
    <>
      <div className="card mb-5 flex flex-wrap items-center gap-3 p-4"><div className="flex gap-2">{[['', 'All'], ['active', 'Active'], ['completed', 'Completed']].map(([k, l]) => <FilterChip key={l} active={status === k} onClick={() => setStatus(k)}>{l}</FilterChip>)}</div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search patient or medicine…" className="ml-auto w-full md:w-80" /></div>
      {error && !data ? <ErrorState error={error} onRetry={reload} /> : (
        <div className="space-y-3">
          {loading && !data && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 !rounded-2xl" />)}
          {data?.data.map((rx) => (
            <div key={rx.id} className="card overflow-hidden">
              <button type="button" aria-expanded={open === rx.id} onClick={() => setOpen(open === rx.id ? null : rx.id)} className="flex w-full flex-wrap items-center gap-4 p-4 text-left transition hover:bg-slate-50/60">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-navy-900 text-teal-300"><Pill size={19} /></span>
                <Avatar src={rx.photo_url} name={fullName(rx)} size={40} />
                <div className="min-w-[170px] flex-1"><p className="font-bold text-navy-900">{fullName(rx)}</p><p className="text-xs text-slate-500"><Meta wrap items={[rx.patient_code, `Rx #${rx.id}`, drName(rx.doctor_name)]} /></p><p className="mt-0.5 line-clamp-1 text-xs font-semibold text-teal-700 xl:hidden">{rx.items.map((i) => i.medicine_name).join(', ')}</p></div>
                <div className="hidden flex-wrap gap-1.5 xl:flex">{rx.items.slice(0, 3).map((i) => <Badge key={i.id} tone="teal">{i.medicine_name}</Badge>)}{rx.items.length > 3 && <Badge>+{rx.items.length - 3}</Badge>}</div>
                <span className="whitespace-nowrap text-xs font-semibold text-slate-400">{fmtDate(rx.created_at)}</span><Badge tone={rx.status === 'active' ? 'green' : 'slate'} dot={rx.status === 'active'}>{titleCase(rx.status)}</Badge>
                <ChevronDown size={18} className={cx('text-slate-400 transition-transform', open === rx.id && 'rotate-180')} />
              </button>
              {open === rx.id && (
                <div className="animate-fade-in border-t border-slate-100 bg-slate-50/50 p-4"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{rx.items.map((i) => (
                  <div key={i.id} className="rounded-xl border border-slate-200 bg-white p-3.5"><div className="flex items-center justify-between gap-2"><p className="font-bold text-navy-900">{i.medicine_name}</p><span className="rounded-md bg-teal-50 px-2 py-0.5 text-xs font-bold text-teal-700">{i.dosage}</span></div><p className="mt-1 text-xs text-slate-500"><Meta wrap items={[i.frequency, `${i.duration_days} days`, i.instructions]} /></p></div>))}</div>
                  {rx.notes && <p className="mt-3 text-sm italic text-slate-500">"{rx.notes}"</p>}<Link to={`/patients/${rx.patient_id}`} className="mt-3 inline-block text-sm font-bold text-teal-600 hover:underline">Open patient record</Link></div>)}
            </div>))}
          {data?.data.length === 0 && <div className="card"><EmptyState icon={Pill} title="No prescriptions found" text="Issue prescriptions from a patient's profile." /></div>}
        </div>)}
      {data && <div className="mt-5"><Pagination page={data.page} pages={data.pages} total={data.total} limit={data.limit} onChange={setPage} /></div>}
    </>
  );
}

function Diagnoses() {
  const [search, setSearch] = useState(''); const [page, setPage] = useState(1); const d = useDebounce(search, 300);
  useEffect(() => setPage(1), [d]);
  const { data, loading, error, reload } = useFetch(() => api.get('/clinical/records', { search: d, page, limit: 10 }), [d, page]);
  return (
    <>
      <div className="card mb-5 p-4"><SearchInput value={search} onChange={setSearch} placeholder="Search by patient or diagnosis…" className="w-full md:w-96" /></div>
      {error && !data ? <ErrorState error={error} onRetry={reload} /> : (
        <div className="space-y-3">
          {loading && !data && Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 !rounded-2xl" />)}
          {data?.data.map((r) => (
            <Link key={r.id} to={`/patients/${r.patient_id}`} className="card card-hover flex flex-wrap items-center gap-4 p-4">
              <Avatar src={r.photo_url} name={fullName(r)} size={46} />
              <div className="min-w-[200px] flex-1"><p className="text-base font-extrabold text-navy-900">{r.diagnosis}</p><p className="text-sm text-slate-500"><Meta wrap items={[fullName(r), r.patient_code]} /></p>{r.treatment && <p className="mt-1 line-clamp-1 text-xs text-slate-400">{r.treatment}</p>}</div>
              <div className="flex flex-wrap gap-1.5 text-xs font-bold">{r.bp_systolic && <span className="rounded-lg bg-slate-100 px-2 py-1 text-slate-600">BP {r.bp_systolic}/{r.bp_diastolic}</span>}{r.heart_rate && <span className="flex items-center gap-1 rounded-lg bg-rose-50 px-2 py-1 text-rose-600"><HeartPulse size={11} />{r.heart_rate}</span>}{r.spo2 && <span className="rounded-lg bg-blue-50 px-2 py-1 text-blue-600">SpO₂ {r.spo2}%</span>}</div>
              <div className="text-right"><Badge tone={r.visit_type === 'Inpatient' ? 'blue' : 'slate'}>{r.visit_type}</Badge><p className="mt-1 text-xs text-slate-400">{fmtDateTime(r.visit_date)}</p></div>
            </Link>))}
          {data?.data.length === 0 && <div className="card"><EmptyState icon={FileText} title="No diagnoses found" /></div>}
        </div>)}
      {data && <div className="mt-5"><Pagination page={data.page} pages={data.pages} total={data.total} limit={data.limit} onChange={setPage} /></div>}
    </>
  );
}

export default function Clinical() {
  const [tab, setTab] = useState('rx');
  return (
    <>
      <PageHeader icon={Stethoscope} title="Diagnoses & prescriptions" subtitle="Everything you've recorded, across all your patients" />
      <Tabs tabs={[{ id: 'rx', label: 'Prescriptions', icon: Pill }, { id: 'dx', label: 'Diagnoses', icon: FileText }]} value={tab} onChange={setTab} className="mb-6" />
      {tab === 'rx' ? <Prescriptions /> : <Diagnoses />}
    </>
  );
}
