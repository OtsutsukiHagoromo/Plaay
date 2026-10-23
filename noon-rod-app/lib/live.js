// Live delivery picture for the staff order page: positions, timings and ETAs from noon's
// task details. Pure functions, so they can be tested without noon.

import { STATUS_LABELS, toDegrees } from './status.js';

// noon times are UTC without a zone: "2026-10-23 12:17:02.000000" or "2026-10-23T12:16:35".
export function noonTime(value) {
  if (!value) return null;
  const iso = String(value).trim().replace(' ', 'T').replace(/(\.\d{3})\d+$/, '$1');
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// noon's "late" is a signed duration against its target for that stage: "-00:01:34.000000"
// means 1 min 34 s early. Returns seconds (positive = late) or null.
export function lateSeconds(value) {
  const m = /^(-)?(\d+):(\d\d):(\d\d)/.exec(String(value || ''));
  if (!m) return null;
  const secs = Number(m[2]) * 3600 + Number(m[3]) * 60 + Number(m[4]);
  return m[1] ? -secs : secs;
}

const point = (loc) => {
  const lat = toDegrees(loc?.latitude);
  const lng = toDegrees(loc?.longitude);
  return lat != null && lng != null ? { lat, lng } : null;
};

const FINISHED = ['delivered', 'undelivered', 'cancelled'];

export function buildLive(order, task, now = new Date()) {
  const status = task?.status_code || order.noon.status || '';
  const stages = {};
  for (const u of task?.da_updates || []) {
    const at = noonTime(u.time);
    if (u.status && at) stages[u.status] = { at: at.toISOString(), late: lateSeconds(u.late) };
  }
  const dispatchedAt = noonTime(task?.created_at)?.toISOString() || null;
  const prox = task?.da_details?.proximity;
  const eta = (est) => (est && Number.isFinite(est.duration) ? { seconds: Math.round(est.duration), meters: Math.round(est.distance), at: new Date(now.getTime() + est.duration * 1000).toISOString() } : null);
  const beforePickup = ['created', 'pending_assignment', 'assigned', 'arrived_at_pickup_location'].includes(status);
  const onTheWay = ['picked_up', 'arrived_at_delivery'].includes(status);

  return {
    status,
    label: STATUS_LABELS[status] || (order.noon.taskNr ? status : 'Not dispatched'),
    finished: FINISHED.includes(status),
    now: now.toISOString(),
    placedAt: order.createdAt,
    dispatchedAt,
    stages,
    rider: task?.da_details && !FINISHED.includes(status)
      ? { name: task.da_details.name || task.da_details.first_name || 'Rider', phone: task.da_details.phone_number || null, pos: point(task.da_details.location) }
      : null,
    warehouse: point(task?.restaurant_details?.location),
    customer: point(task?.customer_details?.location) || point(order.shippingAddress),
    // Only the ETA that is still ahead of the rider.
    etaPickup: beforePickup && status !== 'arrived_at_pickup_location' ? eta(prox?.pickup) : null,
    etaCustomer: beforePickup || onTheWay ? eta(prox?.drop_off) : null,
  };
}
