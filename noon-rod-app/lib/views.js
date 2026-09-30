// Server-rendered HTML for the staff dashboard and the customer tracking page.

import { isCashOnDelivery } from './mapping.js';

const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const BASE_CSS = `
  :root { --navy: #081D48; --bg: #f7f5f0; --card: #fff; --muted: #5b6478; --line: #e4e0d6; --ok: #1f7a4d; --warn: #b45309; --bad: #b42318; }
  @media (prefers-color-scheme: dark) {
    :root { --navy: #c9d4f2; --bg: #0e1424; --card: #172036; --muted: #9aa4bd; --line: #26314d; --ok: #5fd39a; --warn: #f5b25c; --bad: #ff8a80; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; font: 15px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; background: var(--bg); color: var(--navy); }
  main { max-width: 1100px; margin: 0 auto; padding: 24px 16px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .muted { color: var(--muted); font-size: 13px; }
`;

function money(set) {
  const m = set?.shopMoney;
  return m ? `${m.currencyCode} ${Number(m.amount).toFixed(2)}` : '';
}

function statusBadge(order, labels) {
  if (order.cancelledAt) return '<span class="b bad">Order cancelled</span>';
  if (order.noon.error && !order.noon.taskNr) return '<span class="b bad">Booking failed</span>';
  const s = order.noon.status;
  if (!s) return '<span class="b">Not dispatched</span>';
  const tone = s === 'delivered' ? 'ok' : ['undelivered', 'cancelled'].includes(s) ? 'bad' : 'warn';
  return `<span class="b ${tone}">${esc(labels[s] || s)}</span>`;
}

function actions(order) {
  if (order.cancelledAt) return '';
  const s = order.noon.status;
  const form = (action, label, cls = '') =>
    `<form method="post"><input type="hidden" name="order" value="${esc(order.legacyResourceId)}"><input type="hidden" name="action" value="${action}"><button class="${cls}" ${action === 'cancel' ? `onclick="return confirm('Cancel the noon rider for ${esc(order.name)}? Cancellations on production are charged.')"` : ''}>${label}</button></form>`;
  if (!order.noon.taskNr || ['cancelled', 'undelivered'].includes(s)) return form('dispatch', order.noon.taskNr ? 'Book again' : 'Dispatch');
  if (['created', 'pending_assignment', 'assigned', 'arrived_at_pickup_location'].includes(s)) return form('cancel', 'Cancel rider', 'ghost');
  return '';
}

export function renderDashboard({ orders, cfg, flash, labels }) {
  const env = cfg.noon.baseUrl.includes('noonstg') ? 'STAGING' : 'PRODUCTION';
  const rows = orders
    .map((o) => {
      const a = o.shippingAddress || {};
      const pay = isCashOnDelivery(o, cfg) ? `COD ${money(o.totalOutstandingSet)}` : `Prepaid ${money(o.totalPriceSet)}`;
      return `<tr>
        <td data-l="Order"><strong>${esc(o.name)}</strong><div class="muted">${esc(new Date(o.createdAt).toLocaleString('en-GB', { timeZone: 'Asia/Dubai', dateStyle: 'short', timeStyle: 'short' }))}</div></td>
        <td data-l="Customer">${esc(a.name)}<div class="muted">${esc([a.address1, a.city].filter(Boolean).join(', '))}${a.latitude == null ? ' · <b class="bad-t">no map pin</b>' : ''}</div></td>
        <td data-l="Payment">${esc(pay)}</td>
        <td data-l="Rider">${statusBadge(o, labels)}${o.noon.taskNr ? `<div class="muted">Task ${esc(o.noon.taskNr)}</div>` : ''}${o.noon.error ? `<div class="err">${esc(o.noon.error)}</div>` : ''}</td>
        <td data-l="">${actions(o)}</td>
      </tr>`;
    })
    .join('');

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Plaay Express Dispatch</title><meta http-equiv="refresh" content="60">
<style>${BASE_CSS}
  header { display: flex; justify-content: space-between; align-items: end; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
  .env { font-size: 12px; font-weight: 700; padding: 3px 8px; border-radius: 99px; border: 1px solid currentColor; color: ${env === 'STAGING' ? 'var(--warn)' : 'var(--ok)'}; }
  .flash { background: var(--card); border: 1px solid var(--line); border-left: 4px solid var(--navy); padding: 10px 12px; border-radius: 8px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; background: var(--card); border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
  th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--line); vertical-align: top; }
  th { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
  .b { display: inline-block; font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 99px; background: var(--line); }
  .b.ok { color: var(--ok); } .b.warn { color: var(--warn); } .b.bad { color: var(--bad); } .bad-t { color: var(--bad); }
  .err { color: var(--bad); font-size: 13px; margin-top: 4px; max-width: 320px; }
  button { font: inherit; font-weight: 600; padding: 7px 14px; border-radius: 8px; border: 1px solid var(--navy); background: var(--navy); color: var(--bg); cursor: pointer; }
  button.ghost { background: transparent; color: var(--navy); }
  form { margin: 0; }
  @media (max-width: 720px) {
    thead { display: none; } table, tbody, tr, td { display: block; width: 100%; }
    tr { border-bottom: 1px solid var(--line); padding: 8px 0; } td { border: 0; padding: 4px 12px; }
    td[data-l]:not([data-l=""])::before { content: attr(data-l); display: block; font-size: 11px; text-transform: uppercase; color: var(--muted); }
  }
</style></head><body><main>
<header><div><h1>Express delivery dispatch</h1><div class="muted">Orders tagged <code>noon-express</code>. Pack first, then press Dispatch: a rider arrives within minutes.</div></div><span class="env">noon ${env}</span></header>
${flash ? `<div class="flash">${esc(flash)}</div>` : ''}
<table><thead><tr><th>Order</th><th>Customer</th><th>Payment</th><th>Rider</th><th></th></tr></thead>
<tbody>${rows || '<tr><td colspan="5" class="muted">No express orders yet.</td></tr>'}</tbody></table>
<p class="muted">Pickup point <code>${esc(cfg.noon.outletCode || 'not set')}</code> · refreshes every minute</p>
</main></body></html>`;
}

export function renderTrackingPage({ token }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Track your Plaay order</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css">
<style>${BASE_CSS}
  main { max-width: 560px; }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 18px; margin-top: 16px; }
  #status { font-size: 24px; font-weight: 700; margin: 4px 0; }
  #map { height: 320px; border-radius: 12px; margin-top: 16px; display: none; }
  .steps { display: flex; gap: 6px; margin-top: 14px; } .steps i { flex: 1; height: 6px; border-radius: 3px; background: var(--line); } .steps i.on { background: var(--navy); }
  a.call { display: inline-block; margin-top: 12px; font-weight: 600; color: var(--navy); }
</style></head><body><main>
<div class="muted">Plaay · Express delivery by noon</div>
<div class="card"><div class="muted" id="order">Loading…</div><div id="status">&nbsp;</div><div class="muted" id="rider"></div>
<div class="steps"><i></i><i></i><i></i><i></i></div><div id="call"></div><div id="map"></div></div>
<p class="muted">This page updates by itself.</p>
</main>
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
<script>
  const token = ${JSON.stringify(token)};
  const stage = { created: 1, pending_assignment: 1, assigned: 2, arrived_at_pickup_location: 2, picked_up: 3, arrived_at_delivery: 3, delivered: 4 };
  let map, riderMarker, dropMarker;
  async function refresh() {
    let d;
    try { const r = await fetch('/api/track-data?t=' + encodeURIComponent(token)); if (!r.ok) return; d = await r.json(); } catch { return; }
    document.getElementById('order').textContent = 'Order ' + d.order;
    document.getElementById('status').textContent = d.label;
    document.getElementById('rider').textContent = d.rider ? d.rider.name + ' is your rider' : '';
    document.querySelectorAll('.steps i').forEach((el, i) => el.classList.toggle('on', i < (stage[d.status] || 0)));
    const call = document.getElementById('call');
    call.innerHTML = '';
    if (d.rider && d.rider.phone) { const a = document.createElement('a'); a.className = 'call'; a.href = 'tel:' + d.rider.phone; a.textContent = 'Call your rider'; call.appendChild(a); }
    const pts = [];
    if (d.drop && d.drop.lat) pts.push([d.drop.lat, d.drop.lng]);
    const riderPt = d.rider && d.rider.lat && d.status !== 'delivered' ? [d.rider.lat, d.rider.lng] : null;
    if (riderPt) pts.push(riderPt);
    if (!pts.length || !window.L) return;
    const el = document.getElementById('map');
    if (!map) {
      el.style.display = 'block';
      map = L.map(el, { zoomControl: false }).setView(pts[0], 14);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map);
    }
    if (d.drop && d.drop.lat) { dropMarker = dropMarker || L.marker([d.drop.lat, d.drop.lng], { title: 'You' }).addTo(map); }
    if (riderPt) {
      if (!riderMarker) riderMarker = L.circleMarker(riderPt, { radius: 9, color: '#081D48', fillColor: '#f5b400', fillOpacity: 1, weight: 3 }).addTo(map);
      riderMarker.setLatLng(riderPt);
    } else if (riderMarker) { riderMarker.remove(); riderMarker = null; }
    if (pts.length > 1) map.fitBounds(pts, { padding: [40, 40], maxZoom: 16 });
  }
  refresh();
  setInterval(refresh, 20000);
</script></body></html>`;
}
