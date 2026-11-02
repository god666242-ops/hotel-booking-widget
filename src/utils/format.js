export const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Local YYYY-MM-DD (toISOString() is UTC and can be a day off in IST)
export const toLocalISO = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Parse YYYY-MM-DD as a LOCAL date (new Date('YYYY-MM-DD') is UTC)
export const parseISO = (s) => {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

export const addDays = (iso, n) => {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toLocalISO(d);
};

export const nightsBetween = (a, b) =>
  Math.max(1, Math.round((parseISO(b) - parseISO(a)) / 86400000));

export const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export const fmtDate = (iso) =>
  parseISO(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
