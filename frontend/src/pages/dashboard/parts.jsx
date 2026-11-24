import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { LivePill, Meta, Skeleton, cx } from '../../components/ui';

export const AXIS = { axisLine: false, tickLine: false, tick: { fill: '#64748b', fontSize: 12, fontWeight: 600 } };

/** Big gradient hero with a photo on the right. */
export function Hero({ image, eyebrow, title, subtitle, actions, aside, updatedAt }) {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 5000); return () => clearInterval(t); }, []);
  const secs = updatedAt ? Math.max(0, Math.round((Date.now() - updatedAt.getTime()) / 1000)) : null;
  return (
    <section className="dark-surface relative mb-6 overflow-hidden rounded-3xl bg-navy-950 text-white shadow-soft">
      <img src={image} alt="" className="absolute inset-y-0 right-0 h-full w-full object-cover opacity-60 lg:w-[62%] lg:opacity-100"
        style={{ maskImage: 'linear-gradient(to left, black 25%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to left, black 25%, transparent 100%)' }}
        onError={(e) => { e.currentTarget.style.display = 'none'; }} />
      <div className="absolute inset-0 bg-gradient-to-r from-navy-950 via-navy-950/90 to-navy-950/30" />
      <div className="relative flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-end lg:justify-between lg:p-10">
        <div className="max-w-xl">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <LivePill label="Live" className="bg-emerald-400/15 text-emerald-300 ring-emerald-400/30" />
            {secs != null && <span className="flex items-center gap-1.5 text-xs font-medium text-slate-300"><RefreshCw size={12} aria-hidden="true" />Updated {secs < 5 ? 'just now' : `${secs}s ago`}</span>}
            {eyebrow && <span className="text-sm font-semibold text-teal-300">{Array.isArray(eyebrow) ? <Meta items={eyebrow} wrap /> : eyebrow}</span>}
          </div>
          <h1 className="font-display text-4xl font-semibold leading-[1.1] sm:text-5xl">{title}</h1>
          {subtitle && <p className="mt-3 max-w-lg text-sm leading-relaxed text-slate-300 sm:text-base">{subtitle}</p>}
          {actions && <div className="mt-6 flex flex-wrap gap-3">{actions}</div>}
        </div>
        {aside && <div className="flex flex-wrap gap-3">{aside}</div>}
      </div>
    </section>
  );
}

export const GlassStat = ({ icon: Icon, label, value, sub, tone = 'teal', to }) => {
  const body = (
    <div className="glass flex min-w-[150px] items-center gap-3.5 rounded-2xl px-4 py-3.5 transition hover:bg-white/15">
      <span className={cx('grid h-11 w-11 place-items-center rounded-xl', tone === 'rose' ? 'bg-rose-500/25 text-rose-200' : tone === 'amber' ? 'bg-amber-400/25 text-amber-200' : 'bg-teal-400/25 text-teal-200')}><Icon size={20} aria-hidden="true" /></span>
      <div><p className="text-xs font-semibold text-slate-300">{label}</p><p className="num font-display text-3xl font-semibold leading-tight">{value}</p>{sub && <p className="text-xs text-slate-300">{sub}</p>}</div>
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
};

export function DashSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-64 w-full !rounded-3xl" />
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-40 !rounded-2xl" />)}</div>
      <div className="grid gap-5 lg:grid-cols-3"><Skeleton className="h-80 !rounded-2xl lg:col-span-2" /><Skeleton className="h-80 !rounded-2xl" /></div>
    </div>
  );
}

export const Panel = ({ children, className, delay = 0 }) => (
  <div className={cx('card min-w-0 animate-fade-up p-5 sm:p-6', className)} style={{ animationDelay: `${delay}ms` }}>{children}</div>
);

export const Legend = ({ items }) => (
  <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
    {items.map((i) => (
      <span key={i.label} className="flex items-center gap-2 text-xs font-semibold text-slate-600">
        <span aria-hidden="true" className={i.value != null ? 'h-8 w-1 rounded-full' : 'h-2.5 w-2.5 rounded-sm'} style={{ background: i.color }} />
        <span>{i.value != null && <span className="num block font-display text-2xl font-semibold leading-none text-navy-900">{i.value}</span>}{i.label}</span>
      </span>
    ))}
  </div>
);
