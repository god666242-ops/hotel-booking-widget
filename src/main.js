import {
  fetchHotelMeta,
  fetchAvailability,
  createBookingHold,
  validatePromoCode,
} from "./utils/api.js";
import {
  esc,
  inr,
  toLocalISO,
  addDays,
  nightsBetween,
  fmtDate,
  plural,
} from "./utils/format.js";
import { icon } from "./utils/icons.js";
import { validateStay } from "./utils/validators.js";
import { renderDatePicker } from "./components/DatePicker.js";
import { renderGuestCounter } from "./components/GuestCounter.js";
import { renderRoomCardList } from "./components/RoomCardList.js";
import { renderAddonsList } from "./components/AddonsList.js";
import { renderPriceBreakdown } from "./components/PriceBreakdown.js";
import { renderPolicyNotice } from "./components/PolicyNotice.js";
import { renderGuestForm } from "./components/GuestForm.js";
import {
  loadRazorpayScript,
  openRazorpayCheckout,
} from "./components/PaymentHandler.js";
import { renderPropertyGuide } from "./components/PropertyGuide.js";
import { analytics } from "./utils/analytics.js";
import styles from "./styles/shadow-theme.css?inline";
import { BRAND_MARK, BRAND_NAME, BRAND_URL } from "./utils/brand.js";

const FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap";

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const SORTS = {
  recommended: "Recommended",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
};

function ensureFonts() {
  if (document.getElementById("hbe-fonts")) return;
  const link = document.createElement("link");
  link.id = "hbe-fonts";
  link.rel = "stylesheet";
  link.href = FONT_HREF;
  document.head.appendChild(link);
}

class HotelBookingEngine extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    const today = toLocalISO(new Date());

    this.state = {
      hotelSlug: this.getAttribute("data-hotel") || "",
      turnstileSiteKey: this.getAttribute("data-turnstile-key") || "",
      hotelMeta: null,
      checkIn: today,
      checkOut: addDays(today, 1),
      adults: 2,
      children: 0,
      rooms: 1,
      availableRooms: [],
      recommendedCombos: [],
      selectedBooking: null,
      selectedRatePlanId: null,
      selectedAddOns: [],
      appliedPromo: null,
      promoDiscountAmount: 0,
      ratePlanDiscountAmount: 0,
      confirmedBookingCode: null,
      activeBookingId: null,
      sort: "recommended",
      step: "SEARCH", // 'SEARCH' | 'DETAILS' | 'VERIFYING' | 'CONFIRMED'
      loading: false,
      error: null,
    };

    this.isOpen = false;
    this._lastStep = null;
    this.resultsEl = null;
    this.guideEl = null;

    this._paying = false;
    this._timers = new Set();
    this.guestForm = null;
    this._total = 0;

    this._onKey = (e) => {
      if (!this.isOpen) return;
      if (e.key === "Escape") {
        this.closeModal();
      } else if (e.key === "Tab") {
        this.trapFocus(e);
      }
    };
  }

  trapFocus(e) {
    const scope =
      this.shadowRoot.querySelector(".hbe-lightbox.is-open") ||
      this.shadowRoot.querySelector("#hbe-modal");
    if (!scope) return;

    const items = [...scope.querySelectorAll(FOCUSABLE)].filter(
      (el) => el.offsetParent !== null || el === this.shadowRoot.activeElement,
    );
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = this.shadowRoot.activeElement;
    if (e.shiftKey && (active === first || active === scope)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    } else if (!scope.contains(active)) {
      e.preventDefault();
      first.focus();
    }
  }

  later(fn, ms) {
    const id = setTimeout(() => {
      this._timers.delete(id);
      fn();
    }, ms);
    this._timers.add(id);
  }

  clearTimers() {
    this._timers.forEach(clearTimeout);
    this._timers.clear();
  }

  applyBranding() {
    const primary = this.getAttribute("data-primary");
    if (primary && HEX.test(primary))
      this.style.setProperty("--hbe-primary", primary);
    const label = this.getAttribute("data-button-label");
    if (label) this.$("#hbe-open-label").textContent = label;
  }

  async connectedCallback() {
    ensureFonts();
    this.injectStyles();
    this.render();
    this.applyBranding();
    loadRazorpayScript();
    await this.initHotel();
  }

  disconnectedCallback() {
    document.removeEventListener("keydown", this._onKey);
    this.clearTimers();
    if (this.isOpen) document.body.style.overflow = this._prevOverflow || "";
  }

  injectStyles() {
    const styleEl = document.createElement("style");
    styleEl.textContent = styles;
    this.shadowRoot.appendChild(styleEl);
  }

  /* ───────── Data ───────── */

  async initHotel() {
    if (!this.state.hotelSlug) {
      this.state.error =
        "Missing data-hotel attribute on <hotel-booking-engine>";
      this.updateView();
      return;
    }

    try {
      const res = await fetchHotelMeta(this.state.hotelSlug);
      this.state.hotelMeta = res.data;

      if (res.data?.turnstileSiteKey && !this.state.turnstileSiteKey) {
        this.state.turnstileSiteKey = res.data.turnstileSiteKey;
      }

      // Initialize Tracking Pixels (GA4 / Meta Pixel / GTM)
      if (res.data?.integrations) {
        analytics.init(res.data.integrations);
      }

      this.state.error = null;
      this.updateView();
    } catch (err) {
      console.error("[HBE Error] Failed to load hotel metadata:", err);
      if (window.Sentry) {
        window.Sentry.captureException(err, {
          tags: { hotelSlug: this.state.hotelSlug, step: "INIT_HOTEL" },
        });
      }
      this.state.error =
        "Unable to connect to hotel booking server. Please verify data-hotel slug.";
      this.updateView();
      return;
    }

    await this.searchRooms();
  }

  get nights() {
    return nightsBetween(this.state.checkIn, this.state.checkOut);
  }

  get totalGuests() {
    return (
      (Number(this.state.adults) || 0) + (Number(this.state.children) || 0)
    );
  }

  async searchRooms() {
    this.state.loading = true;
    this.state.error = null;
    this.renderResults();

    try {
      const res = await fetchAvailability({
        slug: this.state.hotelSlug,
        checkIn: this.state.checkIn,
        checkOut: this.state.checkOut,
        adults: this.state.adults,
        children: this.state.children,
        rooms: this.state.rooms,
      });

      this.state.availableRooms = res.data?.availableRooms || [];
      this.state.recommendedCombos = res.data?.recommendedCombos || [];
      this.state.error = null;
    } catch (err) {
      console.error("[HBE Error] Search availability error:", err);
      if (window.Sentry) {
        window.Sentry.captureException(err, {
          tags: { hotelSlug: this.state.hotelSlug, step: "SEARCH_ROOMS" },
        });
      }
      this.state.error = err.message || "Failed to load rooms";
    } finally {
      this.state.loading = false;
      if (this.state.step === "SEARCH" && this.resultsEl?.isConnected) {
        this.renderResults();
      } else {
        this.updateView();
      }
    }
  }

  /* ───────── Modal Shell ───────── */

  render() {
    const container = document.createElement("div");
    container.id = "hbe-root";

    container.innerHTML = `
      <button class="hbe-launcher" id="hbe-open-btn" type="button" aria-haspopup="dialog">
        ${icon("calendar", 18)}<span id="hbe-open-label">Book direct &amp; save</span>
      </button>

      <div class="hbe-overlay" id="hbe-overlay">
        <div class="hbe-modal" id="hbe-modal" role="dialog" aria-modal="true" aria-labelledby="hbe-hotel-title" tabindex="-1">
          <header class="hbe-header">
            <div class="hbe-header-title">
              <div class="hbe-header-sub">${icon("shield", 14)}Best rate guarantee</div>
              <h2 id="hbe-hotel-title">Direct reservations</h2>
            </div>
            <button class="hbe-close-btn" id="hbe-close-btn" type="button" aria-label="Close booking window">${icon("x", 20)}</button>
          </header>
          <ol class="hbe-steps" id="hbe-steps" aria-label="Booking progress">
            <li data-step="SEARCH"><span class="hbe-step-dot">1</span><span class="hbe-step-label">Choose room</span></li>
            <li data-step="DETAILS"><span class="hbe-step-dot">2</span><span class="hbe-step-label">Guest details</span></li>
            <li data-step="CONFIRMED"><span class="hbe-step-dot">3</span><span class="hbe-step-label">Confirmed</span></li>
          </ol>
          <div class="hbe-body" id="hbe-body"></div>
          <footer class="hbe-foot">
            <a class="hbe-foot-link" href="${BRAND_URL}" target="_blank" rel="noopener noreferrer" aria-label="Powered by ${BRAND_NAME}">${BRAND_MARK}<span>Powered by <b>${BRAND_NAME}</b></span></a>
          </footer>
        </div>
      </div>
    `;

    this.shadowRoot.appendChild(container);

    this.$ = (sel) => this.shadowRoot.querySelector(sel);
    this.$("#hbe-open-btn").addEventListener("click", () => this.openModal());
    this.$("#hbe-close-btn").addEventListener("click", () => this.closeModal());
    this.$("#hbe-overlay").addEventListener("mousedown", (e) => {
      if (e.target.id === "hbe-overlay") this.closeModal();
    });
  }

  openModal() {
    this.isOpen = true;
    this._prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", this._onKey);
    this.$("#hbe-overlay").classList.add("active");
    this.updateView();
    this.$("#hbe-modal").focus({ preventScroll: true });
  }

  closeModal() {
    this.isOpen = false;
    document.body.style.overflow = this._prevOverflow || "";
    document.removeEventListener("keydown", this._onKey);
    this.$("#hbe-overlay").classList.remove("active");
    this.$("#hbe-open-btn").focus({ preventScroll: true });
  }

  updateView() {
    const body = this.$("#hbe-body");
    const title = this.$("#hbe-hotel-title");

    if (this.state.hotelMeta?.name) {
      title.textContent = this.state.hotelMeta.name;
    }

    const order = ["SEARCH", "DETAILS", "CONFIRMED"];
    const stepName =
      this.state.step === "VERIFYING" ? "DETAILS" : this.state.step;
    const current = order.indexOf(stepName);

    this.shadowRoot.querySelectorAll("#hbe-steps li").forEach((li, i) => {
      li.classList.toggle("is-active", i === current);
      li.classList.toggle("is-done", i < current);
      if (i === current) li.setAttribute("aria-current", "step");
      else li.removeAttribute("aria-current");
    });

    body.innerHTML = "";
    this.resultsEl = null;
    this.guideEl = null;

    if (this.state.error && this.state.step !== "SEARCH") {
      const err = document.createElement("div");
      err.className = "hbe-error";
      err.textContent = this.state.error;
      body.appendChild(err);
    }

    if (this.state.step === "SEARCH") {
      this.renderSearchStep(body);
    } else if (this.state.step === "DETAILS") {
      this.renderGuestStep(body);
    } else if (this.state.step === "VERIFYING") {
      this.renderVerifyingStep(body);
    } else {
      this.renderConfirmedStep(body);
    }

    if (this._lastStep !== this.state.step) {
      body.scrollTop = 0;
      if (this.isOpen && this._lastStep)
        this.$("#hbe-modal").focus({ preventScroll: true });
    }
    this._lastStep = this.state.step;
  }

  /* ───────── Step 1: Search + Rooms ───────── */

  renderSearchStep(container) {
    const searchCard = document.createElement("div");
    searchCard.className = "hbe-search hbe-card";

    const dateContainer = document.createElement("div");
    dateContainer.className = "hbe-search-dates";
    renderDatePicker(dateContainer, {
      checkIn: this.state.checkIn,
      checkOut: this.state.checkOut,
      onChange: (dates) => {
        this.state.checkIn = dates.checkIn;
        this.state.checkOut = dates.checkOut;
        this.searchRooms();
      },
    });

    const guestContainer = document.createElement("div");
    renderGuestCounter(guestContainer, {
      adults: this.state.adults,
      children: this.state.children,
      rooms: this.state.rooms,
      onChange: (guests) => {
        Object.assign(this.state, guests);
        this.searchRooms();
      },
    });

    searchCard.append(dateContainer, guestContainer);
    container.appendChild(searchCard);

    this.resultsEl = document.createElement("div");
    this.resultsEl.className = "hbe-results";
    container.appendChild(this.resultsEl);
    this.renderResults();

    this.guideEl = document.createElement("div");
    this.guideEl.className = "hbe-guide-container";
    container.appendChild(this.guideEl);

    if (this.state.hotelMeta) {
      renderPropertyGuide(this.guideEl, this.state.hotelMeta);
    }
  }

  sortedRooms() {
    const rooms = [...this.state.availableRooms];
    const price = (r) => Number(r.pricing?.totalBaseTariff) || 0;
    if (this.state.sort === "price-asc")
      rooms.sort((a, b) => price(a) - price(b));
    if (this.state.sort === "price-desc")
      rooms.sort((a, b) => price(b) - price(a));
    return rooms;
  }

  renderResults() {
    const el = this.resultsEl;
    if (!el || !el.isConnected) return;
    el.innerHTML = "";
    el.setAttribute("aria-busy", String(this.state.loading));

    if (this.state.error) {
      el.innerHTML = `<div class="hbe-alert" role="alert">${icon("alert", 18)}<div>
        <strong>We couldn’t load rooms.</strong><span>${esc(this.state.error)}</span>
        <button type="button" class="hbe-link" id="hbe-retry">Try again</button></div></div>`;
      el.querySelector("#hbe-retry").addEventListener("click", () =>
        this.searchRooms(),
      );
      return;
    }

    if (this.state.loading) {
      el.innerHTML = `
        <div class="hbe-loading-note" role="status">Checking live availability &amp; rates…</div>
        <div class="hbe-rooms-grid" aria-hidden="true">
          <div class="hbe-skeleton"></div><div class="hbe-skeleton"></div>
        </div>`;
      return;
    }

    const rooms = this.sortedRooms();
    const hasRooms = rooms.length > 0;

    if (hasRooms) {
      const head = document.createElement("div");
      head.className = "hbe-results-head";
      head.innerHTML = `
        <div>
          <span class="hbe-results-count">${plural(rooms.length, "room type")} available</span>
          <span class="hbe-results-dates">${esc(fmtDate(this.state.checkIn))} → ${esc(fmtDate(this.state.checkOut))} · ${plural(this.nights, "night")}</span>
        </div>
        <label class="hbe-sort">
          <span>Sort</span>
          <select id="hbe-sort" aria-label="Sort rooms">
            ${Object.entries(SORTS)
              .map(
                ([v, l]) =>
                  `<option value="${v}" ${v === this.state.sort ? "selected" : ""}>${l}</option>`,
              )
              .join("")}
          </select>
        </label>`;
      head.querySelector("#hbe-sort").addEventListener("change", (e) => {
        this.state.sort = e.target.value;
        this.renderResults();
      });
      el.appendChild(head);
    }

    const list = document.createElement("div");
    el.appendChild(list);

    const meta = this.state.hotelMeta;
    renderRoomCardList(list, {
      availableRooms: rooms,
      recommendedCombos: this.state.recommendedCombos,
      totalGuests: this.totalGuests,
      requestedRooms: this.state.rooms,
      nights: this.nights,
      propertyPhotos: meta?.photos || meta?.propertyPhotos || [],
      onSelectRoom: (selected) => {
        const rawAddons = selected.addOns || meta?.addOns || [];
        this.state.selectedBooking = {
          isCombo: false,
          roomTypeId: selected.roomTypeId || selected._id,
          taxPercent: selected.taxPercent,
          name: selected.name,
          photos: selected.photos,
          pricing: selected.pricing,
          addOns: rawAddons.filter((a) => a.isActive !== false),
        };

        // Analytics: View Content Event
        analytics.trackViewItem({
          roomTypeId: selected.roomTypeId || selected._id,
          roomName: selected.name,
          price: selected.pricing?.totalBaseTariff || 0,
        });

        this.goToDetails();
      },
      onSelectCombo: (combo) => {
        this.state.selectedBooking = {
          isCombo: true,
          comboId: combo.id || combo._id,
          roomTypeId: combo.roomTypeId || null,
          name: combo.title,
          totalRooms: combo.totalRooms,
          pricing: {
            totalBaseTariff: combo.totalPrice,
            avgPerNight: combo.avgPerNight,
          },
          breakdown: combo.breakdown || [],
          addOns: combo.addOns || [],
        };

        analytics.trackViewItem({
          roomTypeId: combo.id || combo._id,
          roomName: combo.title,
          price: combo.totalPrice || 0,
        });

        this.goToDetails();
      },
    });
  }

  goToDetails() {
    this.state.selectedAddOns = [];
    this.state.selectedRatePlanId = null;
    this.state.appliedPromo = null;
    this.state.promoDiscountAmount = 0;
    this.state.ratePlanDiscountAmount = 0;
    this.state.error = null;
    this.state.step = "DETAILS";
    this.updateView();

    const booking = this.state.selectedBooking;
    if (booking) {
      analytics.trackBeginCheckout({
        roomTypeId: booking.roomTypeId || booking.comboId,
        roomName: booking.name,
        value: booking.pricing?.totalBaseTariff || 0,
        nights: this.nights,
        rooms: booking.totalRooms || this.state.rooms,
      });
    }
  }

  /* ───────── Step 2: Details + Payment ───────── */

  isPayAtHotel() {
    // Same rule as the server: pay-at-hotel unless the hotel uses its own gateway
    return this.state.hotelMeta?.paymentConfig?.mode !== "HOTEL_GATEWAY";
  }

  payLabel() {
    if (this.isPayAtHotel() && this._payNow > 0) {
      return `Pay ${inr(this._payNow)} now to confirm`;
    }
    return this._total > 0
      ? `Pay ${inr(this._total)} securely`
      : "Proceed to secure payment";
  }

  renderGuestStep(container) {
    const booking = this.state.selectedBooking;
    if (!booking) {
      this.state.step = "SEARCH";
      this.updateView();
      return;
    }

    const { adults, children, checkIn, checkOut } = this.state;
    const meta = this.state.hotelMeta;

    const back = document.createElement("button");
    back.type = "button";
    back.className = "hbe-back";
    back.innerHTML = `${icon("chevL", 16)}Back to rooms`;
    back.addEventListener("click", () => {
      this.state.step = "SEARCH";
      this.updateView();
    });
    container.appendChild(back);

    const grid = document.createElement("div");
    grid.className = "hbe-checkout";
    const main = document.createElement("div");
    main.className = "hbe-checkout-main";
    const aside = document.createElement("div");
    aside.className = "hbe-checkout-aside";

    // ── Rate Plans Selection (Issue 1 & Feature Support) ──
    const activeRatePlans = (meta?.ratePlans || []).filter(
      (rp) => rp.isActive !== false,
    );
    if (activeRatePlans.length > 0 && !booking.isCombo) {
      const planSection = document.createElement("div");
      planSection.className = "hbe-card hbe-rateplans-card";
      planSection.innerHTML = `
        <div class="hbe-card-eyebrow">Rate Option</div>
        <h3 class="hbe-card-title">Choose your booking plan</h3>
        <div class="hbe-rateplan-list" style="margin-top: 12px; display: grid; gap: 8px;">
          <label class="hbe-rateplan-row ${!this.state.selectedRatePlanId ? "is-selected" : ""}" style="display: flex; align-items: flex-start; gap: 10px; padding: 12px; border: 1.5px solid var(--hbe-border, #e2e8f0); border-radius: 12px; cursor: pointer;">
            <input type="radio" name="hbe-rate-plan" value="" ${!this.state.selectedRatePlanId ? "checked" : ""} style="margin-top: 3px;" />
            <div style="flex: 1;">
              <div style="font-weight: 700; font-size: 14px;">Standard Flexible Rate</div>
              <div style="font-size: 12px; color: var(--hbe-muted, #64748b);">Standard cancellation rules apply.</div>
            </div>
            <strong style="font-size: 13px;">Standard</strong>
          </label>
          ${activeRatePlans
            .map((plan) => {
              const isSelected = this.state.selectedRatePlanId === plan._id;
              const dType =
                plan.discountType ||
                (plan.discountPercent ? "PERCENT" : "FLAT");
              const dVal =
                plan.discountValue !== undefined
                  ? plan.discountValue
                  : plan.discountPercent || plan.discountAmount || 0;
              const discLabel =
                dVal > 0
                  ? dType === "PERCENT"
                    ? `${dVal}% OFF`
                    : `₹${dVal} OFF`
                  : "";

              return `
              <label class="hbe-rateplan-row ${isSelected ? "is-selected" : ""}" style="display: flex; align-items: flex-start; gap: 10px; padding: 12px; border: 1.5px solid var(--hbe-border, #e2e8f0); border-radius: 12px; cursor: pointer;">
                <input type="radio" name="hbe-rate-plan" value="${plan._id}" ${isSelected ? "checked" : ""} style="margin-top: 3px;" />
                <div style="flex: 1;">
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="font-weight: 700; font-size: 14px;">${esc(plan.name)}</span>
                    ${plan.isNonRefundable ? '<span style="font-size: 10px; font-weight: 700; color: #b91c1c; background: #fee2e2; padding: 1px 6px; border-radius: 999px;">Non-refundable</span>' : ""}
                    ${plan.mealsIncluded ? '<span style="font-size: 10px; font-weight: 700; color: #15803d; background: #dcfce7; padding: 1px 6px; border-radius: 999px;">Breakfast Included</span>' : ""}
                  </div>
                  ${plan.description ? `<div style="font-size: 12px; color: var(--hbe-muted, #64748b); margin-top: 2px;">${esc(plan.description)}</div>` : ""}
                </div>
                ${discLabel ? `<span style="font-size: 12px; font-weight: 700; color: #15803d;">${discLabel}</span>` : ""}
              </label>
            `;
            })
            .join("")}
        </div>
      `;

      planSection
        .querySelectorAll('input[name="hbe-rate-plan"]')
        .forEach((radio) => {
          radio.addEventListener("change", (e) => {
            this.state.selectedRatePlanId = e.target.value || null;
            planSection.querySelectorAll(".hbe-rateplan-row").forEach((row) => {
              row.classList.toggle("is-selected", row.contains(e.target));
            });
            this.refreshBillingBreakdown(aside);
          });
        });

      main.appendChild(planSection);
    }

    // Guest form (validated with Turnstile)
    const formHost = document.createElement("div");
    this.guestForm = renderGuestForm(formHost, {
      initial: this._guestDraft || {},
      legal: meta?.legal || {},
      turnstileSiteKey: this.state.turnstileSiteKey,
    });
    main.appendChild(formHost);

    // Add-ons
    const rawAddOns =
      booking.addOns?.length > 0 ? booking.addOns : meta?.addOns || [];
    const availableAddOns = rawAddOns.filter((a) => a.isActive !== false);

    if (availableAddOns.length > 0) {
      const addonsContainer = document.createElement("div");
      renderAddonsList(
        addonsContainer,
        availableAddOns,
        (addon, isChecked) => {
          const addonId = addon._id || addon.code;
          if (isChecked) {
            this.state.selectedAddOns.push(addon);
          } else {
            this.state.selectedAddOns = this.state.selectedAddOns.filter(
              (a) => (a._id || a.code) !== addonId,
            );
          }
          this.refreshBillingBreakdown(aside);
        },
        this.state.selectedAddOns.map((a) => a._id || a.code),
      );
      main.appendChild(addonsContainer);
    }

    // Cancellation policy notice
    const policyHost = document.createElement("div");
    const activeSelectedPlan = (meta?.ratePlans || []).find(
      (p) => String(p._id) === String(this.state.selectedRatePlanId),
    );

    renderPolicyNotice(
      policyHost,
      activeSelectedPlan?.isNonRefundable
        ? { enabled: false }
        : meta?.cancellationPolicy,
      {
        checkInTime: meta?.checkInTime || "12:00 PM",
        payAtHotel: this.isPayAtHotel(),
        cutoffHours: meta?.cancellationPolicy?.cutoffHours ?? 12,
      },
    );
    main.appendChild(policyHost);

    // Stay summary
    const guestsText = [
      plural(adults, "adult"),
      children ? plural(children, "child", "children") : "",
    ]
      .filter(Boolean)
      .join(" · ");

    const photo =
      booking.photos?.[0] || meta?.photos?.[0] || meta?.propertyPhotos?.[0];
    const totalRoomsCount = booking.isCombo
      ? booking.totalRooms
      : this.state.rooms;

    const stay = document.createElement("section");
    stay.className = "hbe-stay hbe-card";
    stay.setAttribute("aria-label", "Your reservation");
    stay.innerHTML = `
      ${photo ? `<img class="hbe-stay-img" src="${esc(photo)}" alt="" />` : ""}
      <div class="hbe-stay-body">
        <div class="hbe-card-eyebrow">Your reservation</div>
        <h3 class="hbe-stay-title">${esc(booking.name)}</h3>
        <dl class="hbe-stay-grid">
          <div><dt>Check-in</dt><dd>${esc(fmtDate(checkIn))}</dd></div>
          <div><dt>Check-out</dt><dd>${esc(fmtDate(checkOut))}</dd></div>
          <div><dt>Guests</dt><dd>${esc(guestsText)}</dd></div>
          <div><dt>Rooms &amp; nights</dt><dd>${esc(plural(totalRoomsCount, "room"))} · ${esc(plural(this.nights, "night"))}</dd></div>
        </dl>
      </div>`;
    stay
      .querySelector(".hbe-stay-img")
      ?.addEventListener("error", (e) => e.target.remove(), { once: true });
    aside.appendChild(stay);

    const priceContainer = document.createElement("div");
    priceContainer.id = "hbe-price-container";
    aside.appendChild(priceContainer);

    const payWrap = document.createElement("div");
    payWrap.className = "hbe-pay";
    payWrap.innerHTML = `
      <div class="hbe-alert" id="hbe-pay-error" role="alert" hidden></div>
      <button class="hbe-btn-primary" id="hbe-pay-btn" type="button">${esc(this.payLabel())}</button>
      <p class="hbe-secure">${icon("lock", 14)}Payments secured by Razorpay · 256-bit SSL</p>`;

    payWrap
      .querySelector("#hbe-pay-btn")
      .addEventListener("click", () => this.handleProceedToPayment(grid));
    aside.appendChild(payWrap);

    formHost.addEventListener("submit", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleProceedToPayment(grid);
    });

    grid.append(main, aside);
    container.appendChild(grid);
    this.refreshBillingBreakdown(aside);
  }

  refreshBillingBreakdown(container) {
    const priceBox = container.querySelector("#hbe-price-container");
    if (!priceBox || !this.state.selectedBooking) return;

    const booking = this.state.selectedBooking;
    const baseTariff = Number(booking.pricing?.totalBaseTariff || 0);
    const totalRoomCount = Math.max(
      1,
      booking.isCombo ? booking.totalRooms : this.state.rooms,
    );
    const nights = Math.max(1, this.nights);

    // Compute Rate Plan Discount
    let ratePlanDiscount = 0;
    if (this.state.selectedRatePlanId) {
      const plan = (this.state.hotelMeta?.ratePlans || []).find(
        (p) => String(p._id) === String(this.state.selectedRatePlanId),
      );
      if (plan) {
        const dType =
          plan.discountType || (plan.discountPercent ? "PERCENT" : "FLAT");
        const dVal = Number(
          plan.discountValue !== undefined
            ? plan.discountValue
            : plan.discountPercent || plan.discountAmount || 0,
        );
        if (dType === "PERCENT" && dVal > 0) {
          ratePlanDiscount = Math.round((baseTariff * dVal) / 100);
        } else if (dType === "FLAT" && dVal > 0) {
          ratePlanDiscount = dVal;
        }
      }
    }
    this.state.ratePlanDiscountAmount = Math.min(baseTariff, ratePlanDiscount);

    // Calculate add-ons
    const addOnsTotal = this.state.selectedAddOns.reduce((sum, a) => {
      const price = Number(a.price) || 0;
      const qty = Number(a.quantity) || 1;
      let cost = price * qty;

      if (a.chargeType === "PER_NIGHT" || a.isPerNight) {
        cost *= nights;
      } else if (a.chargeType === "PER_GUEST_PER_NIGHT") {
        cost *= nights * this.totalGuests;
      } else if (
        a.chargeType === "PER_GUEST" ||
        a.chargeType === "PER_PERSON"
      ) {
        cost *= this.totalGuests;
      }
      return sum + cost;
    }, 0);

    const discountedRoomTariff = Math.max(
      0,
      baseTariff -
        (this.state.ratePlanDiscountAmount || 0) -
        (this.state.promoDiscountAmount || 0),
    );
    const taxableSubtotal = discountedRoomTariff + addOnsTotal;
    const taxConfig = this.state.hotelMeta?.taxConfig;
    let taxPercent = 0;

    // Keep in sync with server GST logic
    if (taxConfig?.gstEnabled) {
      if (
        booking.taxPercent !== null &&
        booking.taxPercent !== undefined &&
        !isNaN(Number(booking.taxPercent))
      ) {
        taxPercent = Number(booking.taxPercent);
      } else if (taxConfig.useSlab) {
        const avgPerNight = discountedRoomTariff / (totalRoomCount * nights);
        taxPercent =
          avgPerNight >= (taxConfig.tierThreshold || 7500)
            ? taxConfig.rateAboveThreshold || 18
            : taxConfig.rateBelowThreshold || 12;
      } else {
        taxPercent =
          taxConfig.taxPercent !== undefined
            ? Number(taxConfig.taxPercent)
            : 12;
      }
    }

    const gst = Math.round((taxableSubtotal * taxPercent) / 100);
    this._total = taxableSubtotal + gst;

    // Pay-at-hotel: only the booking fee is charged online (mirrors the server)
    if (this.isPayAtHotel()) {
      const pct = Number(
        this.state.hotelMeta?.paymentConfig?.payAtHotelCommissionPercent ?? 8,
      );
      const fee = Math.round(((taxableSubtotal * pct) / 100) * 100) / 100;
      this._payNow = Math.min(Math.max(fee, 1), this._total);
      this._dueAtHotel = Math.max(
        0,
        Math.round((this._total - this._payNow) * 100) / 100,
      );
    } else {
      this._payNow = this._total;
      this._dueAtHotel = 0;
    }

    renderPriceBreakdown(priceBox, {
      baseTariff,
      discountAmount:
        (this.state.ratePlanDiscountAmount || 0) +
        (this.state.promoDiscountAmount || 0),
      appliedPromo: this.state.appliedPromo,
      addOnsTotal,
      gst,
      taxPercent,
      rooms: totalRoomCount,
      nights,
      onApplyPromo: async (promoCode) => {
        const res = await validatePromoCode({
          slug: this.state.hotelSlug,
          promoCode,
          roomTypeId: booking.roomTypeId || null,
          subtotal: baseTariff - (this.state.ratePlanDiscountAmount || 0),
          nights,
        });

        if (res?.data) {
          this.state.appliedPromo = res.data;
          this.state.promoDiscountAmount = Number(res.data.discountAmount || 0);
          this.refreshBillingBreakdown(container);
        }
      },
      onRemovePromo: () => {
        this.state.appliedPromo = null;
        this.state.promoDiscountAmount = 0;
        this.refreshBillingBreakdown(container);
      },
    });

    // "Pay now / pay at hotel" summary under the price breakdown
    let splitNote = container.querySelector("#hbe-split-note");
    if (this.isPayAtHotel() && this._total > 0) {
      if (!splitNote) {
        splitNote = document.createElement("div");
        splitNote.id = "hbe-split-note";
        splitNote.className = "hbe-policy-card";
        priceBox.insertAdjacentElement("afterend", splitNote);
      }
      splitNote.innerHTML = `
        <div class="hbe-policy-header"><span class="hbe-policy-title">How you pay</span></div>
        <ul class="hbe-cancel-list">
          <li class="hbe-cancel-row"><span class="hbe-cancel-label">Pay now to confirm <small>(booking fee, non-refundable)</small></span><strong>${esc(inr(this._payNow))}</strong></li>
          <li class="hbe-cancel-row"><span class="hbe-cancel-label">Pay at the hotel on arrival</span><strong>${esc(inr(this._dueAtHotel))}</strong></li>
        </ul>`;
    } else if (splitNote) {
      splitNote.remove();
    }
    const btn = container.querySelector("#hbe-pay-btn");
    if (btn && !this._paying) btn.textContent = this.payLabel();
  }

  async handleProceedToPayment(root) {
    if (this._paying) return;

    const payBtn =
      root?.querySelector("#hbe-pay-btn") ||
      this.shadowRoot.querySelector("#hbe-pay-btn");
    const payErr =
      root?.querySelector("#hbe-pay-error") ||
      this.shadowRoot.querySelector("#hbe-pay-error");

    if (payErr) {
      payErr.hidden = true;
      payErr.innerHTML = "";
    }

    if (!this.guestForm) {
      console.error("[HBE] guestForm instance not initialized");
      return;
    }

    const guest = this.guestForm.validateAll();

    if (!guest) {
      if (payErr) {
        payErr.innerHTML = `${icon("alert", 18)}<div>Please complete all required fields, pass verification, and accept terms.</div>`;
        payErr.hidden = false;
      }

      const firstInvalid = this.shadowRoot.querySelector(
        ".hbe-field.is-invalid input, #hbe-form-summary, .hbe-field.is-invalid",
      );
      if (firstInvalid) {
        firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
        if (firstInvalid.tagName === "INPUT") firstInvalid.focus();
      }
      return;
    }

    const stayError = validateStay(this.state, toLocalISO(new Date()));
    const setBusy = (busy, label) => {
      this._paying = busy;
      if (payBtn) {
        payBtn.disabled = busy;
        payBtn.classList.toggle("is-loading", busy);
        payBtn.textContent = label || this.payLabel();
      }
      this.guestForm?.setBusy(busy);
    };

    const fail = (msg) => {
      console.error("[HBE Checkout Failure]:", msg);
      if (payErr) {
        payErr.innerHTML = `${icon("alert", 18)}<div>${esc(msg)}</div>`;
        payErr.hidden = false;
      }
      this.guestForm?.resetTurnstile?.();
      setBusy(false);
    };

    if (stayError) {
      fail(stayError);
      return;
    }

    this._guestDraft = {
      name: guest.name,
      email: guest.email,
      phone: guest.phone,
    };

    setBusy(true, "Securing your room…");

    const booking = this.state.selectedBooking;
    if (!booking) {
      fail("No room selected. Please go back and select a room.");
      return;
    }

    const payload = {
      checkIn: this.state.checkIn,
      checkOut: this.state.checkOut,
      adults: Number(this.state.adults) || 2,
      children: Number(this.state.children) || 0,
      guest: {
        name: guest.name,
        email: guest.email,
        phone: guest.phone,
      },
      consent: { accepted: guest.terms === true },
      turnstileToken: guest.turnstileToken || null,
      ratePlanId: this.state.selectedRatePlanId || null,
      promoCode: this.state.appliedPromo?.code || null,
      selectedAddOns: (this.state.selectedAddOns || []).map((a) => ({
        addOnId: a._id || a.code || a.addOnId,
        name: a.name,
        quantity: a.quantity || 1,
      })),
      isCombo: Boolean(booking.isCombo),
      comboId: booking.isCombo ? booking.comboId : null,
      roomTypeId: booking.isCombo ? null : booking.roomTypeId || booking._id,
      roomCount:
        Number(booking.isCombo ? booking.totalRooms : this.state.rooms) || 1,
    };

    try {
      const holdRes = await createBookingHold({
        slug: this.state.hotelSlug,
        payload,
      });

      if (!holdRes || !holdRes.data) {
        throw new Error(
          holdRes?.message || "Invalid response received from server.",
        );
      }

      const { bookingId, razorpayOrderId, razorpayKeyId, amount, bookingCode } =
        holdRes.data;

      // Remember the split so the confirmation screen can show what is due at the hotel
      this.state.paymentSplit = holdRes.data.payAtHotel
        ? { paidNow: amount, dueAtHotel: holdRes.data.amountDueAtHotel || 0 }
        : null;

      this.state.activeBookingId = bookingId;

      if (!window.Razorpay) {
        setBusy(true, "Loading payment gateway…");
        const ok = await loadRazorpayScript();
        if (!ok || !window.Razorpay) {
          fail(
            "The payment gateway couldn’t load. Check your connection and try again.",
          );
          return;
        }
      }

      setBusy(true, "Waiting for payment…");

      openRazorpayCheckout({
        hotelSlug: this.state.hotelSlug,
        bookingId,
        bookingCode,
        keyId: razorpayKeyId,
        orderId: razorpayOrderId,
        amount,
        hotelName: this.state.hotelMeta?.name || "Direct Booking",
        guest: { ...guest, phone: guest.phoneE164 || guest.phone },
        onSuccess: () => {
          this._paying = false;
          this.state.confirmedBookingCode = bookingCode;

          // Analytics: Purchase Conversion Event
          analytics.trackPurchase({
            bookingCode,
            value: amount, // what was actually charged online (booking fee for pay-at-hotel)
            roomTypeId: booking.roomTypeId || booking.comboId,
            roomName: booking.name,
          });

          this.state.step = "VERIFYING";
          this.updateView();
        },
        onDismiss: () => {
          this.state.activeBookingId = null;
          this.guestForm?.resetTurnstile?.();
          setBusy(false);
        },
        onFailure: (err) => {
          this.state.activeBookingId = null;
          if (window.Sentry) {
            window.Sentry.captureException(err, {
              tags: {
                bookingCode,
                hotelSlug: this.state.hotelSlug,
                step: "PAYMENT_FAILED",
              },
            });
          }
          fail(
            typeof err === "string"
              ? err
              : err?.message || "Payment could not be completed.",
          );
        },
      });
    } catch (err) {
      if (window.Sentry) {
        window.Sentry.captureException(err, {
          tags: {
            hotelSlug: this.state.hotelSlug,
            step: "HOLD_CREATION_FAILED",
          },
        });
      }
      fail(err.message || "We couldn’t secure your room. Please try again.");
    }
  }

  /* ───────── Step 3A: Verifying Webhook/Confirmation ───────── */

  renderVerifyingStep(container) {
    container.innerHTML = `
      <div class="hbe-card hbe-confirmed" role="status" aria-live="polite">
        <div class="hbe-spinner" aria-hidden="true"></div>
        <h3 class="hbe-confirmed-title">Securing your stay</h3>
        <p class="hbe-confirmed-text">Payment received. We’re confirming your room with the property — please don’t close this window.</p>
        <div class="hbe-code-label">Booking reference</div>
        <div class="hbe-code">${esc(this.state.confirmedBookingCode || "")}</div>
      </div>
    `;

    this.clearTimers();
    this.later(() => {
      this.state.step = "CONFIRMED";
      this.updateView();
    }, 2500);
  }

  /* ───────── Step 3B: Final Confirmation ───────── */

  renderConfirmedStep(container) {
    const booking = this.state.selectedBooking;
    const code = this.state.confirmedBookingCode || "";
    container.innerHTML = `
      <div class="hbe-card hbe-confirmed">
        <svg class="hbe-check" viewBox="0 0 52 52" aria-hidden="true">
          <circle class="hbe-check-circle" cx="26" cy="26" r="24" />
          <path class="hbe-check-mark" d="M15 27l8 8 14-16" />
        </svg>
        <h3 class="hbe-confirmed-title">Reservation confirmed</h3>
        <p class="hbe-confirmed-text">Your booking voucher is on its way to your email and WhatsApp.</p>
        <div class="hbe-code-label">Booking reference</div>
        <div class="hbe-code-row">
          <div class="hbe-code">${esc(code)}</div>
          <button class="hbe-copy" id="hbe-copy-btn" type="button" aria-label="Copy booking reference">${icon("copy", 16)}<span>Copy</span></button>
        </div>
        ${booking ? `<div class="hbe-confirmed-meta">${esc(booking.name)} · ${esc(fmtDate(this.state.checkIn))} → ${esc(fmtDate(this.state.checkOut))}</div>` : ""}
        ${this.state.paymentSplit ? `<div class="hbe-confirmed-meta">Booking fee paid: ${esc(inr(this.state.paymentSplit.paidNow))} · Pay at the hotel: <strong>${esc(inr(this.state.paymentSplit.dueAtHotel))}</strong></div>` : ""}
        <button class="hbe-btn-primary" id="hbe-finish-btn" type="button">Done</button>
      </div>
    `;

    container
      .querySelector("#hbe-copy-btn")
      .addEventListener("click", async (e) => {
        const btn = e.currentTarget;
        try {
          await navigator.clipboard.writeText(code);
          btn.querySelector("span").textContent = "Copied";
        } catch {
          btn.querySelector("span").textContent = "Press Ctrl+C";
        }
        this.later(
          () => (btn.querySelector("span").textContent = "Copy"),
          1800,
        );
      });

    container.querySelector("#hbe-finish-btn").addEventListener("click", () => {
      this.clearTimers();
      this.state.step = "SEARCH";
      this.state.selectedBooking = null;
      this.state.selectedRatePlanId = null;
      this.state.selectedAddOns = [];
      this.state.appliedPromo = null;
      this.state.promoDiscountAmount = 0;
      this.state.ratePlanDiscountAmount = 0;
      this.state.confirmedBookingCode = null;
      this.state.activeBookingId = null;
      this._guestDraft = null;
      this._total = 0;
      this._payNow = 0;
      this._dueAtHotel = 0;
      this.state.paymentSplit = null;
      this.closeModal();
      this.updateView();
      this.searchRooms();
    });
  }
}

customElements.define("hotel-booking-engine", HotelBookingEngine);
