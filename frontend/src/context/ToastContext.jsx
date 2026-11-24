import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

const ToastCtx = createContext(null);
export const useToast = () => useContext(ToastCtx);

const STYLES = {
  success: { icon: CheckCircle2, bar: 'bg-emerald-500', iconCls: 'text-emerald-600 bg-emerald-50' },
  error: { icon: XCircle, bar: 'bg-rose-500', iconCls: 'text-rose-600 bg-rose-50' },
  warning: { icon: AlertTriangle, bar: 'bg-amber-500', iconCls: 'text-amber-600 bg-amber-50' },
  info: { icon: Info, bar: 'bg-blue-500', iconCls: 'text-blue-600 bg-blue-50' },
};

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => setItems((l) => l.filter((t) => t.id !== id)), []);
  const push = useCallback((type, title, message, ms = 4200) => {
    const id = ++idRef.current;
    setItems((l) => [...l.slice(-3), { id, type, title, message }]);
    if (ms) setTimeout(() => dismiss(id), ms);
  }, [dismiss]);

  const api = useMemo(() => ({
    success: (t, m) => push('success', t, m),
    error: (t, m) => push('error', t, m, 6000),
    warning: (t, m) => push('warning', t, m, 6000),
    info: (t, m) => push('info', t, m),
  }), [push]);

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div role="region" aria-label="Notifications" className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-3">
        {items.map((t) => {
          const s = STYLES[t.type];
          const Icon = s.icon;
          return (
            <div key={t.id} role={t.type === 'error' || t.type === 'warning' ? 'alert' : 'status'} className="pointer-events-auto relative flex animate-toast-in items-start gap-3 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 pl-5 shadow-lift">
              <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1.5 ${s.bar}`} />
              <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl ${s.iconCls}`}><Icon size={18} aria-hidden="true" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-navy-900">{t.title}</p>
                {t.message && <p className="mt-0.5 text-sm leading-snug text-slate-500">{t.message}</p>}
              </div>
              <button onClick={() => dismiss(t.id)} className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600" aria-label="Dismiss notification"><X size={16} aria-hidden="true" /></button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}
