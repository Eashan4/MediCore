import { useEffect, useState } from 'react';
import { Baby, Bone, Brain, Building2, Clock, DollarSign, HeartPulse, MoreVertical, Pencil, Plus, ScanLine, Scissors, Siren, Star, Stethoscope, Trash2, UserPlus, Users } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useDebounce, useFetch, useForm } from '../hooks';
import { Avatar, Badge, Button, ConfirmModal, EmptyState, ErrorState, Field, Input, Menu, MenuItem, Modal, PageHeader, Photo, SearchInput, Select, Skeleton, Tabs, Textarea, cx } from '../components/ui';
import { DepartmentSelect, invalidateLookups, useDepartments } from '../components/ui/pickers';
import { drName, money } from '../lib/format';

const ICONS = { HeartPulse, Brain, Bone, Siren, Stethoscope, Scissors, ScanLine, Baby };
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const STATUS = { active: { l: 'Available', t: 'green' }, on_leave: { l: 'On leave', t: 'amber' }, inactive: { l: 'Inactive', t: 'slate' } };

function DoctorForm({ open, onClose, doctor, onSaved }) {
  const toast = useToast(); const f = useForm({}); const [busy, setBusy] = useState(false); const editing = !!doctor;
  useEffect(() => {
    if (!open) return; f.setErrors({});
    f.setValues(doctor ? { name: doctor.name, email: doctor.email, password: '', phone: doctor.phone || '', avatar_url: doctor.avatar_url || '', department_id: doctor.department_id || '', specialization: doctor.specialization, qualification: doctor.qualification || '', experience_years: doctor.experience_years, consultation_fee: doctor.consultation_fee, license_no: doctor.license_no, bio: doctor.bio || '', available_days: doctor.available_days, status: doctor.status }
      : { name: '', email: '', password: '', phone: '', avatar_url: '', department_id: '', specialization: '', qualification: '', experience_years: 5, consultation_fee: 100, license_no: '', bio: '', available_days: 'Mon,Tue,Wed,Thu,Fri', status: 'active' });
    /* eslint-disable-next-line */
  }, [open, doctor]);
  const days = (f.values.available_days || '').split(',').filter(Boolean);
  const toggle = (d) => f.set('available_days', DAYS.filter((x) => (x === d ? !days.includes(x) : days.includes(x))).join(','));
  const submit = async () => {
    const v = f.values; const e = {};
    if (v.name.trim().length < 2) e.name = 'Name is required'; if (!/^\S+@\S+\.\S+$/.test(v.email)) e.email = 'Enter a valid email';
    if (!editing && !/^(?=.*[A-Z])(?=.*\d).{8,}$/.test(v.password)) e.password = '8+ chars with an uppercase letter and a number';
    if (editing && v.password && !/^(?=.*[A-Z])(?=.*\d).{8,}$/.test(v.password)) e.password = '8+ chars with an uppercase letter and a number';
    if (!v.department_id) e.department_id = 'Select a department'; if (!v.specialization.trim()) e.specialization = 'Required'; if (v.license_no.trim().length < 3) e.license_no = 'Required';
    if (Object.keys(e).length) { f.setErrors(e); return toast.warning('Please fix the highlighted fields'); }
    setBusy(true);
    try { const r = editing ? await api.put(`/doctors/${doctor.id}`, v) : await api.post('/doctors', v); invalidateLookups(); toast.success(editing ? 'Doctor updated' : 'Doctor added', drName(r.name)); onSaved(); onClose(); }
    catch (err) { f.setErrors(err.fields || {}); toast.error('Could not save doctor', err.message); } finally { setBusy(false); }
  };
  const E = f.errors;
  return (
    <Modal open={open} onClose={onClose} size="lg" icon={editing ? Pencil : UserPlus} title={editing ? 'Edit doctor' : 'Add a doctor'} subtitle="Creates a login account with the Doctor role"
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={submit}>{editing ? 'Save changes' : 'Add doctor'}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" required error={E.name}><Input {...f.bind('name')} error={E.name} placeholder="e.g. Anna Schmidt" /></Field>
        <Field label="Email (login)" required error={E.email}><Input type="email" {...f.bind('email')} error={E.email} /></Field>
        <Field label={editing ? 'New password (optional)' : 'Password'} required={!editing} error={E.password}><Input type="password" autoComplete="new-password" {...f.bind('password')} error={E.password} /></Field>
        <Field label="Phone"><Input {...f.bind('phone')} /></Field>
        <Field label="Department" required error={E.department_id}><DepartmentSelect value={f.values.department_id} onChange={(v) => f.set('department_id', v)} error={E.department_id} /></Field>
        <Field label="Specialization" required error={E.specialization}><Input {...f.bind('specialization')} error={E.specialization} placeholder="e.g. Cardiologist" /></Field>
        <Field label="Qualification"><Input {...f.bind('qualification')} placeholder="MD, FACC" /></Field>
        <Field label="License no." required error={E.license_no}><Input {...f.bind('license_no')} error={E.license_no} /></Field>
        <Field label="Experience (years)"><Input type="number" min="0" {...f.bind('experience_years')} /></Field>
        <Field label="Consultation fee ($)"><Input type="number" min="0" {...f.bind('consultation_fee')} /></Field>
        <Field label="Status"><Select {...f.bind('status')}><option value="active">Active</option><option value="on_leave">On leave</option><option value="inactive">Inactive</option></Select></Field>
        <Field label="Photo URL" hint="Optional. Paste an image link"><Input {...f.bind('avatar_url')} placeholder="https://..." /></Field>
        <div className="sm:col-span-2" role="group" aria-labelledby="days-label"><p id="days-label" className="label">Available days</p><div className="flex flex-wrap gap-2">{DAYS.map((d) => <button type="button" key={d} onClick={() => toggle(d)} aria-pressed={days.includes(d)} className={cx('rounded-xl border px-3.5 py-2 text-sm font-bold transition', days.includes(d) ? 'border-teal-600 bg-teal-600 text-white' : 'border-slate-200 text-slate-500 hover:border-teal-300')}>{d}</button>)}</div></div>
        <Field label="Short bio" className="sm:col-span-2"><Textarea rows={2} {...f.bind('bio')} /></Field>
      </div>
    </Modal>
  );
}

function DeptForm({ open, onClose, dept, onSaved }) {
  const toast = useToast(); const f = useForm({}); const [busy, setBusy] = useState(false); const editing = !!dept;
  useEffect(() => { if (open) { f.setErrors({}); f.setValues(dept ? { name: dept.name, description: dept.description || '', image_url: dept.image_url || '', floor: dept.floor || '', color: dept.color || '#17aa9e', icon: dept.icon || 'Stethoscope' } : { name: '', description: '', image_url: '', floor: '', color: '#17aa9e', icon: 'Stethoscope' }); } /* eslint-disable-next-line */ }, [open, dept]);
  const submit = async () => {
    if (f.values.name.trim().length < 2) return f.setErrors({ name: 'Name is required' });
    setBusy(true);
    try { editing ? await api.put(`/departments/${dept.id}`, f.values) : await api.post('/departments', f.values); invalidateLookups(); toast.success(editing ? 'Department updated' : 'Department created', f.values.name); onSaved(); onClose(); }
    catch (e) { f.setErrors(e.fields || {}); toast.error('Could not save department', e.message); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} size="md" icon={Building2} title={editing ? 'Edit department' : 'New department'} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={submit}>Save</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" required error={f.errors.name}><Input {...f.bind('name')} error={f.errors.name} /></Field><Field label="Floor / location"><Input {...f.bind('floor')} placeholder="Floor 3" /></Field>
        <Field label="Icon"><Select {...f.bind('icon')}>{Object.keys(ICONS).map((i) => <option key={i}>{i}</option>)}</Select></Field><Field label="Accent colour"><Input type="color" className="!h-11 !p-1.5" {...f.bind('color')} /></Field>
        <Field label="Image URL" className="sm:col-span-2" hint="Optional department photo"><Input {...f.bind('image_url')} placeholder="https://..." /></Field>
        <Field label="Description" className="sm:col-span-2"><Textarea {...f.bind('description')} /></Field>
      </div>
    </Modal>
  );
}

export default function Doctors() {
  const { user } = useAuth(); const toast = useToast(); const isAdmin = user.role === 'admin';
  const [tab, setTab] = useState('doctors'); const [search, setSearch] = useState(''); const [dept, setDept] = useState(''); const [status, setStatus] = useState('');
  const dSearch = useDebounce(search, 250);
  const docs = useFetch(() => api.get('/doctors', { search: dSearch, department_id: dept, status }), [dSearch, dept, status]);
  const depts = useFetch(() => api.get('/departments'), []);
  const [form, setForm] = useState(false); const [edit, setEdit] = useState(null); const [del, setDel] = useState(null); const [dForm, setDForm] = useState(false); const [dEdit, setDEdit] = useState(null); const [dDel, setDDel] = useState(null);

  const removeDoc = async () => { try { await api.del(`/doctors/${del.id}`); invalidateLookups(); toast.success('Doctor deleted', del.name); setDel(null); docs.reload(); } catch (e) { toast.error('Cannot delete doctor', e.message); setDel(null); } };
  const removeDept = async () => { try { await api.del(`/departments/${dDel.id}`); invalidateLookups(); toast.success('Department deleted'); setDDel(null); depts.reload(); } catch (e) { toast.error('Cannot delete department', e.message); setDDel(null); } };

  return (
    <>
      <PageHeader icon={Stethoscope} title="Doctors & departments" subtitle="Specialists, schedules and hospital departments"
        actions={isAdmin && (tab === 'doctors' ? <Button icon={UserPlus} onClick={() => setForm(true)}>Add doctor</Button> : <Button icon={Plus} onClick={() => setDForm(true)}>New department</Button>)} />
      <Tabs tabs={[{ id: 'doctors', label: 'Doctors', icon: Stethoscope, count: docs.data?.length }, { id: 'departments', label: 'Departments', icon: Building2, count: depts.data?.length }]} value={tab} onChange={setTab} className="mb-6" />

      {tab === 'doctors' && (<>
        <div className="card mb-6 flex flex-wrap items-center gap-3 p-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name or specialization…" className="w-full md:w-80" />
          <div className="w-52"><DepartmentSelect value={dept} onChange={setDept} placeholder="All departments" /></div>
          <div className="w-40"><Select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Any status</option><option value="active">Available</option><option value="on_leave">On leave</option><option value="inactive">Inactive</option></Select></div>
        </div>
        {docs.error && !docs.data ? <ErrorState error={docs.error} onRetry={docs.reload} /> : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {docs.loading && !docs.data && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[420px] !rounded-3xl" />)}
            {docs.data?.map((d, i) => (
              <article key={d.id} style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }} className="card card-hover group animate-fade-up overflow-hidden">
                <Photo src={d.avatar_url} className="h-56" overlay="from-navy-950/85 via-navy-950/10 to-transparent">
                  <div className="flex h-full flex-col justify-between p-4">
                    <div className="flex items-start justify-between"><Badge tone={STATUS[d.status].t} dot className="!bg-white/90">{STATUS[d.status].l}</Badge>
                      {isAdmin && <Menu trigger={() => <button className="grid h-8 w-8 place-items-center rounded-lg bg-white/90 text-slate-600 transition hover:bg-white" aria-label="Actions"><MoreVertical size={16} /></button>}><MenuItem icon={Pencil} onClick={() => setEdit(d)}>Edit doctor</MenuItem><MenuItem icon={Trash2} danger onClick={() => setDel(d)}>Delete</MenuItem></Menu>}</div>
                    <div className="text-white"><p className="text-lg font-extrabold leading-tight">{drName(d.name)}</p><p className="text-sm font-medium text-white/80">{d.specialization}</p></div>
                  </div>
                </Photo>
                <div className="p-5">
                  <div className="flex items-center justify-between"><span className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ background: d.department_color || '#17aa9e' }}>{d.department}</span><span className="flex items-center gap-1 text-sm font-bold text-navy-900"><Star size={15} className="fill-amber-400 text-amber-400" />{Number(d.rating).toFixed(1)}</span></div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    {[[d.experience_years, 'Years'], [d.patients, 'Patients'], [d.appointments_today, 'Today']].map(([v, l]) => <div key={l} className="rounded-xl bg-slate-50 py-2.5"><p className="text-lg font-extrabold text-navy-900">{v}</p><p className="text-[11px] font-semibold text-slate-400">{l}</p></div>)}
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs font-semibold text-slate-500"><span className="flex items-center gap-1.5"><Clock size={13} />{d.available_days.replace(/,/g, ', ')}</span><span className="flex items-center gap-1 text-navy-800"><DollarSign size={13} />{money(d.consultation_fee)}</span></div>
                  {d.qualification && <p className="mt-2 truncate text-xs text-slate-400">{d.qualification}</p>}
                </div>
              </article>))}
            {docs.data?.length === 0 && <div className="card sm:col-span-2 xl:col-span-3"><EmptyState icon={Stethoscope} title="No doctors found" text="Try adjusting the search or filters." /></div>}
          </div>)}
      </>)}

      {tab === 'departments' && (depts.error && !depts.data ? <ErrorState error={depts.error} onRetry={depts.reload} /> : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {depts.loading && !depts.data && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-72 !rounded-3xl" />)}
          {depts.data?.map((d, i) => { const I = ICONS[d.icon] || Stethoscope; return (
            <article key={d.id} style={{ animationDelay: `${i * 40}ms` }} className="card card-hover animate-fade-up overflow-hidden">
              <Photo src={d.image_url} className="h-40" overlay="from-navy-950/80 via-navy-950/20 to-transparent">
                <div className="flex h-full flex-col justify-between p-4"><div className="flex items-start justify-between"><span className="grid h-11 w-11 place-items-center rounded-xl text-white shadow-lg" style={{ background: d.color || '#17aa9e' }}><I size={21} /></span>
                  {isAdmin && <Menu trigger={() => <button className="grid h-8 w-8 place-items-center rounded-lg bg-white/90 text-slate-600" aria-label="Actions"><MoreVertical size={16} /></button>}><MenuItem icon={Pencil} onClick={() => setDEdit(d)}>Edit</MenuItem><MenuItem icon={Trash2} danger onClick={() => setDDel(d)}>Delete</MenuItem></Menu>}</div>
                  <p className="text-lg font-extrabold text-white">{d.name}</p></div>
              </Photo>
              <div className="p-5"><p className="line-clamp-2 min-h-[40px] text-sm text-slate-500">{d.description}</p>
                <div className="mt-4 flex items-center justify-between text-sm font-bold text-navy-800"><span className="flex items-center gap-1.5"><Stethoscope size={15} className="text-teal-600" />{d.doctors} doctors</span><span className="flex items-center gap-1.5"><Users size={15} className="text-teal-600" />{d.staff} staff</span><span className="text-xs font-semibold text-slate-400">{d.floor}</span></div></div>
            </article>); })}
        </div>))}

      <DoctorForm open={form || !!edit} doctor={edit} onClose={() => { setForm(false); setEdit(null); }} onSaved={() => { docs.reload(); depts.reload(); }} />
      <DeptForm open={dForm || !!dEdit} dept={dEdit} onClose={() => { setDForm(false); setDEdit(null); }} onSaved={depts.reload} />
      <ConfirmModal open={!!del} onClose={() => setDel(null)} onConfirm={removeDoc} title={`Delete ${del ? drName(del.name) : ''}?`} message="Their login is removed too. Doctors with appointments or records can't be deleted. Set them to Inactive instead." confirmText="Delete doctor" />
      <ConfirmModal open={!!dDel} onClose={() => setDDel(null)} onConfirm={removeDept} title={`Delete ${dDel?.name}?`} message="Departments that still have doctors can't be deleted." confirmText="Delete department" />
    </>
  );
}
