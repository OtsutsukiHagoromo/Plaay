// Pure functions that turn a Shopify order (GraphQL shape, see lib/shopify.js ORDER_FIELDS)
// into a noon create-task payload.

export class MappingError extends Error {
  constructor(problems) {
    super(problems.join('; '));
    this.name = 'MappingError';
    this.problems = problems;
  }
}

// noon wants coordinates as integers: degrees x 10^7.
export function toE7(value) {
  return Math.round(Number(value) * 1e7);
}

// noon wants money as integer fils (AED x 100).
export function toFils(amount) {
  return Math.round(Number(amount) * 100);
}

// Normalise a UAE phone number to +971XXXXXXXXX. Returns '' when nothing usable is left.
export function normalizePhone(raw) {
  if (!raw) return '';
  let p = String(raw).replace(/[^\d+]/g, '');
  if (p.startsWith('00')) p = `+${p.slice(2)}`;
  if (p.startsWith('+')) return /^\+\d{8,15}$/.test(p) ? p : '';
  if (p.startsWith('971')) return `+${p}`;
  if (/^0\d{8,9}$/.test(p)) return `+971${p.slice(1)}`; // 050 123 4567, 04 123 4567
  if (/^5\d{8}$/.test(p)) return `+971${p}`; // 501234567
  return '';
}

export const DELIVERY_MODES = {
  standard: { label: 'Express', short: 'Express (on-demand)' },
  '4hr_delivery': { label: '4-hour', short: '4-hour delivery' },
};

const shippingText = (order) => `${order.shippingLine?.title || ''} ${order.shippingLine?.code || ''}`;

// Orders for noon: express (on-demand) or 4-hour shipping methods.
export function isExpressOrder(order, cfg) {
  if (!order.shippingLine) return false;
  return cfg.expressMatch.test(shippingText(order)) || cfg.fourHourMatch.test(shippingText(order));
}

// The noon delivery mode an order should use unless staff pick another one.
export function defaultDeliveryMode(order, cfg) {
  return order.shippingLine && cfg.fourHourMatch.test(shippingText(order)) ? '4hr_delivery' : 'standard';
}

export function isCashOnDelivery(order, cfg) {
  const gateways = order.paymentGatewayNames || [];
  const outstanding = Number(order.totalOutstandingSet?.shopMoney?.amount || 0);
  return outstanding > 0 && gateways.some((g) => cfg.codMatch.test(g));
}

export function buildTaskPayload(order, cfg, mode = 'standard') {
  const problems = [];
  const a = order.shippingAddress;

  if (!cfg.noon.outletCode) problems.push('NOON_OUTLET_CODE is not configured');
  if (!a) {
    throw new MappingError([...problems, 'order has no shipping address']);
  }

  const country = String(a.countryCodeV2 || '').toLowerCase();
  if (!['ae', 'sa'].includes(country)) problems.push(`noon only delivers in AE/SA, address country is "${a.countryCodeV2}"`);

  if (a.latitude == null || a.longitude == null) {
    problems.push('shipping address has no map coordinates; ask the customer for a location pin');
  }

  const phone = normalizePhone(a.phone) || normalizePhone(order.phone) || normalizePhone(order.billingAddress?.phone);
  if (!phone) problems.push('no usable customer phone number');

  const name = (a.name || [a.firstName, a.lastName].filter(Boolean).join(' ') || '').trim();
  if (!name) problems.push('no customer name on the shipping address');

  const addressText = [a.company, a.address1, a.address2, a.city, a.province].filter(Boolean).join(', ');
  if (addressText.length < 5) problems.push('shipping address text is too short');

  if (problems.length) throw new MappingError(problems);

  const payload = {
    order_reference: order.name,
    outlet_code: cfg.noon.outletCode,
    drop_off_address: {
      lat: toE7(a.latitude),
      lng: toE7(a.longitude),
      address: addressText.slice(0, 10000),
      contact_name: name.slice(0, 100),
      contact_phone_number: phone,
      country_code: country,
      ...(a.city ? { city: a.city.slice(0, 100) } : {}),
    },
    package_count: 1,
    pickup_notes: `Plaay order ${order.name} (${order.currentSubtotalLineItemsQuantity ?? '?'} items)`.slice(0, 1000),
  };

  // noon takes exactly one of cod_value / prepaid_value, and rejects a value of 0.
  if (isCashOnDelivery(order, cfg)) {
    payload.cod_value = toFils(order.totalOutstandingSet.shopMoney.amount);
  } else {
    payload.prepaid_value = toFils(order.totalPriceSet?.shopMoney?.amount || 0);
  }
  if (!payload.cod_value && !payload.prepaid_value) {
    throw new MappingError(['noon needs an order value above AED 0 (free orders can’t be booked)']);
  }

  // noon's default is on-demand; only send delivery_mode for the 4-hour service.
  if (mode === '4hr_delivery') payload.delivery_mode = '4hr_delivery';

  const note = (order.note || '').replace(/\s+/g, ' ').trim();
  if (note) payload.delivery_notes = note.slice(0, 250);

  return payload;
}
