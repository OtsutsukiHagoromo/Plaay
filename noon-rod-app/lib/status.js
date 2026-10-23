// Applies noon task status webhooks to the Shopify order.

import { TAGS } from './config.js';
import { NoonError } from './noon.js';
import { trackingUrl } from './tracking.js';

export const STATUS_LABELS = {
  created: 'Looking for a rider',
  pending_assignment: 'Looking for a rider',
  assigned: 'Rider assigned',
  arrived_at_pickup_location: 'Rider is collecting your order',
  picked_up: 'On the way',
  arrived_at_delivery: 'Rider has arrived',
  delivered: 'Delivered',
  undelivered: 'Delivery unsuccessful',
  cancelled: 'Cancelled',
};

const RANK = {
  created: 1,
  pending_assignment: 1,
  assigned: 2,
  arrived_at_pickup_location: 3,
  picked_up: 4,
  arrived_at_delivery: 5,
  delivered: 6,
  undelivered: 6,
  cancelled: 6,
};

// The webhook is only a prompt: the status we apply is read back from noon's API with our
// own key, so a forged or replayed request can't change an order, even on staging where the
// webhook can't carry our X-API-Key.
export async function handleStatusUpdate({ cfg, shopify, noon, log = console }, update) {
  const { order_nr: taskNr, order_reference: reference } = update || {};
  if (!taskNr || !reference) return { ignored: 'incomplete payload' };

  const order = await shopify.findOrderByName(reference);
  if (!order) return { ignored: `no Shopify order named ${reference}` };
  if (order.noon.taskNr && order.noon.taskNr !== taskNr) return { ignored: `stale task ${taskNr}` };

  let task;
  try {
    task = await noon.getTask(taskNr);
  } catch (err) {
    if (err instanceof NoonError && err.status >= 400 && err.status < 500) return { ignored: `unknown task ${taskNr}` };
    throw err; // noon unreachable: fail so the webhook is retried
  }
  // noon reports order_id as "<order_reference> - <task nr>". Only trust a task we didn't
  // book ourselves if it carries this order's reference.
  if (!order.noon.taskNr && !String(task?.order_id || '').startsWith(`${reference} - `)) {
    return { ignored: `task ${taskNr} does not belong to ${reference}` };
  }
  const status = task?.status_code;
  if (!status) return { ignored: 'task has no status' };
  // Webhooks can arrive out of order; never move a task backwards.
  if ((RANK[status] ?? 0) < (RANK[order.noon.status] ?? 0)) return { ignored: `out-of-order ${status}` };

  await shopify.setNoonState(order.id, { task_nr: taskNr, status });

  const ensureFulfillment = async (notifyCustomer) => {
    if (order.noon.fulfillmentId) return order.noon.fulfillmentId;
    try {
      const id = await shopify.createFulfillment(order, {
        taskNr,
        trackingUrl: trackingUrl(cfg, order.legacyResourceId),
        notifyCustomer,
      });
      await shopify.setNoonState(order.id, { fulfillment_id: id });
      order.noon.fulfillmentId = id;
      return id;
    } catch (err) {
      // e.g. staff already fulfilled it by hand; the status is still recorded above.
      log.warn?.(`could not fulfil ${order.name}: ${err.message}`);
      return '';
    }
  };

  switch (status) {
    case 'picked_up': {
      const id = await ensureFulfillment(true);
      if (id) await shopify.createFulfillmentEvent(id, 'OUT_FOR_DELIVERY', 'Picked up by noon rider');
      break;
    }
    case 'arrived_at_delivery':
      await ensureFulfillment(true);
      break;
    case 'delivered': {
      const id = await ensureFulfillment(false);
      if (id) await shopify.createFulfillmentEvent(id, 'DELIVERED', 'Delivered by noon rider');
      await shopify.addTags(order.id, [TAGS.delivered]);
      break;
    }
    case 'undelivered':
      if (order.noon.fulfillmentId) {
        await shopify.createFulfillmentEvent(order.noon.fulfillmentId, 'FAILURE', 'noon rider could not deliver');
      }
      await shopify.addTags(order.id, [TAGS.undelivered]);
      await shopify.removeTags(order.id, [TAGS.dispatched]);
      break;
    case 'cancelled':
      await shopify.addTags(order.id, [TAGS.cancelled]);
      await shopify.removeTags(order.id, [TAGS.dispatched]);
      break;
    default:
      break;
  }

  log.info?.(`${order.name}: noon task ${taskNr} -> ${status}`);
  return { ok: true, order: order.name, status };
}

// noon returns coordinates either as degrees or as degrees x 10^7.
export function toDegrees(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return null;
  return Math.abs(n) > 180 ? n / 1e7 : n;
}
