// Signed, unguessable customer tracking links: /track/<orderId>.<signature>

import crypto from 'node:crypto';

function signature(secret, orderId) {
  return crypto.createHmac('sha256', secret).update(`track:${orderId}`).digest('base64url').slice(0, 22);
}

export function trackingToken(secret, orderId) {
  if (!secret) throw new Error('TRACKING_SECRET is not set');
  return `${orderId}.${signature(secret, orderId)}`;
}

// Returns the numeric order id, or null when the token is missing or forged.
export function verifyTrackingToken(secret, token) {
  if (!secret || typeof token !== 'string') return null;
  const [orderId, sig] = token.split('.');
  if (!/^\d+$/.test(orderId || '') || !sig) return null;
  const expected = Buffer.from(signature(secret, orderId));
  const given = Buffer.from(sig);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given) ? orderId : null;
}

export function trackingUrl(cfg, orderId) {
  if (!cfg.appUrl || !cfg.trackingSecret) return '';
  return `${cfg.appUrl}/track/${trackingToken(cfg.trackingSecret, orderId)}`;
}
