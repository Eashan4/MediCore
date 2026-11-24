import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarCheck, CalendarDays, CalendarPlus, CheckCircle2, LogIn, MoreVertical, Pencil, PlayCircle, Trash2, UserX, XCircle } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useDebounce, useFetch, useForm } from '../hooks';
import { Avatar, Badge, Button, ConfirmModal, cx, EmptyState, ErrorState, Field, FilterChip, IconButton, Input, Menu, MenuItem, Meta, Modal, PageHeader, Pagination, SearchInput, Select, Skeleton, Textarea } from '../components/ui';
import { DoctorSelect, PatientPicker } from '../components/ui/pickers';
import { APPT_STATUS } from '../lib/constants';
import { drName, fmtDate, fmtTime, fullName, relativeDay, titleCase, toInputDate, toInputDateTime } from '../lib/format';

export function AppointmentModal({ open, onClose, appt, presetPatient, onSaved }) {
  const toast = useToast();
  const f = useForm({ patient: null, doctor_id: '', scheduled_at: '', duration_min: 30, type: 'consultation', reason: '', notes: '' });
  const [busy, setBusy] = useState(false); const editing = !!appt;
  useEffect(() => {
    if (!open) return;
    f.setErrors({});
    if (appt) f.setValues({ patient: { id: appt.patient_id, first_name: appt.first_name, last_name: appt.last_name, patient_code: appt.patient_code, photo_url: appt.patient_photo, age: appt.age, gender: appt.gender }, doctor_id: appt.doctor_id, scheduled_at: appt.scheduled_at.slice(0, 16).replace(' ', 'T'), duration_min: appt.duration_min, type: appt.type, reason: appt.reason || '', notes: appt.notes || '' });
    else { const d = new Date(); d.setMinutes(Math.ceil((d.getMinutes() + 1) / 15) * 15, 0, 0); f.setValues({ patient: presetPatient || null, doctor_id: presetPatient?.assigned_doctor_id || '', scheduled_at: toInputDateTime(d), duration_min: 30, type: 'consultation', reason: '', notes: '' }); }
    /* eslint-disable-next-line */
  }, [open, appt]);

  const submit = async () => {
    const e = {};
    if (!f.values.patient) e.patient_id = 'Select a patient';
    if (!f.values.doctor_id) e.doctor_id = 'Select a doctor';
    if (!f.values.scheduled_at) e.scheduled_at = 'Pick a date and time';
    if (Object.keys(e).length) return f.setErrors(e);
    setBusy(true);
    const body = { patient_id: f.values.patient.id, doctor_id: f.values.doctor_id, scheduled_at: f.values.scheduled_at, duration_min: Number(f.values.duration_min), type: f.values.type, reason: f.values.reason, notes: f.values.notes };
    try {
      const r = editing ? await api.put(`/appointments/${appt.id}`, body) : await api.post('/appointments', body);
      toast.success(editing ? 'Appointment rescheduled' : 'Appointment booked', `${fullName(r)} with ${drName(r.doctor_name)} on ${fmtDate(r.scheduled_at)} at ${fmtTime(r.scheduled_at)}`);
      onSaved?.(r); onClose();
    } catch (err) { f.setErrors(err.fields || {}); toast.error(err.status === 409 ? 'Time slot unavailable' : 'Could not save appointment', err.message); } finally { setBusy(false); }
  };
  const E = f.errors;
  return (
    <Modal open={open} onClose={onClose} size="md" icon={CalendarPlus} title={editing ? 'Reschedule appointment' : 'Book an appointment'} subtitle="Overlapping bookings for the same doctor or patient are blocked"
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button loading={busy} icon={CalendarCheck} onClick={submit}>{editing ? 'Save changes' : 'Book appointment'}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Patient" required error={E.patient_id} className="sm:col-span-2"><PatientPicker value={f.values.patient} onChange={(p) => { f.set('patient', p); if (p?.assigned_doctor_id && !f.values.doctor_id) f.set('doctor_id', p.assigned_doctor_id); }} disabled={editing || !!presetPatient} error={E.patient_id} /></Field>
        <Field label="Doctor" required error={E.doctor_id} className="sm:col-span-2"><DoctorSelect value={f.values.doctor_id} onChange={(v) => f.set('doctor_id', v)} error={E.doctor_id} /></Field>
        <Field label="Date & time" required error={E.scheduled_at}><Input type="datetime-local" step="900" {...f.bind('scheduled_at')} error={E.scheduled_at} /></Field>
        <Field label="Duration"><Select {...f.bind('duration_min')}>{[15, 20, 30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} minutes</option>)}</Select></Field>
        <Field label="Type"><Select {...f.bind('type')}>{['consultation', 'follow_up', 'checkup', 'procedure', 'emergency'].map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}</Select></Field>
        <Field label="Reason for visit"><Input {...f.bind('reason')} placeholder="e.g. Chest pain review" /></Field>
        <Field label="Notes" className="sm:col-span-2"><Textarea rows={2} {...f.bind('notes')} /></Field>
      </div>
    </Modal>
  );
}

export default function Appointments() {
  const { user } = useAuth(); const toast = useToast(); const [params, setParams] = useSearchParams();
  const canBook = user.role !== 'doctor'; const isDoc = user.role === 'doctor'; const isAdmin = user.role === 'admin';
  const [range, setRange] = useState('today'); const [status, setStatus] = useState(''); const [search, setSearch] = useState(''); const [doctor, setDoctor] = useState(''); const [page, setPage] = useState(1);
  const dSearch = useDebounce(search, 300);
  const [open, setOpen] = useState(params.get('new') === '1'); const [edit, setEdit] = useState(null); const [del, setDel] = useState(null);
  useEffect(() => { if (params.get('new')) setParams({}, { replace: true }); /* eslint-disable-next-line */ }, []);
  useEffect(() => setPage(1), [range, status, dSearch, doctor]);

  const query = () => {
    const base = { status, search: dSearch, doctor_id: doctor, page, limit: 12 };
    if (range === 'today') return { ...base, date: toInputDate(), order: 'asc' };
    if (range === 'week') return { ...base, range: 'week', order: 'asc' };
    if (range === 'upcoming') return { ...base, range: 'upcoming', order: 'asc' };
    return { ...base, order: 'desc' };
  };
  const { data, loading, error, reload } = useFetch(() => api.get('/appointments', query()), [range, status, dSearch, doctor, page]);

  const setSt = async (a, s, msg) => {
    try { await api.patch(`/appointments/${a.id}/status`, { status: s }); toast.success(msg, fullName(a)); reload(); } catch (e) { toast.error('Update failed', e.message); }
  };
  const remove = async () => { try { await api.del(`/appointments/${del.id}`); toast.success('Appointment deleted'); setDel(null); reload(); } catch (e) { toast.error('Delete failed', e.message); } };

  return (
    <>
      <PageHeader icon={CalendarDays} title={isDoc ? 'My appointments' : 'Appointments'} subtitle="Schedule, check in and track patient visits"
        actions={canBook && <Button icon={CalendarPlus} onClick={() => setOpen(true)}>Book appointment</Button>} />

      <div className="card mb-5 flex flex-wrap items-center gap-3 p-4">
        <div className="flex flex-wrap gap-2">{[['today', 'Today'], ['week', 'Next 7 days'], ['upcoming', 'All upcoming'], ['all', 'History']].map(([k, l]) => <FilterChip key={k} active={range === k} onClick={() => setRange(k)}>{l}</FilterChip>)}</div>
        <span className="hidden h-6 w-px bg-slate-200 md:block" />
        <div className="w-44"><Select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Any status</option>{Object.entries(APPT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select></div>
        {!isDoc && <div className="w-56"><DoctorSelect value={doctor} onChange={setDoctor} placeholder="All doctors" onlyActive={false} /></div>}
        <SearchInput value={search} onChange={setSearch} placeholder={isDoc ? 'Search patient…' : 'Search patient or doctor…'} className="ml-auto w-full md:w-64" />
      </div>

      {error && !data ? <ErrorState error={error} onRetry={reload} /> : (
        <div className="space-y-3">
          {loading && !data && Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 w-full !rounded-2xl" />)}
          {data?.data.map((a, i) => {
            const st = APPT_STATUS[a.status]; const open_ = a.status === 'scheduled' || a.status === 'checked_in';
            return (
              <div key={a.id} style={{ animationDelay: `${i * 25}ms` }} className="card card-hover flex animate-fade-up flex-wrap items-center gap-4 p-4 sm:p-5">
                <div className={cx('grid w-[92px] shrink-0 place-items-center rounded-2xl py-2.5 text-center', open_ ? 'bg-navy-900 text-white' : 'bg-slate-100 text-slate-500')}>
                  <p className="text-xs font-bold opacity-80">{relativeDay(a.scheduled_at) === fmtDate(a.scheduled_at) ? fmtDate(a.scheduled_at).slice(0, 6) : relativeDay(a.scheduled_at)}</p>
                  <p className="whitespace-nowrap text-lg font-extrabold leading-tight">{fmtTime(a.scheduled_at)}</p><p className="text-[10px] font-semibold opacity-80">{a.duration_min} min</p>
                </div>
                <div className="flex min-w-[170px] flex-1 items-center gap-3 xl:min-w-[220px]">
                  <Avatar src={a.patient_photo} name={fullName(a)} size={48} />
                  <div className="min-w-0"><Link to={`/patients/${a.patient_id}`} className="block truncate text-base font-bold text-navy-900 hover:text-teal-700">{fullName(a)}</Link>
                    <p className="text-xs text-slate-500"><Meta items={[a.patient_code, `${a.age}y`, a.reason || titleCase(a.type)]} /></p></div>
                </div>
                {!isDoc && <div className="flex min-w-[150px] items-center gap-2.5 xl:min-w-[190px]"><Avatar src={a.doctor_avatar} name={a.doctor_name} size={34} /><div className="min-w-0"><p className="truncate text-sm font-semibold text-navy-800">{drName(a.doctor_name)}</p><p className="truncate text-xs text-slate-500">{a.specialization}</p></div></div>}
                <Badge tone={st.tone} dot={a.status === 'checked_in'} pulse={a.status === 'checked_in'}>{st.label}</Badge>
                <Badge tone="slate" className="hidden xl:inline-flex">{titleCase(a.type)}</Badge>
                <div className="ml-auto flex items-center gap-2">
                  {user.role !== 'doctor' && a.status === 'scheduled' && <Button size="xs" variant="soft" icon={LogIn} onClick={() => setSt(a, 'checked_in', 'Patient checked in')}>Check in</Button>}
                  {isDoc && a.status === 'scheduled' && <Button size="xs" variant="soft" icon={PlayCircle} onClick={() => setSt(a, 'checked_in', 'Consultation started')}>Start</Button>}
                  {isDoc && a.status === 'checked_in' && <Button size="xs" icon={CheckCircle2} onClick={() => setSt(a, 'completed', 'Consultation completed')}>Complete</Button>}
                  {open_ && (
                    <Menu trigger={() => <IconButton icon={MoreVertical} label="More actions" />}>
                      {a.status === 'checked_in' && !isDoc && <MenuItem icon={CheckCircle2} onClick={() => setSt(a, 'completed', 'Marked completed')}>Mark completed</MenuItem>}
                      {canBook && <MenuItem icon={Pencil} onClick={() => setEdit(a)}>Reschedule</MenuItem>}
                      <MenuItem icon={UserX} onClick={() => setSt(a, 'no_show', 'Marked as no-show')}>Mark no-show</MenuItem>
                      {canBook && <MenuItem icon={XCircle} danger onClick={() => setSt(a, 'cancelled', 'Appointment cancelled')}>Cancel appointment</MenuItem>}
                    </Menu>)}
                  {isAdmin && <IconButton icon={Trash2} label="Delete" className="hover:!bg-rose-50 hover:!text-rose-600" onClick={() => setDel(a)} />}
                </div>
              </div>
            );
          })}
          {data && data.data.length === 0 && <div className="card"><EmptyState icon={CalendarDays} title="No appointments found" text="Nothing matches the selected range and filters." action={canBook && <Button size="sm" icon={CalendarPlus} onClick={() => setOpen(true)}>Book appointment</Button>} /></div>}
        </div>
      )}
      {data && <div className="mt-5"><Pagination page={data.page} pages={data.pages} total={data.total} limit={data.limit} onChange={setPage} /></div>}

      <AppointmentModal open={open || !!edit} appt={edit} onClose={() => { setOpen(false); setEdit(null); }} onSaved={reload} />
      <ConfirmModal open={!!del} onClose={() => setDel(null)} onConfirm={remove} title="Delete appointment?" message="This permanently removes the appointment record. To keep history, cancel it instead." confirmText="Delete" />
    </>
  );
}
