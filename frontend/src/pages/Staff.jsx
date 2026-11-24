import { useEffect, useState } from 'react';
import { KeyRound, Mail, Pencil, Phone, Plus, Trash2, UserPlus, UsersRound } from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import { useDebounce, useFetch, useForm } from '../hooks';
import { Avatar, Badge, Button, ConfirmModal, EmptyState, ErrorState, Field, FilterChip, IconButton, Input, Modal, PageHeader, SearchInput, Select, Skeleton, StatCard, TableShell, Td, Th } from '../components/ui';
import { DepartmentSelect } from '../components/ui/pickers';
import { fmtDate, titleCase } from '../lib/format';

const ST = { active: 'green', on_leave: 'amber', inactive: 'slate' };
const SHIFT = { morning: 'blue', evening: 'violet', night: 'navy' };
const ROLES = ['Head Nurse', 'Staff Nurse', 'ICU Nurse', 'Lab Technician', 'Pharmacist', 'Radiographer', 'Physiotherapist', 'Receptionist', 'Anesthesia Technician', 'Ambulance Driver', 'Security Supervisor', 'Administrator'];

function StaffForm({ open, onClose, member, onSaved }) {
  const toast = useToast(); const f = useForm({}); const [busy, setBusy] = useState(false); const editing = !!member;
  useEffect(() => {
    if (!open) return; f.setErrors({});
    f.setValues(member ? { name: member.name, designation: member.designation, department_id: member.department_id || '', email: member.email || '', phone: member.phone || '', shift: member.shift, status: member.status, create_login: false, password: '' }
      : { name: '', designation: 'Staff Nurse', department_id: '', email: '', phone: '', shift: 'morning', status: 'active', create_login: false, password: '' });
    /* eslint-disable-next-line */
  }, [open, member]);
  const submit = async () => {
    const v = f.values; const e = {};
    if (v.name.trim().length < 2) e.name = 'Name is required'; if (!v.designation.trim()) e.designation = 'Required'; if (v.email && !/^\S+@\S+\.\S+$/.test(v.email)) e.email = 'Enter a valid email';
    if (v.create_login && !v.email) e.email = 'Email is required for a login'; if (v.create_login && !/^(?=.*[A-Z])(?=.*\d).{8,}$/.test(v.password)) e.password = '8+ chars with an uppercase letter and a number';
    if (Object.keys(e).length) return f.setErrors(e);
    setBusy(true);
    try { const body = { ...v, department_id: v.department_id || null }; editing ? await api.put(`/staff/${member.id}`, body) : await api.post('/staff', body); toast.success(editing ? 'Staff updated' : 'Staff member added', v.name); onSaved(); onClose(); }
    catch (err) { f.setErrors(err.fields || {}); toast.error('Could not save', err.message); } finally { setBusy(false); }
  };
  const E = f.errors;
  return (
    <Modal open={open} onClose={onClose} size="md" icon={editing ? Pencil : UserPlus} title={editing ? 'Edit staff member' : 'Add staff member'} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={submit}>Save</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" required error={E.name}><Input {...f.bind('name')} error={E.name} /></Field>
        <Field label="Designation" required error={E.designation}><Input list="roles" {...f.bind('designation')} error={E.designation} /><datalist id="roles">{ROLES.map((r) => <option key={r} value={r} />)}</datalist></Field>
        <Field label="Department"><DepartmentSelect value={f.values.department_id} onChange={(v) => f.set('department_id', v)} placeholder="None" /></Field>
        <Field label="Shift"><Select {...f.bind('shift')}><option value="morning">Morning</option><option value="evening">Evening</option><option value="night">Night</option></Select></Field>
        <Field label="Email" error={E.email}><Input type="email" {...f.bind('email')} error={E.email} /></Field><Field label="Phone"><Input {...f.bind('phone')} /></Field>
        <Field label="Status"><Select {...f.bind('status')}><option value="active">Active</option><option value="on_leave">On leave</option><option value="inactive">Inactive</option></Select></Field>
        {!editing && (<div className="sm:col-span-2 rounded-2xl border border-dashed border-teal-300 bg-teal-50/50 p-4">
          <label className="flex cursor-pointer items-center gap-3 text-sm font-bold text-navy-800"><input type="checkbox" checked={!!f.values.create_login} onChange={(e) => f.set('create_login', e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-teal-600" /><KeyRound size={16} className="text-teal-600" />Grant system access (Receptionist login)</label>
          {f.values.create_login && <div className="mt-3"><Field label="Initial password" error={E.password}><Input type="password" autoComplete="new-password" {...f.bind('password')} error={E.password} /></Field></div>}</div>)}
      </div>
    </Modal>
  );
}

export default function Staff() {
  const toast = useToast(); const [search, setSearch] = useState(''); const [dept, setDept] = useState(''); const [shift, setShift] = useState(''); const dSearch = useDebounce(search, 250);
  const { data, loading, error, reload } = useFetch(() => api.get('/staff', { search: dSearch, department_id: dept, shift }), [dSearch, dept, shift]);
  const [form, setForm] = useState(false); const [edit, setEdit] = useState(null); const [del, setDel] = useState(null);
  const remove = async () => { try { await api.del(`/staff/${del.id}`); toast.success('Staff member removed', del.name); setDel(null); reload(); } catch (e) { toast.error('Could not remove', e.message); setDel(null); } };
  const count = (k, v) => (data || []).filter((s) => s[k] === v).length;
  return (
    <>
      <PageHeader icon={UsersRound} title="Staff" subtitle="Nurses, technicians and support teams" actions={<Button icon={UserPlus} onClick={() => setForm(true)}>Add staff</Button>} />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-4">
        <StatCard icon={UsersRound} label="Total staff" value={data?.length ?? 0} tone="teal" sub="All departments" />
        <StatCard icon={UsersRound} label="Active" value={count('status', 'active')} tone="emerald" delay={60} sub="Currently working" />
        <StatCard icon={UsersRound} label="On leave" value={count('status', 'on_leave')} tone="amber" delay={120} sub="Away" />
        <StatCard icon={KeyRound} label="With system login" value={(data || []).filter((s) => s.user_id).length} tone="navy" delay={180} sub="Receptionist accounts" />
      </div>
      <div className="card mb-5 flex flex-wrap items-center gap-3 p-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search name, role or department…" className="w-full md:w-80" />
        <div className="w-52"><DepartmentSelect value={dept} onChange={setDept} placeholder="All departments" /></div>
        <div className="flex gap-2">{[['', 'All shifts'], ['morning', 'Morning'], ['evening', 'Evening'], ['night', 'Night']].map(([k, l]) => <FilterChip key={l} active={shift === k} onClick={() => setShift(k)}>{l}</FilterChip>)}</div>
      </div>
      {error && !data ? <ErrorState error={error} onRetry={reload} /> : (
        <TableShell label="Staff">
          <thead><tr><Th>Staff member</Th><Th>Department</Th><Th className="hidden xl:table-cell">Contact</Th><Th>Shift</Th><Th className="hidden xl:table-cell">Joined</Th><Th>Status</Th><Th className="text-right">Actions</Th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {loading && !data && Array.from({ length: 6 }).map((_, i) => <tr key={i}><Td colSpan={7}><Skeleton className="h-10 w-full" /></Td></tr>)}
            {data?.map((s) => (
              <tr key={s.id} className="transition hover:bg-teal-50/40">
                <Td data-primary><div className="flex items-center gap-3"><Avatar src={s.avatar_url} name={s.name} size={42} /><div className="whitespace-nowrap"><p className="font-bold text-navy-900">{s.name}</p><p className="text-xs text-slate-500">{s.designation}</p></div></div></Td>
                <Td label="Department">{s.department || <span className="text-slate-400">-</span>}</Td>
                <Td label="Contact" className="hidden xl:table-cell"><p className="flex items-center gap-1.5 text-xs text-slate-600"><Mail size={12} className="text-slate-400" />{s.email || '-'}</p><p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-600"><Phone size={12} className="text-slate-400" />{s.phone || '-'}</p></Td>
                <Td label="Shift"><Badge tone={SHIFT[s.shift]}>{titleCase(s.shift)}</Badge></Td><Td label="Joined" className="hidden text-slate-600 xl:table-cell">{fmtDate(s.joined_on)}</Td>
                <Td label="Status"><div className="flex flex-wrap items-center gap-1.5"><Badge tone={ST[s.status]} dot>{titleCase(s.status)}</Badge>{s.user_id && <Badge tone="teal"><KeyRound size={11} />Login</Badge>}</div></Td>
                 <Td data-actions className="text-right"><div className="flex justify-end gap-1"><IconButton icon={Pencil} label="Edit" onClick={() => setEdit(s)} /><IconButton icon={Trash2} label="Remove" className="hover:!bg-rose-50 hover:!text-rose-600" onClick={() => setDel(s)} /></div></Td>
              </tr>))}
            {data?.length === 0 && <tr><td colSpan={7}><EmptyState icon={UsersRound} title="No staff found" action={<Button size="sm" icon={Plus} onClick={() => setForm(true)}>Add staff</Button>} /></td></tr>}
          </tbody>
        </TableShell>)}
      <StaffForm open={form || !!edit} member={edit} onClose={() => { setForm(false); setEdit(null); }} onSaved={reload} />
      <ConfirmModal open={!!del} onClose={() => setDel(null)} onConfirm={remove} title={`Remove ${del?.name}?`} message="The staff record (and any linked receptionist login) will be removed." confirmText="Remove" />
    </>
  );
}
