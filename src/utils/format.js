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

/**
 * Formats "14:00" or "02:00 PM" as "2:00 PM" (the admin may save either form).
 * Anything unparseable is returned as typed; empty input returns `fallback`.
 */
export const fmtClock = (value, fallback = '') => {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;
  const m = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!m) return raw;

  let h = Number(m[1]);
  const min = Number(m[2]);
  const meridiem = m[3] ? m[3].toUpperCase() : null;
  if (meridiem === 'PM' && h < 12) h += 12;
  if (meridiem === 'AM' && h === 12) h = 0;
  if (h > 23 || min > 59) return raw;

  return `${h % 12 || 12}:${m[2]} ${h >= 12 ? 'PM' : 'AM'}`;
};

/**
 * Label for one cancellation tier. `tiers` must be sorted by daysBeforeCheckIn, highest first.
 * A tier applies when the guest cancels at least `daysBeforeCheckIn` days ahead (same rule as the server),
 * so the 0-day tier means "less than the next tier's days", not a fixed "48 hours".
 * Returns trusted HTML (only numbers are interpolated).
 */
export const tierLabel = (tiers, index) => {
  const days = Math.max(0, Number(tiers[index].daysBeforeCheckIn) || 0);
  const unit = (n) => (n === 1 ? 'day' : 'days');

  if (days > 0) {
    return `<strong>${days} ${days === 1 ? 'day' : 'days'}</strong> or more before check-in`;
  }

  const higher = index > 0 ? Math.max(0, Number(tiers[index - 1].daysBeforeCheckIn) || 0) : 0;
  if (higher > 0) {
    return `Less than <strong>${higher} ${unit(higher)}</strong> before check-in`;
  }
  return 'Any time before check-in';
};