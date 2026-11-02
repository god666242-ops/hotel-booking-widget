import { esc, inr } from '../utils/format.js';

const CHARGE_LABEL = {
  PER_NIGHT: 'per night',
  PER_GUEST: 'per guest',
  PER_PERSON: 'per guest',
  PER_GUEST_PER_NIGHT: 'per guest / night',
};

export function renderAddonsList(container, addOns, onToggle, selectedIds = []) {
  if (!addOns || addOns.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <section class="hbe-card" aria-labelledby="hbe-addons-title">
      <div class="hbe-card-eyebrow">Optional</div>
      <h3 class="hbe-card-title" id="hbe-addons-title">Enhance your stay</h3>
      <div class="hbe-addon-list" id="hbe-addon-items"></div>
    </section>`;

  const list = container.querySelector('#hbe-addon-items');
  addOns.forEach((item) => {
    const id = item._id || item.code;
    const row = document.createElement('label');
    row.className = 'hbe-addon-row';
    const unit = CHARGE_LABEL[item.chargeType] || (item.isPerNight ? 'per night' : '');
    row.innerHTML = `
      <input type="checkbox" value="${esc(id)}" class="addon-checkbox" ${selectedIds.includes(id) ? 'checked' : ''} />
      <span class="hbe-addon-name">${esc(item.name)}${item.description ? `<small>${esc(item.description)}</small>` : ''}</span>
      <span class="hbe-addon-price">+${inr(item.price)}${unit ? `<small>${unit}</small>` : ''}</span>`;
    row.querySelector('.addon-checkbox').addEventListener('change', (e) => onToggle(item, e.target.checked));
    list.appendChild(row);
  });
}
