import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, AlertTriangle, ArrowRight, BedDouble, CalendarCheck, CalendarDays, Clock, Pill, ShieldCheck, Siren, Stethoscope, UserPlus, Users } from 'lucide-react';
import { api } from '../../api/client';
import { useFetch } from '../../hooks';
import { ActionLink, Avatar, Badge, Button, Count, cx, EmptyState, ErrorState, Meta, Ring, SectionTitle, StatCard, Tabs } from '../../components/ui';
import { ChartTooltip } from '../../components/ui/pickers';
import { AXIS, DashSkeleton, GlassStat, Hero, Legend, Panel } from './parts';
import { CHART_COLORS, IMAGES, URGENCY } from '../../lib/constants';
import { drName, duration, fmtTime, fullName, greeting, relativeDay, timeAgo } from '../../lib/format';

const sevTone = { info: 'bg-teal-500', warning: 'bg-amber-500', critical: 'bg-rose-500' };

export default function AdminDashboard({ user }) {
  const nav = useNavigate();
  const { data, loading, error, reload, updatedAt } = useFetch(() => api.get('/dashboard/admin'), [], { interval: 30000 });
  const [flowTab, setFlowTab] = useState('flow');

  if (loading && !data) return <DashSkeleton />;
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  const d = data; const s = d.stats;
  const totalDx = d.diagnoses.reduce((a, b) => a + b.value, 0);
  const bedSegs = [{ v: s.beds.occupied, c: 'bg-blue-500' }, { v: s.beds.maintenance, c: 'bg-rose-400' }, { v: s.beds.available, c: 'bg-emerald-400' }];

  return (
    <>
      <Hero image={IMAGES.hospital} updatedAt={updatedAt}
        title={<>{greeting()}, {user.name.split(' ')[0]}</>}
        subtitle={`${s.beds.available} beds are free right now, ${s.appointments.remaining} appointments are still ahead today and ${s.emergency.active} emergency case${s.emergency.active === 1 ? ' is' : 's are'} active.`}
        actions={<>
          <Button variant="primary" icon={UserPlus} onClick={() => nav('/patients?new=1')}>Register patient</Button>
          <Button variant="glass" icon={BedDouble} onClick={() => nav('/beds')}>Bed board</Button>
          <Button variant="glass" icon={Siren} onClick={() => nav('/emergency?new=1')}>New emergency</Button>
        </>}
        aside={<>
          <GlassStat icon={BedDouble} label="Occupancy" value={`${s.beds.occupancy}%`} sub={`${s.beds.occupied}/${s.beds.total} beds`} to="/beds" />
          <GlassStat icon={Siren} label="Critical now" value={s.emergency.critical} tone={s.emergency.critical ? 'rose' : 'teal'} sub="emergency cases" to="/emergency" />
        </>} />

      {/* ------------- KPI row ------------- */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-5">
        <StatCard icon={Users} label="Total patients" value={s.patients.total} sub={`+${s.patients.week} registered this week`} spark={s.patients.spark} tone="teal" onClick={() => nav('/patients')} delay={0} />
        <StatCard icon={BedDouble} label="Beds available" value={s.beds.available} sub={[`${s.beds.occupied} occupied`, `${s.beds.maintenance} maintenance`]} tone="emerald" onClick={() => nav('/beds')} delay={60}
          badge={<div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100">{bedSegs.map((g, i) => <span key={i} className={cx(g.c, 'transition-all duration-1000')} style={{ width: `${(g.v / s.beds.total) * 100}%` }} />)}</div>} />
        <StatCard icon={Stethoscope} label="Doctors on duty" value={s.doctors.active} sub={[`${s.doctors.total} total`, `${s.doctors.on_leave} on leave`]} tone="navy" onClick={() => nav('/doctors')} delay={120}
          badge={<div className="flex -space-x-2">{(d.upcoming || []).slice(0, 5).map((u, i) => <Avatar key={i} src={u.doctor_avatar} name={u.doctor_name} size={26} ring />)}</div>} />
        <StatCard icon={CalendarCheck} label="Appointments today" value={s.appointments.today} sub={[`${s.appointments.completed} done`, `${s.appointments.remaining} remaining`]} spark={s.appointments.spark} tone="blue" onClick={() => nav('/appointments')} delay={180} />
        <StatCard icon={Siren} label="Emergency requests" value={s.emergency.active} sub={[`${s.emergency.critical} critical`, `${s.emergency.today} today`]} spark={s.emergency.spark} tone="rose" onClick={() => nav('/emergency')} delay={240} />
      </div>

      {/* ------------- flow + occupancy ------------- */}
      <div className="mb-6 grid gap-5 xl:grid-cols-3">
        <Panel className="xl:col-span-2" delay={60}>
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <SectionTitle icon={Activity} title={flowTab === 'flow' ? 'Patient flow' : 'Bed occupancy trend'} subtitle={flowTab === 'flow' ? 'Admissions and discharges, last 7 days' : 'Share of beds in use, last 14 days'} />
            <Tabs value={flowTab} onChange={setFlowTab} tabs={[{ id: 'flow', label: 'Weekly flow' }, { id: 'trend', label: 'Occupancy' }]} />
          </div>
          {flowTab === 'flow' && <Legend items={[{ label: 'Admissions this week', color: '#12223f', value: d.weekly.reduce((n, w) => n + w.admissions, 0) }, { label: 'Discharges this week', color: '#17aa9e', value: d.weekly.reduce((n, w) => n + w.discharges, 0) }]} />}
          <div role="img" aria-label={flowTab === 'flow' ? 'Bar chart of daily admissions and discharges for the last 7 days' : 'Area chart of bed occupancy percentage for the last 14 days'} className="mt-4 h-[290px]">
            <ResponsiveContainer width="100%" height="100%">
              {flowTab === 'flow' ? (
                <BarChart data={d.weekly} barGap={6} barCategoryGap="26%" margin={{ left: -18, top: 8 }}>
                  <defs>
                    <linearGradient id="gNavy" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2f4f8a" /><stop offset="1" stopColor="#12223f" /></linearGradient>
                    <linearGradient id="gTeal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3cc5b7" /><stop offset="1" stopColor="#0f8a82" /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 4" vertical={false} stroke="#e2ebf6" />
                  <XAxis dataKey="label" {...AXIS} /><YAxis allowDecimals={false} {...AXIS} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(23,170,158,.07)', radius: 8 }} />
                  <Bar dataKey="admissions" name="Admissions" fill="url(#gNavy)" radius={[8, 8, 0, 0]} maxBarSize={34} animationDuration={900} />
                  <Bar dataKey="discharges" name="Discharges" fill="url(#gTeal)" radius={[8, 8, 0, 0]} maxBarSize={34} animationDuration={1100} />
                </BarChart>
              ) : (
                <AreaChart data={d.occupancy_trend} margin={{ left: -18, top: 8 }}>
                  <defs><linearGradient id="gOcc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#17aa9e" stopOpacity=".4" /><stop offset="1" stopColor="#17aa9e" stopOpacity="0" /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 4" vertical={false} stroke="#e2ebf6" />
                  <XAxis dataKey="label" {...AXIS} interval={1} /><YAxis domain={[0, 100]} unit="%" {...AXIS} />
                  <ReferenceLine y={85} stroke="#f43f5e" strokeDasharray="5 5" label={{ value: 'Capacity alert', fill: '#f43f5e', fontSize: 11, position: 'insideTopRight' }} />
                  <Tooltip content={<ChartTooltip formatter={(v) => `${v}%`} />} />
                  <Area type="monotone" dataKey="pct" name="Occupancy" stroke="#0f8a82" strokeWidth={3} fill="url(#gOcc)" dot={false} activeDot={{ r: 6, strokeWidth: 3, stroke: '#fff' }} animationDuration={1000} />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel delay={120}>
          <SectionTitle icon={BedDouble} title="Occupancy by ward" subtitle="Live bed utilisation" action={<ActionLink to="/beds">Open board</ActionLink>} />
          <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Ring value={s.beds.occupancy} size={118} stroke={12} color="#17aa9e">
              <div><p className="text-3xl font-extrabold leading-none text-navy-900"><Count value={s.beds.occupancy} suffix="%" /></p><p className="mt-1 text-[11px] font-semibold text-slate-500">occupied</p></div>
            </Ring>
            <div className="space-y-2 text-xs font-semibold text-slate-600">
              <p className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" />{s.beds.occupied} occupied</p>
              <p className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />{s.beds.available} available</p>
              <p className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-rose-400" />{s.beds.maintenance} maintenance</p>
            </div>
          </div>
          <div className="space-y-3.5">
            {d.wards.map((w) => (
              <div key={w.id}>
                <div className="mb-1.5 flex items-center justify-between text-xs"><span className="font-bold text-navy-800">{w.name}</span><span className="font-semibold text-slate-500"><Meta items={[`${w.occupied}/${w.total}`, <span key="p" className={w.pct >= 85 ? 'text-rose-700' : 'text-navy-700'}>{w.pct}%</span>]} /></span></div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className={cx('h-full rounded-full transition-all duration-1000', w.pct >= 85 ? 'bg-gradient-to-r from-rose-400 to-rose-500' : 'bg-gradient-to-r from-teal-400 to-blue-500')} style={{ width: `${w.pct}%` }} /></div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* ------------- diagnoses / departments / emergency ------------- */}
      <div className="mb-6 grid gap-5 xl:grid-cols-3">
        <Panel delay={80}>
          <SectionTitle icon={Activity} title="Diagnosis mix" subtitle="Most common conditions, last 4 months" />
          <div role="img" aria-label={`Donut chart of ${totalDx} consultations by diagnosis`} className="relative mx-auto h-[190px] w-[190px]">
            <ResponsiveContainer><PieChart><Pie data={d.diagnoses} dataKey="value" nameKey="name" innerRadius={62} outerRadius={90} paddingAngle={3} cornerRadius={7} stroke="none" animationDuration={1000}>
              {d.diagnoses.map((e, i) => <Cell key={e.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Pie><Tooltip content={<ChartTooltip />} /></PieChart></ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center"><div><p className="text-2xl font-extrabold text-navy-900">{totalDx}</p><p className="text-[11px] font-semibold text-slate-500">consultations</p></div></div>
          </div>
          <ul className="mt-4 space-y-2">
            {d.diagnoses.map((e, i) => (
              <li key={e.name} className="flex items-center gap-2.5 text-sm"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} /><span className="flex-1 truncate font-medium text-slate-700">{e.name}</span><span className="font-bold text-navy-900">{Math.round((e.value / totalDx) * 100)}%</span></li>
            ))}
          </ul>
        </Panel>

        <Panel delay={140}>
          <SectionTitle icon={Stethoscope} title="Appointments by department" subtitle="Last 7 days and next 7 days" />
          <div role="img" aria-label="Bar chart of appointments per department" className="h-[300px]">
            <ResponsiveContainer>
              <BarChart data={d.departments} layout="vertical" margin={{ left: 0, right: 12 }} barCategoryGap="22%">
                <CartesianGrid strokeDasharray="3 4" horizontal={false} stroke="#e2ebf6" />
                <XAxis type="number" allowDecimals={false} {...AXIS} /><YAxis type="category" dataKey="name" width={118} {...AXIS} tick={{ fill: '#334155', fontSize: 12, fontWeight: 600 }} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(23,170,158,.07)' }} />
                <Bar dataKey="appointments" name="Appointments" radius={[0, 8, 8, 0]} maxBarSize={20} animationDuration={1000}>{d.departments.map((e) => <Cell key={e.name} fill={e.color || '#17aa9e'} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel delay={200}>
          <SectionTitle icon={Siren} title="Emergency queue" subtitle="Sorted by urgency" action={<ActionLink to="/emergency">Manage</ActionLink>} />
          {d.emergencies.length === 0 ? <EmptyState icon={ShieldCheck} title="No active emergencies" text="The emergency department is clear." /> : (
            <ul className="space-y-3">
              {d.emergencies.slice(0, 4).map((e) => (
                <li key={e.id} className="relative overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/60 p-3.5 pl-5 transition hover:bg-white hover:shadow-soft">
                  <span className={cx('absolute inset-y-0 left-0 w-1.5', URGENCY[e.urgency].bar)} />
                  <div className="flex items-start justify-between gap-2"><p className="truncate text-sm font-bold text-navy-900">{e.patient_name}{e.age != null && <span className="ml-1.5 font-medium text-slate-500">{e.age}y</span>}</p><Badge tone={URGENCY[e.urgency].tone} dot pulse={e.urgency === 'critical'}>{URGENCY[e.urgency].label}</Badge></div>
                  <p className="mt-1 line-clamp-2 text-xs leading-snug text-slate-500">{e.condition_desc}</p>
                  <p className="mt-2 flex items-center gap-3 text-[11px] font-semibold text-slate-400"><span className="flex items-center gap-1"><Clock size={12} />{duration(e.waiting_minutes)}</span><span>{e.doctor_name ? drName(e.doctor_name) : 'Awaiting doctor'}</span></p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* ------------- upcoming / stock / activity ------------- */}
      <div className="grid gap-5 xl:grid-cols-3">
        <Panel delay={80}>
          <SectionTitle icon={CalendarDays} title="Upcoming appointments" subtitle="Next on the schedule" action={<ActionLink to="/appointments">View all</ActionLink>} />
          <ul className="space-y-1">
            {d.upcoming.map((a) => (
              <li key={a.id} className="flex items-center gap-3 rounded-xl p-2.5 transition hover:bg-slate-50">
                <Avatar src={a.patient_photo} name={fullName(a)} size={40} />
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-navy-900">{fullName(a)}</p><p className="text-xs text-slate-500"><Meta items={[drName(a.doctor_name), a.specialization]} /></p></div>
                <div className="text-right"><p className="text-sm font-bold text-navy-800">{fmtTime(a.scheduled_at)}</p><p className="text-[11px] font-semibold text-slate-400">{relativeDay(a.scheduled_at)}</p></div>
              </li>
            ))}
            {d.upcoming.length === 0 && <EmptyState icon={CalendarDays} title="Nothing scheduled" />}
          </ul>
        </Panel>

        <Panel delay={140}>
          <SectionTitle icon={Pill} title="Inventory alerts" subtitle="Low stock and expiring items" action={<ActionLink to="/medicines">Inventory</ActionLink>} />
          <div className="mb-4 grid grid-cols-3 gap-2 text-center">
            {[['Low stock', d.medicine_alerts.low, 'text-amber-600 bg-amber-50'], ['Expiring', d.medicine_alerts.expiring, 'text-blue-600 bg-blue-50'], ['Expired', d.medicine_alerts.expired, 'text-rose-600 bg-rose-50']].map(([l, v, c]) => (
              <div key={l} className={cx('rounded-xl py-2.5', c)}><p className="text-xl font-extrabold">{v}</p><p className="text-[11px] font-semibold">{l}</p></div>
            ))}
          </div>
          <ul className="space-y-3.5">
            {d.low_stock.map((m) => {
              const pct = Math.min(100, Math.round((m.quantity / Math.max(m.reorder_level, 1)) * 100));
              return (
                <li key={m.id}>
                  <div className="mb-1.5 flex items-center justify-between text-sm"><span className="flex items-center gap-2 font-semibold text-navy-800">{m.quantity === 0 && <AlertTriangle size={14} className="text-rose-500" />}{m.name}</span><span className="text-xs font-bold text-slate-500">{m.quantity} / {m.reorder_level}</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={cx('h-full rounded-full', pct < 25 ? 'bg-rose-500' : 'bg-amber-400')} style={{ width: `${Math.max(pct, 4)}%` }} /></div>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel delay={200}>
          <SectionTitle icon={ShieldCheck} title="Recent activity" subtitle="From the audit log" action={<ActionLink to="/audit">Security</ActionLink>} />
          <ol className="relative space-y-4 before:absolute before:bottom-2 before:left-[7px] before:top-2 before:w-px before:bg-slate-200">
            {d.activity.map((a) => (
              <li key={a.id} className="relative pl-7">
                <span className={cx('absolute left-0 top-1.5 h-[15px] w-[15px] rounded-full ring-4 ring-white', sevTone[a.severity])} />
                <p className="text-sm font-semibold leading-snug text-navy-800">{a.description || a.action}</p>
                <p className="mt-0.5 text-xs font-medium text-slate-500"><Meta wrap items={[a.user_name, timeAgo(a.created_at)]} /></p>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </>
  );
}
