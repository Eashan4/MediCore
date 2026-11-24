import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, BedDouble, CalendarDays, ClipboardList, FileText, KeyRound, LayoutDashboard, LogOut, Menu as MenuIcon, Pill, Search, ShieldCheck, Siren,
  Stethoscope, UserRound, Users, UsersRound, X, ChevronDown, Loader2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../api/client';
import { useClickOutside, useDebounce, useEscape, useFetch, useFocusTrap } from '../../hooks';
import { Avatar, Badge, Menu, MenuItem, Meta, Ring, cx } from '../ui';
import { ROLE_META, URGENCY } from '../../lib/constants';
import { drName, fmtDate, fullName, timeAgo } from '../../lib/format';

export const Logo = ({ light, size = 40 }) => {
  const gid = `lg${useId().replace(/:/g, '')}`;
  return (
  <div className="flex items-center gap-3">
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className="shrink-0 drop-shadow-[0_6px_14px_rgba(23,170,158,.45)]">
      <defs><linearGradient id={gid} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3cc5b7" /><stop offset="1" stopColor="#2f4f8a" /></linearGradient></defs>
      <rect width="48" height="48" rx="14" fill={`url(#${gid})`} />
      <path d="M20 10h8v10h10v8H28v10h-8V28H10v-8h10z" fill="#fff" opacity=".97" />
      <path d="M8 29h9l3-6 4 11 3-8 2 3h11" fill="none" stroke="#12223f" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" opacity=".55" />
    </svg>
    <div className="leading-none">
      <p className={cx('font-display text-2xl font-semibold tracking-tight', light ? 'text-white' : 'text-navy-900')}>Medi<span className="text-teal-400">Core</span></p>
      <p className={cx('mt-1 text-[11px] font-medium tracking-wide', light ? 'text-slate-400' : 'text-slate-500')}>Hospital suite</p>
    </div>
  </div>
);
};

const NAV = {
  admin: [
    { group: 'Overview', items: [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }] },
    { group: 'Clinical', items: [
      { to: '/patients', label: 'Patients', icon: Users }, { to: '/appointments', label: 'Appointments', icon: CalendarDays },
      { to: '/beds', label: 'Bed Management', icon: BedDouble }, { to: '/admissions', label: 'Admissions', icon: ClipboardList },
      { to: '/emergency', label: 'Emergency', icon: Siren, badge: 'emergency' } ] },
    { group: 'Management', items: [
      { to: '/doctors', label: 'Doctors', icon: Stethoscope }, { to: '/staff', label: 'Staff', icon: UsersRound }, { to: '/medicines', label: 'Medicines', icon: Pill, badge: 'stock' } ] },
    { group: 'Security', items: [{ to: '/audit', label: 'Audit Logs', icon: ShieldCheck }] },
  ],
  doctor: [
    { group: 'Overview', items: [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }] },
    { group: 'My practice', items: [
      { to: '/patients', label: 'My Patients', icon: Users }, { to: '/appointments', label: 'My Appointments', icon: CalendarDays },
      { to: '/clinical', label: 'Diagnoses & Rx', icon: FileText }, { to: '/beds', label: 'Inpatient Beds', icon: BedDouble },
      { to: '/emergency', label: 'Emergency', icon: Siren, badge: 'emergency' } ] },
    { group: 'Reference', items: [{ to: '/medicines', label: 'Medicine Formulary', icon: Pill }] },
  ],
  receptionist: [
    { group: 'Overview', items: [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }] },
    { group: 'Front desk', items: [
      { to: '/patients', label: 'Patients', icon: Users }, { to: '/appointments', label: 'Appointments', icon: CalendarDays },
      { to: '/admissions', label: 'Admissions', icon: ClipboardList }, { to: '/beds', label: 'Bed Availability', icon: BedDouble },
      { to: '/emergency', label: 'Emergency', icon: Siren, badge: 'emergency' } ] },
    { group: 'Directory', items: [{ to: '/doctors', label: 'Doctors', icon: Stethoscope }] },
  ],
};

const TITLES = { '/dashboard': 'Dashboard', '/patients': 'Patients', '/appointments': 'Appointments', '/beds': 'Bed Management', '/admissions': 'Admissions', '/emergency': 'Emergency', '/doctors': 'Doctors & Departments', '/staff': 'Staff', '/medicines': 'Medicines', '/audit': 'Security & Audit', '/clinical': 'Diagnoses & Prescriptions', '/profile': 'My Profile' };

function Sidebar({ user, shell, onNavigate }) {
  const groups = NAV[user.role];
  const beds = shell?.beds;
  return (
    <aside className="dark-surface relative flex h-full w-[272px] flex-col overflow-hidden bg-navy-950 text-white">
      <div className="relative px-6 pb-5 pt-6"><Logo light /></div>

      <nav aria-label="Main" className="relative flex-1 space-y-6 overflow-y-auto border-t border-white/10 px-4 pb-4 pt-5">
        {groups.map((g) => (
          <div key={g.group}>
            <p className="mb-1.5 px-3 text-xs font-semibold text-slate-400">{g.group}</p>
            <div className="space-y-1">
              {g.items.map((it) => {
                const count = it.badge === 'emergency' ? shell?.emergencyActive : it.badge === 'stock' ? shell?.lowStock : 0;
                return (
                  <NavLink key={it.to} to={it.to} onClick={onNavigate}
                    className={({ isActive }) => cx('group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors duration-150',
                      isActive ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/[.06] hover:text-white')}>
                    {({ isActive }) => (<>
                      {isActive && <span aria-hidden="true" className="absolute inset-y-2 -left-4 w-1 rounded-r-full bg-teal-400" />}
                      <it.icon size={19} aria-hidden="true" className={cx(isActive ? 'text-teal-300' : 'text-slate-400 group-hover:text-teal-300')} />
                      <span className="flex-1">{it.label}</span>
                      {count > 0 && <span className={cx('grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold', isActive ? 'bg-white text-navy-900' : 'bg-rose-500 text-white')}>{count}</span>}
                    </>)}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="relative space-y-3 p-4">
        {beds && (
          <div className="rounded-xl border border-white/10 bg-white/[.04] p-4">
            <div className="flex items-center gap-4">
              <Ring value={beds.occupancy} size={64} stroke={7} color="#3cc5b7" track="rgba(255,255,255,.12)"><span className="num text-sm font-bold">{beds.occupancy}%</span></Ring>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-300">Bed occupancy</p>
                <p className="num mt-0.5 font-display text-2xl font-semibold leading-tight">{beds.available} <span className="font-sans text-xs font-medium text-slate-400">beds free</span></p>
                <p className="text-[11px] text-slate-400">{beds.occupied} of {beds.total} in use</p>
              </div>
            </div>
          </div>
        )}
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[.04] p-3">
          <Avatar src={user.avatar_url} name={user.name} size={38} status="online" />
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{user.role === 'doctor' ? drName(user.name) : user.name}</p><p className="truncate text-[11px] text-slate-400">{ROLE_META[user.role].label}</p></div>
        </div>
      </div>
    </aside>
  );
}

function GlobalSearch({ className }) {
  const [q, setQ] = useState(''); const [open, setOpen] = useState(false); const [res, setRes] = useState([]); const [loading, setLoading] = useState(false);
  const dq = useDebounce(q, 250); const ref = useRef(null); const input = useRef(null); const nav = useNavigate();
  useClickOutside(ref, () => setOpen(false), open);
  useEscape(() => setOpen(false), open);
  useEffect(() => {
    const fn = (e) => { if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) && input.current?.offsetParent) { e.preventDefault(); input.current.focus(); } };
    document.addEventListener('keydown', fn); return () => document.removeEventListener('keydown', fn);
  }, []);
  useEffect(() => {
    if (dq.trim().length < 2) { setRes([]); return undefined; }
    let live = true; setLoading(true);
    api.get('/patients', { search: dq, limit: 6, sort: 'name' }).then((r) => live && setRes(r.data)).catch(() => live && setRes([])).finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [dq]);
  return (
    <div ref={ref} role="search" className={cx('relative w-full max-w-md', className)}>
      <Search size={17} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
      <input ref={input} type="search" role="combobox" aria-expanded={open && q.trim().length >= 2} aria-controls="global-search-results" aria-autocomplete="list" aria-label="Search patients" value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder="Search patients by name, ID or phone"
        className="h-11 w-full rounded-2xl border border-slate-200 bg-white/80 pl-11 pr-12 text-sm placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-500/15 [&::-webkit-search-cancel-button]:hidden" />
      {loading ? <Loader2 size={16} aria-hidden="true" className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-slate-400" /> : <kbd aria-hidden="true" className="absolute right-3.5 hidden md:block top-1/2 -translate-y-1/2 rounded-md border border-slate-200 bg-slate-50 px-1.5 text-[11px] font-semibold text-slate-400">/</kbd>}
      {open && q.trim().length >= 2 && (
        <div id="global-search-results" className="absolute z-40 mt-2 w-full animate-pop rounded-2xl border border-slate-200 bg-white p-1.5 shadow-lift">
          {res.length === 0 && !loading && <p className="px-4 py-5 text-center text-sm text-slate-500" role="status">No patients match "{q}"</p>}
          {res.map((p) => (
            <button key={p.id} onClick={() => { nav(`/patients/${p.id}`); setOpen(false); setQ(''); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-teal-50">
              <Avatar src={p.photo_url} name={fullName(p)} size={36} />
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-navy-900">{fullName(p)}</p><p className="truncate text-xs text-slate-500"><Meta items={[p.patient_code, `${p.age}y`, p.gender]} /></p></div>
              {p.bed_number && <Badge tone="blue">{p.bed_number}</Badge>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Notifications({ user, shell }) {
  const nav = useNavigate();
  const items = shell?.emergencies || [];
  const total = (shell?.emergencyActive || 0) + (user.role === 'admin' ? shell?.lowStock || 0 : 0);
  return (
    <Menu width="w-[360px] max-w-[calc(100vw-2rem)]" trigger={(open) => (
      <button type="button" aria-label={total > 0 ? `Notifications, ${total} need attention` : 'Notifications'} className={cx('relative grid h-11 w-11 place-items-center rounded-2xl border bg-white/80 text-slate-600 transition hover:border-teal-400 hover:text-teal-700', open ? 'border-teal-400' : 'border-slate-200')}>
        <Bell size={19} aria-hidden="true" />
        {total > 0 && <span aria-hidden="true" className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">{total}</span>}
      </button>)}>
      <div className="p-2">
        <div className="mb-1 flex items-center justify-between px-2 py-1.5"><p className="text-sm font-bold text-navy-900">Notifications</p>{total > 0 && <Badge tone="red">{total} need attention</Badge>}</div>
        {items.length === 0 && !(user.role === 'admin' && shell?.lowStock) && <p className="px-3 py-8 text-center text-sm text-slate-500">You're all caught up</p>}
        {items.map((e) => (
          <button type="button" key={e.id} onClick={() => nav('/emergency')} className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-50">
            <span className={cx('mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl', e.urgency === 'critical' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600')}><Siren size={17} aria-hidden="true" /></span>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-navy-900">{e.patient_name}</p><p className="truncate text-xs text-slate-500">{e.condition_desc}</p></div>
            <Badge tone={URGENCY[e.urgency].tone}>{URGENCY[e.urgency].label}</Badge>
          </button>
        ))}
        {user.role === 'admin' && shell?.lowStock > 0 && (
          <button type="button" onClick={() => nav('/medicines')} className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-50">
            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600"><Pill size={17} /></span>
            <div className="flex-1"><p className="text-sm font-semibold text-navy-900">Low stock alert</p><p className="text-xs text-slate-500">{shell.lowStock} medicines are at or below reorder level</p></div>
          </button>
        )}
      </div>
    </Menu>
  );
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const loc = useLocation(); const nav = useNavigate();
  const [mobile, setMobile] = useState(false);
  const drawer = useRef(null);
  useEscape(() => setMobile(false), mobile);
  useFocusTrap(drawer, mobile);

  const { data: shell } = useFetch(async () => {
    const [beds, emg, meds] = await Promise.all([
      api.get('/beds').then((r) => r.summary).catch(() => null),
      api.get('/emergency', { status: 'active', limit: 4 }).catch(() => null),
      user.role === 'admin' ? api.get('/medicines/meta').catch(() => null) : Promise.resolve(null),
    ]);
    return { beds, emergencyActive: emg?.stats?.active || 0, emergencies: emg?.data || [], lowStock: meds ? meds.stats.low + meds.stats.out_of_stock : 0 };
  }, [user.id, loc.pathname], { interval: 45000 });

  useEffect(() => { setMobile(false); window.scrollTo({ top: 0 }); }, [loc.pathname]);
  const title = useMemo(() => (loc.pathname.startsWith('/patients/') ? 'Patient Profile' : TITLES[loc.pathname] || 'MediCore'), [loc.pathname]);

  const doLogout = async () => { await logout(); toast.info('Signed out', 'See you soon!'); nav('/login'); };

  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only z-[200] rounded-xl bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to main content</a>
      <div className="fixed inset-y-0 left-0 z-30 hidden lg:block"><Sidebar user={user} shell={shell} /></div>
      {mobile && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-navy-950/60 backdrop-blur-sm" onClick={() => setMobile(false)} aria-hidden="true" />
          <div ref={drawer} role="dialog" aria-modal="true" aria-label="Navigation menu" tabIndex={-1} className="relative h-full w-[272px] max-w-[85vw] animate-slide-right outline-none"><Sidebar user={user} shell={shell} onNavigate={() => setMobile(false)} />
            <button type="button" onClick={() => setMobile(false)} className="absolute right-3 top-5 grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-white" aria-label="Close menu"><X size={18} aria-hidden="true" /></button></div>
        </div>
      )}

      <div className="lg:pl-[272px]">
        <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-[#f4f7fa]/85 backdrop-blur-xl">
          <div className="mx-auto flex h-[72px] max-w-[1480px] items-center gap-4 px-4 sm:px-6 lg:px-8">
            <button type="button" onClick={() => setMobile(true)} className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-slate-200 bg-white/80 text-navy-800 lg:hidden" aria-label="Open menu" aria-expanded={mobile}><MenuIcon size={20} aria-hidden="true" /></button>
            <div className="min-w-0 lg:hidden"><Logo size={34} /></div>
            <div className="hidden min-w-0 lg:block"><p className="text-xs font-medium text-slate-500">{ROLE_META[user.role].label} workspace</p><p className="truncate text-sm font-bold text-navy-900">{title}</p></div>
            <div className="hidden flex-1 justify-center px-2 md:flex"><GlobalSearch /></div><div className="flex-1 md:hidden" />
            <div className="hidden text-right xl:block"><p className="text-sm font-bold text-navy-900">{fmtDate(new Date())}</p><p className="text-xs text-slate-500">{new Date().toLocaleDateString('en-US', { weekday: 'long' })}</p></div>
            <Notifications user={user} shell={shell} />
            <Menu trigger={(open) => (
              <button type="button" aria-label="Account menu" className={cx('flex items-center gap-2.5 rounded-2xl border bg-white/80 py-1.5 pl-1.5 pr-3 transition hover:border-teal-400', open ? 'border-teal-400' : 'border-slate-200')}>
                <Avatar src={user.avatar_url} name={user.name} size={36} square />
                <span className="hidden text-left sm:block"><span className="block max-w-[130px] truncate text-sm font-bold leading-tight text-navy-900">{user.role === 'doctor' ? drName(user.name) : user.name}</span><span className="block text-[11px] leading-tight text-slate-500">{ROLE_META[user.role].short}</span></span>
                <ChevronDown size={15} className="hidden text-slate-400 sm:block" />
              </button>)}>
              <div className="border-b border-slate-100 px-3 pb-2.5 pt-2"><p className="truncate text-sm font-bold text-navy-900">{user.name}</p><p className="truncate text-xs text-slate-500">{user.email}</p></div>
              <div className="pt-1.5">
                <MenuItem icon={UserRound} onClick={() => nav('/profile')}>My profile</MenuItem>
                <MenuItem icon={KeyRound} onClick={() => nav('/profile')}>Change password</MenuItem>
                <MenuItem icon={LogOut} danger onClick={doLogout}>Sign out</MenuItem>
              </div>
            </Menu>
          </div>
          <div className="px-4 pb-3 sm:px-6 md:hidden"><GlobalSearch className="max-w-none" /></div>
        </header>
        <main id="main" tabIndex={-1} className="mx-auto max-w-[1480px] px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-8">
          <div key={loc.pathname} className="animate-fade-up"><Outlet /></div>
        </main>
      </div>
    </div>
  );
}
