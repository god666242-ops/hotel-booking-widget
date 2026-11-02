/**
 * Pure validation helpers for the checkout form.
 * No DOM access here, so everything is unit-testable.
 */

export const LIMITS = Object.freeze({
  nameMin: 2,
  nameMax: 80,
  emailMax: 254,
});

const COUNTRY_CODE = '+91';
const PHONE_HINT = '10-digit mobile starting with 6-9';

const COMMON_DOMAIN_TYPOS = {
  'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.con': 'gmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmail.con': 'hotmail.com',
  'yaho.com': 'yahoo.com',
  'yahoo.con': 'yahoo.com',
  'yahoo.co': 'yahoo.com',
  'outlok.com': 'outlook.com',
  'outlook.con': 'outlook.com',
};

/** Collapse whitespace and trim. */
export const normalizeSpaces = (s = '') => String(s).replace(/\s+/g, ' ').trim();

export function validateName(raw) {
  const value = normalizeSpaces(raw);
  if (!value) return { ok: false, value, error: 'Please enter the guest’s full name.' };
  if (value.length < LIMITS.nameMin) return { ok: false, value, error: 'Name looks too short.' };
  if (value.length > LIMITS.nameMax) return { ok: false, value, error: `Name must be ${LIMITS.nameMax} characters or fewer.` };
  // Unicode letters, combining marks, spaces, and . ' - only
  if (!/^[\p{L}\p{M}][\p{L}\p{M}\s.'’-]*$/u.test(value)) {
    return { ok: false, value, error: 'Use letters only (spaces, . - and ’ are fine).' };
  }
  if (!/\p{L}.*\p{L}/u.test(value)) return { ok: false, value, error: 'Name looks too short.' };
  return { ok: true, value };
}

export function validateEmail(raw) {
  const value = String(raw || '').trim().toLowerCase();
  if (!value) return { ok: false, value, error: 'Please enter your email address.' };
  if (value.length > LIMITS.emailMax) return { ok: false, value, error: 'Email address is too long.' };
  // Pragmatic RFC-5322 subset: no consecutive dots, valid label chars, TLD >= 2
  const re = /^(?!.*\.\.)[a-z0-9._%+-]+@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
  const local = value.split('@')[0] || '';
  if (!re.test(value) || local.startsWith('.') || local.endsWith('.') || local.length > 64) {
    return { ok: false, value, error: 'Enter a valid email, e.g. name@example.com.' };
  }
  const domain = value.split('@')[1];
  const fix = COMMON_DOMAIN_TYPOS[domain];
  return fix
    ? { ok: true, value, suggestion: `${local}@${fix}` }
    : { ok: true, value };
}

/**
 * Keeps digits only and drops a pasted +91 / 0091 / 91 prefix or a leading
 * trunk 0, so "+91 98765-43210" and "09876543210" both become "9876543210".
 */
export function cleanPhoneDigits(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('0091')) d = d.slice(4);
  else if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d;
}

export function validatePhone(raw) {
  const value = cleanPhoneDigits(raw);
  if (!value) return { ok: false, value, error: 'Please enter a mobile number.' };
  if (value.length < 10) return { ok: false, value, error: `Number is too short — ${PHONE_HINT}.` };
  if (value.length > 10) return { ok: false, value, error: `Number is too long — ${PHONE_HINT}.` };
  if (!/^[6-9]\d{9}$/.test(value)) return { ok: false, value, error: `Enter a valid number — ${PHONE_HINT}.` };
  if (/^(\d)\1+$/.test(value)) return { ok: false, value, error: 'That number doesn’t look real.' };
  return { ok: true, value, e164: `${COUNTRY_CODE}${value}` };
}

export function validateTerms(checked) {
  return checked
    ? { ok: true, value: true }
    : { ok: false, value: false, error: 'Please accept the booking terms to continue.' };
}

/**
 * Validates stay inputs right before creating a hold: a stale tab left open
 * overnight must not be able to book yesterday.
 */
export function validateStay({ checkIn, checkOut, adults, children, rooms }, todayISO) {
  if (!checkIn || !checkOut) return 'Please choose your stay dates.';
  if (checkIn < todayISO) return 'Check-in date is in the past. Please pick new dates.';
  if (checkOut <= checkIn) return 'Check-out must be after check-in.';
  if (!(adults >= 1)) return 'At least one adult is required.';
  if (children < 0 || rooms < 1) return 'Please review your guest and room selection.';
  return '';
}