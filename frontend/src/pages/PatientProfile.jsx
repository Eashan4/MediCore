import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  Activity, AlertTriangle, ArrowLeft, BedDouble, CalendarClock, CalendarPlus, Check, ClipboardList, Copy, Droplets, FilePlus2, FileText, HeartPulse, Mail, MapPin, MoreHorizontal, Pencil,
  Phone, Pill, Plus, Shield, Stethoscope, Thermometer, Trash2, UserRound, Weight, Wind, X,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useDebounce, useFetch, useForm } from '../hooks';
import { Avatar, Badge, Button, ConfirmModal, cx, EmptyState, ErrorState, Field, InfoRow, Input, Menu, MenuItem, Meta, Modal, SectionTitle, Select, Skeleton, Spark, Tabs, Textarea } from '../components/ui';
import { ChartTooltip, DoctorSelect } from '../components/ui/pickers';
import { PatientFormModal } from './Patients';
import { AppointmentModal } from './Appointments';
import { AdmitModal } from './Beds';
import { APPT_STATUS, IMAGES } from '../lib/constants';
import { daysSince, drName, fmtDate, fmtDateShort, fmtDateTime, fmtTime, fullName, money, relativeDay, timeAgo, titleCase, toInputDate } from '../lib/format';

/* ---------- vitals helpers ---------- */
function vitalState(kind, v) {
  if (v == null) return { label: 'No data', cls: 'bg-slate-100 text-slate-500' };
  const ok = { label: 'Normal', cls: 'bg-emerald-50 text-emerald-700' }; const warn = (l) => ({ label: l, cls: 'bg-amber-50 text-amber-700' }); const bad = (l) => ({ label: l, cls: 'bg-rose-50 text-rose-700' });
  if (kind === 'bp') { const [s, d] = v; if (s >= 140 || d >= 90) return bad('High'); if (s >= 130 || d >= 85) return warn('Elevated'); if (s < 90) return warn('Low'); return ok; }
  if (kind === 'hr') return v > 110 ? bad('High') : v > 100 ? warn('Elevated') : v < 50 ? bad('Low') : v < 60 ? warn('Low') : ok;
  if (kind === 'temp') return v >= 38 ? bad('Fever') : v >= 37.6 ? warn('Elevated') : v < 35.5 ? warn('Low') : ok;
  if (kind === 'spo2') return v < 92 ? bad('Low') : v < 95 ? warn('Borderline') : ok;
  return { label: 'Recorded', cls: 'bg-slate-100 text-slate-600' };
}

const VITAL_METRICS = {
  bp: { label: 'Blood pressure', icon: Activity, unit: 'mmHg', color: '#12223f', lines: [{ k: 'bp_systolic', n: 'Systolic', c: '#12223f' }, { k: 'bp_diastolic', n: 'Diastolic', c: '#17aa9e' }], band: [90, 130] },
  hr: { label: 'Heart rate', icon: HeartPulse, unit: 'bpm', lines: [{ k: 'heart_rate', n: 'Heart rate', c: '#f43f5e' }], band: [60, 100] },
  temp: { label: 'Temperature', icon: Thermometer, unit: '°C', lines: [{ k: 'temperature', n: 'Temperature', c: '#f59e0b' }], band: [36.1, 37.5], domain: [35, 40] },
  spo2: { label: 'SpO₂', icon: Wind, unit: '%', lines: [{ k: 'spo2', n: 'SpO₂', c: '#3b82f6' }], band: [95, 100], domain: [85, 100] },
  weight: { label: 'Weight', icon: Weight, unit: 'kg', lines: [{ k: 'weight_kg', n: 'Weight', c: '#8b5cf6' }] },
};

function VitalCard({ kind, icon: Icon, label, value, unit, state, series, color, sub, active, onClick }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={!!active} className={cx('card card-hover relative flex flex-col items-stretch overflow-hidden p-4 text-left', active && 'ring-4 ring-teal-500/20 border-teal-300')}>
      <div className="flex items-center justify-between"><span className="grid h-9 w-9 place-items-center rounded-xl text-white" style={{ background: color }}><Icon size={17} aria-hidden="true" /></span><span className={cx('rounded-full px-2.5 py-1 text-[11px] font-bold', state.cls)}>{state.label}</span></div>
      <p className="mt-3 text-[13px] font-semibold text-slate-500">{label}</p>
      <p className="num mt-1 font-display text-[32px] font-semibold leading-none text-navy-900">{value ?? '-'}<span className="ml-1 text-sm font-semibold text-slate-400">{value != null ? unit : ''}</span></p>
      <div className="mt-2 -mx-1"><Spark data={series} color={color} height={30} /></div>
      <p className="mt-1 text-xs font-medium text-slate-500">{sub}</p>
    </button>
  );
}

/* ---------- modals ---------- */
function RecordModal({ open, onClose, patientId, isAdmin, onSaved }) {
  const toast = useToast(); const f = useForm({}); const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { f.setValues({ visit_type: 'Outpatient', chief_complaint: '', diagnosis: '', treatment: '', notes: '', bp_systolic: '', bp_diastolic: '', heart_rate: '', temperature: '', spo2: '', weight_kg: '', follow_up_date: '', doctor_id: '' }); f.setErrors({}); } /* eslint-disable-next-line */ }, [open]);
  const submit = async () => {
    if (f.values.diagnosis.trim().length < 2) return f.setErrors({ diagnosis: 'Diagnosis is required' });
    setBusy(true);
    try { await api.post(`/patients/${patientId}/records`, { ...f.values, doctor_id: f.values.doctor_id || undefined }); toast.success('Diagnosis recorded', f.values.diagnosis); onSaved(); onClose(); }
    catch (e) { f.setErrors(e.fields || {}); toast.error('Could not save record', e.message); } finally { setBusy(false); }
  };
  const E = f.errors; const num = (k, label, ph, step) => <Field label={label} error={E[k]}><Input type="number" step={step || 1} {...f.bind(k)} error={E[k]} placeholder={ph} /></Field>;
  return (
    <Modal open={open} onClose={onClose} size="lg" icon={FilePlus2} title="Add diagnosis & visit notes" subtitle="Saved to the patient's medical history and visible in the audit log"
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button loading={busy} icon={Check} onClick={submit}>Save record</Button></>}>
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Diagnosis" required error={E.diagnosis} className="sm:col-span-2"><Input {...f.bind('diagnosis')} error={E.diagnosis} placeholder="e.g. Essential hypertension" /></Field>
          <Field label="Visit type"><Select {...f.bind('visit_type')}>{['Outpatient', 'Inpatient', 'Follow-up', 'Checkup', 'Emergency'].map((t) => <option key={t}>{t}</option>)}</Select></Field>
          <Field label="Chief complaint"><Input {...f.bind('chief_complaint')} placeholder="Presenting symptoms" /></Field>
          <Field label="Treatment plan" className="sm:col-span-2"><Textarea rows={2} {...f.bind('treatment')} /></Field>
          <Field label="Clinical notes" className="sm:col-span-2"><Textarea rows={2} {...f.bind('notes')} /></Field>
          {isAdmin && <Field label="Responsible doctor" className="sm:col-span-2"><DoctorSelect value={f.values.doctor_id} onChange={(v) => f.set('doctor_id', v)} placeholder="Patient's assigned doctor" /></Field>}
        </div>
        <div>
          <h4 className="mb-3 text-xs font-bold text-teal-600">Vitals (optional)</h4>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {num('bp_systolic', 'Systolic (mmHg)', '120')}{num('bp_diastolic', 'Diastolic (mmHg)', '80')}{num('heart_rate', 'Heart rate (bpm)', '72')}
            {num('temperature', 'Temperature (°C)', '36.8', 0.1)}{num('spo2', 'SpO₂ (%)', '98')}{num('weight_kg', 'Weight (kg)', '70', 0.1)}
          </div>
        </div>
        <Field label="Follow-up date"><Input type="date" min={toInputDate()} {...f.bind('follow_up_date')} /></Field>
      </div>
    </Modal>
  );
}

function MedicineInput({ value, onPick, error }) {
  const [q, setQ] = useState(value || ''); const [open, setOpen] = useState(false); const [res, setRes] = useState([]); const ref = useRef(null); const dq = useDebounce(q, 250);
  useEffect(() => setQ(value || ''), [value]);
  useEffect(() => { if (!open || dq.length < 2) return; api.get('/medicines/search', { q: dq }).then(setRes).catch(() => setRes([])); }, [dq, open]);
  useEffect(() => { const fn = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false); document.addEventListener('mousedown', fn); return () => document.removeEventListener('mousedown', fn); }, []);
  return (
    <div ref={ref} className="relative">
      <Input value={q} error={error} placeholder="Search medicine…" onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); onPick({ medicine_name: e.target.value, medicine_id: undefined }); }} />
      {open && res.length > 0 && q.length >= 2 && (
        <div className="absolute z-30 mt-1.5 max-h-56 w-full animate-pop overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lift">
          {res.map((m) => <button type="button" key={m.id} onClick={() => { onPick({ medicine_name: m.name, medicine_id: m.id }); setQ(m.name); setOpen(false); }} className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-teal-50">
            <span><b className="text-navy-900">{m.name}</b><span className="ml-2 text-xs text-slate-400">{m.generic_name}</span></span><Badge tone={m.quantity === 0 ? 'red' : 'green'}>{m.quantity === 0 ? 'Out of stock' : `${m.quantity} ${m.unit}`}</Badge></button>)}
        </div>)}
    </div>
  );
}

const FREQ = ['Once daily', 'Twice daily', 'Three times daily', 'Every 8 hours', 'At bedtime', 'As needed'];
const blankItem = () => ({ medicine_name: '', medicine_id: undefined, dosage: '', frequency: 'Twice daily', duration_days: 7, instructions: '' });

function RxModal({ open, onClose, patient, isAdmin, onSaved }) {
  const toast = useToast(); const [items, setItems] = useState([blankItem()]); const [notes, setNotes] = useState(''); const [doctorId, setDoctorId] = useState(''); const [errs, setErrs] = useState({}); const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setItems([blankItem()]); setNotes(''); setDoctorId(''); setErrs({}); } }, [open]);
  const upd = (i, patch) => setItems((l) => l.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const submit = async () => {
    const e = {}; items.forEach((it, i) => { if (!it.medicine_name.trim()) e[`n${i}`] = 'Required'; if (!it.dosage.trim()) e[`d${i}`] = 'Required'; });
    if (Object.keys(e).length) return setErrs(e);
    setBusy(true);
    try {
      const r = await api.post(`/patients/${patient.id}/prescriptions`, { items, notes, doctor_id: doctorId || undefined });
      toast.success('Prescription issued', `${items.length} medicine${items.length > 1 ? 's' : ''} for ${fullName(patient)}`);
      (r.warnings || []).forEach((w) => toast.warning('Check before dispensing', w)); onSaved(); onClose();
    } catch (err) { toast.error('Could not issue prescription', err.message); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} size="lg" icon={Pill} title="Write a prescription" subtitle={patient ? `For ${fullName(patient)}${patient.allergies ? `. Allergies: ${patient.allergies}` : ''}` : ''}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button loading={busy} icon={Check} onClick={submit}>Issue prescription</Button></>}>
      <div className="space-y-4">
        {patient?.allergies && <p className="flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700"><AlertTriangle size={16} className="mt-0.5 shrink-0" />Known allergies: {patient.allergies}</p>}
        {items.map((it, i) => (
          <div key={i} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="mb-3 flex items-center justify-between"><p className="text-sm font-bold text-navy-900">Medicine {i + 1}</p>{items.length > 1 && <button onClick={() => setItems((l) => l.filter((_, j) => j !== i))} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Remove"><Trash2 size={15} /></button>}</div>
            <div className="grid gap-3 sm:grid-cols-6">
              <Field label="Medicine" required error={errs[`n${i}`]} className="sm:col-span-6"><MedicineInput value={it.medicine_name} error={errs[`n${i}`]} onPick={(p) => upd(i, p)} /></Field>
              <Field label="Dosage" required error={errs[`d${i}`]} className="sm:col-span-2"><Input value={it.dosage} onChange={(e) => upd(i, { dosage: e.target.value })} error={errs[`d${i}`]} placeholder="500 mg" /></Field>
              <Field label="Frequency" className="sm:col-span-2"><Select value={it.frequency} onChange={(e) => upd(i, { frequency: e.target.value })}>{FREQ.map((x) => <option key={x}>{x}</option>)}</Select></Field>
              <Field label="Days" className="sm:col-span-2"><Input type="number" min="1" max="365" value={it.duration_days} onChange={(e) => upd(i, { duration_days: e.target.value })} /></Field>
              <Field label="Instructions" className="sm:col-span-6"><Input value={it.instructions} onChange={(e) => upd(i, { instructions: e.target.value })} placeholder="e.g. After meals" /></Field>
            </div>
          </div>
        ))}
        <Button variant="soft" size="sm" icon={Plus} onClick={() => setItems((l) => [...l, blankItem()])}>Add another medicine</Button>
        <Field label="Notes to pharmacist / patient"><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        {isAdmin && <Field label="Prescribing doctor"><DoctorSelect value={doctorId} onChange={setDoctorId} placeholder="Patient's assigned doctor" /></Field>}
      </div>
    </Modal>
  );
}

function ClinicalModal({ open, onClose, patient, onSaved }) {
  const toast = useToast(); const [a, setA] = useState(''); const [c, setC] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setA(patient?.allergies || ''); setC(patient?.chronic_conditions || ''); } }, [open, patient]);
  const save = async () => { setBusy(true); try { await api.patch(`/patients/${patient.id}/clinical`, { allergies: a, chronic_conditions: c }); toast.success('Clinical details updated'); onSaved(); onClose(); } catch (e) { toast.error('Update failed', e.message); } finally { setBusy(false); } };
  return (
    <Modal open={open} onClose={onClose} size="sm" icon={AlertTriangle} title="Allergies & conditions" footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={save}>Save</Button></>}>
      <div className="space-y-4"><Field label="Allergies" hint="Separate with commas"><Textarea value={a} onChange={(e) => setA(e.target.value)} /></Field><Field label="Chronic conditions"><Textarea value={c} onChange={(e) => setC(e.target.value)} /></Field></div>
    </Modal>
  );
}

/* ---------- page ---------- */
export default function PatientProfile() {
  const { id } = useParams(); const nav = useNavigate(); const { user } = useAuth(); const toast = useToast();
  const { data, loading, error, reload } = useFetch(() => api.get(`/patients/${id}`), [id]);
  const [tab, setTab] = useState('overview'); const [metric, setMetric] = useState('bp');
  const [m, setM] = useState(null); const [del, setDel] = useState(false); const [copied, setCopied] = useState(false);
  useEffect(() => { setTab('overview'); }, [id]);

  const role = user.role; const isAdmin = role === 'admin'; const isDoc = role === 'doctor'; const canEdit = role !== 'doctor'; const canClinical = role !== 'receptionist'; const canBook = role !== 'doctor';

  if (loading && !data) return <div className="space-y-5"><Skeleton className="h-64 w-full !rounded-3xl" /><div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-40" />)}</div></div>;
  if (error && !data) return <div><Link to="/patients" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-teal-700"><ArrowLeft size={16} /> Back to patients</Link><ErrorState error={error} onRetry={reload} /></div>;
  const { patient: p, admission, records, prescriptions, appointments, admissions, vitals } = data;
  const last = vitals[vitals.length - 1] || {};
  const series = (k) => vitals.map((v) => Number(v[k]) || 0);
  const admitted = !!admission;
  const copyId = async () => { try { await navigator.clipboard.writeText(p.patient_code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ } };
  const upcoming = appointments.filter((a) => ['scheduled', 'checked_in'].includes(a.status) && a.scheduled_at.slice(0, 10) >= toInputDate()).reverse();
  const past = appointments.filter((a) => !upcoming.includes(a));
  const metricCfg = VITAL_METRICS[metric];
  const chartData = vitals.map((v) => ({ ...v, label: fmtDateShort(v.date) }));
  const hasData = vitals.length > 0;

  const doDelete = async () => { try { await api.del(`/patients/${p.id}`); toast.success('Patient deleted', fullName(p)); nav('/patients'); } catch (e) { toast.error('Cannot delete patient', e.message); setDel(false); } };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: UserRound }, { id: 'history', label: 'Medical history', icon: FileText, count: records.length },
    { id: 'rx', label: 'Prescriptions', icon: Pill, count: prescriptions.length }, { id: 'appts', label: 'Appointments', icon: CalendarClock, count: appointments.length },
    { id: 'admissions', label: 'Admissions', icon: BedDouble, count: admissions.length },
  ];

  return (
    <>
      <Link to="/patients" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-teal-700"><ArrowLeft size={16} /> {isDoc ? 'My patients' : 'All patients'}</Link>

      {/* ============ cover / identity ============ */}
      <section className="card mb-6 overflow-hidden">
        <div className="relative h-40 overflow-hidden bg-gradient-to-br from-navy-900 via-navy-800 to-teal-700 sm:h-44">
          <img src={IMAGES.heart} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25 mix-blend-luminosity" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          
          <svg className="absolute bottom-0 left-0 w-full opacity-30" height="46" viewBox="0 0 800 46" preserveAspectRatio="none"><path d="M0 24h250l14-18 18 36 14-28 10 10h494" fill="none" stroke="#5eead4" strokeWidth="2" /></svg>
          <div className="relative flex items-start justify-between p-5 sm:p-6"><span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white backdrop-blur">Patient record</span>
            {admitted ? <Badge tone="blue" dot pulse className="!bg-white !text-blue-700">Admitted to bed {admission.bed_number}</Badge> : <Badge tone="green" className="!bg-white">Outpatient</Badge>}</div>
        </div>
        <div className="px-5 pb-6 sm:px-8">
          <div className="-mt-16 flex flex-col gap-x-6 gap-y-4 sm:flex-row sm:items-start">
            <Avatar src={p.photo_url} name={fullName(p)} size={128} square className="shrink-0 rounded-3xl shadow-lift [&_img]:rounded-3xl [&_img]:ring-4 [&_img]:ring-white [&>span]:rounded-3xl [&>span]:ring-4 [&>span]:ring-white" />
            <div className="min-w-0 flex-1 sm:pt-[76px]">
              <h1 className="font-display text-3xl font-semibold text-navy-900 sm:text-4xl">{fullName(p)}</h1>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <button onClick={copyId} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-xs font-bold text-slate-600 transition hover:bg-teal-50 hover:text-teal-700">{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? 'Copied' : p.patient_code}</button>
                <Badge tone="navy">{p.age} years</Badge><Badge tone="slate">{titleCase(p.gender)}</Badge>
                {p.blood_group && <Badge tone="red"><Droplets size={12} />{p.blood_group}</Badge>}
                {p.insurance_provider && <Badge tone="teal"><Shield size={12} />{p.insurance_provider}</Badge>}
                <span className="text-xs font-medium text-slate-400">Registered {fmtDate(p.created_at)}</span>
              </div>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2.5 border-t border-slate-100 pt-5">
              {canClinical && <Button icon={FilePlus2} onClick={() => setM('record')}>Add diagnosis</Button>}
              {canClinical && <Button variant="navy" icon={Pill} onClick={() => setM('rx')}>Prescribe</Button>}
              {canBook && <Button variant="outline" icon={CalendarPlus} onClick={() => setM('appt')}>Book visit</Button>}
              {canBook && !admitted && <Button variant="outline" icon={BedDouble} onClick={() => setM('admit')}>Admit</Button>}
              {(canEdit || isAdmin) && (
                <Menu trigger={() => <button className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-teal-400 hover:text-teal-700" aria-label="More"><MoreHorizontal size={18} /></button>}>
                  {canEdit && <MenuItem icon={Pencil} onClick={() => setM('edit')}>Edit details</MenuItem>}
                  {isAdmin && <MenuItem icon={Trash2} danger onClick={() => setDel(true)}>Delete patient</MenuItem>}
                </Menu>)}
          </div>
          {p.allergies && <div className="mt-5 flex flex-wrap items-center gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm"><AlertTriangle size={17} className="text-rose-500" /><b className="text-rose-700">Allergies:</b>{p.allergies.split(',').map((a) => <span key={a} className="rounded-full bg-white px-2.5 py-0.5 text-xs font-bold text-rose-600 ring-1 ring-rose-200">{a.trim()}</span>)}</div>}
        </div>
      </section>

      {/* ============ vitals strip ============ */}
      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-3 xl:grid-cols-5">
        <VitalCard kind="bp" label="Blood pressure" icon={Activity} color="#12223f" value={last.bp_systolic ? `${last.bp_systolic}/${last.bp_diastolic}` : null} unit="mmHg" state={vitalState('bp', last.bp_systolic ? [last.bp_systolic, last.bp_diastolic] : null)} series={series('bp_systolic')} sub={last.date ? `Recorded ${timeAgo(last.date)}` : 'Not recorded'} active={metric === 'bp'} onClick={() => { setMetric('bp'); setTab('overview'); }} />
        <VitalCard kind="hr" label="Heart rate" icon={HeartPulse} color="#f43f5e" value={last.heart_rate} unit="bpm" state={vitalState('hr', last.heart_rate)} series={series('heart_rate')} sub={last.date ? `Recorded ${timeAgo(last.date)}` : 'Not recorded'} active={metric === 'hr'} onClick={() => { setMetric('hr'); setTab('overview'); }} />
        <VitalCard kind="temp" label="Temperature" icon={Thermometer} color="#f59e0b" value={last.temperature} unit="°C" state={vitalState('temp', last.temperature)} series={series('temperature')} sub={last.date ? `Recorded ${timeAgo(last.date)}` : 'Not recorded'} active={metric === 'temp'} onClick={() => { setMetric('temp'); setTab('overview'); }} />
        <VitalCard kind="spo2" label="Oxygen (SpO₂)" icon={Wind} color="#3b82f6" value={last.spo2} unit="%" state={vitalState('spo2', last.spo2)} series={series('spo2')} sub={last.date ? `Recorded ${timeAgo(last.date)}` : 'Not recorded'} active={metric === 'spo2'} onClick={() => { setMetric('spo2'); setTab('overview'); }} />
        <VitalCard kind="weight" label="Weight" icon={Weight} color="#8b5cf6" value={last.weight_kg} unit="kg" state={vitalState('weight', last.weight_kg)} series={series('weight_kg')} sub={last.date ? `Recorded ${timeAgo(last.date)}` : 'Not recorded'} active={metric === 'weight'} onClick={() => { setMetric('weight'); setTab('overview'); }} />
      </div>

      <Tabs variant="line" tabs={tabs} value={tab} onChange={setTab} className="mb-6" />

      {/* ============ OVERVIEW ============ */}
      {tab === 'overview' && (
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            {admitted ? (
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-navy-700 to-navy-900 p-6 text-white shadow-lift">
                <BedDouble size={150} className="absolute -right-6 -top-4 text-white/10" />
                <div className="relative flex flex-wrap items-center justify-between gap-5">
                  <div><p className="flex items-center gap-2 text-xs font-bold text-blue-200"><span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping2 rounded-full bg-emerald-400" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" /></span>Currently admitted</p>
                    <h3 className="mt-2 font-display text-4xl font-semibold">Bed {admission.bed_number}</h3><p className="mt-1 text-sm text-blue-100"><Meta wrap items={[`${admission.ward_name} ward`, admission.floor, titleCase(admission.bed_type), `${money(admission.daily_rate)}/day`]} /></p></div>
                  <div className="flex gap-3"><div className="rounded-2xl bg-white/12 px-5 py-3 text-center backdrop-blur"><p className="num font-display text-3xl font-semibold">{daysSince(admission.admitted_at)}</p><p className="text-xs font-semibold text-blue-200">Day of stay</p></div>
                    <div className="rounded-2xl bg-white/12 px-5 py-3 text-center backdrop-blur"><p className="num font-display text-3xl font-semibold">{money(daysSince(admission.admitted_at) * admission.daily_rate)}</p><p className="text-xs font-semibold text-blue-200">Est. charges</p></div></div>
                </div>
                <div className="relative mt-5 grid gap-3 border-t border-white/15 pt-4 text-sm sm:grid-cols-3">
                  <p><span className="text-blue-200">Admitted</span><br /><b>{fmtDateTime(admission.admitted_at)}</b></p><p><span className="text-blue-200">Attending</span><br /><b>{admission.doctor_name ? drName(admission.doctor_name) : 'Unassigned'}</b></p><p><span className="text-blue-200">Reason</span><br /><b className="line-clamp-2">{admission.reason || '-'}</b></p>
                </div>
              </div>
            ) : (
              <div className="card flex flex-wrap items-center gap-5 p-6"><span className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600"><BedDouble size={26} /></span>
                <div className="flex-1"><h3 className="font-extrabold text-navy-900">Not currently admitted</h3><p className="text-sm text-slate-500">This patient is being managed as an outpatient.</p></div>{canBook && <Button icon={BedDouble} onClick={() => setM('admit')}>Admit to a bed</Button>}</div>
            )}

            <div className="card p-5 sm:p-6">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <SectionTitle icon={metricCfg.icon} title={`${metricCfg.label} trend`} subtitle={hasData ? `Last ${vitals.length} recorded visits` : 'No vitals recorded yet'} />
                <div className="flex flex-wrap gap-1.5">{Object.entries(VITAL_METRICS).map(([k, v]) => <button key={k} onClick={() => setMetric(k)} className={cx('rounded-full px-3 py-1.5 text-xs font-bold transition', metric === k ? 'bg-navy-900 text-white' : 'bg-slate-100 text-slate-500 hover:text-navy-800')}>{v.label.replace('Blood pressure', 'BP').replace('Heart rate', 'HR').replace('Temperature', 'Temp')}</button>)}</div>
              </div>
              {hasData ? (
                <div className="h-[260px]"><ResponsiveContainer><LineChart data={chartData} margin={{ left: -14, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 4" vertical={false} stroke="#e2ebf6" />
                  {metricCfg.band && <ReferenceArea y1={metricCfg.band[0]} y2={metricCfg.band[1]} fill="#10b981" fillOpacity={0.07} />}
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} domain={metricCfg.domain || ['auto', 'auto']} />
                  <Tooltip content={<ChartTooltip formatter={(v) => `${v} ${metricCfg.unit}`} />} />
                  {metricCfg.lines.map((l) => <Line key={l.k} type="monotone" dataKey={l.k} name={l.n} stroke={l.c} strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 7, strokeWidth: 3, stroke: '#fff', fill: l.c }} animationDuration={900} />)}
                </LineChart></ResponsiveContainer></div>
              ) : <EmptyState icon={Activity} title="No vitals yet" text="Vitals appear here after a doctor records a visit." />}
              {hasData && metricCfg.band && <p className="mt-2 text-xs font-medium text-slate-400"><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-emerald-400/40" />Green band shows the typical healthy range ({metricCfg.band[0]}-{metricCfg.band[1]} {metricCfg.unit}).</p>}
            </div>

            <div className="card p-5 sm:p-6">
              <SectionTitle icon={FileText} title="Recent visits" subtitle="Latest diagnoses" action={<button onClick={() => setTab('history')} className="text-xs font-bold text-teal-600 hover:underline">Full history</button>} />
              {records.length === 0 ? <EmptyState icon={FileText} title="No visits recorded" /> : (
                <ul className="space-y-3">{records.slice(0, 3).map((r) => (
                  <li key={r.id} className="flex items-center gap-4 rounded-2xl border border-slate-100 p-3.5 transition hover:border-teal-200 hover:shadow-soft">
                    <div className="grid w-14 shrink-0 place-items-center rounded-xl bg-slate-50 py-2 text-center"><p className="text-lg font-extrabold leading-none text-navy-900">{fmtDateShort(r.visit_date).split(' ')[0]}</p><p className="text-xs font-semibold text-slate-500">{fmtDateShort(r.visit_date).split(' ')[1]}</p></div>
                    <div className="min-w-0 flex-1"><p className="truncate font-bold text-navy-900">{r.diagnosis}</p><p className="text-xs text-slate-500"><Meta items={[drName(r.doctor_name), r.department]} /></p></div><Badge tone={r.visit_type === 'Inpatient' ? 'blue' : 'slate'}>{r.visit_type}</Badge></li>))}</ul>)}
            </div>
          </div>

          <div className="space-y-6">
            <div className="card p-5 sm:p-6">
              <SectionTitle icon={Stethoscope} title="Care team" />
              {p.doctor_name ? (
                <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-br from-teal-50 to-navy-50 p-4"><Avatar src={p.doctor_avatar} name={p.doctor_name} size={60} ring /><div className="min-w-0"><p className="truncate font-extrabold text-navy-900">{drName(p.doctor_name)}</p><p className="text-xs font-semibold text-teal-700">Primary physician</p>{records[0] && <p className="mt-0.5 text-xs text-slate-500">{records[0].department}</p>}</div></div>
              ) : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No doctor assigned yet.</p>}
            </div>

            <div className="card p-5 sm:p-6">
              <SectionTitle icon={UserRound} title="Personal details" />
              <div className="divide-y divide-slate-100">
                <InfoRow icon={Phone} label="Phone">{p.phone}</InfoRow><InfoRow icon={Mail} label="Email">{p.email}</InfoRow>
                <InfoRow icon={MapPin} label="Address">{[p.address, p.city].filter(Boolean).join(', ')}</InfoRow>
                <InfoRow icon={CalendarClock} label="Date of birth">{fmtDate(p.dob)} ({p.age} yrs)</InfoRow>
                <InfoRow icon={Shield} label="Insurance">{p.insurance_provider ? `${p.insurance_provider}${p.insurance_no ? `, ${p.insurance_no}` : ''}` : null}</InfoRow>
              </div>
            </div>

            <div className="card p-5 sm:p-6">
              <SectionTitle icon={Phone} title="Emergency contact" />
              {p.emergency_contact_name ? <div className="flex items-center gap-3"><Avatar name={p.emergency_contact_name} size={42} /><div><p className="font-bold text-navy-900">{p.emergency_contact_name}</p><p className="text-sm text-slate-500">{p.emergency_contact_phone}</p></div></div> : <p className="text-sm text-slate-500">Not provided.</p>}
            </div>

            <div className="card p-5 sm:p-6">
              <SectionTitle icon={AlertTriangle} title="Allergies & conditions" action={canClinical && <button onClick={() => setM('clinical')} className="text-xs font-bold text-teal-600 hover:underline">Edit</button>} />
              <p className="mb-2 text-xs font-semibold text-slate-500">Allergies</p>
              <div className="mb-4 flex flex-wrap gap-2">{p.allergies ? p.allergies.split(',').map((a) => <Badge key={a} tone="red">{a.trim()}</Badge>) : <span className="text-sm text-slate-500">None recorded</span>}</div>
              <p className="mb-2 text-xs font-semibold text-slate-500">Chronic conditions</p>
              <div className="flex flex-wrap gap-2">{p.chronic_conditions ? p.chronic_conditions.split(',').map((a) => <Badge key={a} tone="amber">{a.trim()}</Badge>) : <span className="text-sm text-slate-500">None recorded</span>}</div>
            </div>
          </div>
        </div>
      )}

      {/* ============ MEDICAL HISTORY ============ */}
      {tab === 'history' && (records.length === 0 ? <div className="card"><EmptyState icon={FileText} title="No medical history yet" text="Diagnoses and visit notes recorded by doctors will appear here." action={canClinical && <Button icon={FilePlus2} onClick={() => setM('record')}>Add first record</Button>} /></div> : (
        <ol className="relative space-y-5 before:absolute before:bottom-4 before:left-[27px] before:top-4 before:w-0.5 before:bg-gradient-to-b before:from-teal-300 before:to-slate-200">
          {records.map((r, i) => (
            <li key={r.id} className="relative flex animate-fade-up gap-5" style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}>
              <div className="z-10 grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white text-center shadow-soft ring-4 ring-[#f3f7fb]"><div><p className="text-lg font-extrabold leading-none text-navy-900">{fmtDateShort(r.visit_date).split(' ')[0]}</p><p className="text-xs font-bold text-teal-600">{fmtDateShort(r.visit_date).split(' ')[1]}</p></div></div>
              <div className="card card-hover min-w-0 flex-1 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><h3 className="text-lg font-extrabold text-navy-900">{r.diagnosis}</h3>{r.chief_complaint && <p className="mt-0.5 text-sm text-slate-500">Complaint: {r.chief_complaint}</p>}</div>
                  <div className="flex items-center gap-2"><Badge tone={r.visit_type === 'Inpatient' ? 'blue' : 'slate'}>{r.visit_type}</Badge><span className="text-xs font-semibold text-slate-400">{fmtTime(r.visit_date)}</span></div>
                </div>
                {r.treatment && <p className="mt-3 rounded-xl bg-teal-50/60 p-3 text-sm text-slate-700"><b className="text-teal-700">Treatment:</b> {r.treatment}</p>}
                {r.notes && <p className="mt-2 text-sm text-slate-500">{r.notes}</p>}
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                  {r.bp_systolic && <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-600">BP {r.bp_systolic}/{r.bp_diastolic}</span>}{r.heart_rate && <span className="rounded-lg bg-rose-50 px-2.5 py-1 text-rose-600">HR {r.heart_rate}</span>}
                  {r.temperature && <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-amber-600">{r.temperature}°C</span>}{r.spo2 && <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-blue-600">SpO₂ {r.spo2}%</span>}{r.weight_kg && <span className="rounded-lg bg-violet-50 px-2.5 py-1 text-violet-600">{r.weight_kg} kg</span>}
                  {r.follow_up_date && <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-emerald-700">Follow-up {fmtDate(r.follow_up_date)}</span>}
                </div>
                <div className="mt-4 flex items-center gap-2.5 border-t border-slate-100 pt-3"><Avatar src={r.doctor_avatar} name={r.doctor_name} size={28} /><p className="text-sm text-slate-600"><b className="text-navy-800">{drName(r.doctor_name)}</b>{r.department ? `, ${r.department}` : ''}</p></div>
              </div>
            </li>))}
        </ol>))}

      {/* ============ PRESCRIPTIONS ============ */}
      {tab === 'rx' && (prescriptions.length === 0 ? <div className="card"><EmptyState icon={Pill} title="No prescriptions" text="Prescriptions issued for this patient will be listed here." action={canClinical && <Button icon={Pill} onClick={() => setM('rx')}>Write prescription</Button>} /></div> : (
        <div className="grid gap-5 md:grid-cols-2">
          {prescriptions.map((rx, i) => (
            <div key={rx.id} className="card card-hover animate-fade-up p-5" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
              <div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-navy-900 text-teal-300"><Pill size={18} /></span><div><p className="font-extrabold text-navy-900">Rx #{rx.id}</p><p className="text-xs text-slate-500"><Meta items={[fmtDate(rx.created_at), drName(rx.doctor_name)]} /></p></div></div><Badge tone={rx.status === 'active' ? 'green' : 'slate'} dot={rx.status === 'active'}>{titleCase(rx.status)}</Badge></div>
              <ul className="space-y-2.5">{rx.items.map((it) => (
                <li key={it.id} className="rounded-xl bg-slate-50 p-3"><div className="flex items-center justify-between gap-2"><p className="font-bold text-navy-900">{it.medicine_name}</p><span className="rounded-md bg-white px-2 py-0.5 text-xs font-bold text-teal-700 ring-1 ring-teal-100">{it.dosage}</span></div>
                  <p className="mt-0.5 text-xs text-slate-500"><Meta wrap items={[it.frequency, `${it.duration_days} days`, it.instructions]} /></p></li>))}</ul>
              {rx.notes && <p className="mt-3 text-sm italic text-slate-500">"{rx.notes}"</p>}
            </div>))}
        </div>))}

      {/* ============ APPOINTMENTS ============ */}
      {tab === 'appts' && (appointments.length === 0 ? <div className="card"><EmptyState icon={CalendarClock} title="No appointments" action={canBook && <Button icon={CalendarPlus} onClick={() => setM('appt')}>Book a visit</Button>} /></div> : (
        <div className="space-y-6">
          {[['Upcoming', upcoming], ['Past visits', past]].map(([title, list]) => list.length > 0 && (
            <div key={title}><h3 className="mb-3 text-xs font-semibold text-slate-500">{title} ({list.length})</h3>
              <div className="space-y-2.5">{list.map((a) => (
                <div key={a.id} className="card flex flex-wrap items-center gap-4 p-4"><div className="w-[88px] shrink-0"><p className="text-sm font-extrabold text-navy-900">{relativeDay(a.scheduled_at)}</p><p className="text-xs font-semibold text-slate-400">{fmtTime(a.scheduled_at)}</p></div>
                  <Avatar src={a.doctor_avatar} name={a.doctor_name} size={38} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-navy-900">{drName(a.doctor_name)}</p><p className="text-xs text-slate-500"><Meta items={[a.specialization, a.reason || titleCase(a.type)]} /></p></div><Badge tone={APPT_STATUS[a.status].tone}>{APPT_STATUS[a.status].label}</Badge></div>))}</div></div>))}
        </div>))}

      {/* ============ ADMISSIONS ============ */}
      {tab === 'admissions' && (admissions.length === 0 ? <div className="card"><EmptyState icon={BedDouble} title="No admissions" text="This patient has never been admitted." /></div> : (
        <div className="space-y-3">{admissions.map((a) => (
          <div key={a.id} className="card flex flex-wrap items-center gap-5 p-5"><span className={cx('grid h-12 w-12 place-items-center rounded-2xl text-white', a.status === 'admitted' ? 'bg-gradient-to-br from-blue-400 to-blue-600' : 'bg-gradient-to-br from-slate-300 to-slate-400')}><BedDouble size={22} /></span>
            <div className="min-w-[180px] flex-1"><p className="font-extrabold text-navy-900"><Meta wrap items={[a.ward_name, a.bed_number]} /></p><p className="text-sm text-slate-500">{a.reason || 'No reason recorded'}</p></div>
            <div className="text-sm"><p className="font-semibold text-navy-800">{fmtDateTime(a.admitted_at)}</p><p className="text-xs text-slate-400">{a.discharged_at ? `Discharged ${fmtDateTime(a.discharged_at)}` : 'Still admitted'}</p></div>
            <Badge tone={a.status === 'admitted' ? 'blue' : 'green'} dot={a.status === 'admitted'} pulse={a.status === 'admitted'}>{a.status === 'admitted' ? 'Admitted' : 'Discharged'}</Badge>
            {a.discharge_notes && <p className="w-full rounded-xl bg-slate-50 p-3 text-sm text-slate-600"><b>Discharge notes:</b> {a.discharge_notes}</p>}</div>))}</div>))}

      {/* ============ modals ============ */}
      <RecordModal open={m === 'record'} onClose={() => setM(null)} patientId={p.id} isAdmin={isAdmin} onSaved={reload} />
      <RxModal open={m === 'rx'} onClose={() => setM(null)} patient={p} isAdmin={isAdmin} onSaved={() => { reload(); setTab('rx'); }} />
      <ClinicalModal open={m === 'clinical'} onClose={() => setM(null)} patient={p} onSaved={reload} />
      <PatientFormModal open={m === 'edit'} onClose={() => setM(null)} patient={p} onSaved={reload} />
      <AppointmentModal open={m === 'appt'} onClose={() => setM(null)} presetPatient={{ ...p, id: p.id }} onSaved={() => { reload(); setTab('appts'); }} />
      <AdmitModal open={m === 'admit'} onClose={() => setM(null)} presetPatient={p} onDone={reload} />
      <ConfirmModal open={del} onClose={() => setDel(false)} onConfirm={doDelete} title="Delete this patient?" confirmText="Delete patient" message={`${fullName(p)} and all linked records will be permanently deleted. This action is logged in the audit trail.`} />
    </>
  );
}
