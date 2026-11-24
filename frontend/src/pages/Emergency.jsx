import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Ambulance, BedDouble, CheckCircle2, Clock, Footprints, Pencil, Phone, Plus, Siren, Stethoscope, Trash2, UserCheck, XCircle, Share2 } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useDebounce, useFetch, useForm } from '../hooks';
import { Avatar, Badge, Button, ConfirmModal, cx, EmptyState, ErrorState, Field, FilterChip, IconButton, Input, Meta, Modal, PageHeader, Pagination, SearchInput, Select, Skeleton, StatCard, Textarea } from '../components/ui';
import { DoctorSelect, PatientPicker } from '../components/ui/pickers';
import { EMG_STATUS, URGENCY } from '../lib/constants';
import { drName, duration, fmtDateTime, fullName, titleCase } from '../lib/format';

const MODE_ICON = { ambulance: Ambulance, walk_in: Footprints, referral: Share2 };

function EmergencyForm({ open, onClose, item, onSaved }) {
  const toast = useToast(); const f = useForm({}); const [busy, setBusy] = useState(false); const [linked, setLinked] = useState(null); const editing = !!item;
  useEffect(() => {
    if (!open) return; f.setErrors({}); setLinked(null);
    f.setValues(item ? { patient_name: item.patient_name, age: item.age ?? '', gender: item.gender, phone: item.phone || '', condition_desc: item.condition_desc, urgency: item.urgency, arrival_mode: item.arrival_mode, assigned_doctor_id: item.assigned_doctor_id || '', notes: item.notes || '' }
      : { patient_name: '', age: '', gender: 'male', phone: '', condition_desc: '', urgency: 'high', arrival_mode: 'ambulance', assigned_doctor_id: '', notes: '' });
    /* eslint-disable-next-line */
  }, [open, item]);
  const link = (p) => { setLinked(p); if (p) f.setValues((v) => ({ ...v, patient_name: fullName(p), age: p.age, gender: p.gender, phone: p.phone || '', assigned_doctor_id: v.assigned_doctor_id || p.assigned_doctor_id || '' })); };
  const submit = async () => {
    const e = {}; if (f.values.patient_name.trim().length < 2) e.patient_name = 'Enter the patient name'; if (f.values.condition_desc.trim().length < 5) e.condition_desc = 'Describe the condition';
    if (Object.keys(e).length) return f.setErrors(e);
    setBusy(true);
    try { const body = { ...f.values, patient_id: linked?.id, assigned_doctor_id: f.values.assigned_doctor_id || undefined }; const r = editing ? await api.put(`/emergency/${item.id}`, body) : await api.post('/emergency', body); toast.success(editing ? 'Request updated' : 'Emergency request submitted', `${r.request_code}, ${titleCase(r.urgency)} priority`); onSaved(); onClose(); }
    catch (err) { f.setErrors(err.fields || {}); toast.error('Could not save request', err.message); } finally { setBusy(false); }
  };
  const E = f.errors;
  return (
    <Modal open={open} onClose={onClose} size="lg" icon={Siren} title={editing ? 'Edit emergency request' : 'New emergency admission request'} subtitle="Set the urgency so the team can triage correctly"
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant="danger" loading={busy} icon={Siren} onClick={submit}>{editing ? 'Save changes' : 'Submit request'}</Button></>}>
      <div className="space-y-5">
        <div>
          <p id="urgency-label" className="label">Urgency level</p>
          <div role="group" aria-labelledby="urgency-label" className="grid grid-cols-2 gap-3 sm:grid-cols-4">{Object.entries(URGENCY).map(([k, u]) => (
            <button key={k} type="button" aria-pressed={f.values.urgency === k} onClick={() => f.set('urgency', k)} className={cx('rounded-2xl border-2 p-3 text-left transition-all', f.values.urgency === k ? 'border-navy-900 bg-navy-50 shadow-soft' : 'border-slate-200 hover:border-slate-300')}>
              <span className={cx('mb-2 block h-1.5 w-8 rounded-full', u.bar)} /><p className="text-sm font-extrabold text-navy-900">{u.label}</p><p className="text-[11px] text-slate-500">{{ critical: 'Life-threatening', high: 'Urgent, < 15 min', medium: 'Needs care soon', low: 'Non-urgent' }[k]}</p></button>))}</div>
        </div>
        {!editing && <Field label="Link existing patient (optional)"><PatientPicker value={linked} onChange={link} placeholder="Search registered patients…" /></Field>}
        <div className="grid gap-4 sm:grid-cols-6">
          <Field label="Patient name" required error={E.patient_name} className="sm:col-span-3"><Input {...f.bind('patient_name')} error={E.patient_name} placeholder="Full name or 'Unknown male'" /></Field>
          <Field label="Age" className="sm:col-span-1"><Input type="number" min="0" max="120" {...f.bind('age')} /></Field>
          <Field label="Gender" className="sm:col-span-2"><Select {...f.bind('gender')}><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></Select></Field>
          <Field label="Condition / presenting complaint" required error={E.condition_desc} className="sm:col-span-6"><Textarea {...f.bind('condition_desc')} error={E.condition_desc} placeholder="e.g. Severe chest pain with sweating" /></Field>
          <Field label="Arrival mode" className="sm:col-span-2"><Select {...f.bind('arrival_mode')}><option value="ambulance">Ambulance</option><option value="walk_in">Walk-in</option><option value="referral">Referral</option></Select></Field>
          <Field label="Contact phone" className="sm:col-span-2"><Input {...f.bind('phone')} /></Field>
          <Field label="Assign doctor" className="sm:col-span-2"><DoctorSelect value={f.values.assigned_doctor_id} onChange={(v) => f.set('assigned_doctor_id', v)} placeholder="Assign later" /></Field>
        </div>
      </div>
    </Modal>
  );
}

function AdmitEmergency({ item, onClose, onDone }) {
  const toast = useToast(); const [bedId, setBedId] = useState(''); const [doctorId, setDoctorId] = useState(''); const [busy, setBusy] = useState(false);
  const { data: beds, loading } = useFetch(() => api.get('/beds/available'), [!!item], { enabled: !!item });
  useEffect(() => { setBedId(''); setDoctorId(item?.assigned_doctor_id || ''); }, [item]);
  const wards = [...new Set((beds || []).map((b) => b.ward_name))];
  const go = async () => {
    if (!bedId) return toast.warning('Choose a bed first');
    setBusy(true);
    try { const r = await api.post(`/emergency/${item.id}/admit`, { bed_id: bedId, doctor_id: doctorId || undefined }); toast.success('Patient admitted', r.message); onDone(); onClose(); }
    catch (e) { toast.error('Admission failed', e.message); } finally { setBusy(false); }
  };
  return (
    <Modal open={!!item} onClose={onClose} size="md" icon={BedDouble} title="Admit to a bed" subtitle={item ? `${item.patient_name}, ${item.request_code}` : ''} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={go}>Admit patient</Button></>}>
      <div className="space-y-5"><p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">If the patient isn't registered yet, a patient record is created automatically from this request.</p>
        <Field label="Attending doctor"><DoctorSelect value={doctorId} onChange={setDoctorId} /></Field>
        <Field label="Available bed" required>{loading ? <Skeleton className="h-20 w-full" /> : (
          <div className="max-h-64 space-y-3 overflow-y-auto rounded-xl border border-slate-200 p-3">{wards.map((w) => <div key={w}><p className="mb-1.5 text-xs font-semibold text-slate-500">{w}</p><div className="flex flex-wrap gap-2">{beds.filter((b) => b.ward_name === w).map((b) => <button key={b.id} type="button" aria-pressed={bedId === b.id} onClick={() => setBedId(b.id)} className={cx('rounded-xl border px-3 py-2 text-sm font-bold transition', bedId === b.id ? 'border-teal-600 bg-teal-600 text-white shadow-soft' : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-400')}>{b.bed_number}</button>)}</div></div>)}{wards.length === 0 && <p className="py-4 text-center text-sm text-slate-500">No beds available right now</p>}</div>)}</Field></div>
    </Modal>
  );
}

export default function Emergency() {
  const { user } = useAuth(); const toast = useToast(); const [params, setParams] = useSearchParams();
  const canCreate = user.role !== 'doctor'; const isAdmin = user.role === 'admin'; const isDoc = user.role === 'doctor';
  const [status, setStatus] = useState('active'); const [urgency, setUrgency] = useState(''); const [search, setSearch] = useState(''); const [page, setPage] = useState(1);
  const dSearch = useDebounce(search, 300);
  const [form, setForm] = useState(params.get('new') === '1'); const [edit, setEdit] = useState(null); const [admit, setAdmit] = useState(null); const [del, setDel] = useState(null);
  useEffect(() => { if (params.get('new')) setParams({}, { replace: true }); /* eslint-disable-next-line */ }, []);
  useEffect(() => setPage(1), [status, urgency, dSearch]);
  const { data, loading, error, reload } = useFetch(() => api.get('/emergency', { status: status === 'all' ? '' : status, urgency, search: dSearch, page, limit: 12 }), [status, urgency, dSearch, page], { interval: 15000 });

  const setSt = async (e, s, msg) => { try { await api.patch(`/emergency/${e.id}/status`, { status: s }); toast.success(msg, e.patient_name); reload(); } catch (err) { toast.error('Update failed', err.message); } };
  const remove = async () => { try { await api.del(`/emergency/${del.id}`); toast.success('Request deleted'); setDel(null); reload(); } catch (e) { toast.error('Delete failed', e.message); } };
  const st = data?.stats;

  return (
    <>
      <PageHeader icon={Siren} title="Emergency management" subtitle="Admission requests, triage levels and live status tracking" actions={canCreate && <Button variant="danger" icon={Plus} onClick={() => setForm(true)}>New emergency request</Button>} />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-4">
        <StatCard icon={Siren} label="Active cases" value={st?.active ?? 0} sub="Pending or in treatment" tone="rose" />
        <StatCard icon={Clock} label="Awaiting doctor" value={st?.pending ?? 0} sub="Not yet picked up" tone="amber" delay={60} />
        <StatCard icon={Siren} label="Critical now" value={st?.critical ?? 0} sub="Life-threatening" tone="rose" delay={120} />
        <StatCard icon={CheckCircle2} label="Received today" value={st?.today ?? 0} sub="Since midnight" tone="navy" delay={180} />
      </div>

      <div className="card mb-5 flex flex-wrap items-center gap-3 p-4">
        <div className="flex flex-wrap gap-2">{[['active', 'Active'], ['pending', 'Pending'], ['in_treatment', 'In treatment'], ['admitted', 'Admitted'], ['resolved', 'Resolved'], ['all', 'All']].map(([k, l]) => <FilterChip key={k} active={status === k} onClick={() => setStatus(k)}>{l}</FilterChip>)}</div>
        <div className="w-40"><Select value={urgency} onChange={(e) => setUrgency(e.target.value)}><option value="">Any urgency</option>{Object.entries(URGENCY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select></div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search name, code or condition…" className="ml-auto w-full md:w-72" />
      </div>

      {error && !data ? <ErrorState error={error} onRetry={reload} /> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {loading && !data && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-44 !rounded-2xl" />)}
          {data?.data.map((e, i) => {
            const U = URGENCY[e.urgency]; const S = EMG_STATUS[e.status]; const Mode = MODE_ICON[e.arrival_mode] || Siren; const active = ['pending', 'in_treatment'].includes(e.status);
            return (
              <div key={e.id} style={{ animationDelay: `${i * 30}ms` }} className={cx('card card-hover relative animate-fade-up overflow-hidden p-5 pl-6', !active && 'opacity-80')}>
                <span className={cx('absolute inset-y-0 left-0 w-2', U.bar)} />
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0"><p className="flex items-center gap-2 text-xs font-bold text-slate-400"><Meta items={[<span key="c" className="font-mono">{e.request_code}</span>, <span key="m" className="inline-flex items-center gap-1"><Mode size={13} aria-hidden="true" />{titleCase(e.arrival_mode)}</span>]} /></p>
                    <h3 className="mt-1 text-lg font-extrabold text-navy-900">{e.patient_name}<span className="ml-2 text-sm font-semibold text-slate-400">{[e.age != null && `${e.age}y`, titleCase(e.gender)].filter(Boolean).join(', ')}</span></h3></div>
                  <div className="flex items-center gap-2"><Badge tone={U.tone} dot pulse={e.urgency === 'critical' && active}>{U.label}</Badge><Badge tone={S.tone}>{S.label}</Badge></div>
                </div>
                <p className="mt-2.5 text-sm leading-relaxed text-slate-600">{e.condition_desc}</p>
                <div className="mt-3.5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold text-slate-500">
                  <span className="flex items-center gap-1.5"><Clock size={13} />{active ? `Waiting ${duration(e.waiting_minutes)}` : `Handled in ${duration(e.waiting_minutes)}`}</span>
                  {e.phone && <span className="flex items-center gap-1.5"><Phone size={13} />{e.phone}</span>}
                  <span className="flex items-center gap-1.5">{e.doctor_name ? <><Avatar src={e.doctor_avatar} name={e.doctor_name} size={20} />{drName(e.doctor_name)}</> : <><Stethoscope size={13} />No doctor assigned</>}</span>
                  <span className="text-slate-400">{fmtDateTime(e.created_at)}</span>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                  {e.status === 'pending' && <Button size="xs" icon={UserCheck} onClick={() => setSt(e, 'in_treatment', isDoc ? 'You took this case' : 'Treatment started')}>{isDoc ? 'Take case' : 'Start treatment'}</Button>}
                  {active && canCreate && <Button size="xs" variant="soft" icon={BedDouble} onClick={() => setAdmit(e)}>Admit to bed</Button>}
                  {active && <Button size="xs" variant="outline" icon={CheckCircle2} onClick={() => setSt(e, 'resolved', 'Case resolved')}>Resolve</Button>}
                  {e.status === 'admitted' && e.patient_id && <Link to={`/patients/${e.patient_id}`}><Button size="xs" variant="soft">Open patient record</Button></Link>}
                  <span className="ml-auto flex items-center gap-1">
                    {active && canCreate && <IconButton icon={Pencil} label="Edit" size={32} onClick={() => setEdit(e)} />}
                    {active && <IconButton icon={XCircle} label="Cancel request" size={32} className="hover:!bg-amber-50 hover:!text-amber-600" onClick={() => setSt(e, 'cancelled', 'Request cancelled')} />}
                    {isAdmin && <IconButton icon={Trash2} label="Delete" size={32} className="hover:!bg-rose-50 hover:!text-rose-600" onClick={() => setDel(e)} />}
                  </span>
                </div>
              </div>);
          })}
          {data && data.data.length === 0 && <div className="card lg:col-span-2"><EmptyState icon={Siren} title="No emergency requests" text="Nothing matches this filter. The department is clear." /></div>}
        </div>)}
      {data && <div className="mt-5"><Pagination page={data.page} pages={data.pages} total={data.total} limit={data.limit} onChange={setPage} /></div>}

      <EmergencyForm open={form || !!edit} item={edit} onClose={() => { setForm(false); setEdit(null); }} onSaved={reload} />
      <AdmitEmergency item={admit} onClose={() => setAdmit(null)} onDone={reload} />
      <ConfirmModal open={!!del} onClose={() => setDel(null)} onConfirm={remove} title="Delete emergency request?" message="This removes the request permanently. Resolve or cancel it instead to keep history." confirmText="Delete" />
    </>
  );
}
