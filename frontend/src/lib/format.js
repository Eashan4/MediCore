// Server timestamps are plain local strings ("YYYY-MM-DD HH:mm:ss") - parse as local time.
export const parseDate = (s) => {
  if (!s) return null;
  if (s instanceof Date) return s;
  const str = String(s);
  return new Date(str.length === 10 ? `${str}T00:00:00` : str.replace(' ', 'T'));
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const p2 = (n) => String(n).padStart(2, '0');

export const fmtDate = (s) => { const d = parseDate(s); return d ? `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : '-'; };
export const fmtDateShort = (s) => { const d = parseDate(s); return d ? `${d.getDate()} ${MONTHS[d.getMonth()]}` : '-'; };
export const fmtTime = (s) => {
  const d = parseDate(s); if (!d) return '-';
  const h = d.getHours(); return `${h % 12 || 12}:${p2(d.getMinutes())} ${h >= 12 ? 'PM' : 'AM'}`;
};
export const fmtDateTime = (s) => (s ? `${fmtDate(s)}, ${fmtTime(s)}` : '-');
export const toInputDate = (d = new Date()) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const toInputDateTime = (d = new Date()) => `${toInputDate(d)}T${p2(d.getHours())}:${p2(d.getMinutes())}`;

export const isToday = (s) => { const d = parseDate(s); return !!d && toInputDate(d) === toInputDate(); };

export function timeAgo(s) {
  const d = parseDate(s); if (!d) return '-';
  const sec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 86400 * 7) return `${Math.floor(sec / 86400)}d ago`;
  return fmtDate(s);
}

export function relativeDay(s) {
  const d = parseDate(s); if (!d) return '-';
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const c = new Date(d); c.setHours(0, 0, 0, 0);
  const diff = Math.round((c - t) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return fmtDate(s);
}

export const duration = (mins) => {
  if (mins == null) return '-';
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  return `${Math.floor(mins / 1440)}d ${Math.floor((mins % 1440) / 60)}h`;
};

export const daysSince = (s) => { const d = parseDate(s); return d ? Math.max(1, Math.floor((Date.now() - d.getTime()) / 86400000) + 1) : 1; };
export const hoursSince = (s) => { const d = parseDate(s); return d ? Math.floor((Date.now() - d.getTime()) / 3600000) : 0; };

export const fullName = (p) => (p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : '');
export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';
export const drName = (name) => (name ? (name.startsWith('Dr') ? name : `Dr. ${name}`) : 'Unassigned');
export const surname = (name = '') => name.trim().split(/\s+/).slice(-1)[0];
export const money = (n, digits = 0) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
export const titleCase = (s = '') => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bIcu\b/g, 'ICU');
export const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };
export const pluralize = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
export const copy = async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch { return false; } };
