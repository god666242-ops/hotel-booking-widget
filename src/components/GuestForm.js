import { esc } from "../utils/format.js";
import { icon } from "../utils/icons.js";
import {
  LIMITS,
  validateName,
  validateEmail,
  validatePhone,
  validateTerms,
  cleanPhoneDigits,
} from "../utils/validators.js";

const FIELDS = ["name", "email", "phone", "terms", "turnstile"];
const COUNTRY_CODE = "+91"; // fixed: India only (display only)

/** Only https links from our own API reach the page; anything else is dropped. */
function safeLink(url, label) {
  return /^https:\/\//i.test(url || "")
    ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`
    : label;
}

/**
 * Loads the Cloudflare Turnstile script dynamically if not already loaded on window.
 */
function ensureTurnstileScript() {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.turnstile) return Promise.resolve(window.turnstile);

  if (window.__turnstilePromise) return window.__turnstilePromise;

  window.__turnstilePromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(
      'script[src*="turnstile/v0/api.js"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(window.turnstile));
      existing.addEventListener("error", reject);
      return;
    }

    const script = document.createElement("script");
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.turnstile);
    script.onerror = () => {
      console.warn("[Turnstile] Failed to load challenge script.");
      resolve(null);
    };
    document.head.appendChild(script);
  });

  return window.__turnstilePromise;
}

export function renderGuestForm(
  container,
  { initial = {}, onChange, legal = {}, turnstileSiteKey = "" } = {},
) {
  const activeSiteKey =
    turnstileSiteKey ||
    (typeof import.meta !== "undefined" &&
      import.meta.env?.VITE_TURNSTILE_SITE_KEY) ||
    (typeof process !== "undefined" &&
      process.env?.NEXT_PUBLIC_TURNSTILE_SITE_KEY) ||
    "";

  container.innerHTML = `
    <form class="hbe-card hbe-form" id="hbe-guest-form" novalidate autocomplete="on" aria-labelledby="hbe-form-title">
      <div class="hbe-form-head">
        <div class="hbe-card-eyebrow">Step 2 of 3</div>
        <h3 class="hbe-card-title" id="hbe-form-title">Guest details</h3>
        <p class="hbe-card-lead">We’ll send your confirmation and voucher here.</p>
      </div>

      <div class="hbe-alert hbe-form-summary" id="hbe-form-summary" role="alert" hidden></div>

      <div class="hbe-field" data-field="name">
        <label for="hbe-guest-name">Full name <abbr title="required" aria-hidden="true">*</abbr></label>
        <div class="hbe-control">
          ${icon("user", 18, "hbe-control-ico")}
          <input type="text" id="hbe-guest-name" name="name" class="hbe-input" placeholder="As on government ID"
            autocomplete="name" maxlength="${LIMITS.nameMax + 20}" required aria-describedby="hbe-err-name" value="${esc(initial.name || "")}" />
        </div>
        <p class="hbe-field-error" id="hbe-err-name" data-for="name" aria-live="polite"></p>
      </div>

      <div class="hbe-grid-2">
        <div class="hbe-field" data-field="email">
          <label for="hbe-guest-email">Email <abbr title="required" aria-hidden="true">*</abbr></label>
          <div class="hbe-control">
            ${icon("mail", 18, "hbe-control-ico")}
            <input type="email" id="hbe-guest-email" name="email" class="hbe-input" placeholder="you@example.com"
              autocomplete="email" inputmode="email" autocapitalize="off" spellcheck="false" required
              aria-describedby="hbe-err-email" value="${esc(initial.email || "")}" />
          </div>
          <p class="hbe-field-error" id="hbe-err-email" data-for="email" aria-live="polite"></p>
        </div>

        <div class="hbe-field" data-field="phone">
          <label for="hbe-guest-phone">Mobile / WhatsApp <abbr title="required" aria-hidden="true">*</abbr></label>
          <div class="hbe-control hbe-phone">
            <span class="hbe-cc-fixed" aria-hidden="true">${COUNTRY_CODE}</span>
            <input type="tel" id="hbe-guest-phone" name="phone" class="hbe-input" placeholder="98765 43210"
              autocomplete="tel-national" inputmode="numeric" maxlength="15" required
              aria-describedby="hbe-err-phone" value="${esc(initial.phone || "")}" />
          </div>
          <p class="hbe-field-error" id="hbe-err-phone" data-for="phone" aria-live="polite"></p>
        </div>
      </div>

      <div class="hbe-field hbe-terms" data-field="terms">
        <label class="hbe-check-row" for="hbe-guest-terms">
          <input type="checkbox" id="hbe-guest-terms" name="terms" aria-describedby="hbe-err-terms" required />
          <span>I’ve reviewed the cancellation policy and property rules, and I agree to the ${safeLink(legal.termsUrl, "booking terms")} and ${safeLink(legal.privacyUrl, "privacy policy")}.</span>
        </label>
        <p class="hbe-field-error" id="hbe-err-terms" data-for="terms" aria-live="polite"></p>
      </div>

      <div class="hbe-field hbe-turnstile" data-field="turnstile" ${!activeSiteKey ? 'style="display:none;"' : ""}>
        <div id="hbe-turnstile-container" class="hbe-turnstile-target"></div>
        <p class="hbe-field-error" id="hbe-err-turnstile" data-for="turnstile" aria-live="polite"></p>
      </div>
    </form>
  `;

  const $ = (s) => container.querySelector(s);
  const form = $("#hbe-guest-form");
  const summary = $("#hbe-form-summary");
  const els = {
    name: $("#hbe-guest-name"),
    email: $("#hbe-guest-email"),
    phone: $("#hbe-guest-phone"),
    terms: $("#hbe-guest-terms"),
  };
  const touched = new Set();
  let busy = false;
  let turnstileToken = "";
  let turnstileWidgetId = null;

  // Mount Turnstile Challenge if key is provided
  if (activeSiteKey) {
    ensureTurnstileScript().then((ts) => {
      const target = container.querySelector("#hbe-turnstile-container");
      if (ts && target) {
        try {
          turnstileWidgetId = ts.render(target, {
            sitekey: activeSiteKey,
            theme: "auto",
            callback: (token) => {
              turnstileToken = token;
              touched.add("turnstile");
              check("turnstile");
              onChange?.();
            },
            "error-callback": () => {
              turnstileToken = "";
              check("turnstile", { force: true });
            },
            "expired-callback": () => {
              turnstileToken = "";
              check("turnstile", { force: true });
            },
          });
        } catch (err) {
          console.warn("[Turnstile render error]:", err);
        }
      }
    });
  }

  const run = {
    name: () => validateName(els.name.value),
    email: () => validateEmail(els.email.value),
    phone: () => validatePhone(els.phone.value),
    terms: () => validateTerms(els.terms.checked),
    turnstile: () => {
      if (!activeSiteKey) return { ok: true, value: "" };
      if (!turnstileToken) {
        return {
          ok: false,
          error: "Please complete the security check to continue.",
        };
      }
      return { ok: true, value: turnstileToken };
    },
  };

  function paint(field, result) {
    const errEl = container.querySelector(
      `.hbe-field-error[data-for="${field}"]`,
    );
    const wrap = container.querySelector(`.hbe-field[data-field="${field}"]`);
    if (!errEl || !wrap) return;

    const showErr = !result.ok;
    const hint = result.ok && result.suggestion;

    if (showErr) {
      errEl.textContent = result.error;
      errEl.classList.remove("is-hint");
    } else if (hint) {
      errEl.innerHTML = `Did you mean <button type="button" class="hbe-link" data-fix="${esc(result.suggestion)}">${esc(result.suggestion)}</button>?`;
      errEl.classList.add("is-hint");
    } else {
      errEl.textContent = "";
      errEl.classList.remove("is-hint");
    }

    if (els[field]) {
      if (showErr) els[field].setAttribute("aria-invalid", "true");
      else els[field].removeAttribute("aria-invalid");
    }

    wrap.classList.toggle("is-invalid", showErr);
    wrap.classList.toggle(
      "is-valid",
      result.ok &&
        !hint &&
        touched.has(field) &&
        field !== "terms" &&
        field !== "turnstile",
    );
  }

  function check(field, { force = false } = {}) {
    const r = run[field]();
    if (force || touched.has(field)) paint(field, r);
    if (!summary.hidden) refreshSummary();
    return r;
  }

  /** Keeps the error banner in sync as the guest fixes fields */
  function refreshSummary() {
    const errs = FIELDS.map((f) => ({ field: f, r: run[f]() }))
      .filter((x) => !x.r.ok)
      .map((x) => ({ field: x.field, error: x.r.error }));
    updateSummary(errs);
  }

  function updateSummary(errors) {
    if (!errors.length) {
      summary.hidden = true;
      summary.innerHTML = "";
      return;
    }
    summary.hidden = false;
    summary.innerHTML = `${icon("alert", 18)}<div><strong>Please fix ${errors.length === 1 ? "this field" : `these ${errors.length} fields`}:</strong>
      <ul>${errors.map((e) => `<li><button type="button" class="hbe-link" data-jump="${e.field}">${esc(e.error)}</button></li>`).join("")}</ul></div>`;
  }

  // ── Input shaping ──
  els.phone.addEventListener("input", () => {
    const pos = els.phone.selectionStart;
    const cleaned = els.phone.value.replace(/[^\d+\s()-]/g, "");
    if (cleaned !== els.phone.value) els.phone.value = cleaned;
    if (pos != null) els.phone.setSelectionRange(pos, pos);
    check("phone");
  });
  els.phone.addEventListener("paste", (e) => {
    const text = (e.clipboardData || window.clipboardData)?.getData("text");
    if (!text) return;
    e.preventDefault();
    els.phone.value = cleanPhoneDigits(text);
    touched.add("phone");
    check("phone");
  });

  ["name", "email", "phone", "terms"].forEach((f) => {
    const el = els[f];
    const evt = f === "terms" ? "change" : "blur";
    el.addEventListener(evt, () => {
      touched.add(f);
      check(f, { force: true });
    });
    if (f !== "phone") el.addEventListener("input", () => check(f));
    el.addEventListener("input", () => onChange?.());
  });

  // trim on blur
  els.email.addEventListener("blur", () => {
    els.email.value = els.email.value.trim();
  });
  els.name.addEventListener("blur", () => {
    els.name.value = els.name.value.replace(/\s+/g, " ").trim();
  });

  // email suggestion apply + error summary jump links
  container.addEventListener("click", (e) => {
    const fix = e.target.closest?.("[data-fix]");
    if (fix) {
      els.email.value = fix.dataset.fix;
      touched.add("email");
      check("email", { force: true });
      els.email.focus();
      return;
    }
    const jump = e.target.closest?.("[data-jump]");
    if (jump) {
      if (jump.dataset.jump === "turnstile") {
        container
          .querySelector("#hbe-turnstile-container")
          ?.scrollIntoView({ behavior: "smooth" });
      } else {
        els[jump.dataset.jump]?.focus();
      }
    }
  });

  form.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.matches("input:not([type=checkbox])")) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  return {
    validateAll() {
      const errors = [];
      const values = {};
      FIELDS.forEach((f) => {
        touched.add(f);
        const r = run[f]();
        paint(f, r);
        if (!r.ok) errors.push({ field: f, error: r.error });
        else values[f] = r.value;
      });
      updateSummary(errors);
      if (errors.length) {
        if (els[errors[0].field]) {
          els[errors[0].field].focus();
        } else if (errors[0].field === "turnstile") {
          container
            .querySelector("#hbe-turnstile-container")
            ?.scrollIntoView({ behavior: "smooth" });
        }
        return null;
      }
      return {
        name: values.name,
        email: values.email,
        phone: values.phone,
        terms: values.terms === true,
        phoneE164: run.phone().e164,
        turnstileToken: values.turnstile || "",
      };
    },
    resetTurnstile() {
      turnstileToken = "";
      if (window.turnstile && turnstileWidgetId !== null) {
        try {
          window.turnstile.reset(turnstileWidgetId);
        } catch (_) {}
      }
    },
    setBusy(b) {
      busy = b;
      form.setAttribute("aria-busy", String(b));
      form.querySelectorAll("input").forEach((el) => {
        el.disabled = b;
      });
    },
    get isBusy() {
      return busy;
    },
  };
}
