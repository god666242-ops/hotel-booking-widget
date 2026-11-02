/**
 * Lightweight client-side analytics dispatcher for Meta Pixel, GA4 & GTM.
 */
class HotelAnalytics {
  constructor() {
    this.initialized = false;
    this.metaPixelId = null;
    this.ga4MeasurementId = null;
    this.gtmId = null;
  }

  init(integrations = {}) {
    if (this.initialized) return;

    this.metaPixelId = integrations.metaPixelId?.trim() || null;
    this.ga4MeasurementId = integrations.ga4MeasurementId?.trim() || null;
    this.gtmId =
      integrations.googleTagManagerId?.trim() ||
      integrations.gtmId?.trim() ||
      null;

    if (this.metaPixelId) this.initMetaPixel(this.metaPixelId);
    if (this.ga4MeasurementId) this.initGA4(this.ga4MeasurementId);
    if (this.gtmId) this.initGTM(this.gtmId);

    this.initialized = true;
  }

  initGTM(gtmId) {
    if (typeof window === "undefined") return;

    window.dataLayer = window.dataLayer || [];
    (function (w, d, s, l, i) {
      w[l] = w[l] || [];
      w[l].push({ "gtm.start": new Date().getTime(), event: "gtm.js" });
      var f = d.getElementsByTagName(s)[0],
        j = d.createElement(s),
        dl = l != "dataLayer" ? "&l=" + l : "";
      j.async = true;
      j.src = "https://www.googletagmanager.com/gtm.js?id=" + i + dl;
      f.parentNode.insertBefore(j, f);
    })(window, document, "script", "dataLayer", gtmId);
  }

  initMetaPixel(pixelId) {
    if (typeof window === "undefined" || window.fbq) return;

    /* eslint-disable */
    !(function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () {
        n.callMethod
          ? n.callMethod.apply(n, arguments)
          : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = !0;
      n.version = "2.0";
      n.queue = [];
      t = b.createElement(e);
      t.async = !0;
      t.src = v;
      s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    })(
      window,
      document,
      "script",
      "https://connect.facebook.net/en_US/fbevents.js",
    );
    /* eslint-enable */

    window.fbq("init", pixelId);
    window.fbq("track", "PageView");
  }

  initGA4(measurementId) {
    if (typeof window === "undefined" || window.gtag) return;

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", measurementId);
  }

  trackViewItem({ roomTypeId, roomName, price, currency = "INR" }) {
    if (window.dataLayer) {
      window.dataLayer.push({
        event: "view_item",
        ecommerce: {
          currency,
          value: price,
          items: [{ item_id: roomTypeId, item_name: roomName, price }],
        },
      });
    }

    if (window.fbq && this.metaPixelId) {
      window.fbq("track", "ViewContent", {
        content_ids: [roomTypeId],
        content_name: roomName,
        content_type: "product",
        value: price,
        currency,
      });
    }

    if (window.gtag && this.ga4MeasurementId) {
      window.gtag("event", "view_item", {
        currency,
        value: price,
        items: [{ item_id: roomTypeId, item_name: roomName, price }],
      });
    }
  }

  trackBeginCheckout({
    roomTypeId,
    roomName,
    value,
    currency = "INR",
    nights,
    rooms,
  }) {
    if (window.dataLayer) {
      window.dataLayer.push({
        event: "begin_checkout",
        ecommerce: {
          currency,
          value,
          items: [
            {
              item_id: roomTypeId,
              item_name: roomName,
              price: value,
              quantity: rooms,
            },
          ],
        },
      });
    }

    if (window.fbq && this.metaPixelId) {
      window.fbq("track", "InitiateCheckout", {
        content_ids: [roomTypeId],
        content_name: roomName,
        value,
        currency,
        num_items: rooms,
      });
    }

    if (window.gtag && this.ga4MeasurementId) {
      window.gtag("event", "begin_checkout", {
        currency,
        value,
        items: [
          {
            item_id: roomTypeId,
            item_name: roomName,
            price: value,
            quantity: rooms,
          },
        ],
      });
    }
  }

  trackPurchase({
    bookingCode,
    value,
    currency = "INR",
    roomTypeId,
    roomName,
  }) {
    if (window.dataLayer) {
      window.dataLayer.push({
        event: "purchase",
        ecommerce: {
          transaction_id: bookingCode,
          value,
          currency,
          items: [{ item_id: roomTypeId, item_name: roomName, price: value }],
        },
      });
    }

    if (window.fbq && this.metaPixelId) {
      window.fbq("track", "Purchase", {
        content_ids: [roomTypeId],
        content_name: roomName,
        value,
        currency,
      });
    }

    if (window.gtag && this.ga4MeasurementId) {
      window.gtag("event", "purchase", {
        transaction_id: bookingCode,
        value,
        currency,
        items: [{ item_id: roomTypeId, item_name: roomName, price: value }],
      });
    }
  }
}

export const analytics = new HotelAnalytics();
