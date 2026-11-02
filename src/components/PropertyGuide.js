/**
 * PropertyGuide.js
 * Trust-building guide for the booking modal, in this order:
 * Map → Reasons → Amenities → Languages → Key Facts → Cancellation → FAQs → Rules → Announcement
 */
import { esc, plural } from '../utils/format.js';
import { icon } from '../utils/icons.js';

// Only allow https map embeds (meta comes from an API)
const safeUrl = (u) => {
  try {
    const x = new URL(u);
    return x.protocol === 'https:' ? x.href : '';
  } catch {
    return '';
  }
};

const distance = (v, fallback) =>
  v == null || v === '' ? fallback : typeof v === 'number' ? `${v} km` : String(v);

const cardHeader = (ico, title) =>
  `<div class="hbe-guide-header"><span class="hbe-guide-icon">${ico}</span>${title}</div>`;

const pills = (items) =>
  `<div class="hbe-amenities-wrap">${items
    .map((t) => `<span class="hbe-amenity-pill">${esc(t)}</span>`)
    .join('')}</div>`;

const accordionCard = (ico, title, bodyHtml) => `
  <div class="hbe-guide-card hbe-accordion-card hbe-span-all">
    <div class="hbe-accordion-item">
      <button type="button" class="hbe-accordion-trigger" aria-expanded="false">
        <span class="hbe-accordion-title"><span class="hbe-accordion-icon">${ico}</span>${title}</span>
        <span class="hbe-arrow" aria-hidden="true">${icon('chevD', 18)}</span>
      </button>
      <div class="hbe-accordion-panel">
        <div class="hbe-accordion-inner">
          <div class="hbe-accordion-body">${bodyHtml}</div>
        </div>
      </div>
    </div>
  </div>
`;

const refundClass = (pct) => (pct >= 100 ? 'is-full' : pct > 0 ? 'is-partial' : 'is-none');

export function renderPropertyGuide(container, meta) {
  if (!meta) return;

  const guideBox = document.createElement('section');
  guideBox.className = 'hbe-guide-wrapper';
  guideBox.setAttribute('aria-label', 'Property guide');

  // 1. Map & Landmark
  const mapUrl = safeUrl(meta.address?.mapEmbedUrl);
  const addressLine = [meta.address?.street, meta.address?.city].filter(Boolean).join(', ');
  const mapHtml = mapUrl
    ? `<div class="hbe-guide-card hbe-span-all">
         ${cardHeader(icon('pin', 18), 'Location &amp; Landmark')}
         <p class="hbe-landmark-text">
           ${esc(addressLine)}${meta.address?.landmark ? ` · <em>${esc(meta.address.landmark)}</em>` : ''}
         </p>
         <div class="hbe-map-container">
           <iframe src="${esc(mapUrl)}" title="Hotel location map" width="100%" height="220"
             loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
         </div>
       </div>`
    : '';

  // 2. Top Reasons to Book Direct
  const reasons = meta.topReasonsToBook || [];
  const reasonsHtml = reasons.length
    ? `<div class="hbe-reasons-card hbe-span-all">
         <div class="hbe-guide-eyebrow">Direct booking perks</div>
         <div class="hbe-guide-title">Top Reasons to Book Direct</div>
         <div class="hbe-reasons-grid">
           ${reasons
             .map(
               (r) => `<div class="hbe-reason-item">
                         <span class="hbe-check-icon">${icon('check', 12)}</span>
                         <span>${esc(r)}</span>
                       </div>`
             )
             .join('')}
         </div>
       </div>`
    : '';

  // 3. Featured Hotel Amenities
  const amenities = meta.topAmenities || [];
  const amenitiesHtml = amenities.length
    ? `<div class="hbe-guide-card">${cardHeader(icon('bell', 18), 'Featured Hotel Amenities')}${pills(amenities)}</div>`
    : '';

  // 4. Languages Spoken by Staff
  const languages = meta.languagesSpoken || [];
  const languagesHtml = languages.length
    ? `<div class="hbe-guide-card">${cardHeader(icon('chat', 18), 'Languages Spoken by Staff')}${pills(languages)}</div>`
    : '';

  // 5. Key Property Facts
  const facts = meta.helpfulFacts || {};
  const factCells = [
    ['Check-in / Check-out', `${meta.checkInTime || '12:00 PM'} / ${meta.checkOutTime || '11:00 AM'}`],
    ['In-house dining', plural(facts.numberOfRestaurants || 1, 'restaurant')],
    ['Airport distance', distance(facts.airportDistanceKm, '15 km')],
    ['Railway station', distance(facts.railwayStationDistanceKm, '5 km')],
    ['Couple friendly', facts.coupleFriendly ? 'Yes (18+ with ID)' : 'Family only'],
    ['Pets allowed', facts.petFriendly ? 'Yes' : 'No'],
  ];
  const factsHtml = `
    <div class="hbe-guide-card hbe-facts-card hbe-span-all">
      ${cardHeader(icon('list', 18), 'Key Property Facts')}
      <div class="hbe-facts-grid">
        ${factCells
          .map(
            ([label, val]) => `<div class="hbe-fact-cell">
              <span class="hbe-fact-label">${esc(label)}</span>
              <span class="hbe-fact-val">${esc(val)}</span>
            </div>`
          )
          .join('')}
      </div>
    </div>
  `;

  // 6. Cancellation & Refund Policy
  const policy = meta.cancellationPolicy;
  let cancellationHtml;

  if (policy?.enabled && policy.tiers?.length > 0) {
    const tiers = [...policy.tiers].sort((a, b) => b.daysBeforeCheckIn - a.daysBeforeCheckIn);
    cancellationHtml = `
      <div class="hbe-guide-card hbe-span-all">
        ${cardHeader(icon('shield', 18), 'Cancellation &amp; Refund Policy')}
        <ul class="hbe-cancel-list">
          ${tiers
            .map((t) => {
              const days = Number(t.daysBeforeCheckIn) || 0;
              const pct = Number(t.refundPercent) || 0;
              const label =
                days === 0
                  ? 'Within 48 hours of check-in'
                  : `Up to <strong>${days} ${days === 1 ? 'day' : 'days'}</strong> before check-in`;
              return `<li class="hbe-cancel-row">
                        <span class="hbe-cancel-label">${label}</span>
                        <span class="hbe-refund-badge ${refundClass(pct)}">${pct}% refund</span>
                      </li>`;
            })
            .join('')}
        </ul>
        <p class="hbe-landmark-text hbe-cancel-note">
          * Deadlines are calculated from the hotel's standard ${esc(meta.checkInTime || '12:00 PM')} check-in time.
        </p>
      </div>
    `;
  } else {
    cancellationHtml = `
      <div class="hbe-guide-card hbe-nonrefundable hbe-span-all">
        <div class="hbe-guide-header"><span class="hbe-guide-icon">${icon('lock', 18)}</span>Non-Refundable Property</div>
        <p class="hbe-landmark-text">
          Reservations at this property are non-refundable once confirmed.
        </p>
      </div>
    `;
  }

  // 7. FAQs (accordion)
  const faqs = meta.faqs || [];
  const faqsHtml = faqs.length
    ? accordionCard(
        icon('help', 18),
        'Frequently Asked Questions',
        faqs
          .map(
            (f) => `<div class="hbe-faq-row">
                      <div class="hbe-faq-q">${esc(f.question)}</div>
                      <div class="hbe-faq-a">${esc(f.answer)}</div>
                    </div>`
          )
          .join('')
      )
    : '';

  // 8. Property Rules & Guidelines (accordion)
  const policies = meta.propertyPolicies || [];
  const policiesHtml = policies.length
    ? accordionCard(
        icon('scroll', 18),
        'Property Rules &amp; Guidelines',
        `<ul class="hbe-policy-bullet-list">${policies.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>`
      )
    : '';

  // 9. Announcement
  const announcementHtml =
    meta.announcement?.enabled && meta.announcement?.text
      ? `<div class="hbe-banner-announcement hbe-span-all" role="status">
           <span class="hbe-banner-icon">${icon('megaphone', 18)}</span>
           <p>${esc(meta.announcement.text)}</p>
         </div>`
      : '';

  guideBox.innerHTML = `
    ${mapHtml}
    ${reasonsHtml}
    ${amenitiesHtml}
    ${languagesHtml}
    ${factsHtml}
    ${cancellationHtml}
    ${faqsHtml}
    ${policiesHtml}
    ${announcementHtml}
  `;

  // Accordion toggles: CSS animates height via the .is-open class
  guideBox.querySelectorAll('.hbe-accordion-item').forEach((item) => {
    const trigger = item.querySelector('.hbe-accordion-trigger');
    trigger.addEventListener('click', () => {
      const open = item.classList.toggle('is-open');
      trigger.setAttribute('aria-expanded', String(open));
    });
  });

  container.appendChild(guideBox);
}