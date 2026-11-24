import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { BedDouble, Droplets, Eye, Pencil, Phone, Plus, Trash2, UserPlus, Users } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useDebounce, useFetch, useForm } from '../hooks';
import { Avatar, Badge, Button, ConfirmModal, EmptyState, ErrorState, Field, FilterChip, IconButton, Input, Meta, Modal, PageHeader, Pagination, SearchInput, Select, Skeleton, Td, TableShell, Textarea, Th, cx } from '../components/ui';
import { DoctorSelect } from '../components/ui/pickers';
import { BLOOD_GROUPS } from '../lib/constants';
import { fmtDate, fullName, timeAgo, toInputDate } from '../lib/format';

const EMPTY = { first_name: '', last_name: '', dob: '', gender: '', blood_group: '', phone: '', email: '', address: '', city: '', emergency_contact_name: '', emergency_contact_phone: '', allergies: '', chronic_conditions: '', insurance_provider: '', insurance_no: '', assigned_doctor_id: '' };

/** Create / edit a patient. Shared with the patient profile page. */
export function PatientFormModal({ open, onClose, patient, onSaved }) {
  const toast = useToast(); const { user } = useAuth();
  const f = useForm(EMPTY); const [busy, setBusy] = useState(false);
  const editing = !!patient;
  useEffect(() => {
    if (!open) return;
    f.setErrors({});
    f.setValues(patient ? Object.fromEntries(Object.keys(EMPTY).map((k) => [k, patient[k] ?? ''])) : EMPTY);
    /* eslint-disable-next-line */
  }, [open, patient]);

  const validate = () => {
    const v = f.values; const e = {};
    if (!v.first_name.trim()) e.first_name = 'First name is required';
    if (!v.last_name.trim()) e.last_name = 'Last name is required';
    if (!v.dob) e.dob = 'Date of birth is required'; else if (v.dob > toInputDate()) e.dob = 'Cannot be in the future';
    if (!v.gender) e.gender = 'Select a gender';
    if (!/^[+\d][\d\s().-]{6,}$/.test(v.phone.trim())) e.phone = 'Enter a valid phone number';
    if (v.email && !/^\S+@\S+\.\S+$/.test(v.email)) e.email = 'Enter a valid email';
    return e;
  };
  const submit = async () => {
    const e = validate(); if (Object.keys(e).length) { f.setErrors(e); toast.warning('Please fix the highlighted fields'); return; }
    setBusy(true);
    try {
      const body = { ...f.values, assigned_doctor_id: f.values.assigned_doctor_id || null };
      const r = editing ? await api.put(`/patients/${patient.id}`, body) : await api.post('/patients', body);
      toast.success(editing ? 'Patient updated' : 'Patient registered', `${fullName(r)}, ${r.patient_code}`);
      onSaved?.(r); onClose();
    } catch (err) { f.setErrors(err.fields || {}); toast.error('Could not save patient', err.message); } finally { setBusy(false); }
  };
  const E = f.errors;
  return (
    <Modal open={open} onClose={onClose} size="lg" icon={editing ? Pencil : UserPlus} title={editing ? 'Edit patient' : 'Register new patient'} subtitle={editing ? patient.patient_code : 'A unique patient ID is generated automatically'}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={submit}>{editing ? 'Save changes' : 'Register patient'}</Button></>}>
      <div className="space-y-6">
        <section>
          <h3 className="mb-3 border-b border-slate-100 pb-2 font-display text-base font-semibold text-navy-900">Personal information</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" required error={E.first_name}><Input {...f.bind('first_name')} error={E.first_name} /></Field>
            <Field label="Last name" required error={E.last_name}><Input {...f.bind('last_name')} error={E.last_name} /></Field>
            <Field label="Date of birth" required error={E.dob}><Input type="date" max={toInputDate()} {...f.bind('dob')} error={E.dob} /></Field>
            <Field label="Gender" required error={E.gender}><Select {...f.bind('gender')} error={E.gender}><option value="">Select</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option></Select></Field>
            <Field label="Blood group"><Select {...f.bind('blood_group')}><option value="">Unknown</option>{BLOOD_GROUPS.map((b) => <option key={b}>{b}</option>)}</Select></Field>
            <Field label="Phone" required error={E.phone}><Input {...f.bind('phone')} error={E.phone} placeholder="+1 555 123 4567" /></Field>
            <Field label="Email" error={E.email}><Input type="email" {...f.bind('email')} error={E.email} /></Field>
            <Field label="City"><Input {...f.bind('city')} /></Field>
            <Field label="Address" className="sm:col-span-2"><Input {...f.bind('address')} /></Field>
          </div>
        </section>
        <section>
          <h3 className="mb-3 border-b border-slate-100 pb-2 font-display text-base font-semibold text-navy-900">Emergency contact and insurance</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Contact name"><Input {...f.bind('emergency_contact_name')} /></Field>
            <Field label="Contact phone"><Input {...f.bind('emergency_contact_phone')} /></Field>
            <Field label="Insurance provider"><Input {...f.bind('insurance_provider')} /></Field>
            <Field label="Insurance number"><Input {...f.bind('insurance_no')} /></Field>
          </div>
        </section>
        <section>
          <h3 className="mb-3 border-b border-slate-100 pb-2 font-display text-base font-semibold text-navy-900">Clinical</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Allergies"><Textarea rows={2} {...f.bind('allergies')} placeholder="e.g. Penicillin, peanuts" /></Field>
            <Field label="Chronic conditions"><Textarea rows={2} {...f.bind('chronic_conditions')} placeholder="e.g. Hypertension" /></Field>
            <Field label="Assigned doctor" className="sm:col-span-2"><DoctorSelect value={f.values.assigned_doctor_id} onChange={(v) => f.set('assigned_doctor_id', v)} placeholder="Not assigned" /></Field>
          </div>
        </section>
      </div>
    </Modal>
  );
}

export default function Patients() {
  const { user } = useAuth(); const toast = useToast(); const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const canEdit = user.role === 'admin' || user.role === 'receptionist'; const isAdmin = user.role === 'admin';
  const [search, setSearch] = useState(''); const [gender, setGender] = useState(''); const [status, setStatus] = useState(''); const [blood, setBlood] = useState(''); const [sort, setSort] = useState('recent'); const [page, setPage] = useState(1);
  const dSearch = useDebounce(search, 300);
  const [form, setForm] = useState(params.get('new') === '1'); const [edit, setEdit] = useState(null); const [del, setDel] = useState(null); const [busy, setBusy] = useState(false);
  useEffect(() => { if (params.get('new')) setParams({}, { replace: true }); /* eslint-disable-next-line */ }, []);
  useEffect(() => setPage(1), [dSearch, gender, status, blood, sort]);

  const { data, loading, error, reload } = useFetch(() => api.get('/patients', { search: dSearch, gender, status, blood_group: blood, sort, page, limit: 10 }), [dSearch, gender, status, blood, sort, page]);

  const remove = async () => {
    setBusy(true);
    try { await api.del(`/patients/${del.id}`); toast.success('Patient deleted', fullName(del)); setDel(null); reload(); } catch (e) { toast.error('Cannot delete patient', e.message); setDel(null); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader icon={Users} title={user.role === 'doctor' ? 'My patients' : 'Patients'} subtitle={user.role === 'doctor' ? 'Patients assigned to you or seen by you' : 'Register, search and manage patient records'}
        actions={canEdit && <Button icon={UserPlus} onClick={() => setForm(true)}>Register patient</Button>} />

      <div className="card mb-5 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name, patient ID, phone or email" className="w-full md:w-96" />
          <div className="w-36"><Select value={gender} onChange={(e) => setGender(e.target.value)}><option value="">Any gender</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option></Select></div>
          <div className="w-32"><Select value={blood} onChange={(e) => setBlood(e.target.value)}><option value="">Any blood</option>{BLOOD_GROUPS.map((b) => <option key={b}>{b}</option>)}</Select></div>
          <div className="w-40"><Select value={sort} onChange={(e) => setSort(e.target.value)}><option value="recent">Newest first</option><option value="name">Name A-Z</option><option value="visit">Last visit</option><option value="age">Youngest</option></Select></div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <FilterChip active={!status} onClick={() => setStatus('')}>All patients</FilterChip>
          <FilterChip active={status === 'admitted'} onClick={() => setStatus('admitted')} dot="bg-blue-500">Admitted</FilterChip>
          <FilterChip active={status === 'outpatient'} onClick={() => setStatus('outpatient')} dot="bg-emerald-500">Outpatient</FilterChip>
        </div>
      </div>

      {error && !data ? <ErrorState error={error} onRetry={reload} /> : (
        <TableShell label="Patients">
          <thead><tr><Th>Patient</Th><Th className="hidden xl:table-cell">ID</Th><Th className="hidden 2xl:table-cell">Contact</Th><Th>Status</Th><Th className="hidden xl:table-cell">Doctor</Th><Th>Last visit</Th><Th className="text-right">Actions</Th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {loading && !data && Array.from({ length: 6 }).map((_, i) => <tr key={i}><Td colSpan={7}><Skeleton className="h-10 w-full" /></Td></tr>)}
            {data?.data.map((p) => (
              <tr key={p.id} className="group cursor-pointer transition hover:bg-teal-50/40" onClick={() => nav(`/patients/${p.id}`)}>
                <Td data-primary><div className="flex items-center gap-3"><Avatar src={p.photo_url} name={fullName(p)} size={42} />
                  <div className="min-w-0"><Link to={`/patients/${p.id}`} onClick={(e) => e.stopPropagation()} className="block truncate font-bold text-navy-900 hover:text-teal-700">{fullName(p)}</Link><p className="flex items-center gap-2 text-xs text-slate-500"><Meta items={[`${p.age}y`, <span className="capitalize">{p.gender}</span>]} />{p.blood_group && <span className="flex items-center gap-0.5 font-bold text-rose-500"><Droplets size={11} />{p.blood_group}</span>}</p><p className="font-mono text-[10px] text-slate-400 xl:hidden">{p.patient_code}</p></div></div></Td>
                <Td data-skip className="hidden whitespace-nowrap xl:table-cell"><span className="rounded-lg bg-slate-100 px-2 py-1 font-mono text-xs font-semibold text-slate-600">{p.patient_code}</span></Td>
                <Td label="Contact" className="hidden whitespace-nowrap 2xl:table-cell"><p className="flex items-center gap-1.5 text-slate-600"><Phone size={13} className="text-slate-400" />{p.phone}</p><p className="truncate text-xs text-slate-400">{p.city}</p></Td>
                <Td label="Status" className="whitespace-nowrap">{p.bed_number ? <Badge tone="blue" dot pulse><BedDouble size={12} aria-hidden="true" />{p.ward_name}, {p.bed_number}</Badge> : <Badge tone="green">Outpatient</Badge>}</Td>
                <Td label="Doctor" className="hidden xl:table-cell">{p.doctor_name ? <div className="flex items-center gap-2"><Avatar src={p.doctor_avatar} name={p.doctor_name} size={26} /><span className="text-sm font-medium text-slate-700">Dr. {p.doctor_name.split(' ').slice(-1)[0]}</span></div> : <span className="text-xs text-slate-400">Unassigned</span>}</Td>
                <Td label="Last visit"><p className="text-sm font-medium text-slate-700">{p.last_visit ? timeAgo(p.last_visit) : '-'}</p><p className="max-w-[120px] truncate text-xs text-slate-400">{p.last_diagnosis}</p></Td>
                <Td data-actions className="text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    <Link to={`/patients/${p.id}`}><IconButton icon={Eye} label="View profile" /></Link>
                    {canEdit && <IconButton icon={Pencil} label="Edit" onClick={() => setEdit(p)} />}
                    {isAdmin && <IconButton icon={Trash2} label="Delete" className="hover:!bg-rose-50 hover:!text-rose-600" onClick={() => setDel(p)} />}
                  </div>
                </Td>
              </tr>
            ))}
            {data && data.data.length === 0 && <tr><td colSpan={7}><EmptyState icon={Users} title="No patients found" text="Try changing your search or filters." action={canEdit && <Button size="sm" icon={Plus} onClick={() => setForm(true)}>Register patient</Button>} /></td></tr>}
          </tbody>
        </TableShell>
      )}
      {data && <div className="mt-5"><Pagination page={data.page} pages={data.pages} total={data.total} limit={data.limit} onChange={setPage} /></div>}

      <PatientFormModal open={form || !!edit} patient={edit} onClose={() => { setForm(false); setEdit(null); }} onSaved={(p) => { reload(); if (!edit) nav(`/patients/${p.id}`); }} />
      <ConfirmModal open={!!del} onClose={() => setDel(null)} loading={busy} onConfirm={remove} title="Delete this patient?" confirmText="Delete patient"
        message={del ? `${fullName(del)} (${del.patient_code}) and all their records will be permanently removed. This cannot be undone and will be logged in the audit trail.` : ''} />
    </>
  );
}
