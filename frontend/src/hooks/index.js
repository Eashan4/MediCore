import { useCallback, useEffect, useRef, useState } from 'react';

/** Data fetching with loading/error state, manual reload and optional polling. */
export function useFetch(fetcher, deps = [], { interval = 0, enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const seq = useRef(0);

  const run = useCallback(async (silent = false) => {
    const mine = ++seq.current;
    if (!silent) setLoading(true);
    try {
      const d = await fetcherRef.current();
      if (mine === seq.current) { setData(d); setError(null); setUpdatedAt(new Date()); }
    } catch (e) {
      if (mine === seq.current && e.name !== 'AbortError') setError(e);
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => { if (enabled) run(false); /* eslint-disable-next-line */ }, [...deps, enabled]);
  useEffect(() => {
    if (!interval || !enabled) return undefined;
    const t = setInterval(() => { if (!document.hidden) run(true); }, interval);
    return () => clearInterval(t);
  }, [interval, enabled, run]);

  return { data, setData, loading, error, reload: () => run(false), refresh: () => run(true), updatedAt };
}

export function useDebounce(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

/** Animated number that eases from 0 (or previous value) to target. */
export function useCountUp(target, duration = 900) {
  const [val, setVal] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const to = Number(target) || 0;
    const start = performance.now();
    const f = from.current;
    let raf;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(f + (to - f) * eased);
      if (p < 1) raf = requestAnimationFrame(tick); else from.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

export function useClickOutside(ref, handler, active = true) {
  useEffect(() => {
    if (!active) return undefined;
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) handler(e); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [ref, handler, active]);
}

const escStack = [];
/** Escape closes only the topmost layer (a menu inside a modal closes before the modal does). */
export function useEscape(handler, active = true) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!active) return undefined;
    const entry = {};
    escStack.push(entry);
    const fn = (e) => { if (e.key === 'Escape' && escStack[escStack.length - 1] === entry) ref.current(e); };
    document.addEventListener('keydown', fn);
    return () => { document.removeEventListener('keydown', fn); const i = escStack.indexOf(entry); if (i > -1) escStack.splice(i, 1); };
  }, [active]);
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Keeps Tab inside `ref` while active, focuses the first field on open and restores focus on close. */
export function useFocusTrap(ref, active = true) {
  useEffect(() => {
    if (!active || !ref.current) return undefined;
    const root = ref.current;
    const prev = document.activeElement;
    const items = () => [...root.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
    // prefer a form field over the close button so people can start typing straight away
    const first = root.querySelector('input:not([disabled]),select:not([disabled]),textarea:not([disabled])') || items()[0] || root;
    first.focus({ preventScroll: true });
    const onKey = (e) => {
      if (e.key !== 'Tab') return;
      const list = items();
      if (!list.length) { e.preventDefault(); root.focus(); return; }
      const a = list[0]; const z = list[list.length - 1];
      if (e.shiftKey && (document.activeElement === a || document.activeElement === root)) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    root.addEventListener('keydown', onKey);
    return () => { root.removeEventListener('keydown', onKey); if (prev && prev.focus && document.contains(prev)) prev.focus({ preventScroll: true }); };
  }, [ref, active]);
}

/** Ticks every `ms` so relative times ("3m ago") stay fresh. */
export function useTick(ms = 30000) {
  const [, set] = useState(0);
  useEffect(() => { const t = setInterval(() => set((n) => n + 1), ms); return () => clearInterval(t); }, [ms]);
}

/** Simple form state helper with per-field server errors. */
export function useForm(initial) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const set = useCallback((k, v) => { setValues((s) => ({ ...s, [k]: v })); setErrors((e) => (e[k] || e[`${k}_id`] ? { ...e, [k]: undefined, [`${k}_id`]: undefined } : e)); }, []);
  const bind = (k) => ({ value: values[k] ?? '', onChange: (e) => set(k, e?.target ? e.target.value : e) });
  return { values, setValues, errors, setErrors, set, bind };
}
