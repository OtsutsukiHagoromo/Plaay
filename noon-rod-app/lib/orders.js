// Grouping and search for the staff dashboard.

export const ACTIVE_STATUSES = ['created', 'pending_assignment', 'assigned', 'arrived_at_pickup_location', 'picked_up', 'arrived_at_delivery'];
export const CANCELLABLE = ['created', 'pending_assignment', 'assigned', 'arrived_at_pickup_location'];

export const VIEWS = [
  { key: 'todo', label: 'To dispatch' },
  { key: 'active', label: 'Out with rider' },
  { key: 'attention', label: 'Needs attention' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'all', label: 'All' },
];

// Which tab an order belongs in (besides "all").
export function bucket(order) {
  const s = order.noon.status;
  if (order.cancelledAt) return 'closed';
  if (s === 'delivered') return 'delivered';
  if (ACTIVE_STATUSES.includes(s)) return 'active';
  if (s === 'undelivered' || order.noon.error) return 'attention';
  if (order.displayFulfillmentStatus === 'FULFILLED') return 'closed'; // shipped some other way
  return 'todo';
}

export function countByView(orders) {
  const counts = Object.fromEntries(VIEWS.map((v) => [v.key, 0]));
  for (const o of orders) {
    counts.all++;
    const b = bucket(o);
    if (b in counts) counts[b]++;
  }
  return counts;
}

export function filterOrders(orders, view, q) {
  const needle = String(q || '').trim().toLowerCase();
  return orders.filter((o) => {
    if (view && view !== 'all' && bucket(o) !== view) return false;
    if (!needle) return true;
    const a = o.shippingAddress || {};
    // Compare phone numbers without the country code or leading 0, so 055…, +97155… and 97155… all match.
    const digits = needle.replace(/\D/g, '').replace(/^(00971|971|0)/, '');
    const hay = [o.name, a.name, a.address1, a.address2, a.city, o.noon.taskNr].join(' ').toLowerCase();
    return hay.includes(needle) || (digits.length >= 4 && String(a.phone || o.phone || '').replace(/\D/g, '').includes(digits));
  });
}

export function shopifyAdminUrl(cfg, legacyId) {
  const handle = String(cfg.shopify.shop || '').replace(/\.myshopify\.com$/, '');
  return `https://admin.shopify.com/store/${handle}/orders/${legacyId}`;
}
