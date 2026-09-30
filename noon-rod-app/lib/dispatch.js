// Booking and cancelling noon riders for Shopify orders.

import { TAGS } from './config.js';
import { buildTaskPayload, MappingError } from './mapping.js';
import { CANCELLABLE_STATUSES, NoonError } from './noon.js';

// A new task may be booked when none exists yet or the previous one ended without delivery.
const REBOOKABLE_STATUSES = ['', 'cancelled', 'undelivered'];

export async function dispatchOrder({ cfg, shopify, noon, log = console }, orderId) {
  const order = await shopify.getOrder(orderId);
  if (!order) return { ok: false, reason: 'order not found' };
  if (order.cancelledAt) return { ok: false, reason: `${order.name} is cancelled` };
  if (order.noon.taskNr && !REBOOKABLE_STATUSES.includes(order.noon.status)) {
    return { ok: true, already: true, taskNr: order.noon.taskNr };
  }

  let payload;
  try {
    payload = buildTaskPayload(order, cfg);
  } catch (err) {
    if (err instanceof MappingError) return fail(shopify, order, err.message, log);
    throw err;
  }

  // Same key for duplicate deliveries of the same webhook; a new key once the previous task is over.
  const idempotencyKey = `plaay-${order.legacyResourceId}-${order.noon.taskNr || 'first'}`;
  let created;
  try {
    created = await noon.createTask(payload, idempotencyKey);
  } catch (err) {
    // 4xx = noon rejected the order (out of range, no riders, bad data): show it to staff.
    if (err instanceof NoonError && err.status >= 400 && err.status < 500) return fail(shopify, order, err.message, log);
    throw err;
  }

  await shopify.setNoonState(order.id, {
    task_nr: created.mp_task_nr,
    status: 'created',
    // Clear leftovers from a previous attempt.
    ...(order.noon.error ? { error: '' } : {}),
    ...(order.noon.fulfillmentId ? { fulfillment_id: '' } : {}),
  });
  await shopify.addTags(order.id, [TAGS.dispatched]);
  await shopify.removeTags(order.id, [TAGS.dispatch, TAGS.error, TAGS.cancelled, TAGS.undelivered]);
  log.info?.(`noon task ${created.mp_task_nr} booked for ${order.name}`);
  return { ok: true, taskNr: created.mp_task_nr };
}

async function fail(shopify, order, message, log) {
  log.warn?.(`could not book noon rider for ${order.name}: ${message}`);
  await shopify.setNoonState(order.id, { error: message });
  await shopify.addTags(order.id, [TAGS.error]);
  // Drop the trigger tag so staff can re-add it once the problem is fixed.
  await shopify.removeTags(order.id, [TAGS.dispatch]);
  return { ok: false, reason: message };
}

export async function cancelDispatch({ shopify, noon, log = console }, orderIdOrOrder) {
  const order = typeof orderIdOrOrder === 'object' ? orderIdOrOrder : await shopify.getOrder(orderIdOrOrder);
  if (!order?.noon.taskNr) return { ok: false, reason: 'no noon task on this order' };

  const task = await noon.getTask(order.noon.taskNr);
  const status = task?.status_code || '';
  if (status === 'cancelled') {
    await markCancelled(shopify, order);
    return { ok: true, already: true };
  }
  if (!CANCELLABLE_STATUSES.includes(status)) {
    return { ok: false, reason: `rider task is "${status}" and can no longer be cancelled` };
  }

  await noon.cancelTask(order.noon.taskNr);
  await markCancelled(shopify, order);
  log.info?.(`noon task ${order.noon.taskNr} cancelled for ${order.name}`);
  return { ok: true };
}

async function markCancelled(shopify, order) {
  await shopify.setNoonState(order.id, { status: 'cancelled' });
  await shopify.addTags(order.id, [TAGS.cancelled]);
  await shopify.removeTags(order.id, [TAGS.dispatched, TAGS.dispatch]);
}
