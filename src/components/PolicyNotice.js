import { esc } from '../utils/format.js';
import { icon } from '../utils/icons.js';

/**
 * Cancellation policy shown in the checkout step, directly above the terms checkbox,
 * so guests see refund rules before they pay.
 *
 * Options:
 *  - checkInTime:  standard check-in time used for the day-based tiers
 *  - payAtHotel:   hotel uses the pay-at-hotel flow (fixed, non-refundable fee)
 *  - cutoffHours:  online cancellation closes this many hours before check-in
 */
export function renderPolicyNotice(
  container,
  cancellationPolicy,
  { checkInTime = '12:00 PM', payAtHotel = false, cutoffHours = null } = {},
) {
  if (!container) return;

  const hours = Number(cutoffHours);
  const cutoffText =
    Number.isFinite(hours) && hours > 0
      ? `Online cancellation closes ${hours} ${hours === 1 ? 'hour' : 'hours'} before check-in.`
      : '';

  if (payAtHotel) {
    container.innerHTML = `
      <div class="hbe-policy-card">
        <div class="hbe-policy-header">${icon('shield', 18)}<span class="hbe-policy-title">Cancellation policy</span></div>
        <ul class="hbe-cancel-list">
          <li class="hbe-cancel-row"><span class="hbe-cancel-label">Booking fee paid online</span><span class="hbe-refund-badge is-none">Non-refundable</span></li>
          <li class="hbe-cancel-row"><span class="hbe-cancel-label">If you cancel in time</span><span class="hbe-refund-badge is-partial">Nothing more to pay</span></li>
          <li class="hbe-cancel-row"><span class="hbe-cancel-label">If the hotel cancels</span><span class="hbe-refund-badge is-full">Fee refunded in full</span></li>
        </ul>
        ${cutoffText ? `<p class="hbe-policy-footnote">${esc(cutoffText)}</p>` : ''}
      </div>`;
    return;
  }

  if (!cancellationPolicy || !cancellationPolicy.enabled || !cancellationPolicy.tiers?.length) {
    container.innerHTML = `
      <div class="hbe-policy-card non-refundable">
        <div class="hbe-policy-header">${icon('lock', 18)}<span class="hbe-policy-title">Non-refundable reservation</span></div>
        <p class="hbe-policy-text">This booking can’t be cancelled or refunded once confirmed.</p>
      </div>`;
    return;
  }

  const tiers = [...cancellationPolicy.tiers].sort((a, b) => b.daysBeforeCheckIn - a.daysBeforeCheckIn);
  const rows = tiers
    .map((t) => {
      const days = Number(t.daysBeforeCheckIn) || 0;
      const pct = Number(t.refundPercent) || 0;
      const cls = pct >= 100 ? 'is-full' : pct > 0 ? 'is-partial' : 'is-none';
      const label = days === 0
        ? 'Within 48 hours of check-in'
        : `Up to <strong>${days} ${days === 1 ? 'day' : 'days'}</strong> before check-in`;
      return `<li class="hbe-cancel-row"><span class="hbe-cancel-label">${label}</span><span class="hbe-refund-badge ${cls}">${pct}% refund</span></li>`;
    })
    .join('');

  container.innerHTML = `
    <div class="hbe-policy-card">
      <div class="hbe-policy-header">${icon('shield', 18)}<span class="hbe-policy-title">Cancellation &amp; refund policy</span></div>
      <ul class="hbe-cancel-list">${rows}</ul>
      <p class="hbe-policy-footnote">Deadlines are counted from the standard ${esc(checkInTime)} check-in time.${cutoffText ? ' ' + esc(cutoffText) : ''}</p>
    </div>`;
}