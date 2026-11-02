import { icon } from '../utils/icons.js';
import { toLocalISO, parseISO, addDays, nightsBetween, fmtDate, plural } from '../utils/format.js';

export function renderDatePicker(container, { checkIn, checkOut, onChange }) {
  const todayISO = toLocalISO(new Date());

  // Confirmed dates
  let confirmedCheckIn = checkIn || todayISO;
  let confirmedCheckOut = checkOut || addDays(confirmedCheckIn, 1);

  // Selection state: 'CHECK_IN' or 'CHECK_OUT'
  let selectingState = 'CHECK_IN';
  let tempCheckIn = confirmedCheckIn;
  let tempCheckOut = confirmedCheckOut;
  let hoverDate = null;
  let isOpen = false;

  let viewDate = parseISO(confirmedCheckIn);
  viewDate.setDate(1);

  function getMonthData(year, month) {
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return { firstDayIndex, daysInMonth, year, month };
  }

  function emitChange() {
    const inEl = container.querySelector('#hbe-checkin');
    const outEl = container.querySelector('#hbe-checkout');
    if (inEl && outEl) {
      inEl.value = confirmedCheckIn;
      outEl.value = confirmedCheckOut;
      outEl.min = addDays(confirmedCheckIn, 1);
    }
    onChange({
      checkIn: confirmedCheckIn,
      checkOut: confirmedCheckOut,
      nights: nightsBetween(confirmedCheckIn, confirmedCheckOut),
    });
  }

  function renderMonthGrid(year, month) {
    const { firstDayIndex, daysInMonth } = getMonthData(year, month);
    const monthTitle = new Date(year, month, 1).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });

    let cellsHtml = '';
    for (let i = 0; i < firstDayIndex; i++) {
      cellsHtml += `<div class="hbe-cal-day is-empty"></div>`;
    }

    const effectiveCheckIn = tempCheckIn;
    const effectiveCheckOut = selectingState === 'CHECK_OUT' ? null : tempCheckOut;

    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isPast = iso < todayISO;
      const isStart = iso === effectiveCheckIn;
      const isEnd = effectiveCheckOut && iso === effectiveCheckOut;

      const inRange =
        (effectiveCheckIn && effectiveCheckOut && iso > effectiveCheckIn && iso < effectiveCheckOut) ||
        (selectingState === 'CHECK_OUT' && hoverDate && iso > effectiveCheckIn && iso < hoverDate);

      const isHoverEnd = selectingState === 'CHECK_OUT' && hoverDate === iso && iso > effectiveCheckIn;

      const classes = [
        'hbe-cal-day',
        isPast ? 'is-disabled' : '',
        isStart ? 'is-start' : '',
        isEnd ? 'is-end' : '',
        isHoverEnd ? 'is-hover-end' : '',
        inRange ? 'is-in-range' : '',
      ]
        .filter(Boolean)
        .join(' ');

      cellsHtml += `
        <button type="button" class="${classes}" data-iso="${iso}" ${isPast ? 'disabled' : ''} aria-label="${fmtDate(iso)}" aria-pressed="${Boolean(isStart || isEnd)}">
          <span>${d}</span>
        </button>
      `;
    }

    return `
      <div class="hbe-cal-month">
        <div class="hbe-cal-month-title">${monthTitle}</div>
        <div class="hbe-cal-weekdays">
          <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
        </div>
        <div class="hbe-cal-days-grid">${cellsHtml}</div>
      </div>
    `;
  }

  function updateDOM() {
    const nights = nightsBetween(confirmedCheckIn, confirmedCheckOut);
    const today = parseISO(todayISO);
    const canGoPrev = viewDate.getFullYear() * 12 + viewDate.getMonth() > today.getFullYear() * 12 + today.getMonth();
    const active = container.getRootNode().activeElement;
    const refocus = active && container.contains(active) ? (active.dataset?.iso ? `[data-iso="${active.dataset.iso}"]` : active.id ? `#${active.id}` : null) : null;

    const m1Year = viewDate.getFullYear();
    const m1Month = viewDate.getMonth();
    const m2Date = new Date(m1Year, m1Month + 1, 1);
    const m2Year = m2Date.getFullYear();
    const m2Month = m2Date.getMonth();

    container.innerHTML = `
      <input type="hidden" id="hbe-checkin" value="${confirmedCheckIn}" />
      <input type="hidden" id="hbe-checkout" value="${confirmedCheckOut}" />

      <div class="hbe-datepicker-wrap">
        <div class="hbe-input-group">
          <span class="hbe-label">Stay dates</span>
          <button type="button" class="hbe-datepicker-trigger ${isOpen ? 'is-active' : ''}" id="hbe-datepicker-btn" aria-haspopup="dialog" aria-expanded="${isOpen}" aria-controls="hbe-cal-popover">
            <span class="hbe-dp-col ${selectingState === 'CHECK_IN' && isOpen ? 'is-focused' : ''}">
              <span class="hbe-dp-sub">Check-in</span>
              <strong class="hbe-dp-val">${fmtDate(confirmedCheckIn)}</strong>
            </span>
            <span class="hbe-dp-divider">
              <span class="hbe-dp-pill">${plural(nights, 'night')}</span>
            </span>
            <span class="hbe-dp-col ${selectingState === 'CHECK_OUT' && isOpen ? 'is-focused' : ''}">
              <span class="hbe-dp-sub">Check-out</span>
              <strong class="hbe-dp-val">${fmtDate(confirmedCheckOut)}</strong>
            </span>
          </button>
        </div>

        <div class="hbe-cal-popover ${isOpen ? 'is-open' : ''}" id="hbe-cal-popover" role="dialog" aria-label="Choose stay dates" ${isOpen ? '' : 'hidden'}>
          <div class="hbe-cal-quick-bar">
            <button type="button" class="hbe-preset-btn" data-preset="tonight">Tonight (1N)</button>
            <button type="button" class="hbe-preset-btn" data-preset="weekend">This Weekend</button>
            <button type="button" class="hbe-preset-btn" data-preset="week">7 Nights</button>
          </div>
          
          <div class="hbe-cal-nav">
            <button type="button" class="hbe-cal-nav-btn" id="hbe-cal-prev" aria-label="Previous month" ${canGoPrev ? '' : 'disabled'}>${icon('chevL', 16)}</button>
            <button type="button" class="hbe-cal-nav-btn" id="hbe-cal-next" aria-label="Next month">${icon('chevR', 16)}</button>
          </div>

          <div class="hbe-cal-months-container">
            ${renderMonthGrid(m1Year, m1Month)}
            ${renderMonthGrid(m2Year, m2Month)}
          </div>

          <div class="hbe-cal-footer">
            <span class="hbe-cal-hint">
              ${
                selectingState === 'CHECK_IN'
                  ? 'Step 1: Choose check-in date'
                  : 'Step 2: Choose check-out date'
              }
            </span>
            <button type="button" class="hbe-cal-apply-btn" id="hbe-cal-apply">Done</button>
          </div>
        </div>
      </div>
    `;

    bindEvents();
    if (refocus) container.querySelector(refocus)?.focus({ preventScroll: true });
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    selectingState = 'CHECK_IN';
    updateDOM();
  }

  if (!container.dataset.hbeDpBound) {
    container.dataset.hbeDpBound = '1';
    container.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen) {
        e.stopPropagation(); // don't close the whole modal
        close();
        container.querySelector('#hbe-datepicker-btn')?.focus();
      }
    });
    const root = container.getRootNode();
    const onOutside = (e) => {
      if (!container.isConnected) { root.removeEventListener('mousedown', onOutside); return; }
      if (isOpen && !e.composedPath().includes(container)) close();
    };
    root.addEventListener('mousedown', onOutside);
  }

  function bindEvents() {
    const trigger = container.querySelector('#hbe-datepicker-btn');
    trigger?.addEventListener('click', () => {
      isOpen = !isOpen;
      if (isOpen) {
        selectingState = 'CHECK_IN';
        tempCheckIn = confirmedCheckIn;
        tempCheckOut = confirmedCheckOut;
      }
      updateDOM();
    });

    container.querySelector('#hbe-cal-prev')?.addEventListener('click', (e) => {
      e.stopPropagation();
      viewDate.setMonth(viewDate.getMonth() - 1);
      updateDOM();
    });

    container.querySelector('#hbe-cal-next')?.addEventListener('click', (e) => {
      e.stopPropagation();
      viewDate.setMonth(viewDate.getMonth() + 1);
      updateDOM();
    });

    container.querySelector('#hbe-cal-apply')?.addEventListener('click', (e) => {
      e.stopPropagation();
      isOpen = false;
      updateDOM();
    });

    container.querySelectorAll('.hbe-preset-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const mode = btn.dataset.preset;
        if (mode === 'tonight') {
          confirmedCheckIn = todayISO;
          confirmedCheckOut = addDays(todayISO, 1);
        } else if (mode === 'weekend') {
          const d = parseISO(todayISO);
          const distToFri = (5 - d.getDay() + 7) % 7 || 7;
          confirmedCheckIn = addDays(todayISO, distToFri);
          confirmedCheckOut = addDays(confirmedCheckIn, 2);
        } else if (mode === 'week') {
          confirmedCheckIn = todayISO;
          confirmedCheckOut = addDays(todayISO, 7);
        }
        isOpen = false;
        selectingState = 'CHECK_IN';
        viewDate = parseISO(confirmedCheckIn);
        viewDate.setDate(1);
        emitChange();
        updateDOM();
      });
    });

    container.querySelectorAll('.hbe-cal-day:not(.is-empty):not([disabled])').forEach((btn) => {
      btn.addEventListener('mouseenter', () => {
        if (selectingState === 'CHECK_OUT') {
          hoverDate = btn.dataset.iso;
          container.querySelectorAll('.hbe-cal-day:not(.is-empty)').forEach((el) => {
            const iso = el.dataset.iso;
            if (iso > tempCheckIn && iso < hoverDate) {
              el.classList.add('is-in-range');
            } else {
              el.classList.remove('is-in-range');
            }
          });
        }
      });

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const selected = btn.dataset.iso;

        if (selectingState === 'CHECK_IN') {
          tempCheckIn = selected;
          tempCheckOut = null;
          hoverDate = null;
          selectingState = 'CHECK_OUT';
          updateDOM();
        } else {
          if (parseISO(selected) <= parseISO(tempCheckIn)) {
            tempCheckIn = selected;
            tempCheckOut = null;
            selectingState = 'CHECK_OUT';
            updateDOM();
          } else {
            confirmedCheckIn = tempCheckIn;
            confirmedCheckOut = selected;
            tempCheckOut = selected;
            selectingState = 'CHECK_IN';
            isOpen = false;
            emitChange();
            updateDOM();
          }
        }
      });
    });

    // Vitest support
    const inEl = container.querySelector('#hbe-checkin');
    const outEl = container.querySelector('#hbe-checkout');
    inEl?.addEventListener('change', () => {
      confirmedCheckIn = inEl.value;
      if (parseISO(outEl.value) <= parseISO(inEl.value)) {
        outEl.value = addDays(inEl.value, 1);
        confirmedCheckOut = outEl.value;
      }
      emitChange();
    });
    outEl?.addEventListener('change', () => {
      confirmedCheckOut = outEl.value;
      emitChange();
    });
  }

  updateDOM();
}

export const nightsLabel = (checkIn, checkOut) => plural(nightsBetween(checkIn, checkOut), 'night');