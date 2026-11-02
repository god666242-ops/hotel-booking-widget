import { esc, inr, plural } from '../utils/format.js';
import { icon as svg } from '../utils/icons.js';

const FALLBACK_PHOTO =
  'https://images.unsplash.com/photo-1781572725438-ac8c41476752?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D';
const MAX_PHOTOS = 8;

const REDUCED = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const ICON_PREV = svg('chevL', 18);
const ICON_NEXT = svg('chevR', 18);
const ICON_EXPAND = svg('expand', 14);

function urgencyBadge(units) {
  const n = Number(units);
  if (!Number.isFinite(n) || n < 1) return '';
  if (n === 1) return `<span class="hbe-urgency-pill danger">Only 1 room left!</span>`;
  if (n <= 3) return `<span class="hbe-urgency-pill warning">Only ${n} rooms left</span>`;
  return '';
}

/* ───────── Fullscreen gallery (inside the modal) ───────── */
function openLightbox(card, photos, start, name) {
  const host = card.closest('.hbe-modal');
  if (!host) return;

  let i = start;
  const multi = photos.length > 1;
  const lb = document.createElement('div');
  lb.className = 'hbe-lightbox';
  lb.setAttribute('role', 'dialog');
  lb.setAttribute('aria-modal', 'true');
  lb.setAttribute('aria-label', `${name} photo gallery`);
  lb.innerHTML = `
    <div class="hbe-lb-count"></div>
    <button type="button" class="hbe-lb-close" aria-label="Close gallery">&times;</button>
    ${multi ? `<button type="button" class="hbe-lb-nav prev" aria-label="Previous photo">${ICON_PREV}</button>
               <button type="button" class="hbe-lb-nav next" aria-label="Next photo">${ICON_NEXT}</button>` : ''}
    <figure class="hbe-lb-stage"><img class="hbe-lb-img" alt="" draggable="false" /></figure>
    <div class="hbe-lb-caption">${esc(name)}</div>
    ${multi ? `<div class="hbe-lb-thumbs">${photos
      .map((p, n) => `<button type="button" class="hbe-lb-thumb" data-i="${n}" aria-label="Photo ${n + 1}"><img src="${esc(p)}" alt="" draggable="false" /></button>`)
      .join('')}</div>` : ''}
  `;

  const img = lb.querySelector('.hbe-lb-img');
  const count = lb.querySelector('.hbe-lb-count');
  const thumbs = [...lb.querySelectorAll('.hbe-lb-thumb')];

  const show = (n) => {
    i = (n + photos.length) % photos.length;
    img.style.animation = 'none';
    void img.offsetWidth; // restart the fade-in
    img.style.animation = '';
    img.src = photos[i];
    img.alt = `${name} – photo ${i + 1}`;
    count.textContent = `${i + 1} / ${photos.length}`;
    thumbs.forEach((t, n) => t.classList.toggle('is-active', n === i));
    thumbs[i]?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: REDUCED() ? 'auto' : 'smooth' });
  };

  const onKey = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
    else if (e.key === 'ArrowLeft' && multi) show(i - 1);
    else if (e.key === 'ArrowRight' && multi) show(i + 1);
  };
  function close() {
    document.removeEventListener('keydown', onKey, true); // capture: runs before the modal's own Esc handler
    lb.classList.remove('is-open');
    setTimeout(() => lb.remove(), 250);
    card.querySelector('.hbe-slides')?.focus({ preventScroll: true });
  }
  document.addEventListener('keydown', onKey, true);

  lb.querySelector('.hbe-lb-close').addEventListener('click', close);
  lb.querySelector('.prev')?.addEventListener('click', () => show(i - 1));
  lb.querySelector('.next')?.addEventListener('click', () => show(i + 1));
  thumbs.forEach((t) => t.addEventListener('click', () => show(Number(t.dataset.i))));
  lb.addEventListener('click', (e) => {
    if (e.target === lb || e.target.classList.contains('hbe-lb-stage')) close();
  });

  // swipe
  let x0 = null;
  lb.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', (e) => {
    if (x0 == null || !multi) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 50) show(i + (dx < 0 ? 1 : -1));
    x0 = null;
  });

  host.appendChild(lb);
  show(i);
  requestAnimationFrame(() => lb.classList.add('is-open'));
  lb.querySelector('.hbe-lb-close').focus({ preventScroll: true });
}

/* ───────── Room card ───────── */
export function renderRoomCard(room, onSelect, { nights, rooms = 1, propertyPhotos = [] } = {}) {
  const card = document.createElement('div');
  card.className = 'hbe-room-item';

  // 1. Prioritize room photos; if empty, use property photos uploaded from admin; fallback if both empty
  const roomSpecificPhotos = (room.photos || []).filter(Boolean);
  const generalPropertyPhotos = (propertyPhotos || []).filter(Boolean);

  let candidatePhotos = roomSpecificPhotos.length > 0 
    ? roomSpecificPhotos 
    : generalPropertyPhotos;

  // Optional: If you want room photos + property photos combined:
  // let candidatePhotos = [...roomSpecificPhotos, ...generalPropertyPhotos];

  const photos = [...new Set(candidatePhotos)].slice(0, MAX_PHOTOS);
  if (!photos.length) photos.push(FALLBACK_PHOTO);

  const multi = photos.length > 1;
  const amenities = (room.amenities || []).slice(0, 3);
  const total = Number(room.pricing?.totalBaseTariff) || 0;
  const perNight = nights && rooms ? Math.round(total / (nights * rooms)) : 0;

  card.innerHTML = `
    <div class="hbe-room-img-wrap">
      <div class="hbe-slides" tabindex="0" role="group" aria-roledescription="carousel" aria-label="${esc(room.name)} photos">
        ${photos
          .map(
            (src, n) => `<div class="hbe-slide" data-i="${n}">
              <img src="${esc(src)}" class="hbe-room-img" alt="${esc(room.name)} – photo ${n + 1}" loading="${n === 0 ? 'eager' : 'lazy'}" draggable="false" />
            </div>`
          )
          .join('')}
      </div>

      <span class="hbe-room-tag">${svg('bolt', 12)}Instant book</span>
      ${urgencyBadge(room.remainingUnits)}

      <button type="button" class="hbe-gallery-count" aria-label="Open photo gallery">
        ${ICON_EXPAND}<span class="hbe-count-text">1 / ${photos.length}</span>
      </button>

      ${multi ? `
        <button type="button" class="hbe-nav prev" aria-label="Previous photo">${ICON_PREV}</button>
        <button type="button" class="hbe-nav next" aria-label="Next photo">${ICON_NEXT}</button>
        <div class="hbe-pager">${photos.map((_, n) => `<button type="button" class="hbe-pager-dot" data-i="${n}" aria-label="Go to photo ${n + 1}"></button>`).join('')}</div>` : ''}
    </div>

    <div class="hbe-room-info">
      <h4 class="hbe-room-title">${esc(room.name)}</h4>
      <div class="hbe-room-meta">
        <span class="hbe-room-pill is-strong">${svg('users', 14)}Up to ${esc(room.maxOccupancy)} guests</span>
        ${amenities.map((a) => `<span class="hbe-room-pill">${esc(a)}</span>`).join('')}
      </div>
      <div class="hbe-room-bottom">
        <div class="hbe-price">
          <strong>${inr(total)}</strong>
          <span>${nights ? `${plural(nights, 'night')}` : 'Total stay'}${perNight ? ` · ~${inr(perNight)}/night` : ''} · + taxes</span>
        </div>
        <button class="hbe-btn-book select-btn" type="button" aria-label="Select ${esc(room.name)}">Select</button>
      </div>
    </div>
  `;

  const track = card.querySelector('.hbe-slides');
  const countText = card.querySelector('.hbe-count-text');
  const dots = [...card.querySelectorAll('.hbe-pager-dot')];
  const prev = card.querySelector('.hbe-nav.prev');
  const next = card.querySelector('.hbe-nav.next');

  const current = () => Math.round(track.scrollLeft / (track.clientWidth || 1));
  const go = (n) => {
    const idx = Math.max(0, Math.min(photos.length - 1, n));
    track.scrollTo({ left: idx * track.clientWidth, behavior: REDUCED() ? 'auto' : 'smooth' });
  };
  const sync = () => {
    const c = current();
    countText.textContent = `${c + 1} / ${photos.length}`;
    dots.forEach((d, n) => d.classList.toggle('is-active', n === c));
    if (prev) prev.disabled = c === 0;
    if (next) next.disabled = c === photos.length - 1;
  };
  let ticking = false;
  track.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; sync(); });
  }, { passive: true });
  sync();

  prev?.addEventListener('click', (e) => { e.stopPropagation(); go(current() - 1); });
  next?.addEventListener('click', (e) => { e.stopPropagation(); go(current() + 1); });
  dots.forEach((d) => d.addEventListener('click', (e) => { e.stopPropagation(); go(Number(d.dataset.i)); }));

  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(current() - 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); go(current() + 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(card, photos, current(), room.name); }
  });

  // Tap a photo (or expand chip) → fullscreen gallery
  track.addEventListener('click', () => openLightbox(card, photos, current(), room.name));
  card.querySelector('.hbe-gallery-count').addEventListener('click', (e) => {
    e.stopPropagation();
    openLightbox(card, photos, current(), room.name);
  });

  // Broken photo → neutral placeholder
  card.querySelectorAll('.hbe-room-img').forEach((im) =>
    im.addEventListener('error', () => { im.closest('.hbe-slide').classList.add('is-broken'); im.remove(); }, { once: true })
  );

  card.querySelector('.select-btn').addEventListener('click', () => onSelect(room));
  return card;
}