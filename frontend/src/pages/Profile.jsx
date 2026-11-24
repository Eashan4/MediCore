import { useState } from 'react';
import { Building2, Check, Clock, KeyRound, Mail, Phone, ShieldCheck, UserRound } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useForm } from '../hooks';
import { Avatar, Badge, Button, Field, InfoRow, Input, PageHeader, SectionTitle } from '../components/ui';
import { ROLE_META } from '../lib/constants';
import { drName, fmtDateTime } from '../lib/format';

export default function Profile() {
  const { user } = useAuth(); const toast = useToast(); const f = useForm({ current_password: '', new_password: '', confirm: '' }); const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); const v = f.values; const errs = {};
    if (!v.current_password) errs.current_password = 'Required';
    if (!/^(?=.*[A-Z])(?=.*\d).{8,}$/.test(v.new_password)) errs.new_password = 'Use 8+ characters with an uppercase letter and a number';
    if (v.new_password !== v.confirm) errs.confirm = 'Passwords do not match';
    if (Object.keys(errs).length) return f.setErrors(errs);
    setBusy(true);
    try { await api.put('/auth/password', { current_password: v.current_password, new_password: v.new_password }); toast.success('Password updated', 'Use your new password next time you sign in'); f.setValues({ current_password: '', new_password: '', confirm: '' }); }
    catch (err) { f.setErrors(err.fields || {}); toast.error('Could not update password', err.message); } finally { setBusy(false); }
  };
  return (
    <>
      <PageHeader icon={UserRound} title="My profile" subtitle="Your account details and security" />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-2">
          <div className="card overflow-hidden">
            <div className="relative h-28 bg-gradient-to-br from-navy-900 via-navy-700 to-teal-600"></div>
            <div className="px-6 pb-6 text-center"><Avatar src={user.avatar_url} name={user.name} size={96} square className="-mt-12 shadow-lift [&_img]:ring-4 [&_img]:ring-white [&>span]:ring-4 [&>span]:ring-white" />
              <h2 className="mt-3 text-xl font-extrabold text-navy-900">{user.role === 'doctor' ? drName(user.name) : user.name}</h2>
              <div className="mt-2 flex justify-center gap-2"><Badge tone="teal"><ShieldCheck size={12} />{ROLE_META[user.role].label}</Badge>{user.specialization && <Badge tone="navy">{user.specialization}</Badge>}</div>
              <div className="mt-5 divide-y divide-slate-100 text-left"><InfoRow icon={Mail} label="Email">{user.email}</InfoRow><InfoRow icon={Phone} label="Phone">{user.phone}</InfoRow>{user.department && <InfoRow icon={Building2} label="Department">{user.department}</InfoRow>}<InfoRow icon={Clock} label="Last sign-in">{user.last_login_at ? fmtDateTime(user.last_login_at) : 'This is your first session'}</InfoRow></div></div>
          </div>
        </div>
        <form onSubmit={submit} className="card p-6 lg:col-span-3 lg:p-8">
          <SectionTitle icon={KeyRound} title="Change password" subtitle="Passwords are stored with bcrypt hashing. Changes are recorded in the audit log." />
          <div className="max-w-md space-y-5">
            <Field label="Current password" error={f.errors.current_password}><Input type="password" autoComplete="current-password" {...f.bind('current_password')} error={f.errors.current_password} /></Field>
            <Field label="New password" error={f.errors.new_password} hint="At least 8 characters, with an uppercase letter and a number"><Input type="password" autoComplete="new-password" {...f.bind('new_password')} error={f.errors.new_password} /></Field>
            <Field label="Confirm new password" error={f.errors.confirm}><Input type="password" autoComplete="new-password" {...f.bind('confirm')} error={f.errors.confirm} /></Field>
            <Button type="submit" loading={busy} icon={Check}>Update password</Button>
          </div>
        </form>
      </div>
    </>
  );
}
