import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, BedDouble, CalendarClock, Check, Crown, DollarSign, HeartPulse, LogOut, Plus, RefreshCw, ShieldAlert, Stethoscope, Trash2, UserRound, Wrench, X,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useFetch, useForm, useTick } from '../hooks';
import { Avatar, Badge, Button, ConfirmModal, Count, cx, Drawer, EmptyState, ErrorState, Field, FilterChip, Input, LivePill, Meta, Modal, Ring, SearchInput, Select, Skeleton, Textarea } from '../components/ui';
import { DoctorSelect, PatientPicker } from '../components/ui/pickers';
import { BED_STATUS, IMAGES } from '../lib/constants';
import { drName, fmtDateTime, fullName, hoursSince, daysSince, money, surname, timeAgo, titleCase } from '../lib/format';

const TYPE_ICON = { standard: BedDouble, icu: HeartPulse, private: Crown, isolation: ShieldAlert };
const stayLabel = (iso) => (hoursSince(iso) < 24 ? `${Math.max(1, hoursSince(iso))}h` : `Day ${daysSince(iso)}`);

/* ============================================================ Bed card */
/* Hover-card alignment so tooltips on the first/last grid column never overflow the page (4 cols at md, 6 at xl). */
const TIP = {
  center: { tip: { md: 'md:left-1/2 md:right-auto md:-ml-[120px]', xl: 'xl:left-1/2 xl:right-auto xl:-ml-[120px]' }, arrow: { md: 'md:left-1/2 md:right-auto md:-ml-1.5', xl: 'xl:left-1/2 xl:right-auto xl:-ml-1.5' } },
  right: { tip: { md: 'md:left-auto md:right-0 md:ml-0', xl: 'xl:left-auto xl:right-0 xl:ml-0' }, arrow: { md: 'md:left-auto md:right-6 md:ml-0', xl: 'xl:left-auto xl:right-6 xl:ml-0' } },
  left: { tip: { md: 'md:left-0 md:right-auto md:ml-0', xl: 'xl:left-0 xl:right-auto xl:ml-0' }, arrow: { md: 'md:left-6 md:right-auto md:ml-0', xl: 'xl:left-6 xl:right-auto xl:ml-0' } },
};
const edgeOf = (i, n) => (i % n === n - 1 ? 'right' : i % n === 0 ? 'left' : 'center');

function BedCard({ bed, onClick, index }) {
  const Icon = TYPE_ICON[bed.bed_type] || BedDouble;
  const md = edgeOf(index, 4); const xl = edgeOf(index, 6);
  const st = BED_STATUS[bed.status];
  const skin = {
    available: 'border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-white',
    occupied: 'border-blue-200 bg-gradient-to-br from-blue-50 via-white to-white',
    maintenance: 'border-rose-200 bg-gradient-to-br from-rose-50 via-white to-white',
  }[bed.status];
  return (
    <div className="group relative">
      <button onClick={onClick} style={{ animationDelay: `${Math.min(index, 24) * 18}ms` }}
        className={cx('relative flex h-[132px] w-full animate-fade-up flex-col overflow-hidden rounded-2xl border p-3.5 text-left transition-all duration-200 hover:-translate-y-1 hover:shadow-lift focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/30', skin)}>
        <span className={cx('absolute inset-y-0 left-0 w-1', st.dot)} />
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-extrabold tracking-tight text-navy-900">{bed.bed_number}</span>
          <span className={cx('grid h-7 w-7 place-items-center rounded-lg', st.soft, st.text)}><Icon size={14} /></span>
        </div>

        {bed.status === 'occupied' && (
          <div className="mt-2.5 flex items-center gap-2.5">
            <Avatar src={bed.photo_url} name={fullName(bed)} size={36} ring />
            <div className="min-w-0"><p className="truncate text-sm font-bold leading-tight text-navy-900">{bed.first_name} {bed.last_name?.[0]}.</p><p className="truncate text-[11px] font-medium text-slate-500">{bed.diagnosis || bed.admission_reason}</p></div>
          </div>
        )}
        {bed.status === 'available' && (
          <div className="mt-2.5 flex flex-1 flex-col items-start justify-center"><BedDouble size={26} className="text-emerald-300 transition-transform duration-300 group-hover:scale-110" /><p className="mt-1 text-[11px] font-semibold text-emerald-700/80">Ready for admission</p></div>
        )}
        {bed.status === 'maintenance' && (
          <div className="mt-2.5 flex flex-1 flex-col items-start justify-center"><Wrench size={24} className="text-rose-300" /><p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-tight text-rose-700/80">{bed.notes || 'Under maintenance'}</p></div>
        )}

        <div className="mt-auto flex items-center justify-between pt-1.5">
          <span className={cx('flex items-center gap-1.5 text-[11px] font-bold', st.text)}>
            <span className="relative flex h-2 w-2"><span className={cx('absolute inline-flex h-full w-full rounded-full opacity-60', st.dot, bed.status === 'occupied' && 'animate-ping2')} /><span className={cx('relative inline-flex h-2 w-2 rounded-full', st.dot)} /></span>
            {st.label}
          </span>
          {bed.status === 'occupied' && <span className="rounded-md bg-white/80 px-1.5 py-0.5 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200">{stayLabel(bed.admitted_at)}</span>}
        </div>
      </button>

      {/* hover details */}
      <div className={cx('bed-tip absolute bottom-[calc(100%+8px)] z-30 w-60 rounded-2xl border border-slate-200 bg-white p-3.5 text-left shadow-lift left-1/2 -ml-[120px]', TIP[md].tip.md, TIP[xl].tip.xl)}>
        <p className="text-xs font-semibold text-slate-500">{bed.ward_name}, {titleCase(bed.bed_type)}</p>
        {bed.status === 'occupied' ? (<>
          <p className="mt-1 text-sm font-extrabold text-navy-900">{fullName(bed)}</p>
          <p className="text-xs text-slate-500"><Meta items={[bed.patient_code, `${bed.age}y`, bed.blood_group || 'N/A']} /></p>
          <p className="mt-2 text-xs"><span className="font-bold text-slate-500">Diagnosis:</span> <span className="font-semibold text-navy-800">{bed.diagnosis || bed.admission_reason || 'Under assessment'}</span></p>
          <p className="mt-1 text-xs"><span className="font-bold text-slate-500">Doctor:</span> <span className="font-semibold text-navy-800">{bed.doctor_name ? drName(bed.doctor_name) : 'Unassigned'}</span></p>
          <p className="mt-1 text-xs text-slate-500">Admitted {timeAgo(bed.admitted_at)}</p>
          {bed.allergies && <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-600"><AlertTriangle size={12} /> Allergy: {bed.allergies}</p>}
        </>) : bed.status === 'available' ? (
          <p className="mt-1 text-sm font-semibold text-navy-800">Available, {money(bed.daily_rate)}/day<br /><span className="text-xs font-medium text-slate-500">Click to admit a patient</span></p>
        ) : (
          <p className="mt-1 text-sm font-semibold text-navy-800">{bed.notes || 'Under maintenance'}<br /><span className="text-xs font-medium text-slate-500">Not available for admission</span></p>
        )}
        <span className={cx('absolute -bottom-1.5 left-1/2 -ml-1.5 h-3 w-3 rotate-45 border-b border-r border-slate-200 bg-white', TIP[md].arrow.md, TIP[xl].arrow.xl)} />
      </div>
    </div>
  );
}

/* ============================================================ Drawer */
function BedDrawer({ bed, onClose, canManage, isAdmin, onChanged }) {
  const toast = useToast();
  const [mode, setMode] = useState(null); // 'discharge' | 'maintenance'
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState(false);
  const f = useForm({ patient: null, doctor_id: '', reason: '' });
  const [notes, setNotes] = useState(''); const [cleaning, setCleaning] = useState(true); const [mNote, setMNote] = useState('');

  useEffect(() => { setMode(null); setNotes(''); setMNote(''); f.setValues({ patient: null, doctor_id: '', reason: '' }); f.setErrors({}); /* eslint-disable-next-line */ }, [bed?.id, bed?.status]);
  if (!bed) return null;
  const st = BED_STATUS[bed.status]; const Icon = TYPE_ICON[bed.bed_type] || BedDouble;

  const run = async (fn, okTitle, okMsg) => {
    setBusy(true);
    try { const r = await fn(); toast.success(okTitle, okMsg || r?.message); await onChanged(); setMode(null); }
    catch (e) { toast.error('Action failed', e.message); if (e.status === 409) onChanged(); f.setErrors(e.fields || {}); }
    finally { setBusy(false); }
  };

  const allocate = () => {
    const errs = {};
    if (!f.values.patient) errs.patient_id = 'Select a patient';
    if (f.values.reason.trim().length < 2) errs.reason = 'Add a reason for admission';
    if (Object.keys(errs).length) return f.setErrors(errs);
    run(() => api.post(`/beds/${bed.id}/allocate`, { patient_id: f.values.patient.id, doctor_id: f.values.doctor_id || undefined, reason: f.values.reason }), 'Bed allocated');
  };

  return (
    <Drawer open onClose={onClose} width="max-w-[460px]">
      <div className={cx('relative overflow-hidden px-6 pb-6 pt-6 text-white', bed.status === 'available' ? 'bg-gradient-to-br from-emerald-500 to-teal-700' : bed.status === 'occupied' ? 'bg-gradient-to-br from-blue-600 to-navy-800' : 'bg-gradient-to-br from-rose-500 to-rose-800')}>
        
        <button onClick={onClose} className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-xl bg-white/15 transition hover:bg-white/25" aria-label="Close"><X size={18} /></button>
        <div className="relative flex items-center gap-4">
          <span className="grid h-16 w-16 place-items-center rounded-2xl bg-white/20 backdrop-blur"><Icon size={30} /></span>
          <div><p className="text-xs font-bold text-white/70">{bed.ward_name} ward</p><h2 className="text-3xl font-extrabold leading-tight">{bed.bed_number}</h2></div>
        </div>
        <div className="relative mt-4 flex flex-wrap gap-2 text-xs font-bold">
          <span className="rounded-full bg-white/20 px-3 py-1 backdrop-blur">{st.label}</span>
          <span className="rounded-full bg-white/20 px-3 py-1 backdrop-blur">{titleCase(bed.bed_type)} bed</span>
          <span className="rounded-full bg-white/20 px-3 py-1 backdrop-blur">{money(bed.daily_rate)} / day</span>
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-6">
        {/* ----- occupied ----- */}
        {bed.status === 'occupied' && (<>
          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center gap-4">
              <Avatar src={bed.photo_url} name={fullName(bed)} size={64} ring />
              <div className="min-w-0"><p className="truncate text-lg font-extrabold text-navy-900">{fullName(bed)}</p><p className="text-sm text-slate-500">{bed.patient_code}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5"><Badge tone="navy">{bed.age} yrs</Badge><Badge tone="slate">{titleCase(bed.gender)}</Badge>{bed.blood_group && <Badge tone="red">{bed.blood_group}</Badge>}</div></div>
            </div>
            {bed.allergies && <p className="mt-3 flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700"><AlertTriangle size={16} className="mt-0.5 shrink-0" /> Allergies: {bed.allergies}</p>}
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {[[Stethoscope, 'Diagnosis', bed.diagnosis || 'Under assessment'], [UserRound, 'Attending doctor', bed.doctor_name ? drName(bed.doctor_name) : 'Unassigned'], [CalendarClock, 'Admitted', fmtDateTime(bed.admitted_at)], [DollarSign, `Est. charges (${daysSince(bed.admitted_at)} d)`, money(daysSince(bed.admitted_at) * bed.daily_rate)]].map(([I, l, v]) => (
              <div key={l} className="rounded-xl bg-slate-50 p-3"><dt className="flex items-center gap-1.5 text-xs font-semibold text-slate-500"><I size={12} />{l}</dt><dd className="mt-1 font-semibold text-navy-900">{v}</dd></div>
            ))}
          </dl>
          {bed.admission_reason && <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600"><b className="text-navy-800">Reason for admission:</b> {bed.admission_reason}</p>}
          <Link to={`/patients/${bed.patient_id}`}><Button variant="outline" className="w-full" icon={UserRound}>Open patient profile</Button></Link>

          {canManage && mode !== 'discharge' && <Button variant="dangerSoft" className="w-full" icon={LogOut} onClick={() => setMode('discharge')}>Discharge patient</Button>}
          {canManage && mode === 'discharge' && (
            <div className="animate-pop space-y-4 rounded-2xl border border-rose-200 bg-rose-50/50 p-4">
              <p className="text-sm font-bold text-navy-900">Discharge {bed.first_name}?</p>
              <Field label="Discharge notes"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Condition at discharge, follow-up instructions…" /></Field>
              <label className="flex cursor-pointer items-center gap-3 text-sm font-medium text-slate-700"><input type="checkbox" checked={cleaning} onChange={(e) => setCleaning(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500" /> Send bed for cleaning / maintenance</label>
              <div className="flex gap-3"><Button variant="outline" size="sm" className="flex-1" onClick={() => setMode(null)}>Cancel</Button>
                <Button variant="danger" size="sm" className="flex-1" loading={busy} onClick={() => run(() => api.post(`/beds/${bed.id}/discharge`, { notes, send_to_cleaning: cleaning }), 'Patient discharged')}>Confirm discharge</Button></div>
            </div>
          )}
        </>)}

        {/* ----- available ----- */}
        {bed.status === 'available' && canManage && (<>
          <div className="space-y-4">
            <h3 className="flex items-center gap-2 text-base font-extrabold text-navy-900"><Plus size={18} className="text-teal-600" /> Admit a patient to this bed</h3>
            <Field label="Patient" required error={f.errors.patient_id}><PatientPicker value={f.values.patient} excludeAdmitted error={f.errors.patient_id}
              onChange={(p) => { f.set('patient', p); f.set('patient_id', undefined); if (p?.assigned_doctor_id && !f.values.doctor_id) f.set('doctor_id', p.assigned_doctor_id); }} /></Field>
            <Field label="Attending doctor" hint="Defaults to the patient's assigned doctor"><DoctorSelect value={f.values.doctor_id} onChange={(v) => f.set('doctor_id', v)} /></Field>
            <Field label="Reason for admission" required error={f.errors.reason}><Input value={f.values.reason} onChange={(e) => f.set('reason', e.target.value)} error={f.errors.reason} placeholder="e.g. Chest pain, under observation" /></Field>
            <Button className="w-full" size="lg" loading={busy} icon={Check} onClick={allocate}>Allocate bed</Button>
          </div>
          <div className="border-t border-slate-100 pt-5">
            {mode !== 'maintenance' ? <Button variant="outline" className="w-full" icon={Wrench} onClick={() => setMode('maintenance')}>Mark under maintenance</Button> : (
              <div className="animate-pop space-y-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                <Field label="Maintenance note"><Input value={mNote} onChange={(e) => setMNote(e.target.value)} placeholder="e.g. Mattress replacement" /></Field>
                <div className="flex gap-3"><Button variant="outline" size="sm" className="flex-1" onClick={() => setMode(null)}>Cancel</Button><Button size="sm" variant="navy" className="flex-1" loading={busy} onClick={() => run(() => api.patch(`/beds/${bed.id}/status`, { status: 'maintenance', notes: mNote }), 'Bed marked for maintenance')}>Confirm</Button></div>
              </div>)}
          </div>
        </>)}
        {bed.status === 'available' && !canManage && <EmptyState icon={BedDouble} title="Bed is available" text="Reception can allocate this bed to a patient." />}

        {/* ----- maintenance ----- */}
        {bed.status === 'maintenance' && (<>
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-center"><Wrench size={30} className="mx-auto text-rose-400" /><p className="mt-2 font-bold text-rose-800">Under maintenance</p><p className="mt-1 text-sm text-rose-700/80">{bed.notes || 'This bed is temporarily out of service.'}</p></div>
          {canManage && <Button className="w-full" icon={Check} loading={busy} onClick={() => run(() => api.patch(`/beds/${bed.id}/status`, { status: 'available' }), 'Bed returned to service')}>Return to service</Button>}
        </>)}

        {isAdmin && bed.status !== 'occupied' && (
          <button onClick={() => setDel(true)} className="flex w-full items-center justify-center gap-2 pt-2 text-xs font-semibold text-slate-400 transition hover:text-rose-600"><Trash2 size={13} /> Delete this bed</button>
        )}
      </div>
      <ConfirmModal open={del} onClose={() => setDel(false)} loading={busy} title={`Delete bed ${bed.bed_number}?`} message="The bed will be removed from the ward. This only works for beds without admission history." confirmText="Delete bed"
        onConfirm={async () => { setBusy(true); try { await api.del(`/beds/${bed.id}`); toast.success('Bed deleted'); setDel(false); onClose(); await onChanged(); } catch (e) { toast.error('Cannot delete bed', e.message); setDel(false); } finally { setBusy(false); } }} />
    </Drawer>
  );
}

/* ============================================================ Admit modal */
export function AdmitModal({ open, onClose, onDone, wards: wardsProp, presetPatient }) {
  const toast = useToast();
  const f = useForm({ patient: null, bed_id: '', doctor_id: '', reason: '' });
  const [wardId, setWardId] = useState('all');
  const [busy, setBusy] = useState(false);
  const [wardsLoaded, setWardsLoaded] = useState([]);
  const wards = wardsProp || wardsLoaded;
  const { data: free, loading, reload } = useFetch(() => api.get('/beds/available'), [open], { enabled: open });
  useEffect(() => { if (open && !wardsProp) api.get('/beds/wards').then(setWardsLoaded).catch(() => {}); }, [open, wardsProp]);
  useEffect(() => {
    if (open) {
      f.setValues({ patient: presetPatient || null, bed_id: '', doctor_id: presetPatient?.assigned_doctor_id || '', reason: '' });
      f.setErrors({}); setWardId('all');
    }
    /* eslint-disable-next-line */
  }, [open]);

  const list = (free || []).filter((b) => wardId === 'all' || b.ward_id === Number(wardId));
  const submit = async () => {
    const errs = {};
    if (!f.values.patient) errs.patient_id = 'Select a patient';
    if (!f.values.bed_id) errs.bed_id = 'Choose a bed';
    if (f.values.reason.trim().length < 2) errs.reason = 'Add a reason for admission';
    if (Object.keys(errs).length) return f.setErrors(errs);
    setBusy(true);
    try {
      const r = await api.post('/admissions', { patient_id: f.values.patient.id, bed_id: f.values.bed_id, doctor_id: f.values.doctor_id || undefined, reason: f.values.reason });
      toast.success('Patient admitted', `${fullName(r)} admitted to ${r.ward_name} ${r.bed_number}`); onDone(); onClose();
    } catch (e) { toast.error('Admission failed', e.message); f.setErrors(e.fields || {}); reload(); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} size="lg" icon={BedDouble} title="Admit a patient" subtitle="Pick a patient, then choose any free bed. Double bookings are blocked automatically."
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button loading={busy} icon={Check} onClick={submit}>Admit patient</Button></>}>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-4">
          <Field label="Patient" required error={f.errors.patient_id}><PatientPicker value={f.values.patient} excludeAdmitted disabled={!!presetPatient} error={f.errors.patient_id} onChange={(p) => { f.set('patient', p); if (p?.assigned_doctor_id && !f.values.doctor_id) f.set('doctor_id', p.assigned_doctor_id); }} /></Field>
          <Field label="Attending doctor"><DoctorSelect value={f.values.doctor_id} onChange={(v) => f.set('doctor_id', v)} /></Field>
          <Field label="Reason for admission" required error={f.errors.reason}><Textarea value={f.values.reason} onChange={(e) => f.set('reason', e.target.value)} error={f.errors.reason} placeholder="Presenting complaint / diagnosis" /></Field>
        </div>
        <div>
          <Field label={`Available beds (${list.length})`} required error={f.errors.bed_id}>
            <Select value={wardId} onChange={(e) => setWardId(e.target.value)} className="mb-3"><option value="all">All wards</option>{wards.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</Select>
            <div className={cx('max-h-[270px] space-y-3 overflow-y-auto rounded-xl border p-3', f.errors.bed_id ? 'border-rose-300' : 'border-slate-200')}>
              {loading && <Skeleton className="h-16 w-full" />}
              {!loading && list.length === 0 && <p className="py-6 text-center text-sm text-slate-500">No free beds in this ward</p>}
              {wards.filter((w) => list.some((b) => b.ward_id === w.id)).map((w) => (
                <div key={w.id}><p className="mb-1.5 text-xs font-semibold text-slate-500">{w.name}</p>
                  <div className="flex flex-wrap gap-2">{list.filter((b) => b.ward_id === w.id).map((b) => (
                    <button key={b.id} type="button" aria-pressed={f.values.bed_id === b.id} onClick={() => f.set('bed_id', b.id)} className={cx('rounded-xl border px-3 py-2 text-sm font-bold transition', f.values.bed_id === b.id ? 'border-teal-600 bg-teal-600 text-white shadow-soft' : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-400')}>{b.bed_number}</button>))}</div></div>
              ))}
            </div>
          </Field>
        </div>
      </div>
    </Modal>
  );
}

function AddBedModal({ open, onClose, wards, onDone }) {
  const toast = useToast(); const f = useForm({ ward_id: '', bed_number: '', bed_type: 'standard', daily_rate: 120 }); const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { f.setValues({ ward_id: wards[0]?.id || '', bed_number: '', bed_type: 'standard', daily_rate: 120 }); f.setErrors({}); } /* eslint-disable-next-line */ }, [open]);
  const submit = async () => {
    setBusy(true);
    try { await api.post('/beds', f.values); toast.success('Bed added', `${f.values.bed_number} is now available`); onDone(); onClose(); }
    catch (e) { f.setErrors(e.fields || { bed_number: e.status === 409 ? 'This bed number already exists in the ward' : undefined }); toast.error('Could not add bed', e.message); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} size="sm" icon={Plus} title="Add a new bed" footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={submit}>Add bed</Button></>}>
      <div className="space-y-4">
        <Field label="Ward" required error={f.errors.ward_id}><Select {...f.bind('ward_id')}>{wards.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</Select></Field>
        <Field label="Bed number" required error={f.errors.bed_number}><Input {...f.bind('bed_number')} error={f.errors.bed_number} placeholder="e.g. MS-125" /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Bed type"><Select {...f.bind('bed_type')}><option value="standard">Standard</option><option value="icu">ICU</option><option value="private">Private</option><option value="isolation">Isolation</option></Select></Field>
          <Field label="Daily rate ($)"><Input type="number" min="0" {...f.bind('daily_rate')} /></Field>
        </div>
      </div>
    </Modal>
  );
}

/* ============================================================ Page */
export default function Beds() {
  const { user } = useAuth();
  const canManage = user.role === 'admin' || user.role === 'receptionist'; const isAdmin = user.role === 'admin';
  const [params, setParams] = useSearchParams();
  const { data, loading, error, reload, refresh, updatedAt } = useFetch(() => api.get('/beds'), [], { interval: 20000 });
  const [ward, setWard] = useState('all'); const [status, setStatus] = useState('all'); const [q, setQ] = useState('');
  const [sel, setSel] = useState(null); const [admit, setAdmit] = useState(params.get('admit') === '1'); const [addBed, setAddBed] = useState(false);
  useTick(10000);
  useEffect(() => { if (params.get('admit')) { setParams({}, { replace: true }); } /* eslint-disable-next-line */ }, []);

  const beds = useMemo(() => (data ? data.wards.flatMap((w) => w.beds) : []), [data]);
  const selBed = beds.find((b) => b.id === sel) || null;
  const sum = data?.summary;
  const hot = data?.wards.filter((w) => w.counts.occupancy >= 85) || [];
  const activeWard = data?.wards.find((w) => String(w.id) === String(ward));

  const matches = (b) => (status === 'all' || b.status === status) && (!q.trim() || [b.bed_number, fullName(b), b.patient_code, b.diagnosis, b.doctor_name].some((v) => v && String(v).toLowerCase().includes(q.trim().toLowerCase())));
  const shown = (data?.wards || []).filter((w) => ward === 'all' || String(w.id) === String(ward)).map((w) => ({ ...w, visible: w.beds.filter(matches) }));
  const visibleCount = shown.reduce((a, w) => a + w.visible.length, 0);

  if (loading && !data) return <div className="space-y-5"><Skeleton className="h-56 w-full !rounded-3xl" /><div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div><div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-6">{Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-[132px]" />)}</div></div>;
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;

  const secs = updatedAt ? Math.round((Date.now() - updatedAt.getTime()) / 1000) : 0;
  const tiles = [
    { id: 'all', label: 'Total beds', value: sum.total, sub: `across ${data.wards.length} wards`, icon: BedDouble, cls: 'from-navy-700 to-navy-900', ring: 'ring-navy-300' },
    { id: 'available', label: 'Available', value: sum.available, sub: 'ready for admission', icon: Check, cls: 'from-emerald-400 to-emerald-600', ring: 'ring-emerald-300' },
    { id: 'occupied', label: 'Occupied', value: sum.occupied, sub: `${sum.occupancy}% occupancy`, icon: UserRound, cls: 'from-blue-400 to-blue-600', ring: 'ring-blue-300' },
    { id: 'maintenance', label: 'Maintenance', value: sum.maintenance, sub: 'cleaning / repairs', icon: Wrench, cls: 'from-rose-400 to-rose-600', ring: 'ring-rose-300' },
  ];

  return (
    <>
      {/* hero */}
      <section className="relative mb-6 overflow-hidden dark-surface rounded-3xl bg-navy-950 text-white shadow-soft">
        <img src={activeWard?.image_url || IMAGES.ward} alt="" key={activeWard?.id || 'all'} className="absolute inset-y-0 right-0 h-full w-full animate-fade-in object-cover opacity-50 lg:w-[58%] lg:opacity-100"
          style={{ maskImage: 'linear-gradient(to left, black 20%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to left, black 20%, transparent 100%)' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        <div className="absolute inset-0 bg-gradient-to-r from-navy-950 via-navy-950/90 to-navy-950/20" />
        <div className="relative flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between lg:p-10">
          <div className="max-w-xl">
            <div className="flex flex-wrap items-center gap-3"><LivePill label="Live" className="bg-emerald-400/15 text-emerald-300 ring-emerald-400/30" /><span className="flex items-center gap-1.5 text-xs font-medium text-slate-300"><RefreshCw size={12} aria-hidden="true" />Updated {secs < 5 ? 'just now' : `${secs}s ago`}</span></div>
            <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.1] sm:text-5xl">Bed management</h1>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-300 sm:text-base">{activeWard ? `${activeWard.name}: ${activeWard.description}` : (canManage ? 'Live view of every bed in the hospital. Click a bed to admit, discharge or take it out of service.' : 'Live view of every bed in the hospital. Click a bed to see the patient and admission details.')}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              {canManage && <Button icon={Plus} onClick={() => setAdmit(true)}>Admit patient</Button>}
              {isAdmin && <Button variant="glass" icon={BedDouble} onClick={() => setAddBed(true)}>Add bed</Button>}
              <Button variant="glass" icon={RefreshCw} onClick={refresh}>Refresh</Button>
            </div>
          </div>
          <div className="glass flex items-center gap-5 rounded-3xl p-5">
            <Ring value={sum.occupancy} size={108} stroke={11} color="#5eead4" track="rgba(255,255,255,.14)"><div><p className="text-3xl font-extrabold leading-none"><Count value={sum.occupancy} suffix="%" /></p><p className="mt-1 text-xs font-semibold text-slate-300">Occupancy</p></div></Ring>
            <div className="space-y-2 text-sm font-semibold">{[['Available', sum.available, 'bg-emerald-400'], ['Occupied', sum.occupied, 'bg-blue-400'], ['Maintenance', sum.maintenance, 'bg-rose-400']].map(([l, v, c]) => <p key={l} className="flex items-center gap-2.5"><span className={cx('h-2.5 w-2.5 rounded-full', c)} /><span className="w-[88px] text-slate-300">{l}</span><b className="text-lg">{v}</b></p>)}</div>
          </div>
        </div>
      </section>

      {hot.length > 0 && (
        <div className="mb-6 flex animate-fade-up items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3.5 text-sm font-semibold text-amber-800"><AlertTriangle size={18} className="shrink-0" />
          {hot.map((w) => `${w.name} is at ${w.counts.occupancy}% capacity`).join('; ')}. Consider planning discharges or transfers.</div>
      )}

      {/* KPI tiles */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((t, i) => (
          <button key={t.id} type="button" aria-pressed={status === t.id} onClick={() => setStatus(status === t.id ? 'all' : t.id)} style={{ animationDelay: `${i * 60}ms` }}
            className={cx('card card-hover relative animate-fade-up overflow-hidden p-4 text-left sm:p-5', status === t.id && t.id !== 'all' && `ring-4 ${t.ring}`)}>
            <div className="flex items-center justify-between"><p className="text-[13px] font-semibold text-slate-500">{t.label}</p><span className={cx('grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br text-white', t.cls)}><t.icon size={17} /></span></div>
            <p className="num mt-2 font-display text-[34px] font-semibold leading-none text-navy-900 sm:text-[40px]"><Count value={t.value} /></p>
            <p className="mt-2 text-xs font-medium text-slate-500">{t.sub}</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={cx('h-full rounded-full bg-gradient-to-r transition-all duration-1000', t.cls)} style={{ width: `${(t.value / sum.total) * 100}%` }} /></div>
          </button>
        ))}
      </div>

      {/* ward tabs */}
      <div className="mb-4 flex gap-3 overflow-x-auto pb-2">
        <button type="button" aria-pressed={ward === 'all'} onClick={() => setWard('all')} className={cx('flex shrink-0 items-center gap-3 rounded-2xl border px-4 py-2.5 text-left transition-all', ward === 'all' ? 'border-teal-500 bg-teal-50 shadow-ring' : 'border-slate-200 bg-white hover:border-teal-300')}>
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-navy-700 to-navy-900 text-white"><BedDouble size={20} /></span>
          <span><span className="block text-sm font-extrabold text-navy-900">All wards</span><span className="block text-xs font-medium text-slate-500">{sum.occupied}/{sum.total} occupied</span></span></button>
        {data.wards.map((w) => (
          <button key={w.id} type="button" aria-pressed={String(ward) === String(w.id)} onClick={() => setWard(String(w.id))} className={cx('flex shrink-0 items-center gap-3 rounded-2xl border px-4 py-2.5 text-left transition-all', String(ward) === String(w.id) ? 'border-teal-500 bg-teal-50 shadow-ring' : 'border-slate-200 bg-white hover:border-teal-300')}>
            <img src={w.image_url} alt="" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} className="h-11 w-11 rounded-xl bg-navy-100 object-cover" />
            <span><span className="block text-sm font-extrabold text-navy-900">{w.name}</span><span className="block text-xs font-medium text-slate-500"><Meta items={[`${w.counts.occupied}/${w.counts.total} occupied`, <span key="f" className="font-bold text-emerald-700">{w.counts.available} free</span>]} /></span></span></button>
        ))}
      </div>

      {/* toolbar */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <FilterChip active={status === 'all'} onClick={() => setStatus('all')} count={sum.total}>All</FilterChip>
          <FilterChip active={status === 'available'} onClick={() => setStatus('available')} count={sum.available} dot="bg-emerald-500">Available</FilterChip>
          <FilterChip active={status === 'occupied'} onClick={() => setStatus('occupied')} count={sum.occupied} dot="bg-blue-500">Occupied</FilterChip>
          <FilterChip active={status === 'maintenance'} onClick={() => setStatus('maintenance')} count={sum.maintenance} dot="bg-rose-500">Maintenance</FilterChip>
        </div>
        <SearchInput value={q} onChange={setQ} placeholder="Find bed, patient or doctor…" className="w-full sm:w-72" />
      </div>

      {/* grid */}
      {visibleCount === 0 ? <div className="card"><EmptyState icon={BedDouble} title="No beds match your filters" text="Try another ward, status or search term." action={<Button variant="outline" size="sm" onClick={() => { setStatus('all'); setQ(''); setWard('all'); }}>Clear filters</Button>} /></div> : (
        <div className="space-y-8">
          {shown.filter((w) => w.visible.length > 0).map((w) => (
            <section key={w.id}>
              <div className="mb-4 flex flex-wrap items-center gap-4">
                <img src={w.image_url} alt="" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} className="h-14 w-14 rounded-2xl bg-navy-100 object-cover shadow-soft" />
                <div className="min-w-0 flex-1"><h2 className="text-lg font-extrabold text-navy-900">{w.name}<span className="ml-2 text-sm font-semibold text-slate-500">{w.floor}</span></h2><p className="text-sm text-slate-500">{w.description}</p></div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700 ring-1 ring-emerald-200">{w.counts.available} free</span>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700 ring-1 ring-blue-200">{w.counts.occupied} occupied</span>
                  {w.counts.maintenance > 0 && <span className="rounded-full bg-rose-50 px-3 py-1 text-rose-700 ring-1 ring-rose-200">{w.counts.maintenance} maintenance</span>}
                  <span className={cx('rounded-full px-3 py-1 ring-1', w.counts.occupancy >= 85 ? 'bg-rose-500 text-white ring-rose-500' : 'bg-navy-900 text-white ring-navy-900')}>{w.counts.occupancy}%</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                {w.visible.map((b, i) => <BedCard key={b.id} bed={b} index={i} onClick={() => setSel(b.id)} />)}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* legend */}
      <div className="card mt-8 flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-semibold text-slate-600">
          {Object.entries(BED_STATUS).map(([k, v]) => <span key={k} className="flex items-center gap-2"><span className={cx('h-3 w-3 rounded-md', v.dot)} />{v.label}</span>)}
          <span className="hidden h-4 w-px bg-slate-200 sm:block" />
          {Object.entries(TYPE_ICON).map(([k, I]) => <span key={k} className="flex items-center gap-1.5 text-xs text-slate-500"><I size={14} />{titleCase(k)}</span>)}
        </div>
        <p className="text-xs font-medium text-slate-400">Hover a bed for a quick summary, click for actions. The board refreshes every 20 seconds.</p>
      </div>

      <BedDrawer bed={selBed} onClose={() => setSel(null)} canManage={canManage} isAdmin={isAdmin} onChanged={refresh} />
      {canManage && <AdmitModal open={admit} onClose={() => setAdmit(false)} wards={data.wards} onDone={refresh} />}
      {isAdmin && <AddBedModal open={addBed} onClose={() => setAddBed(false)} wards={data.wards} onDone={refresh} />}
    </>
  );
}
