import { useEffect, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertOctagon, AlertTriangle, Download, Globe, KeyRound, LogIn, ScrollText, ShieldAlert, ShieldCheck, Users } from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import { useDebounce, useFetch } from '../hooks';
import { Avatar, Badge, Button, cx, EmptyState, ErrorState, Input, Meta, PageHeader, Pagination, SearchInput, SectionTitle, Select, Skeleton, StatCard, TableShell, Tabs, Td, Th } from '../components/ui';
import { ChartTooltip } from '../components/ui/pickers';
import { AXIS, Legend, Panel } from './dashboard/parts';
import { CHART_COLORS } from '../lib/constants';
import { fmtDateShort, fmtDateTime, timeAgo, titleCase } from '../lib/format';

const SEV = { info: { tone: 'teal', dot: 'bg-teal-500' }, warning: { tone: 'amber', dot: 'bg-amber-500' }, critical: { tone: 'red', dot: 'bg-rose-500' } };
const ROLE_TONE = { admin: 'navy', doctor: 'teal', receptionist: 'violet' };

function Overview({ goLogs }) {
  const { data, loading, error, reload } = useFetch(() => api.get('/audit/stats'), [], { interval: 30000 });
  if (loading && !data) return <div className="grid gap-5 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-60 !rounded-2xl" />)}</div>;
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  const t = data.totals; const days = data.per_day.map((d) => ({ ...d, label: fmtDateShort(d.day) })); const peak = Math.max(...data.by_hour.map((h) => h.events), 1);
  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-5">
        <StatCard icon={ScrollText} label="Events (24h)" value={t.events_24h} sub={`${t.active_users_24h} active users`} tone="navy" />
        <StatCard icon={LogIn} label="Successful logins" value={t.logins_24h} sub="Last 24 hours" tone="teal" delay={50} />
        <StatCard icon={ShieldAlert} label="Failed logins" value={t.failed_24h} sub={t.failed_24h > 5 ? 'Unusually high' : 'Within normal range'} tone={t.failed_24h > 5 ? 'rose' : 'amber'} delay={100} onClick={() => goLogs({ action: 'LOGIN_FAILED' })} />
        <StatCard icon={AlertTriangle} label="Warnings" value={t.warnings_24h} sub="Needs a look" tone="amber" delay={150} onClick={() => goLogs({ severity: 'warning' })} />
        <StatCard icon={AlertOctagon} label="Critical events" value={t.critical_24h} sub="Immediate attention" tone="rose" delay={200} onClick={() => goLogs({ severity: 'critical' })} />
      </div>

      {data.suspicious.length > 0 && (
        <div className="mb-6 animate-fade-up overflow-hidden rounded-2xl border border-rose-200 bg-gradient-to-r from-rose-50 to-white">
          <div className="flex items-center gap-3 border-b border-rose-100 px-5 py-3.5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-rose-500 text-white"><ShieldAlert size={18} /></span><div><p className="font-extrabold text-rose-800">Suspicious sign-in activity detected</p><p className="text-xs text-rose-600/80">IP addresses with repeated failed logins in the last 7 days</p></div></div>
          <div className="grid gap-px bg-rose-100 sm:grid-cols-2 xl:grid-cols-3">{data.suspicious.map((s) => (
            <div key={s.ip_address} className="bg-white p-4"><p className="flex items-center gap-2 font-mono text-sm font-bold text-navy-900"><Globe size={14} className="text-rose-500" />{s.ip_address}</p>
              <p className="mt-1 text-sm text-slate-600"><b className="text-rose-600">{s.attempts} failed attempts</b> targeting {s.targets}</p><p className="text-xs text-slate-400">Last attempt {timeAgo(s.last_attempt)}</p></div>))}</div>
        </div>)}

      <div className="mb-6 grid gap-5 xl:grid-cols-3">
        <Panel className="xl:col-span-2">
          <SectionTitle icon={ScrollText} title="Activity over 14 days" subtitle="All events vs flagged (warning / critical)" />
          <Legend items={[{ label: 'All events', color: '#17aa9e' }, { label: 'Flagged', color: '#f43f5e' }]} />
          <div className="mt-3 h-[270px]"><ResponsiveContainer><AreaChart data={days} margin={{ left: -18, top: 6 }}>
            <defs><linearGradient id="aEv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#17aa9e" stopOpacity=".4" /><stop offset="1" stopColor="#17aa9e" stopOpacity="0" /></linearGradient><linearGradient id="aFl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f43f5e" stopOpacity=".35" /><stop offset="1" stopColor="#f43f5e" stopOpacity="0" /></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 4" vertical={false} stroke="#e2ebf6" /><XAxis dataKey="label" {...AXIS} interval={1} /><YAxis allowDecimals={false} {...AXIS} /><Tooltip content={<ChartTooltip />} />
            <Area type="monotone" dataKey="events" name="Events" stroke="#0f8a82" strokeWidth={2.8} fill="url(#aEv)" /><Area type="monotone" dataKey="flagged" name="Flagged" stroke="#f43f5e" strokeWidth={2.4} fill="url(#aFl)" />
          </AreaChart></ResponsiveContainer></div>
        </Panel>
        <Panel>
          <SectionTitle icon={Users} title="Most active users" subtitle="Last 7 days" />
          <ul className="space-y-3">{data.top_users.map((u, i) => (
            <li key={u.user_id} className="flex items-center gap-3"><span className="w-4 text-xs font-extrabold text-slate-300">{i + 1}</span><Avatar src={u.avatar_url} name={u.user_name} size={36} />
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-navy-900">{u.user_name}</p><p className="text-xs text-slate-500"><Meta items={[titleCase(u.user_role), `Seen ${timeAgo(u.last_seen)}`]} /></p></div><b className="text-sm text-navy-800">{u.events}</b></li>))}</ul>
        </Panel>
      </div>

      <div className="mb-6 grid gap-5 xl:grid-cols-3">
        <Panel>
          <SectionTitle icon={LogIn} title="Logins vs failures" subtitle="Authentication per day" />
          <div className="h-[220px]"><ResponsiveContainer><BarChart data={days} barGap={2} margin={{ left: -22 }}><CartesianGrid strokeDasharray="3 4" vertical={false} stroke="#e2ebf6" /><XAxis dataKey="label" {...AXIS} interval={2} /><YAxis allowDecimals={false} {...AXIS} /><Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(23,170,158,.07)' }} />
            <Bar dataKey="logins" name="Logins" fill="#17aa9e" radius={[5, 5, 0, 0]} maxBarSize={12} /><Bar dataKey="failed" name="Failed" fill="#f43f5e" radius={[5, 5, 0, 0]} maxBarSize={12} /></BarChart></ResponsiveContainer></div>
        </Panel>
        <Panel>
          <SectionTitle icon={ScrollText} title="Activity by module" subtitle="Last 7 days" />
          <div className="flex items-center gap-3"><div className="h-[170px] w-[170px] shrink-0"><ResponsiveContainer><PieChart><Pie data={data.by_entity} dataKey="events" nameKey="entity" innerRadius={48} outerRadius={78} paddingAngle={3} cornerRadius={6} stroke="none">{data.by_entity.map((e, i) => <Cell key={e.entity} fill={['#12223f', '#17aa9e', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#10b981', '#94a3b8'][i % 8]} />)}</Pie><Tooltip content={<ChartTooltip />} /></PieChart></ResponsiveContainer></div>
            <ul className="min-w-0 flex-1 space-y-1.5">{data.by_entity.slice(0, 6).map((e, i) => <li key={e.entity} className="flex items-center gap-2 text-xs"><span className="h-2.5 w-2.5 rounded-full" style={{ background: ['#12223f', '#17aa9e', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#10b981', '#94a3b8'][i % 8] }} /><span className="flex-1 truncate font-medium capitalize text-slate-600">{e.entity}</span><b className="text-navy-900">{e.events}</b></li>)}</ul></div>
          <div className="mt-4 flex flex-wrap gap-2">{data.by_role.map((r) => <Badge key={r.role} tone={ROLE_TONE[r.role] || 'slate'}>{titleCase(r.role)}: {r.events}</Badge>)}</div>
        </Panel>
        <Panel>
          <SectionTitle icon={KeyRound} title="Activity by hour" subtitle="When the system is used (7 days)" />
          <div className="grid grid-cols-[repeat(24,minmax(0,1fr))] gap-[3px]">{data.by_hour.map((h) => <div key={h.hour} className="group relative"><div className="aspect-[1/3] rounded transition hover:scale-110" style={{ background: `rgba(23,170,158,${0.08 + (h.events / peak) * 0.92})` }} /><span className="pointer-events-none absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-navy-900 px-2 py-1 text-[11px] font-bold text-white group-hover:block">{h.hour}:00, {h.events} events</span></div>)}</div>
          <div className="mt-2 flex justify-between text-[10px] font-semibold text-slate-400"><span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span></div>
          <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">Darker cells = more activity. Off-hours spikes (late night) are worth investigating.</p>
        </Panel>
      </div>

      <Panel>
        <SectionTitle icon={ShieldAlert} title="Recent security alerts" subtitle="Latest warning and critical events" action={<button onClick={() => goLogs({ severity: 'warning' })} className="text-xs font-bold text-teal-600 hover:underline">View all</button>} />
        <ul className="divide-y divide-slate-100">{data.recent_alerts.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-3 py-3"><span className={cx('h-2.5 w-2.5 rounded-full', SEV[a.severity].dot)} /><Badge tone={SEV[a.severity].tone}>{a.action.replace(/_/g, ' ')}</Badge><p className="min-w-[200px] flex-1 text-sm text-slate-700">{a.description}</p><span className="text-xs text-slate-500"><Meta items={[a.user_name, a.ip_address]} wrap /></span><span className="text-xs font-semibold text-slate-500">{timeAgo(a.created_at)}</span></li>))}</ul>
      </Panel>
    </>
  );
}

function Logs({ preset }) {
  const toast = useToast();
  const [f, setF] = useState({ search: '', severity: preset?.severity || '', action: preset?.action || '', role: '', from: '', to: '' }); const [page, setPage] = useState(1); const dSearch = useDebounce(f.search, 300);
  useEffect(() => { if (preset) setF((x) => ({ ...x, severity: preset.severity || '', action: preset.action || '' })); }, [preset]);
  useEffect(() => setPage(1), [dSearch, f.severity, f.action, f.role, f.from, f.to]);
  const actions = useFetch(() => api.get('/audit/actions'), []);
  const params = { search: dSearch, severity: f.severity, action: f.action, role: f.role, from: f.from, to: f.to };
  const { data, loading, error, reload } = useFetch(() => api.get('/audit', { ...params, page, limit: 15 }), [dSearch, f.severity, f.action, f.role, f.from, f.to, page], { interval: 30000 });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const exportCsv = async () => {
    try {
      const r = await api.get('/audit', { ...params, page: 1, limit: 100 });
      const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const csv = ['Time,User,Role,Action,Severity,Entity,Description,IP', ...r.data.map((l) => [l.created_at, l.user_name, l.user_role, l.action, l.severity, l.entity, l.description, l.ip_address].map(esc).join(','))].join('\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); const a = document.createElement('a'); a.href = url; a.download = `medicore-audit-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
      toast.success('Audit log exported', `${r.data.length} most recent matching events`);
    } catch (e) { toast.error('Export failed', e.message); }
  };

  return (
    <>
      <div className="card mb-5 grid gap-3 p-4 sm:grid-cols-3 xl:grid-cols-6">
        <SearchInput value={f.search} onChange={(v) => setF((x) => ({ ...x, search: v }))} placeholder="Search user, action, IP…" className="sm:col-span-3 xl:col-span-2" />
        <Select value={f.severity} onChange={set('severity')}><option value="">Any severity</option><option value="info">Info</option><option value="warning">Warning</option><option value="critical">Critical</option></Select>
        <Select value={f.action} onChange={set('action')}><option value="">Any action</option>{(actions.data || []).map((a) => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}</Select>
        <Select value={f.role} onChange={set('role')}><option value="">Any role</option><option value="admin">Admin</option><option value="doctor">Doctor</option><option value="receptionist">Receptionist</option></Select>
        <Button variant="outline" icon={Download} onClick={exportCsv}>Export CSV</Button>
        <div className="flex items-center gap-2 sm:col-span-2 xl:col-span-3"><Input type="date" value={f.from} onChange={set('from')} /><span className="text-slate-400">to</span><Input type="date" value={f.to} onChange={set('to')} /></div>
        {(f.severity || f.action || f.role || f.from || f.to || f.search) && <button onClick={() => setF({ search: '', severity: '', action: '', role: '', from: '', to: '' })} className="text-left text-sm font-bold text-teal-600 hover:underline">Clear filters</button>}
      </div>
      {error && !data ? <ErrorState error={error} onRetry={reload} /> : (
        <TableShell label="Activity log">
          <thead><tr><Th>Time</Th><Th>User</Th><Th>Action</Th><Th>Details</Th><Th>Severity</Th><Th className="hidden xl:table-cell">IP address</Th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {loading && !data && Array.from({ length: 8 }).map((_, i) => <tr key={i}><Td colSpan={6}><Skeleton className="h-8 w-full" /></Td></tr>)}
            {data?.data.map((l) => (
              <tr key={l.id} className={cx('transition hover:bg-teal-50/40', l.severity === 'critical' && 'bg-rose-50/40')}>
                <Td data-primary className="xl:whitespace-nowrap"><p className="text-sm font-semibold text-navy-800">{fmtDateTime(l.created_at)}</p><p className="text-xs text-slate-500">{timeAgo(l.created_at)}</p></Td>
                <Td label="User"><p className="text-sm font-bold text-navy-900">{l.user_name}</p>{l.user_role && <Badge tone={ROLE_TONE[l.user_role] || 'slate'} className="mt-0.5">{titleCase(l.user_role)}</Badge>}</Td>
                <Td label="Action"><span className="rounded-lg bg-slate-100 px-2 py-1 font-mono text-[11px] font-bold text-slate-600">{l.action}</span></Td>
                <Td data-wide label="Details" className="min-w-[150px] max-w-[380px] text-sm text-slate-600">{l.description}<span className="mt-0.5 block font-mono text-[10px] text-slate-400 xl:hidden">{l.ip_address}</span></Td>
                <Td label="Severity"><Badge tone={SEV[l.severity].tone} dot>{titleCase(l.severity)}</Badge></Td>
                <Td data-skip className="hidden font-mono text-xs text-slate-500 xl:table-cell">{l.ip_address}</Td>
              </tr>))}
            {data?.data.length === 0 && <tr><td colSpan={6}><EmptyState icon={ShieldCheck} title="No events match" text="Adjust the filters to see more activity." /></td></tr>}
          </tbody>
        </TableShell>)}
      {data && <div className="mt-5"><Pagination page={data.page} pages={data.pages} total={data.total} limit={data.limit} onChange={setPage} /></div>}
    </>
  );
}

export default function AuditLogs() {
  const [tab, setTab] = useState('overview'); const [preset, setPreset] = useState(null);
  return (
    <>
      <PageHeader icon={ShieldCheck} title="Security & audit" subtitle="Admin-only monitoring of logins, patient record changes and administrative actions" />
      <Tabs tabs={[{ id: 'overview', label: 'Security overview', icon: ShieldCheck }, { id: 'logs', label: 'Activity log', icon: ScrollText }]} value={tab} onChange={setTab} className="mb-6" />
      {tab === 'overview' ? <Overview goLogs={(p) => { setPreset(p); setTab('logs'); }} /> : <Logs preset={preset} />}
    </>
  );
}
