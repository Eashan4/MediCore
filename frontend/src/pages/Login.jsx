import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, BedDouble, ClipboardList, Eye, EyeOff, KeyRound, Lock, Mail, ShieldCheck, Stethoscope, Activity } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Button, Meta, cx } from '../components/ui';
import { Logo } from '../components/layout/AppLayout';
import { DEMO_ACCOUNTS, IMAGES, ROLE_META } from '../lib/constants';

const PORTALS = [
  { id: 'admin', label: 'Admin', icon: ShieldCheck, img: IMAGES.hospital, title: 'Run the whole hospital from one screen.', text: 'Live occupancy, staffing, inventory and a full security audit trail, built for administrators.' },
  { id: 'doctor', label: 'Doctor', icon: Stethoscope, img: IMAGES.doctorTeam, title: 'Spend more time with patients, less on paperwork.', text: 'Your schedule, patient histories, diagnoses and prescriptions, always one click away.' },
  { id: 'receptionist', label: 'Reception', icon: ClipboardList, img: IMAGES.reception, title: 'A smooth front desk, from check-in to admission.', text: 'Register patients, book appointments and allocate beds without double bookings.' },
];

export default function Login() {
  const { login, logout } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [role, setRole] = useState('admin');
  const [email, setEmail] = useState(DEMO_ACCOUNTS.admin.email);
  const [password, setPassword] = useState(DEMO_ACCOUNTS.admin.password);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const portal = PORTALS.find((p) => p.id === role);

  const pick = (id) => { setRole(id); setEmail(DEMO_ACCOUNTS[id].email); setPassword(DEMO_ACCOUNTS[id].password); setError(''); };

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const user = await login(email.trim(), password);
      if (user.role !== role) {
        await logout();
        setError(`This account is a ${ROLE_META[user.role].label} account. Select the "${PORTALS.find((p) => p.id === user.role).label}" portal to sign in.`);
        return;
      }
      toast.success(`Welcome back, ${user.name.split(' ')[0]}`, `Signed in to the ${ROLE_META[user.role].label} workspace`);
      nav('/dashboard');
    } catch (err) {
      setError(err.fields?.email || err.message);
    } finally { setLoading(false); }
  };

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.08fr_1fr]">
      {/* ---------------- hero ---------------- */}
      <section className="dark-surface relative hidden overflow-hidden bg-navy-950 lg:block">
        {PORTALS.map((p) => (
          <img key={p.id} src={p.img} alt="" className={cx('absolute inset-0 h-full w-full object-cover transition-opacity duration-[900ms]', p.id === role ? 'opacity-100' : 'opacity-0')} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        ))}
        <div className="absolute inset-0 bg-gradient-to-br from-navy-950/95 via-navy-900/80 to-teal-800/60" />

        <div className="relative flex h-full flex-col justify-between p-12 xl:p-16">
          <Logo light size={46} />
          <div className="max-w-xl">
            <h1 key={role} className="animate-fade-up font-display text-5xl font-semibold leading-[1.08] text-white xl:text-6xl">{portal.title}</h1>
            <p key={role + 't'} className="mt-5 max-w-md animate-fade-up text-base leading-relaxed text-slate-300">{portal.text}</p>

            <div className="mt-10 flex flex-wrap gap-4">
              <div className="glass animate-float rounded-2xl p-4">
                <p className="mb-2.5 flex items-center gap-2 text-xs font-semibold text-slate-200"><BedDouble size={14} aria-hidden="true" className="text-teal-300" />Live bed board</p>
                <div className="grid grid-cols-8 gap-1.5">
                  {Array.from({ length: 24 }).map((_, i) => (
                    <span key={i} className={cx('h-4 w-4 rounded-md', [2, 7, 13, 19].includes(i) ? 'bg-emerald-400' : [5, 21].includes(i) ? 'bg-rose-400' : 'bg-blue-400/80')} />
                  ))}
                </div>
              </div>
              <div className="glass rounded-2xl p-4" style={{ animation: 'float 6s ease-in-out infinite .8s' }}>
                <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-200"><Activity size={14} aria-hidden="true" className="text-teal-300" />Patient vitals</p>
                <svg width="150" height="36" viewBox="0 0 150 36"><path d="M0 20h30l6-12 8 26 7-20 5 6h94" fill="none" stroke="#5eead4" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <div className="glass rounded-2xl p-4" style={{ animation: 'float 7s ease-in-out infinite 1.4s' }}>
                <p className="flex items-center gap-2 text-xs font-semibold text-slate-200"><Lock size={14} aria-hidden="true" className="text-teal-300" />Role-based security</p>
                <p className="mt-1.5 text-xs text-slate-300"><Meta items={['JWT sessions', 'Full audit trail']} /></p>
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-400"><Meta wrap items={[`© ${new Date().getFullYear()} MediCore Hospital Suite`, 'Simulated demo data']} /></p>
        </div>
      </section>

      {/* ---------------- form ---------------- */}
      <section className="relative flex items-center justify-center overflow-hidden px-5 py-10 sm:px-10">
                <div className="relative w-full max-w-[440px] animate-fade-up">
          <div className="mb-8 lg:hidden"><Logo /></div>
          <h2 className="font-display text-4xl font-semibold text-navy-900">Welcome back</h2>
          <p className="mt-2 text-sm text-slate-500">Choose your portal and sign in to continue.</p>

          <div role="radiogroup" aria-label="Portal" className="mt-7 grid grid-cols-3 gap-2 rounded-2xl bg-slate-100 p-1.5">
            {PORTALS.map((p) => (
              <button key={p.id} type="button" role="radio" aria-checked={role === p.id} onClick={() => pick(p.id)}
                className={cx('flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-xs font-bold transition-all', role === p.id ? 'bg-white text-navy-900 shadow-soft' : 'text-slate-500 hover:text-navy-800')}>
                <span className={cx('grid h-8 w-8 place-items-center rounded-lg transition', role === p.id ? 'bg-navy-900 text-teal-300' : 'bg-white/70 text-slate-500')}><p.icon size={16} aria-hidden="true" /></span>
                {p.label}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            {error && (
              <div role="alert" className="flex animate-pop items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-700"><AlertCircle size={18} className="mt-0.5 shrink-0" /><p>{error}</p></div>
            )}
            <div>
              <label className="label" htmlFor="email">Email address</label>
              <div className="relative"><Mail size={17} aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@hospital.com" className="input h-12 pl-11" /></div>
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <div className="relative"><Lock size={17} aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input id="password" type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" className="input h-12 pl-11 pr-12" />
                <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}>{show ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
            </div>
            <Button type="submit" size="lg" loading={loading} className="w-full" disabled={!email || !password} icon={ArrowRight} iconAfter>Sign in to {portal.label} portal</Button>
          </form>

          <div className="mt-6 rounded-2xl border border-dashed border-teal-300 bg-teal-50/60 p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-teal-800"><KeyRound size={15} aria-hidden="true" />Demo credentials</p>
            <div className="mt-2.5 grid gap-1.5 text-xs text-slate-600" role="group" aria-label="Fill in demo credentials">
              {Object.entries(DEMO_ACCOUNTS).map(([r, c]) => (
                <button type="button" key={r} onClick={() => pick(r)} className={cx('flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left transition hover:bg-white', r === role && 'bg-white shadow-soft')}>
                  <span className="font-bold capitalize text-navy-800">{r}</span><span className="font-mono text-[11px]">{c.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
