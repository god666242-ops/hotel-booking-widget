/**
 * Resolves API Base URL safely in production, widget embeds, and local development
 */
function resolveApiBaseUrl() {
  if (import.meta.env?.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL.replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined' && window.location) {
    const isLocal =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1';

    if (isLocal) {
      return 'http://localhost:5000/api/v1/public';
    }

    return `${window.location.origin}/api/v1/public`;
  }

  return 'http://localhost:5000/api/v1/public';
}

const API_BASE_URL = resolveApiBaseUrl();

export async function fetchHotelMeta(slug) {
  const res = await fetch(`${API_BASE_URL}/${slug}/meta`);
  if (!res.ok) throw new Error('Failed to load hotel info');
  return res.json();
}

export async function fetchAvailability({ slug, checkIn, checkOut, adults, children, rooms }) {
  const query = new URLSearchParams({
    checkIn,
    checkOut,
    adults: String(adults),
    children: String(children),
    rooms: String(rooms),
  });
  const res = await fetch(`${API_BASE_URL}/${slug}/availability?${query}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to check availability');
  }
  return res.json();
}

/**
 * Validates a promo code before checkout hold
 */
export async function validatePromoCode({ slug, promoCode, roomTypeId, subtotal, nights }) {
  const res = await fetch(`${API_BASE_URL}/${slug}/validate-promo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ promoCode, roomTypeId, subtotal, nights }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Invalid promo code');
  }
  return data;
}

export async function createBookingHold({ slug, payload }) {
  const res = await fetch(`${API_BASE_URL}/${slug}/hold`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Unable to hold room');
  }
  return data;
}

/**
 * Releases a booking hold immediately upon checkout modal close or cancellation
 */
export async function releaseBookingHold({ slug, bookingId, bookingCode }) {
  const res = await fetch(`${API_BASE_URL}/${slug}/release-hold`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookingId, bookingCode }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || 'Failed to release room hold');
  }
  return data;
}