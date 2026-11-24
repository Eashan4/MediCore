import { Link, useNavigate } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BedDouble, CalendarCheck, CalendarPlus, ClipboardList, Clock, LogIn, Siren, UserPlus, Users } from 'lucide-react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks';
import { ActionLink, Avatar, Badge, Button, cx, EmptyState, ErrorState, Meta, SectionTitle, StatCard } from '../../components/ui';
import { ChartTooltip } from '../../components/ui/pickers';
import { AXIS, DashSkeleton, GlassStat, Hero, Legend, Panel } from './parts';
import { APPT_STATUS, BED_STATUS, IMAGES, URGENCY } from '../../lib/constants';
import { drName, duration, fmtTime, fullName, greeting, timeAgo } from '../../lib/format';

export default function ReceptionDashboard({ user }) {
  const nav = useNavigate(); const toast = useToast();
  const { data, loading, error, reload, updatedAt, refresh } = useFetch(() => api.get('/dashboard/reception'), [], { interval: 30000 });
  if (loading && !data) return <DashSkeleton />;
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  const { stats: s, queue: fullQueue, wards, emergencies, recent_admissions: recent, weekly } = data;
  const isOpen = (a) => ['scheduled', 'checked_in'].includes(a.status);
  const queue = [...fullQueue].sort((a, b) => Number(isOpen(b)) - Number(isOpen(a)) || a.scheduled_at.localeCompare(b.scheduled_at)).slice(0, 8);

  const checkIn = async (a) => {
    try { await api.patch(`/appointments/${a.id}/status`, { status: 'checked_in' }); toast.success('Patient checked in', `${fullName(a)} is now waiting for ${drName(a.doctor_name)}`); refresh(); }
    catch (e) { toast.error('Check-in failed', e.message); }
  };

  return (
    <>
      <Hero image={IMAGES.reception} updatedAt={updatedAt}
        title={<>{greeting()}, {user.name.split(' ')[0]}</>}
        subtitle={`${s.pending_checkin} patient${s.pending_checkin === 1 ? ' is' : 's are'} still to check in, ${s.waiting} waiting to see a doctor, and ${s.beds.available} beds are ready for admission.`}
        actions={<>
          <Button icon={UserPlus} onClick={() => nav('/patients?new=1')}>Register patient</Button>
          <Button variant="glass" icon={CalendarPlus} onClick={() => nav('/appointments?new=1')}>Book appointment</Button>
          <Button variant="glass" icon={ClipboardList} onClick={() => nav('/beds?admit=1')}>Admit patient</Button>
        </>}
        aside={<>
          <GlassStat icon={BedDouble} label="Free beds" value={s.beds.available} sub={`of ${s.beds.total}`} to="/beds" />
          <GlassStat icon={Siren} label="Emergencies" value={s.emergencies} tone={s.emergencies ? 'rose' : 'teal'} sub="active" to="/emergency" />
        </>} />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-4">
        <StatCard icon={UserPlus} label="Registered today" value={s.registered_today} sub={`${s.patients_total} patients in total`} spark={s.spark_reg} tone="teal" onClick={() => nav('/patients')} />
        <StatCard icon={CalendarCheck} label="Appointments today" value={s.appointments_today} sub={[`${s.pending_checkin} to check in`, `${s.waiting} waiting`]} tone="blue" delay={60} onClick={() => nav('/appointments')} />
        <StatCard icon={BedDouble} label="Beds available" value={s.beds.available} sub={[`${s.beds.occupied} occupied`, `${s.beds.maintenance} maintenance`]} tone="emerald" delay={120} onClick={() => nav('/beds')} />
        <StatCard icon={ClipboardList} label="Admissions today" value={s.admitted_today} sub={`${s.discharged_today} discharged today`} tone="navy" delay={180} onClick={() => nav('/admissions')} />
      </div>

      <div className="mb-6 grid gap-5 xl:grid-cols-3">
        <Panel className="xl:col-span-2">
          <SectionTitle icon={Users} title="Today's patient queue" subtitle={`Showing the next ${queue.length} of ${fullQueue.length} appointments today`} action={<ActionLink to="/appointments">All appointments</ActionLink>} />
          {fullQueue.length === 0 ? <EmptyState icon={CalendarCheck} title="No appointments today" action={<Button size="sm" icon={CalendarPlus} onClick={() => nav('/appointments?new=1')}>Book one</Button>} /> : (
            <ul className="divide-y divide-slate-100">
              {queue.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="w-[68px] shrink-0 text-sm font-extrabold text-navy-800">{fmtTime(a.scheduled_at)}</div>
                  <Avatar src={a.patient_photo} name={fullName(a)} size={40} />
                  <Link to={`/patients/${a.patient_id}`} className="min-w-0 flex-1 hover:text-teal-700"><p className="truncate text-sm font-bold text-navy-900">{fullName(a)}</p><p className="text-xs text-slate-500"><Meta items={[drName(a.doctor_name), a.specialization]} /></p></Link>
                  <Badge tone={APPT_STATUS[a.status].tone} dot={a.status === 'checked_in'} pulse={a.status === 'checked_in'}>{APPT_STATUS[a.status].label}</Badge>
                  {a.status === 'scheduled' ? <Button size="xs" variant="soft" icon={LogIn} onClick={() => checkIn(a)}>Check in</Button> : <span className="w-[86px]" />}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <SectionTitle icon={BedDouble} title="Bed availability" subtitle="Each square is one bed" action={<ActionLink to="/beds">Bed board</ActionLink>} />
          <Legend items={[{ label: 'Free', color: '#10b981' }, { label: 'Occupied', color: '#3b82f6' }, { label: 'Maintenance', color: '#f43f5e' }]} />
          <div className="mt-5 space-y-5">
            {wards.map((w) => (
              <div key={w.id}>
                <div className="mb-2 flex items-center justify-between text-xs"><span className="font-bold text-navy-800">{w.name}</span><span className="font-semibold text-emerald-600">{w.available} free</span></div>
                <div className="flex flex-wrap gap-1.5">
                  {w.beds.map((b) => <Link key={b.id} to="/beds" title={`${b.bed_number}, ${BED_STATUS[b.status].label}`} className={cx('h-5 w-5 rounded-md transition hover:scale-125', b.status === 'available' ? 'bg-emerald-400 shadow-[0_2px_8px_-2px_rgba(16,185,129,.8)]' : b.status === 'occupied' ? 'bg-blue-400/80' : 'bg-rose-400')} />)}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Panel>
          <SectionTitle icon={UserPlus} title="Registrations & bookings" subtitle="Last 7 days" />
          <Legend items={[{ label: 'New patients', color: '#17aa9e' }, { label: 'Appointments', color: '#3b82f6' }]} />
          <div className="mt-3 h-[220px]">
            <ResponsiveContainer><AreaChart data={weekly} margin={{ left: -22 }}>
              <defs>
                <linearGradient id="gr1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#17aa9e" stopOpacity=".35" /><stop offset="1" stopColor="#17aa9e" stopOpacity="0" /></linearGradient>
                <linearGradient id="gr2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3b82f6" stopOpacity=".3" /><stop offset="1" stopColor="#3b82f6" stopOpacity="0" /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 4" vertical={false} stroke="#e2ebf6" />
              <XAxis dataKey="label" {...AXIS} /><YAxis allowDecimals={false} {...AXIS} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="appointments" name="Appointments" stroke="#3b82f6" strokeWidth={2.5} fill="url(#gr2)" />
              <Area type="monotone" dataKey="registrations" name="New patients" stroke="#17aa9e" strokeWidth={2.5} fill="url(#gr1)" />
            </AreaChart></ResponsiveContainer>
          </div>
        </Panel>

        <Panel>
          <SectionTitle icon={ClipboardList} title="Current admissions" subtitle="Most recent arrivals" action={<ActionLink to="/admissions">View all</ActionLink>} />
          <ul className="space-y-1">{recent.map((a) => (
            <li key={a.id}><Link to={`/patients/${a.patient_id || ''}`} className="flex items-center gap-3 rounded-xl p-2.5 transition hover:bg-slate-50">
              <Avatar src={a.photo_url} name={fullName(a)} size={38} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-navy-900">{fullName(a)}</p><p className="text-xs text-slate-500"><Meta items={[a.ward_name, timeAgo(a.admitted_at)]} /></p></div><Badge tone="blue">{a.bed_number}</Badge></Link></li>))}</ul>
        </Panel>

        <Panel>
          <SectionTitle icon={Siren} title="Active emergencies" subtitle="Awaiting admission or a doctor" action={<ActionLink to="/emergency">Manage</ActionLink>} />
          {emergencies.length === 0 ? <EmptyState icon={Siren} title="All clear" text="No active emergency requests." /> : (
            <ul className="space-y-2.5">{emergencies.map((e) => (
              <li key={e.id} className="relative overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/60 p-3 pl-4"><span className={cx('absolute inset-y-0 left-0 w-1.5', URGENCY[e.urgency].bar)} />
                <div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-bold text-navy-900">{e.patient_name}</p><Badge tone={URGENCY[e.urgency].tone}>{URGENCY[e.urgency].label}</Badge></div>
                <p className="mt-1 line-clamp-1 text-xs text-slate-500">{e.condition_desc}</p><p className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-slate-400"><Clock size={11} aria-hidden="true" /><Meta items={[duration(e.waiting_minutes), e.arrival_mode.replace('_', ' ')]} /></p></li>))}</ul>
          )}
        </Panel>
      </div>
    </>
  );
}
