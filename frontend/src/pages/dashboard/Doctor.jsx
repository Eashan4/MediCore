import { Link, useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, BedDouble, CalendarClock, CheckCircle2, ClipboardCheck, Clock, HeartPulse, PlayCircle, Siren, Star, Stethoscope, Users } from 'lucide-react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks';
import { ActionLink, Avatar, Badge, Button, cx, EmptyState, ErrorState, Meta, SectionTitle, StatCard } from '../../components/ui';
import { ChartTooltip } from '../../components/ui/pickers';
import { AXIS, DashSkeleton, GlassStat, Hero, Legend, Panel } from './parts';
import { APPT_STATUS, CHART_COLORS, IMAGES, URGENCY } from '../../lib/constants';
import { daysSince, duration, fmtDateShort, fmtTime, fullName, greeting, surname } from '../../lib/format';

export default function DoctorDashboard({ user }) {
  const nav = useNavigate(); const toast = useToast();
  const { data, loading, error, reload, updatedAt, refresh } = useFetch(() => api.get('/dashboard/doctor'), [], { interval: 30000 });
  if (loading && !data) return <DashSkeleton />;
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  const { stats: s, profile, agenda, next, admitted, week, diagnoses, recent, follow_ups: followUps, emergencies } = data;
  const totalDx = diagnoses.reduce((a, b) => a + b.value, 0);

  const setStatus = async (a, status) => {
    try { await api.patch(`/appointments/${a.id}/status`, { status }); toast.success(status === 'completed' ? 'Consultation completed' : 'Consultation started', `${fullName(a)}`); refresh(); }
    catch (e) { toast.error('Could not update appointment', e.message); }
  };

  return (
    <>
      <Hero image={IMAGES.doctorTeam} eyebrow={[profile.specialization, profile.department]} updatedAt={updatedAt}
        title={<>{greeting()}, Dr. {surname(user.name)}</>}
        subtitle={s.remaining_today ? `You have ${s.remaining_today} patient${s.remaining_today === 1 ? '' : 's'} left on today's schedule and ${s.admitted} admitted under your care.` : `Your clinic is done for today. ${s.admitted} patient${s.admitted === 1 ? ' remains' : 's remain'} admitted under your care.`}
        actions={<>
          <Button icon={Users} onClick={() => nav('/patients')}>My patients</Button>
          <Button variant="glass" icon={CalendarClock} onClick={() => nav('/appointments')}>Full schedule</Button>
        </>}
        aside={<>
          <GlassStat icon={Star} label="Rating" value={Number(profile.rating).toFixed(1)} sub={`${profile.experience_years} yrs experience`} />
          {next ? (
            <Link to={`/patients/${next.patient_id}`} className="glass flex min-w-[260px] items-center gap-3.5 rounded-2xl px-4 py-3.5 transition hover:bg-white/15">
              <Avatar src={next.patient_photo} name={fullName(next)} size={46} ring />
              <div className="min-w-0"><p className="text-xs font-semibold text-teal-300">Next patient at {fmtTime(next.scheduled_at)}</p><p className="truncate text-base font-extrabold">{fullName(next)}</p><p className="truncate text-xs text-slate-300">{next.reason}</p></div>
            </Link>
          ) : <GlassStat icon={CheckCircle2} label="Next patient" value="None" sub="Schedule is clear" />}
        </>} />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-4">
        <StatCard icon={Users} label="My patients" value={s.patients} sub="Under your care" tone="teal" onClick={() => nav('/patients')} />
        <StatCard icon={CalendarClock} label="Today's appointments" value={s.appointments_today} sub={[`${s.completed_today} completed`, `${s.remaining_today} remaining`]} spark={week.map((w) => w.total)} tone="blue" delay={60} onClick={() => nav('/appointments')} />
        <StatCard icon={BedDouble} label="Admitted under care" value={s.admitted} sub="Inpatients to review" tone="navy" delay={120} />
        <StatCard icon={ClipboardCheck} label="Follow-ups due" value={s.follow_ups} sub="Within the next 10 days" tone="amber" delay={180} />
      </div>

      <div className="mb-6 grid gap-5 xl:grid-cols-3">
        <Panel className="xl:col-span-2">
          <SectionTitle icon={CalendarClock} title="Today's agenda" subtitle="Your consultations in time order" action={<ActionLink to="/appointments">Full schedule</ActionLink>} />
          {agenda.length === 0 ? <EmptyState icon={CalendarClock} title="No appointments today" text="Enjoy the breathing room, or catch up on records." /> : (
            <ol className="relative space-y-3 before:absolute before:bottom-3 before:left-[62px] before:top-3 before:w-px before:bg-slate-200">
              {agenda.map((a) => {
                const st = APPT_STATUS[a.status]; const done = a.status === 'completed' || a.status === 'cancelled' || a.status === 'no_show';
                return (
                  <li key={a.id} className="flex items-stretch gap-4">
                    <div className="w-[50px] shrink-0 pt-3.5 text-right"><p className="text-sm font-extrabold text-navy-800">{fmtTime(a.scheduled_at).replace(' ', '')}</p></div>
                    <span className={cx('relative z-10 mt-4 h-3 w-3 shrink-0 rounded-full ring-4 ring-white', a.status === 'completed' ? 'bg-emerald-500' : a.status === 'checked_in' ? 'bg-teal-500' : done ? 'bg-slate-300' : 'bg-blue-500')} />
                    <div className={cx('flex min-w-0 flex-1 flex-wrap items-center gap-3 rounded-2xl border p-3 transition', a.status === 'checked_in' ? 'border-teal-300 bg-teal-50/60 shadow-soft' : 'border-slate-100 bg-white hover:shadow-soft', done && 'opacity-70')}>
                      <Avatar src={a.patient_photo} name={fullName(a)} size={42} />
                      <Link to={`/patients/${a.patient_id}`} className="min-w-0 flex-1 hover:text-teal-700">
                        <p className="truncate text-sm font-bold text-navy-900">{fullName(a)} <span className="ml-1 font-medium text-slate-500">{a.age}y</span></p>
                        <p className="text-xs text-slate-500"><Meta items={[a.reason || a.type, `${a.duration_min} min`]} /></p>
                      </Link>
                      <Badge tone={st.tone} dot={a.status === 'checked_in'} pulse={a.status === 'checked_in'}>{a.status === 'checked_in' ? 'Waiting / in room' : st.label}</Badge>
                      {a.status === 'scheduled' && <Button size="xs" variant="soft" icon={PlayCircle} onClick={() => setStatus(a, 'checked_in')}>Start</Button>}
                      {a.status === 'checked_in' && <Button size="xs" icon={CheckCircle2} onClick={() => setStatus(a, 'completed')}>Complete</Button>}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Panel>

        <Panel>
          <SectionTitle icon={BedDouble} title="Admitted patients" subtitle="Currently under your care" />
          {admitted.length === 0 ? <EmptyState icon={BedDouble} title="No inpatients" text="None of your patients are admitted right now." /> : (
            <ul className="space-y-3">
              {admitted.map((p) => (
                <li key={p.admission_id}>
                  <Link to={`/patients/${p.patient_id}`} className="flex items-center gap-3 rounded-2xl border border-slate-100 p-3 transition hover:border-teal-300 hover:shadow-soft">
                    <Avatar src={p.photo_url} name={fullName(p)} size={44} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-navy-900">{fullName(p)}</p>
                      <p className="truncate text-xs text-slate-500">{p.diagnosis || p.reason}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5"><Badge tone="blue">{p.bed_number}</Badge><Badge tone="slate">Day {daysSince(p.admitted_at)}</Badge>
                        {p.heart_rate && <span className="flex items-center gap-1 text-[11px] font-bold text-rose-500"><HeartPulse size={12} />{p.heart_rate}</span>}
                        {p.spo2 && <span className="text-[11px] font-bold text-sky-600">SpO2 {p.spo2}%</span>}</div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Panel>
          <SectionTitle icon={Activity} title="Weekly workload" subtitle="Appointments booked vs completed" />
          <Legend items={[{ label: 'Booked', color: '#c5d6ec' }, { label: 'Completed', color: '#17aa9e' }]} />
          <div className="mt-3 h-[220px]">
            <ResponsiveContainer><BarChart data={week} barGap={4} margin={{ left: -22 }}>
              <CartesianGrid strokeDasharray="3 4" vertical={false} stroke="#e2ebf6" />
              <XAxis dataKey="label" {...AXIS} /><YAxis allowDecimals={false} {...AXIS} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(23,170,158,.07)' }} />
              <Bar dataKey="total" name="Booked" fill="#c5d6ec" radius={[7, 7, 0, 0]} maxBarSize={22} />
              <Bar dataKey="completed" name="Completed" fill="#17aa9e" radius={[7, 7, 0, 0]} maxBarSize={22} />
            </BarChart></ResponsiveContainer>
          </div>
        </Panel>

        <Panel>
          <SectionTitle icon={Stethoscope} title="My case mix" subtitle="Diagnoses you've recorded" />
          <div className="flex items-center gap-4">
            <div className="h-[150px] w-[150px] shrink-0"><ResponsiveContainer><PieChart><Pie data={diagnoses} dataKey="value" nameKey="name" innerRadius={44} outerRadius={70} paddingAngle={3} cornerRadius={6} stroke="none">{diagnoses.map((e, i) => <Cell key={e.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Pie><Tooltip content={<ChartTooltip />} /></PieChart></ResponsiveContainer></div>
            <ul className="min-w-0 flex-1 space-y-2">{diagnoses.slice(0, 5).map((e, i) => <li key={e.name} className="flex items-center gap-2 text-xs"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} /><span className="flex-1 truncate font-medium text-slate-600">{e.name}</span><b className="text-navy-900">{Math.round((e.value / (totalDx || 1)) * 100)}%</b></li>)}</ul>
          </div>
          <div className="mt-5 border-t border-slate-100 pt-4">
            <p className="mb-3 text-xs font-semibold text-slate-500">Recent records</p>
            <ul className="space-y-2.5">{recent.slice(0, 3).map((r) => <li key={r.id}><Link to={`/patients/${r.patient_id}`} className="flex items-center gap-2.5 text-sm hover:text-teal-700"><Avatar src={r.photo_url} name={fullName(r)} size={28} /><span className="min-w-0 flex-1 truncate font-semibold text-navy-800">{fullName(r)}</span><span className="truncate text-xs text-slate-400">{r.diagnosis}</span></Link></li>)}</ul>
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel>
            <SectionTitle icon={Siren} title="Emergency alerts" subtitle="Open cases that need a doctor" action={<ActionLink to="/emergency">Open</ActionLink>} />
            {emergencies.length === 0 ? <p className="py-4 text-center text-sm text-slate-500">No open emergency cases</p> : (
              <ul className="space-y-2.5">{emergencies.map((e) => (
                <li key={e.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3"><span className={cx('h-9 w-1.5 rounded-full', URGENCY[e.urgency].bar)} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-navy-900">{e.patient_name}</p><p className="flex items-center gap-1 text-[11px] font-semibold text-slate-400"><Clock size={11} />{duration(e.waiting_minutes)} waiting</p></div><Badge tone={URGENCY[e.urgency].tone}>{URGENCY[e.urgency].label}</Badge></li>))}</ul>
            )}
          </Panel>
          <Panel>
            <SectionTitle icon={ClipboardCheck} title="Follow-ups due" subtitle="Next 10 days" />
            {followUps.length === 0 ? <p className="py-3 text-center text-sm text-slate-500">No follow-ups due</p> : (
              <ul className="space-y-2.5">{followUps.slice(0, 4).map((f, i) => <li key={i}><Link to={`/patients/${f.patient_id}`} className="flex items-center gap-2.5 text-sm hover:text-teal-700"><Avatar src={f.photo_url} name={fullName(f)} size={30} /><span className="min-w-0 flex-1 truncate font-semibold text-navy-800">{fullName(f)}</span><Badge tone="amber">{fmtDateShort(f.follow_up_date)}</Badge></Link></li>)}</ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
