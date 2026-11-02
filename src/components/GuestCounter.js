export function renderGuestCounter(container, { adults = 2, children = 0, rooms = 1, onChange }) {
  let state = {
    rooms: Number(rooms) || 1,
    adults: Number(adults) || 2,
    children: Number(children) || 0,
  };

  const limits = {
    rooms: { min: 1, max: 8 },
    adults: { min: 1, max: 16 },
    children: { min: 0, max: 8 },
  };

  function update(key, delta) {
    const nextVal = state[key] + delta;
    if (nextVal >= limits[key].min && nextVal <= limits[key].max) {
      state[key] = nextVal;
      // Auto-adjust adults if room count exceeds adult count
      if (state.adults < state.rooms) {
        state.adults = state.rooms;
      }
      render();
      onChange({ ...state });
    }
  }

  function render() {
    container.innerHTML = `
      <div class="hbe-guest-grid">
        <!-- Rooms Counter -->
        <div class="hbe-stepper-card">
          <div class="hbe-stepper-header">
            <span class="hbe-stepper-label">Rooms</span>
            <span class="hbe-stepper-sub">Max 8</span>
          </div>
          <div class="hbe-stepper-controls">
            <button type="button" class="hbe-step-btn" data-action="dec" data-target="rooms" 
              ${state.rooms <= limits.rooms.min ? 'disabled' : ''} aria-label="Decrease rooms">−</button>
            <span class="hbe-step-count" id="hbe-val-rooms">${state.rooms}</span>
            <button type="button" class="hbe-step-btn" data-action="inc" data-target="rooms" 
              ${state.rooms >= limits.rooms.max ? 'disabled' : ''} aria-label="Increase rooms">+</button>
          </div>
        </div>

        <!-- Adults Counter -->
        <div class="hbe-stepper-card">
          <div class="hbe-stepper-header">
            <span class="hbe-stepper-label">Adults</span>
            <span class="hbe-stepper-sub">Ages 13+</span>
          </div>
          <div class="hbe-stepper-controls">
            <button type="button" class="hbe-step-btn" data-action="dec" data-target="adults" 
              ${state.adults <= limits.adults.min ? 'disabled' : ''} aria-label="Decrease adults">−</button>
            <span class="hbe-step-count" id="hbe-val-adults">${state.adults}</span>
            <button type="button" class="hbe-step-btn" data-action="inc" data-target="adults" 
              ${state.adults >= limits.adults.max ? 'disabled' : ''} aria-label="Increase adults">+</button>
          </div>
        </div>

        <!-- Children Counter -->
        <div class="hbe-stepper-card">
          <div class="hbe-stepper-header">
            <span class="hbe-stepper-label">Children</span>
            <span class="hbe-stepper-sub">Ages 0–12</span>
          </div>
          <div class="hbe-stepper-controls">
            <button type="button" class="hbe-step-btn" data-action="dec" data-target="children" 
              ${state.children <= limits.children.min ? 'disabled' : ''} aria-label="Decrease children">−</button>
            <span class="hbe-step-count" id="hbe-val-children">${state.children}</span>
            <button type="button" class="hbe-step-btn" data-action="inc" data-target="children" 
              ${state.children >= limits.children.max ? 'disabled' : ''} aria-label="Increase children">+</button>
          </div>
        </div>
      </div>
    `;

    container.querySelectorAll('.hbe-step-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const action = btn.dataset.action;
        const target = btn.dataset.target;
        update(target, action === 'inc' ? 1 : -1);
      });
    });
  }

  render();
}