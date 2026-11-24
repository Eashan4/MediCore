import { Fragment, cloneElement, createContext, forwardRef, isValidElement, useContext, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowUpRight, ChevronDown, ChevronLeft, ChevronRight, Inbox, Loader2, Search, X } from 'lucide-react';
import { useClickOutside, useCountUp, useEscape, useFocusTrap } from '../../hooks';
import { initials } from '../../lib/format';

export const cx = (...a) => a.filter(Boolean).join(' ');

/* ------------------------------------------------------------------ Button */
const VARIANTS = {
  primary: 'bg-teal-600 text-white shadow-soft hover:bg-teal-700',
  navy: 'bg-navy-900 text-white shadow-soft hover:bg-navy-800',
  soft: 'bg-teal-50 text-teal-800 hover:bg-teal-100',
  outline: 'border border-slate-200 bg-white text-navy-800 hover:border-teal-400 hover:text-teal-700',
  ghost: 'text-slate-600 hover:bg-slate-100',
  danger: 'bg-rose-600 text-white shadow-soft hover:bg-rose-700',
  dangerSoft: 'bg-rose-50 text-rose-700 hover:bg-rose-100',
  white: 'bg-white text-navy-900 shadow-soft hover:bg-slate-50',
  glass: 'border border-white/30 bg-white/10 text-white backdrop-blur hover:bg-white/20',
};
const SIZES = { xs: 'h-8 px-2.5 text-xs gap-1.5 rounded-lg', sm: 'h-9 px-3.5 text-sm gap-1.5 rounded-xl', md: 'h-11 px-5 text-sm gap-2 rounded-xl', lg: 'h-12 px-6 text-base gap-2 rounded-2xl' };

export const Button = forwardRef(function Button({ variant = 'primary', size = 'md', icon: Icon, iconAfter, loading, className, children, disabled, ...p }, ref) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cx('inline-flex shrink-0 items-center justify-center whitespace-nowrap font-semibold transition-all duration-200 active:scale-[.97] disabled:pointer-events-none disabled:opacity-50', VARIANTS[variant], SIZES[size], className)}
      {...p}
    >
      {loading ? <Loader2 size={16} aria-hidden="true" className="animate-spin" /> : Icon && !iconAfter ? <Icon size={size === 'xs' ? 14 : 16} aria-hidden="true" /> : null}
      {children}
      {Icon && iconAfter && !loading && <Icon size={size === 'lg' ? 18 : 16} aria-hidden="true" />}
    </button>
  );
});

export const IconButton = ({ icon: Icon, label, className, size = 36, ...p }) => (
  <button type="button" aria-label={label} title={label} style={{ width: size, height: size }}
    className={cx('grid shrink-0 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-navy-800', className)} {...p}>
    <Icon size={18} aria-hidden="true" />
  </button>
);

/* ------------------------------------------------------------------- Badge */
const TONES = {
  teal: 'bg-teal-50 text-teal-700 ring-teal-600/15', navy: 'bg-navy-50 text-navy-700 ring-navy-600/15', green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/25', red: 'bg-rose-50 text-rose-700 ring-rose-600/15', blue: 'bg-blue-50 text-blue-700 ring-blue-600/15',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/15', pink: 'bg-pink-50 text-pink-700 ring-pink-600/15', slate: 'bg-slate-100 text-slate-600 ring-slate-500/10',
};
export const Badge = ({ tone = 'slate', dot, className, children, pulse }) => (
  <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset', TONES[tone], className)}>
    {dot && <span className="relative flex h-1.5 w-1.5"><span className={cx('absolute inline-flex h-full w-full rounded-full bg-current opacity-60', pulse && 'animate-ping2')} /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" /></span>}
    {children}
  </span>
);

/* ------------------------------------------------------------------ Avatar */
const GRADS = ['from-teal-400 to-navy-600', 'from-blue-400 to-navy-700', 'from-violet-400 to-navy-600', 'from-emerald-400 to-teal-700', 'from-sky-400 to-blue-700', 'from-rose-400 to-violet-600', 'from-amber-400 to-rose-500'];
const hash = (s = '') => [...s].reduce((a, c) => a + c.charCodeAt(0), 0);
export function Avatar({ src, name = '', size = 40, className, ring, status, square }) {
  const [err, setErr] = useState(false);
  useEffect(() => setErr(false), [src]);
  const radius = square ? 'rounded-2xl' : 'rounded-full';
  return (
    <span className={cx('relative inline-block shrink-0', className)} style={{ width: size, height: size }}>
      {src && !err ? (
        <img src={src} alt={name} loading="lazy" onError={() => setErr(true)} className={cx('h-full w-full object-cover', radius, ring && 'ring-2 ring-white')} />
      ) : (
        <span className={cx('grid h-full w-full place-items-center bg-gradient-to-br font-bold text-white', radius, GRADS[hash(name) % GRADS.length], ring && 'ring-2 ring-white')} style={{ fontSize: size * 0.36 }}>
          {initials(name)}
        </span>
      )}
      {status && <span className={cx('absolute bottom-0 right-0 h-3 w-3 rounded-full ring-2 ring-white', status === 'online' ? 'bg-emerald-500' : status === 'busy' ? 'bg-amber-500' : 'bg-slate-300')} />}
    </span>
  );
}

/* A photo with graceful fallback to a gradient */
export function Photo({ src, className, children, overlay = 'from-navy-950/80 via-navy-950/30 to-transparent' }) {
  const [err, setErr] = useState(false);
  return (
    <div className={cx('relative overflow-hidden bg-gradient-to-br from-navy-800 to-teal-700', className)}>
      {src && !err && <img src={src} alt="" loading="lazy" onError={() => setErr(true)} className="absolute inset-0 h-full w-full object-cover" />}
      {overlay && <div className={cx('absolute inset-0 bg-gradient-to-t', overlay)} />}
      <div className="relative h-full">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------- Modal */
export function Modal({ open, onClose, title, subtitle, icon: Icon, size = 'md', children, footer, bodyClass, label }) {
  useEscape(onClose, open);
  const panel = useRef(null); const titleId = useId();
  useFocusTrap(panel, open);
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);
  if (!open) return null;
  const w = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }[size];
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 animate-fade-in bg-navy-950/55 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={title ? titleId : undefined} aria-label={title ? undefined : label || 'Dialog'} tabIndex={-1}
        className={cx('relative flex outline-none max-h-[94vh] w-full animate-pop flex-col overflow-hidden rounded-t-3xl bg-white shadow-lift sm:rounded-3xl', w)}>
        {(title || Icon) && (
          <div className="flex items-start gap-3 border-b border-slate-100 px-6 py-5">
            {Icon && <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-navy-900 text-teal-300"><Icon size={20} /></span>}
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="font-display text-xl font-semibold text-navy-900">{title}</h2>
              {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
            </div>
            <IconButton icon={X} label="Close" onClick={onClose} />
          </div>
        )}
        <div className={cx('min-h-0 flex-1 overflow-y-auto px-6 py-5', bodyClass)}>{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-4">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

export function Drawer({ open, onClose, children, width = 'max-w-md', label = 'Details' }) {
  useEscape(onClose, open);
  const panel = useRef(null);
  useFocusTrap(panel, open);
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 animate-fade-in bg-navy-950/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div ref={panel} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} className={cx('relative flex h-full w-full animate-slide-left flex-col bg-white shadow-lift outline-none', width)}>{children}</div>
    </div>,
    document.body
  );
}

export function ConfirmModal({ open, onClose, onConfirm, title, message, confirmText = 'Confirm', tone = 'danger', loading }) {
  return (
    <Modal open={open} onClose={onClose} size="sm" label={title}
      footer={<><Button variant="outline" size="sm" onClick={onClose}>Cancel</Button><Button variant={tone === 'danger' ? 'danger' : 'primary'} size="sm" loading={loading} onClick={onConfirm}>{confirmText}</Button></>}>
      <div className="flex gap-4">
        <span aria-hidden="true" className={cx('grid h-11 w-11 shrink-0 place-items-center rounded-2xl', tone === 'danger' ? 'bg-rose-50 text-rose-600' : 'bg-teal-50 text-teal-600')}><AlertTriangle size={22} /></span>
        <div><h3 className="text-base font-bold text-navy-900">{title}</h3><p className="mt-1 text-sm leading-relaxed text-slate-500">{message}</p></div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------- Forms */
// Field hands its id / error id to the control inside it, so labels and error text are announced with the input.
const FieldCtx = createContext(null);
const useFieldProps = (error) => {
  const f = useContext(FieldCtx);
  return f ? { id: f.id, 'aria-invalid': error || f.error ? true : undefined, 'aria-describedby': f.describedBy, 'aria-required': f.required || undefined } : {};
};
export function Field({ label, error, hint, required, children, className }) {
  const id = useId();
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <FieldCtx.Provider value={{ id, error: !!error, describedBy, required }}>
      <div className={className}>
        {label && <label htmlFor={id} className="label">{label}{required && <span aria-hidden="true" className="ml-0.5 text-rose-600">*</span>}</label>}
        {children}
        {error ? <p id={`${id}-err`} role="alert" className="mt-1.5 text-xs font-medium text-rose-700">{error}</p> : hint ? <p id={`${id}-hint`} className="mt-1.5 text-xs text-slate-500">{hint}</p> : null}
      </div>
    </FieldCtx.Provider>
  );
}
export const Input = forwardRef(function Input({ error, icon: Icon, className, ...p }, ref) {
  const a = useFieldProps(error);
  return (
    <div className="relative">
      {Icon && <Icon size={16} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />}
      <input ref={ref} className={cx('input', Icon && 'pl-10', error && 'input-error', className)} {...a} {...p} />
    </div>
  );
});
export const Select = forwardRef(function Select({ error, className, children, ...p }, ref) {
  const a = useFieldProps(error);
  return (
    <div className="relative">
      <select ref={ref} className={cx('input appearance-none pr-9', error && 'input-error', className)} {...a} {...p}>{children}</select>
      <ChevronDown size={16} aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
    </div>
  );
});
export const Textarea = forwardRef(function Textarea({ error, className, ...p }, ref) {
  const a = useFieldProps(error);
  return <textarea ref={ref} rows={3} className={cx('input resize-none', error && 'input-error', className)} {...a} {...p} />;
});

export function SearchInput({ value, onChange, placeholder = 'Search…', className, label }) {
  return (
    <div className={cx('relative', className)} role="search">
      <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label || placeholder} className="input pl-10 pr-9 [&::-webkit-search-cancel-button]:hidden" />
      {value && <button type="button" onClick={() => onChange('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700" aria-label="Clear search"><X size={14} aria-hidden="true" /></button>}
    </div>
  );
}

/* -------------------------------------------------------------------- Tabs */
export function Tabs({ tabs, value, onChange, className, variant = 'pill' }) {
  if (variant === 'line') {
    return (
      <div role="tablist" className={cx('flex gap-1 overflow-x-auto border-b border-slate-200', className)}>
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
            className={cx('relative flex items-center gap-2 whitespace-nowrap px-4 py-3 text-sm font-semibold transition', value === t.id ? 'text-teal-700' : 'text-slate-500 hover:text-navy-800')}>
            {t.icon && <t.icon size={16} aria-hidden="true" />}{t.label}
            {t.count != null && <span className={cx('rounded-full px-2 py-0.5 text-[11px]', value === t.id ? 'bg-teal-100 text-teal-800' : 'bg-slate-100 text-slate-600')}>{t.count}</span>}
            {value === t.id && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-teal-500" />}
          </button>
        ))}
      </div>
    );
  }
  return (
    <div role="tablist" className={cx('inline-flex max-w-full gap-1 overflow-x-auto rounded-2xl bg-slate-100 p-1', className)}>
      {tabs.map((t) => (
        <button key={t.id} type="button" role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className={cx('flex items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold transition-all', value === t.id ? 'bg-white text-navy-900 shadow-soft' : 'text-slate-500 hover:text-navy-800')}>
          {t.icon && <t.icon size={15} aria-hidden="true" />}{t.label}
          {t.count != null && <span className={cx('rounded-full px-1.5 py-0.5 text-[11px]', value === t.id ? 'bg-teal-100 text-teal-800' : 'bg-white/70 text-slate-600')}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export const FilterChip = ({ active, onClick, children, count, dot }) => (
  <button type="button" onClick={onClick} aria-pressed={!!active}
    className={cx('inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-all',
      active ? 'border-navy-900 bg-navy-900 text-white shadow-soft' : 'border-slate-200 bg-white text-slate-600 hover:border-teal-400 hover:text-teal-700')}>
    {dot && <span aria-hidden="true" className={cx('h-2 w-2 rounded-full', dot)} />}{children}
    {count != null && <span className={cx('rounded-full px-1.5 text-[11px]', active ? 'bg-white/20' : 'bg-slate-100 text-slate-500')}>{count}</span>}
  </button>
);

/* -------------------------------------------------------------------- Menu */
export function Menu({ trigger, children, align = 'right', width = 'w-56' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null); const list = useRef(null);
  useClickOutside(ref, () => setOpen(false), open);
  useEscape(() => { setOpen(false); ref.current?.querySelector('button')?.focus(); }, open);
  useEffect(() => { if (open) list.current?.querySelector('button')?.focus(); }, [open]);
  const onKey = (e) => {
    const items = [...list.current.querySelectorAll('button:not([disabled])')]; const i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus(); }
    else if (e.key === 'Home') { e.preventDefault(); items[0]?.focus(); }
    else if (e.key === 'End') { e.preventDefault(); items[items.length - 1]?.focus(); }
    else if (e.key === 'Tab') setOpen(false);
  };
  const t = trigger(open);
  return (
    <div ref={ref} className="relative">
      <div onClick={() => setOpen((o) => !o)}>{isValidElement(t) ? cloneElement(t, { 'aria-haspopup': 'menu', 'aria-expanded': open }) : t}</div>
      {open && (
        <div ref={list} role="menu" onKeyDown={onKey} onClick={() => setOpen(false)} className={cx('absolute z-40 mt-2 animate-pop rounded-2xl border border-slate-200 bg-white p-1.5 shadow-lift', width, align === 'right' ? 'right-0 origin-top-right' : 'left-0 origin-top-left')}>
          {children}
        </div>
      )}
    </div>
  );
}
export const MenuItem = ({ icon: Icon, danger, children, ...p }) => (
  <button type="button" role="menuitem" className={cx('flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium transition', danger ? 'text-rose-600 hover:bg-rose-50' : 'text-slate-700 hover:bg-slate-50')} {...p}>
    {Icon && <Icon size={16} aria-hidden="true" className={danger ? '' : 'text-slate-500'} />}{children}
  </button>
);

/* ------------------------------------------------------------ Misc visuals */
export const Skeleton = ({ className }) => <div aria-hidden="true" className={cx('skeleton', className)} />;

export function EmptyState({ icon: Icon = Inbox, title, text, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-teal-50 text-teal-700 ring-1 ring-teal-100"><Icon size={26} /></span>
      <h3 className="font-display text-lg font-semibold text-navy-900">{title}</h3>
      {text && <p className="mt-1 max-w-sm text-sm text-slate-500">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div role="alert" className="card flex flex-col items-center px-6 py-12 text-center">
      <span className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-rose-500"><AlertTriangle size={26} /></span>
      <h3 className="font-display text-lg font-semibold text-navy-900">We couldn't load this</h3>
      <p className="mt-1 max-w-md text-sm text-slate-500">{error?.message || 'Something went wrong.'}</p>
      {onRetry && <Button variant="outline" size="sm" className="mt-5" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

export function Pagination({ page, pages, total, limit, onChange }) {
  if (!pages || pages <= 1) return total != null ? <p className="px-1 text-xs text-slate-400">{total} result{total === 1 ? '' : 's'}</p> : null;
  const from = (page - 1) * limit + 1; const to = Math.min(total, page * limit);
  const nums = []; for (let i = 1; i <= pages; i++) if (i === 1 || i === pages || Math.abs(i - page) <= 1) nums.push(i); else if (nums[nums.length - 1] !== '…') nums.push('…');
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-slate-500" aria-live="polite">Showing <b className="text-navy-800">{from}-{to}</b> of <b className="text-navy-800">{total}</b></p>
      <div className="flex items-center gap-1">
        <IconButton icon={ChevronLeft} label="Previous" disabled={page <= 1} onClick={() => onChange(page - 1)} className="disabled:opacity-30" />
        {nums.map((n, i) => n === '…' ? <span key={`e${i}`} aria-hidden="true" className="px-1 text-slate-400">…</span> : (
          <button key={n} type="button" onClick={() => onChange(n)} aria-label={`Page ${n}`} aria-current={n === page ? 'page' : undefined} className={cx('h-9 min-w-9 rounded-xl px-2 text-sm font-semibold transition', n === page ? 'bg-navy-900 text-white shadow-soft' : 'text-slate-600 hover:bg-slate-100')}>{n}</button>
        ))}
        <IconButton icon={ChevronRight} label="Next" disabled={page >= pages} onClick={() => onChange(page + 1)} className="disabled:opacity-30" />
      </div>
    </nav>
  );
}

export function Spark({ data = [], color = '#17aa9e', height = 40, className }) {
  const d = data.length > 1 ? data : [0, 0];
  const max = Math.max(...d, 1); const min = Math.min(...d, 0);
  const w = 100; const h = 40; const range = max - min || 1;
  const pts = d.map((v, i) => [(i / (d.length - 1)) * w, h - 4 - ((v - min) / range) * (h - 10)]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const id = useRef(`sp${Math.random().toString(36).slice(2, 8)}`).current;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true" className={cx('w-full overflow-visible', className)} style={{ height }}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".35" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={`${line} L${w},${h} L0,${h} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.6" fill="#fff" stroke={color} strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function Ring({ value = 0, size = 112, stroke = 11, color = '#17aa9e', track = '#e2ebf6', children, className }) {
  const [v, setV] = useState(0);
  useEffect(() => { const t = setTimeout(() => setV(value), 80); return () => clearTimeout(t); }, [value]);
  const r = (size - stroke) / 2; const c = 2 * Math.PI * r;
  return (
    <div className={cx('relative grid place-items-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true" className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (Math.min(100, v) / 100) * c} style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(.2,.8,.2,1)' }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

export function Count({ value, suffix = '', decimals = 0, className }) {
  const v = useCountUp(value);
  return <span className={className}>{v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</span>;
}

const STAT_TONES = {
  teal: { rule: 'bg-teal-500', chip: 'bg-teal-50 text-teal-700', spark: '#17aa9e' },
  navy: { rule: 'bg-navy-700', chip: 'bg-navy-50 text-navy-700', spark: '#2f4f8a' },
  blue: { rule: 'bg-blue-500', chip: 'bg-blue-50 text-blue-700', spark: '#3b82f6' },
  rose: { rule: 'bg-rose-500', chip: 'bg-rose-50 text-rose-700', spark: '#f43f5e' },
  amber: { rule: 'bg-amber-500', chip: 'bg-amber-50 text-amber-700', spark: '#f59e0b' },
  violet: { rule: 'bg-violet-500', chip: 'bg-violet-50 text-violet-700', spark: '#8b5cf6' },
  emerald: { rule: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700', spark: '#10b981' },
};

/** Inline list of short facts separated by hairline dividers (replaces " · " string hacks). */
export function Meta({ items = [], className, wrap }) {
  const list = items.filter((x) => x != null && x !== false && x !== '');
  return (
    <span className={cx('flex min-w-0 items-center gap-x-2', wrap ? 'flex-wrap gap-y-0.5' : 'overflow-hidden whitespace-nowrap', className)}>
      {list.map((it, i) => (
        <Fragment key={i}>
          {i > 0 && <span aria-hidden="true" className="h-3 w-px shrink-0 bg-current opacity-30" />}
          <span className={cx(!wrap && 'min-w-0 truncate')}>{it}</span>
        </Fragment>
      ))}
    </span>
  );
}

export function StatCard({ icon: Icon, label, value, suffix, sub, spark, tone = 'teal', onClick, delay = 0, children, badge }) {
  const t = STAT_TONES[tone];
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} type={onClick ? 'button' : undefined} style={{ animationDelay: `${delay}ms` }}
      className={cx('card group relative flex animate-fade-up flex-col items-stretch justify-start overflow-hidden p-4 text-left sm:p-5', onClick && 'card-hover cursor-pointer')}>
      <span aria-hidden="true" className={cx('absolute inset-x-0 top-0 h-[3px]', t.rule)} />
      <div className="flex min-h-[36px] items-center justify-between gap-2 sm:gap-3">
        <p className="flex min-w-0 items-center gap-2 text-[13px] font-semibold leading-tight text-slate-600">
          <span className={cx('grid h-7 w-7 shrink-0 place-items-center rounded-lg', t.chip)}><Icon size={15} aria-hidden="true" /></span>
          <span>{label}</span>
        </p>
        {onClick && <ArrowUpRight size={16} aria-hidden="true" className="shrink-0 text-slate-300 transition group-hover:text-teal-700 group-focus-visible:text-teal-700" />}
      </div>
      <p className="num mt-3 font-display text-[32px] font-semibold leading-none text-navy-900 sm:mt-4 sm:text-[40px]">
        {typeof value === 'number' ? <Count value={value} suffix={suffix} /> : value}
      </p>
      {sub && <p className="mt-2.5 text-xs font-medium text-slate-500">{Array.isArray(sub) ? <Meta items={sub} wrap /> : sub}</p>}
      {badge && <div className="mt-3">{badge}</div>}
      {spark && <div className="-mx-1 mt-3"><Spark data={spark} color={t.spark} height={34} /></div>}
      {children}
    </Tag>
  );
}

export function PageHeader({ title, subtitle, actions, icon: Icon, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b border-slate-200 pb-5">
      <div className="flex min-w-0 items-center gap-4">
        {Icon && <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-navy-900 text-teal-300"><Icon size={22} /></span>}
        <div className="min-w-0">
          <h1 className="font-display text-[28px] font-semibold leading-tight text-navy-900 sm:text-[32px]">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
      {children}
    </div>
  );
}

export const SectionTitle = ({ title, subtitle, action, icon: Icon }) => (
  <div className="mb-4 flex items-start justify-between gap-3">
    <div className="flex items-center gap-2.5">
      {Icon && <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-navy-700"><Icon size={16} /></span>}
      <div><h3 className="font-display text-lg font-semibold leading-tight text-navy-900">{title}</h3>{subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}</div>
    </div>
    {action && <div className="shrink-0 whitespace-nowrap">{action}</div>}
  </div>
);

/** Small "see more" link used in panel headers. */
export const ActionLink = ({ to, children }) => (
  <Link to={to} className="inline-flex items-center gap-0.5 text-xs font-bold text-teal-700 hover:underline">{children}<ChevronRight size={14} aria-hidden="true" /></Link>
);

export const LivePill = ({ label = 'Live', className }) => (
  <span className={cx('inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-500/25', className)}>
    <span aria-hidden="true" className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping2 rounded-full bg-emerald-500" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>
    {label}
  </span>
);

export const InfoRow = ({ icon: Icon, label, children }) => (
  <div className="flex items-start gap-3 py-2.5">
    {Icon && <span aria-hidden="true" className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-50 text-slate-500"><Icon size={15} /></span>}
    <div className="min-w-0"><p className="text-xs font-semibold text-slate-500">{label}</p><div className="text-sm font-medium text-navy-800">{children || '-'}</div></div>
  </div>
);

/** Wide tables scroll sideways on tablets and collapse to labelled cards below 640px (give each Td a `label`). */
export const TableShell = ({ children, className, label }) => (
  <div className={cx('card overflow-hidden', className)}><div className="overflow-x-auto" tabIndex={0} role="region" aria-label={label || 'Data table'}><table className="rtable w-full min-w-[640px] text-left text-sm">{children}</table></div></div>
);
export const Th = ({ children, className, ...p }) => <th scope="col" className={cx('whitespace-nowrap bg-slate-50/80 px-4 py-3 text-xs font-semibold text-slate-500', className)} {...p}>{children}</th>;
export const Td = ({ children, className, label, ...p }) => <td data-label={label} className={cx('px-4 py-3.5 align-middle', className)} {...p}>{children}</td>;
