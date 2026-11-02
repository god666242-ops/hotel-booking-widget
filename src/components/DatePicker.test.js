// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderDatePicker } from './DatePicker.js';

describe('Widget DatePicker - Constraint & Auto-Correction Validations', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('automatically advances checkout date if user sets checkIn after checkout', () => {
    let selectedDates = {};

    renderDatePicker(container, {
      checkIn: '2026-11-05',
      checkOut: '2026-11-06',
      onChange: (dates) => {
        selectedDates = dates;
      },
    });

    const checkInInput = container.querySelector('#hbe-checkin');
    const checkOutInput = container.querySelector('#hbe-checkout');

    // User chooses a check-in date past checkout date
    checkInInput.value = '2026-11-10';
    checkInInput.dispatchEvent(new Event('change'));

    // Check-out should automatically advance to 2026-11-11
    expect(checkOutInput.value).toBe('2026-11-11');
    expect(selectedDates.checkIn).toBe('2026-11-10');
    expect(selectedDates.checkOut).toBe('2026-11-11');
  });
});