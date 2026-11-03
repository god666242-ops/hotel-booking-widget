/**
 * Dev-only mock backend so the widget can be previewed without the API.
 * Enabled by opening the demo page with ?mock  (e.g. http://localhost:3001/?mock)
 * Never imported by src/, so it is not part of the production bundle.
 */
const svgPhoto = (a, b, label) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 550"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="800" height="550" fill="url(#g)"/><circle cx="640" cy="130" r="64" fill="#fff" opacity=".22"/><path d="M0 430 Q200 360 400 420 T800 400 V550 H0Z" fill="#fff" opacity=".18"/><text x="40" y="500" font-family="sans-serif" font-size="34" font-weight="700" fill="#fff" opacity=".85">${label}</text></svg>`
  );

const rooms = [
  { roomTypeId: 'r1', name: 'Deluxe Garden View Room', maxOccupancy: 3, remainingUnits: 2, amenities: ['King bed', 'Free Wi-Fi', 'Balcony'], photos: [svgPhoto('#0f766e', '#134e4a', 'Deluxe Garden'), svgPhoto('#0e7490', '#164e63', 'Deluxe Bath'), svgPhoto('#15803d', '#14532d', 'Deluxe Balcony')], pricing: { totalBaseTariff: 14400 }, taxPercent: 12 },
  { roomTypeId: 'r2', name: 'Premium Pool Facing Suite', maxOccupancy: 4, remainingUnits: 1, amenities: ['Private pool access', 'Bathtub', 'Breakfast'], photos: [svgPhoto('#1d4ed8', '#1e3a8a', 'Pool Suite'), svgPhoto('#0369a1', '#0c4a6e', 'Suite Lounge')], pricing: { totalBaseTariff: 26800 }, taxPercent: 18 },
  { roomTypeId: 'r3', name: 'Standard Courtyard Room', maxOccupancy: 2, remainingUnits: 7, amenities: ['Queen bed', 'Free Wi-Fi'], photos: [svgPhoto('#b45309', '#78350f', 'Courtyard')], pricing: { totalBaseTariff: 9600 }, taxPercent: 12 },
  { roomTypeId: 'r4', name: 'Standard Deluxe Room', maxOccupancy: 2, remainingUnits: 7, amenities: ['Queen bed', 'Free Wi-Fi'], photos: [svgPhoto('#b45309', '#78350f', 'Courtyard')], pricing: { totalBaseTariff: 9600 }, taxPercent: 12 },
];

const meta = {
  name: 'Grand Palms Resort & Spa',
  checkInTime: '12:00 PM', checkOutTime: '11:00 AM',
  address: { street: 'Candolim Beach Road', city: 'Goa', landmark: '5 min walk to Candolim Beach' },
  topReasonsToBook: ['Lowest price guaranteed', 'Free late checkout (on request)', 'Complimentary welcome drink', 'Flexible date changes'],
  topAmenities: ['Infinity pool', 'Beachfront', 'Spa', 'Airport transfers', 'Free Wi-Fi'],
  languagesSpoken: ['English', 'Hindi', 'Konkani'],
  helpfulFacts: { numberOfRestaurants: 2, airportDistanceKm: 38, railwayStationDistanceKm: 12, coupleFriendly: true, petFriendly: false },
  cancellationPolicy: { enabled: true, tiers: [{ daysBeforeCheckIn: 7, refundPercent: 100 }, { daysBeforeCheckIn: 3, refundPercent: 50 }, { daysBeforeCheckIn: 0, refundPercent: 0 }] },
  faqs: [{ question: 'Is breakfast included?', answer: 'Yes, a full buffet breakfast is included with every room.' }, { question: 'Is there airport pickup?', answer: 'Yes, at ₹1,800 one way. Please request it in special requests.' }],
  propertyPolicies: ['Valid government photo ID required at check-in.', 'Outside food is not permitted.', 'Quiet hours 11 PM – 7 AM.'],
  announcement: { enabled: true, text: 'Monsoon offer: stay 3 nights and get a complimentary spa session.' },
  taxConfig: { gstEnabled: true, useSlab: true, tierThreshold: 7500, rateAboveThreshold: 18, rateBelowThreshold: 12 },
  addOns: [
    { _id: 'a1', name: 'Airport transfer', description: 'Private cab, one way', price: 1800, chargeType: 'FLAT' },
    { _id: 'a2', name: 'Candlelight dinner', description: 'Beach-side, per guest', price: 1500, chargeType: 'PER_GUEST' },
    { _id: 'a3', name: 'Extra bed', price: 900, chargeType: 'PER_NIGHT' },
  ],
  photos: [],
};

const json = (body, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

const realFetch = window.fetch.bind(window);
window.fetch = (url, opts = {}) => {
  const u = String(url);
  if (!u.includes('/api/v1/public/')) return realFetch(url, opts);
  if (u.includes('/meta')) return json({ data: meta });
  if (u.includes('/availability')) {
    const q = new URL(u).searchParams;
    const nights = Math.max(1, Math.round((new Date(q.get('checkOut')) - new Date(q.get('checkIn'))) / 864e5));
    const guests = Number(q.get('adults')) + Number(q.get('children'));
    const scale = nights / 3;
    const fit = rooms.filter((r) => r.maxOccupancy >= guests).map((r) => ({ ...r, pricing: { totalBaseTariff: Math.round(r.pricing.totalBaseTariff * scale) } }));
    const combos = guests > 4 ? [{ id: 'c1', title: '2 × Deluxe + 1 × Standard', totalRooms: 3, totalCapacity: 8, totalPrice: Math.round(38400 * scale), avgPerNight: 12800, breakdown: [{ quantity: 2, name: 'Deluxe Garden View Room', maxOccupancyEach: 3 }, { quantity: 1, name: 'Standard Courtyard Room', maxOccupancyEach: 2 }] }] : [];
    return new Promise((r) => setTimeout(() => r(json({ data: { availableRooms: fit, recommendedCombos: combos } })), 700));
  }
  if (u.endsWith('/hold')) return json({ data: { bookingId: 'b_1', bookingCode: 'GP-7K2Q9X', razorpayOrderId: 'order_mock', razorpayKeyId: 'rzp_test_mock', amount: 1 } });
  return json({ data: {} });
};

// Fake Razorpay: auto-succeeds after a moment
window.Razorpay = function (opts) {
  return { open: () => setTimeout(() => opts.handler({ razorpay_payment_id: 'pay_mock', razorpay_order_id: 'order_mock', razorpay_signature: 'sig' }), 600), on: () => {} };
};
