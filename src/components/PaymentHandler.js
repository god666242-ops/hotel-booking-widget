import { releaseBookingHold } from '../utils/api.js';

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

/**
 * Opens Razorpay checkout modal, releases hold immediately upon user cancellation,
 * and passes the payment response for server/webhook verification rather than premature confirmation.
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
  onSuccess,
  onFailure,
  onDismiss,
}) {
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
      // Payment authorized at Razorpay: hand over to confirmation/polling handler
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
        // Automatically release held room stock so retrying does not show 'Sold Out'
        if (hotelSlug && (bookingId || bookingCode)) {
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