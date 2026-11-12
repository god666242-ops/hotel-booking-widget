import { releaseBookingHold } from '../utils/api.js';

function resolveDefaultBridgeUrl() {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PAY_BRIDGE_URL) {
    return import.meta.env.VITE_PAY_BRIDGE_URL;
  }
  if (typeof document !== 'undefined') {
    const engineScript = Array.from(document.scripts).find((s) =>
      /\/engine\.js(\?|$)/.test(s.src || '')
    );
    if (engineScript?.src) {
      return new URL('/pay-bridge.html', engineScript.src).toString();
    }
  }
  return 'https://cdn.purebook.in/pay-bridge.html';
}

export function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

async function handleHoldRelease({ hotelSlug, bookingId, bookingCode }) {
  if (!hotelSlug || (!bookingId && !bookingCode)) return;
  try {
    await releaseBookingHold({
      slug: hotelSlug,
      bookingId,
      bookingCode,
    });
  } catch (err) {
    console.warn('[Checkout] Failed to release hold on dismissal:', err.message);
  }
}

function openHostedBridgeCheckout({
  bridgeUrl,
  hotelSlug,
  bookingId,
  bookingCode,
  keyId,
  orderId,
  amount,
  hotelName,
  guest,
  themeColor,
  onSuccess,
  onFailure,
  onDismiss,
}) {
  const targetUrl = new URL(bridgeUrl, window.location.origin);
  const expectedOrigin = targetUrl.origin;

  const params = new URLSearchParams({
    keyId,
    orderId,
    amount: String(Math.round(amount * 100)),
    hotelName: hotelName || 'PureBook',
    bookingCode: bookingCode || '',
    guestName: guest?.name || '',
    guestEmail: guest?.email || '',
    guestPhone: guest?.phone || '',
    themeColor: themeColor || '#0f766e',
    parentOrigin: window.location.origin,
  });

  targetUrl.search = params.toString();

  const width = 460;
  const height = 680;
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));

  const popup = window.open(
    targetUrl.toString(),
    'purebook_razorpay_bridge',
    `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
  );

  // Fallback to full-page redirect if popup blocker prevented window.open
  if (!popup || popup.closed || typeof popup.closed === 'undefined') {
    targetUrl.searchParams.set('returnUrl', window.location.href);
    window.location.href = targetUrl.toString();
    return;
  }

  let settled = false;

  const cleanup = () => {
    window.removeEventListener('message', onMessage);
    clearInterval(closeWatcher);
  };

  const onMessage = async (event) => {
    if (event.origin !== expectedOrigin) return;
    const msg = event.data;
    if (!msg || msg.source !== 'PUREBOOK_PAY_BRIDGE') return;

    if (msg.type === 'PAYMENT_SUCCESS' && !settled) {
      settled = true;
      cleanup();
      if (typeof onSuccess === 'function') {
        onSuccess({
          razorpayPaymentId: msg.payload.razorpay_payment_id,
          razorpayOrderId: msg.payload.razorpay_order_id,
          razorpaySignature: msg.payload.razorpay_signature,
          bookingId,
          bookingCode,
        });
      }
    } else if (msg.type === 'PAYMENT_FAILED' && !settled) {
      settled = true;
      cleanup();
      await handleHoldRelease({ hotelSlug, bookingId, bookingCode });
      if (typeof onFailure === 'function') {
        onFailure(msg.error || 'Payment failed');
      }
    } else if (msg.type === 'PAYMENT_DISMISSED' && !settled) {
      settled = true;
      cleanup();
      await handleHoldRelease({ hotelSlug, bookingId, bookingCode });
      if (typeof onDismiss === 'function') {
        onDismiss();
      } else if (typeof onFailure === 'function') {
        onFailure('Payment dismissed by user');
      }
    }
  };

  window.addEventListener('message', onMessage);

  const closeWatcher = setInterval(async () => {
    if (popup.closed && !settled) {
      settled = true;
      cleanup();
      await handleHoldRelease({ hotelSlug, bookingId, bookingCode });
      if (typeof onDismiss === 'function') {
        onDismiss();
      } else if (typeof onFailure === 'function') {
        onFailure('Payment window closed');
      }
    }
  }, 500);
}

/**
 * Opens Razorpay checkout modal:
 * - For Pay-at-Hotel (platform Razorpay), routes through https://cdn.purebook.in/pay-bridge.html.
 * - For Hotel Gateway (hotel's own Razorpay), opens directly on the hotel's domain.
 */
export function openRazorpayCheckout({
  hotelSlug,
  bookingId,
  bookingCode,
  keyId,
  orderId,
  amount,
  hotelName,
  guest,
  themeColor = '#0f766e',
  payAtHotel,
  payBridgeUrl,
  onSuccess,
  onFailure,
  onDismiss,
}) {
  if (payAtHotel) {
    const resolvedBridgeUrl =
      payBridgeUrl ||
      (typeof window !== 'undefined' && window.PUREBOOK_PAY_BRIDGE_URL) ||
      resolveDefaultBridgeUrl();

    return openHostedBridgeCheckout({
      bridgeUrl: resolvedBridgeUrl,
      hotelSlug,
      bookingId,
      bookingCode,
      keyId,
      orderId,
      amount,
      hotelName,
      guest,
      themeColor,
      onSuccess,
      onFailure,
      onDismiss,
    });
  }

  const options = {
    key: keyId,
    amount: Math.round(amount * 100),
    currency: 'INR',
    name: hotelName,
    description: `Booking #${bookingCode}`,
    order_id: orderId,
    prefill: {
      name: guest?.name || '',
      email: guest?.email || '',
      contact: guest?.phone || '',
    },
    theme: {
      color: themeColor,
    },
    handler: function (response) {
      if (typeof onSuccess === 'function') {
        onSuccess({
          razorpayPaymentId: response.razorpay_payment_id,
          razorpayOrderId: response.razorpay_order_id,
          razorpaySignature: response.razorpay_signature,
          bookingId,
          bookingCode,
        });
      }
    },
    modal: {
      ondismiss: async function () {
        await handleHoldRelease({ hotelSlug, bookingId, bookingCode });

        if (typeof onDismiss === 'function') {
          onDismiss();
        } else if (typeof onFailure === 'function') {
          onFailure('Payment dismissed by user');
        }
      },
    },
  };

  const rzp = new window.Razorpay(options);
  rzp.open();
}