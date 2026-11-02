import { describe, it, expect } from 'vitest';
import {
  validateName, validateEmail, validatePhone, validateTerms, validateStay, cleanPhoneDigits,
} from './validators.js';

describe('validateName', () => {
  it('accepts normal and unicode names, collapses spaces', () => {
    expect(validateName('  Rahul   Sharma ')).toMatchObject({ ok: true, value: 'Rahul Sharma' });
    expect(validateName('José O’Neil-Smith').ok).toBe(true);
    expect(validateName('प्रिया शर्मा').ok).toBe(true);
  });
  it('rejects empty, short, numeric and symbol input', () => {
    expect(validateName('').ok).toBe(false);
    expect(validateName('A').ok).toBe(false);
    expect(validateName('R2D2').ok).toBe(false);
    expect(validateName('<script>').ok).toBe(false);
    expect(validateName('a'.repeat(81)).ok).toBe(false);
  });
});

describe('validateEmail', () => {
  it('accepts valid emails and lowercases', () => {
    expect(validateEmail(' Rahul.S+trip@Example.co.in ')).toMatchObject({ ok: true, value: 'rahul.s+trip@example.co.in' });
  });
  it('rejects malformed emails', () => {
    for (const bad of ['', 'rahul', 'rahul@', '@x.com', 'a@b', 'a..b@x.com', '.a@x.com', 'a b@x.com', 'a@x.c'])
      expect(validateEmail(bad).ok, bad).toBe(false);
  });
  it('suggests a fix for common domain typos without blocking', () => {
    expect(validateEmail('a@gmial.com')).toMatchObject({ ok: true, suggestion: 'a@gmail.com' });
  });
});

describe('validatePhone (India, +91)', () => {
  it('accepts Indian mobiles in common formats', () => {
    expect(validatePhone('98765 43210')).toMatchObject({ ok: true, value: '9876543210', e164: '+919876543210' });
    expect(validatePhone('+91 98765-43210').value).toBe('9876543210');
    expect(validatePhone('09876543210').value).toBe('9876543210');
  });
  it('rejects bad Indian numbers', () => {
    expect(validatePhone('12345').ok).toBe(false);
    expect(validatePhone('5876543210').ok).toBe(false); // must start 6-9
    expect(validatePhone('9999999999').ok).toBe(false); // repeated digit
    expect(validatePhone('987654321012').ok).toBe(false);
    expect(validatePhone('').ok).toBe(false);
  });
  it('cleanPhoneDigits strips formatting', () => {
    expect(cleanPhoneDigits('(987) 654-3210')).toBe('9876543210');
  });
});

describe('terms / stay', () => {
  it('requires terms', () => {
    expect(validateTerms(false).ok).toBe(false);
    expect(validateTerms(true).ok).toBe(true);
  });
  it('rejects stale or invalid stays', () => {
    const base = { checkIn: '2026-11-01', checkOut: '2026-11-03', adults: 2, children: 0, rooms: 1 };
    expect(validateStay(base, '2026-10-23')).toBe('');
    expect(validateStay(base, '2026-11-02')).toMatch(/past/);
    expect(validateStay({ ...base, checkOut: '2026-11-01' }, '2026-10-23')).toMatch(/after/);
    expect(validateStay({ ...base, adults: 0 }, '2026-10-23')).toMatch(/adult/);
  });
});