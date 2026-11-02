import { inr, plural, esc } from "../utils/format.js";
import { icon } from "../utils/icons.js";

export function renderPriceBreakdown(
  container,
  {
    baseTariff,
    discountAmount = 0,
    appliedPromo = null,
    addOnsTotal = 0,
    gst = 0,
    taxPercent = 0,
    rooms = 1,
    nights = 1,
    onApplyPromo = null,
    onRemovePromo = null,
  } = {},
) {
  const discountedTariff = Math.max(0, baseTariff - discountAmount);
  const total = discountedTariff + addOnsTotal + gst;
  const detail = `${plural(rooms, "room")} × ${plural(nights, "night")}`;

  container.innerHTML = `
    <div class="hbe-card hbe-price-card" aria-live="polite">
      <div class="hbe-badge-rate">${icon("tag", 14)}Best rate · booked direct</div>

      <dl class="hbe-price-list">
        <div class="hbe-summary-row">
          <dt>Room tariff<small>${detail}</small></dt>
          <dd>${discountAmount > 0 ? `<span class="hbe-strike" style="text-decoration: line-through; opacity: 0.6; margin-right: 6px;">${inr(baseTariff)}</span>` : ""}${inr(discountedTariff)}</dd>
        </div>

        ${
          appliedPromo
            ? `
          <div class="hbe-summary-row hbe-promo-applied" style="color: #10b981; font-weight: 500;">
            <dt style="display: flex; align-items: center; gap: 4px;">
              ${icon("tag", 14)} ${esc(appliedPromo.code)}
              <button type="button" class="hbe-promo-remove-btn" id="hbe-remove-promo" title="Remove coupon" style="background: none; border: none; cursor: pointer; color: #ef4444; padding: 0 4px; font-size: 14px;">✕</button>
            </dt>
            <dd>-${inr(discountAmount)}</dd>
          </div>
        `
            : ""
        }

        ${addOnsTotal > 0 ? `<div class="hbe-summary-row"><dt>Add-ons &amp; upgrades</dt><dd>${inr(addOnsTotal)}</dd></div>` : ""}
        <div class="hbe-summary-row"><dt>Taxes &amp; GST<small>${taxPercent}%</small></dt><dd>${inr(gst)}</dd></div>
        <div class="hbe-summary-row total"><dt>Total payable</dt><dd>${inr(total)}</dd></div>
      </dl>

      ${
        !appliedPromo && onApplyPromo
          ? `
        <div class="hbe-promo-wrap" style="margin-top: 14px; padding-top: 12px; border-top: 1px dashed var(--hbe-border, #e5e7eb);">
          <div style="display: flex; gap: 6px;">
            <input type="text" id="hbe-promo-input" class="hbe-input" placeholder="Promo code" maxlength="20" style="text-transform: uppercase; flex: 1; padding: 6px 10px; font-size: 13px;" />
            <button type="button" class="hbe-btn-secondary" id="hbe-promo-apply-btn" style="padding: 6px 14px; font-size: 13px; font-weight: 600; cursor: pointer;">Apply</button>
          </div>
          <p id="hbe-promo-msg" style="margin: 4px 0 0; font-size: 12px; display: none;" aria-live="polite"></p>
        </div>
      `
          : ""
      }
    </div>`;

  // Attach event handlers
  const applyBtn = container.querySelector("#hbe-promo-apply-btn");
  const promoInput = container.querySelector("#hbe-promo-input");
  const promoMsg = container.querySelector("#hbe-promo-msg");
  const removeBtn = container.querySelector("#hbe-remove-promo");

  if (applyBtn && promoInput) {
    const handleApply = async () => {
      const code = promoInput.value.trim().toUpperCase();
      if (!code) return;

      applyBtn.disabled = true;
      applyBtn.textContent = "…";
      if (promoMsg) promoMsg.style.display = "none";

      try {
        await onApplyPromo(code);
      } catch (err) {
        if (promoMsg) {
          promoMsg.style.display = "block";
          promoMsg.style.color = "#ef4444";
          promoMsg.textContent = err.message || "Invalid promo code";
        }
      } finally {
        applyBtn.disabled = false;
        applyBtn.textContent = "Apply";
      }
    };

    applyBtn.addEventListener("click", handleApply);
    promoInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleApply();
      }
    });
  }

  if (removeBtn && onRemovePromo) {
    removeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      onRemovePromo();
    });
  }
}
