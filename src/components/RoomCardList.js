/**
 * Renders smart multi-room combinations and individual room cards.
 * main.js uses this as the single renderer (previously duplicated inline).
 */
import { esc, inr, plural } from '../utils/format.js';
import { icon } from '../utils/icons.js';
import { renderRoomCard } from './RoomCard.js';

const comboId = (c) => String(c.id ?? c._id ?? '');

const comboCard = (combo, idx) => {
  const best = idx === 0;
  const rooms = Number(combo.totalRooms) || 0;
  const breakdown = combo.breakdown || [];

  return `
    <article class="hbe-combo-card ${best ? 'is-best-value' : ''}">
      ${best ? `<span class="hbe-pill-best">${icon('star', 12)}Best value</span>` : ''}
      <div class="hbe-combo-card-top">
        <div class="hbe-combo-info">
          <h5 class="hbe-combo-title">${esc(combo.title)}</h5>
          <span class="hbe-combo-capacity">Sleeps up to <strong>${esc(combo.totalCapacity)} guests</strong> across ${plural(rooms, 'room')}</span>
        </div>
        <div class="hbe-combo-price-block">
          <span class="hbe-combo-rate">${inr(combo.totalPrice)}</span>
          <span class="hbe-combo-night-sub">${inr(combo.avgPerNight)} / night</span>
        </div>
      </div>
      <ul class="hbe-breakdown-list" aria-label="Package includes">
        ${breakdown.map((b) => `<li><span class="hbe-qty">${esc(b.quantity)}×</span><span class="hbe-bd-name">${esc(b.name)}</span><span class="hbe-bd-cap">Max ${esc(b.maxOccupancyEach)} each</span></li>`).join('')}
      </ul>
      <button type="button" class="hbe-combo-book-btn" data-combo-id="${esc(comboId(combo))}">Select ${rooms}-room package</button>
    </article>`;
};

export function renderRoomCardList(container, {
  availableRooms = [],
  recommendedCombos = [],
  totalGuests = 2,
  requestedRooms = 1,
  nights = 1,
  propertyPhotos = [],
  onSelectRoom,
  onSelectCombo,
}) {
  if (!container) return;
  container.innerHTML = '';

  if (availableRooms.length === 0 && recommendedCombos.length === 0) {
    container.innerHTML = `
      <div class="hbe-empty">
        <div class="hbe-empty-icon">${icon('bed', 28)}</div>
        <div class="hbe-empty-title">No rooms available</div>
        <p>We couldn’t find ${plural(requestedRooms, 'room')} for ${plural(totalGuests, 'guest')} on these dates. Try different dates or add another room.</p>
      </div>`;
    return;
  }

  if (recommendedCombos.length > 0) {
    const section = document.createElement('section');
    section.className = 'hbe-combo-section';
    section.innerHTML = `
      <div class="hbe-combo-header">
        <span class="hbe-combo-badge">${icon('star', 12)}Smart group suggestion</span>
        <h4>Room combinations for ${plural(totalGuests, 'guest')}</h4>
        <p class="hbe-combo-sub">${availableRooms.length === 0
          ? `A single room can’t fit ${totalGuests} guests, so we’ve arranged these combinations for you.`
          : 'Travelling as a group? These combined packages offer great value.'}</p>
      </div>
      <div class="hbe-combo-cards">${recommendedCombos.map(comboCard).join('')}</div>`;
    section.querySelectorAll('.hbe-combo-book-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const combo = recommendedCombos.find((c) => comboId(c) === btn.dataset.comboId);
        if (combo && typeof onSelectCombo === 'function') onSelectCombo(combo);
      });
    });
    container.appendChild(section);
  }

  if (availableRooms.length > 0) {
    if (recommendedCombos.length > 0) {
      const d = document.createElement('div');
      d.className = 'hbe-divider-label';
      d.innerHTML = '<span>Or choose an individual room</span>';
      container.appendChild(d);
    }
    const grid = document.createElement('div');
    grid.className = 'hbe-rooms-grid';
    availableRooms.forEach((room, i) => {
      const card = renderRoomCard(room, (r) => onSelectRoom?.(r), { nights, rooms: requestedRooms, propertyPhotos });
      card.style.animationDelay = `${Math.min(i, 6) * 60}ms`;
      grid.appendChild(card);
    });
    container.appendChild(grid);
  }
}
