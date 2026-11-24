import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BedDouble, ClipboardList, LogOut, Plus, UserRound } from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import { useDebounce, useFetch } from '../hooks';
import { Avatar, Badge, Button, EmptyState, ErrorState, Field, FilterChip, Meta, Modal, PageHeader, Pagination, SearchInput, Skeleton, StatCard, TableShell, Td, Textarea, Th } from '../components/ui';
import { AdmitModal } from './Beds';
import { drName, fmtDateTime, fullName, pluralize, titleCase } from '../lib/format';

export default function Admissions() {
  const toast = useToast(); const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState('admitted'); const [search, setSearch] = useState(''); const [page, setPage] = useState(1);
  const [admit, setAdmit] = useState(false); const [dis, setDis] = useState(null); const [notes, setNotes] = useState(''); const [cleaning, setCleaning] = useState(true); const [busy, setBusy] = useState(false);
  const dSearch = useDebounce(search, 300);
  useEffect(() => setPage(1), [status, dSearch]);
  useEffect(() => { if (params.get('new')) { setAdmit(true); setParams({}, { replace: true }); } /* eslint-disable-next-line */ }, []);
  const { data, loading, error, reload } = useFetch(() => api.get('/admissions', { status, search: dSearch, page, limit: 10 }), [status, dSearch, page], { interval: 30000 });

  const discharge = async () => {
    setBusy(true);
    try { await api.post(`/admissions/${dis.id}/discharge`, { notes, send_to_cleaning: cleaning }); toast.success('Patient discharged', `${fullName(dis)} left ${dis.bed_number}`); setDis(null); setNotes(''); reload(); }
    catch (e) { toast.error('Discharge failed', e.message); reload(); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader icon={ClipboardList} title="Admissions" subtitle="Admit patients to beds and manage discharges" actions={<Button icon={Plus} onClick={() => setAdmit(true)}>New admission</Button>} />
      <div className="mb-6 grid gap-5 sm:grid-cols-3">
        <StatCard icon={BedDouble} label="Currently admitted" value={data?.stats.current ?? 0} sub="Active inpatients" tone="blue" />
        <StatCard icon={Plus} label="Admitted today" value={data?.stats.today ?? 0} sub="New admissions" tone="teal" delay={60} />
        <StatCard icon={LogOut} label="Discharged today" value={data?.stats.discharged_today ?? 0} sub="Beds released" tone="emerald" delay={120} />
      </div>

      <div className="card mb-5 flex flex-wrap items-center gap-3 p-4">
        <div className="flex gap-2">{[['admitted', 'Current'], ['discharged', 'Discharged'], ['', 'All']].map(([k, l]) => <FilterChip key={l} active={status === k} onClick={() => setStatus(k)}>{l}</FilterChip>)}</div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search patient, ID or bed…" className="ml-auto w-full md:w-72" />
      </div>

      {error && !data ? <ErrorState error={error} onRetry={reload} /> : (
        <TableShell label="Admissions">
          <thead><tr><Th>Patient</Th><Th>Ward / bed</Th><Th className="hidden xl:table-cell">Doctor</Th><Th>Admitted</Th><Th className="hidden xl:table-cell">Stay</Th><Th className="hidden xl:table-cell">Status</Th><Th className="text-right">Action</Th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {loading && !data && Array.from({ length: 5 }).map((_, i) => <tr key={i}><Td colSpan={7}><Skeleton className="h-10 w-full" /></Td></tr>)}
            {data?.data.map((a) => (
              <tr key={a.id} className="transition hover:bg-teal-50/40">
                <Td data-primary><Link to={`/patients/${a.patient_id}`} className="flex items-center gap-3"><Avatar src={a.photo_url} name={fullName(a)} size={40} /><div className="whitespace-nowrap"><p className="font-bold text-navy-900 hover:text-teal-700">{fullName(a)}</p><p className="text-xs text-slate-500"><Meta items={[a.patient_code, `${a.age}y`, <span key="g" className="hidden xl:inline">{titleCase(a.gender)}</span>]} /></p></div></Link></Td>
                <Td label="Ward and bed" className="whitespace-nowrap"><p className="font-bold text-navy-800">{a.bed_number}</p><p className="text-xs text-slate-500">{a.ward_name}</p></Td>
                <Td label="Doctor" className="hidden xl:table-cell">{a.doctor_name ? <div className="flex items-center gap-2"><Avatar src={a.doctor_avatar} name={a.doctor_name} size={28} /><span className="whitespace-nowrap text-sm text-slate-700">{drName(a.doctor_name)}</span></div> : <span className="text-xs text-slate-400">Unassigned</span>}</Td>
                <Td label="Admitted"><p className="whitespace-nowrap text-sm text-slate-700">{fmtDateTime(a.admitted_at)}</p><p className="max-w-[150px] truncate text-xs text-slate-500 xl:max-w-[200px]"><span className="font-semibold xl:hidden">{pluralize(a.days, 'day')}{a.reason ? ', ' : ''}</span>{a.reason}</p></Td>
                <Td data-skip className="hidden whitespace-nowrap xl:table-cell"><Badge tone="slate">{pluralize(a.days, 'day')}</Badge></Td>
                <Td label="Status" className="hidden xl:table-cell">{a.status === 'admitted' ? <Badge tone="blue" dot pulse>Admitted</Badge> : <Badge tone="green">Discharged</Badge>}</Td>
                <Td data-actions className="text-right">{a.status === 'admitted' ? <Button size="xs" variant="dangerSoft" icon={LogOut} onClick={() => { setDis(a); setNotes(''); }}>Discharge</Button> : <span className="text-xs text-slate-400">{fmtDateTime(a.discharged_at)}</span>}</Td>
              </tr>))}
            {data && data.data.length === 0 && <tr><td colSpan={7}><EmptyState icon={ClipboardList} title="No admissions found" text="Nothing matches the current filters." /></td></tr>}
          </tbody>
        </TableShell>)}
      {data && <div className="mt-5"><Pagination page={data.page} pages={data.pages} total={data.total} limit={data.limit} onChange={setPage} /></div>}

      <AdmitModal open={admit} onClose={() => setAdmit(false)} onDone={reload} />
      <Modal open={!!dis} onClose={() => setDis(null)} size="sm" icon={LogOut} title="Discharge patient" subtitle={dis ? `${fullName(dis)}, ${dis.ward_name} ${dis.bed_number}` : ''}
        footer={<><Button variant="outline" onClick={() => setDis(null)}>Cancel</Button><Button variant="danger" loading={busy} onClick={discharge}>Confirm discharge</Button></>}>
        <div className="space-y-4"><Field label="Discharge notes"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Condition at discharge, follow-up plan…" /></Field>
          <label className="flex cursor-pointer items-center gap-3 text-sm font-medium text-slate-700"><input type="checkbox" checked={cleaning} onChange={(e) => setCleaning(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-teal-600" /> Send bed for cleaning before reuse</label></div>
      </Modal>
    </>
  );
}
