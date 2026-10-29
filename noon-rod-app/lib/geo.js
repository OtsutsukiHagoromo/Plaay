// Road distance and address lookup for the Express check, on OpenStreetMap services:
//   OSRM   driving distance from the warehouse to a pin
//   Photon address search (as the shopper types) and pin -> address
// Both are free public services, so every call has a short timeout, answers are cached, and the
// caller falls back to the measured area list when they don't answer.

const OSRM = process.env.OSRM_URL || 'https://router.project-osrm.org';
const PHOTON = process.env.PHOTON_URL || 'https://photon.komoot.io';
const UAE_BBOX = '51.5,22.6,56.4,26.1';

const cache = new Map();
function remember(key, value) {
  if (cache.size > 2000) cache.delete(cache.keys().next().value);
  cache.set(key, value);
  return value;
}

async function getJSON(url, { fetchImpl = globalThis.fetch, timeoutMs = 2500 } = {}) {
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs), headers: { 'User-Agent': 'plaay-express/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Driving km from `from` to `to` ({lat, lng}), or null if the router doesn't answer.
export async function drivingKm(from, to, opts = {}) {
  const key = `d:${to.lat.toFixed(4)},${to.lng.toFixed(4)}`;
  if (cache.has(key)) return cache.get(key);
  try {
    const r = await getJSON(`${OSRM}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`, opts);
    const m = r.routes?.[0]?.distance;
    return remember(key, m == null ? null : m / 1000);
  } catch {
    return null;
  }
}

// Photon feature -> the parts of a UAE address checkout needs.
export function toAddress(f) {
  const p = f.properties || {};
  const [lng, lat] = f.geometry?.coordinates || [];
  const building = p.name && p.name !== p.street ? p.name : '';
  const street = [p.housenumber, p.street].filter(Boolean).join(' ');
  const community = p.district || p.locality || p.suburb || p.city || '';
  const emirate = String(p.state || p.city || '').replace(/^Emirate of /i, '').replace(/ Emirate$/i, '');
  return {
    label: [building, street, community].filter(Boolean).join(', ') || p.name || emirate,
    address1: [building, street].filter(Boolean).join(', ') || p.name || community,
    community,
    emirate,
    lat,
    lng,
  };
}

// Address suggestions in the UAE for what the shopper typed, nearest Dubai first.
export async function searchAddress(q, opts = {}) {
  const text = String(q || '').trim();
  if (text.length < 3) return [];
  const key = `s:${text.toLowerCase()}`;
  if (cache.has(key)) return cache.get(key);
  try {
    const r = await getJSON(`${PHOTON}/api/?q=${encodeURIComponent(text)}&lang=en&limit=6&lat=25.15&lon=55.25&bbox=${UAE_BBOX}`, opts);
    const list = (r.features || []).filter((f) => f.properties?.countrycode === 'AE').map(toAddress);
    return remember(key, list);
  } catch {
    return [];
  }
}

// Pin -> nearest address, or null.
export async function reverseAddress(lat, lng, opts = {}) {
  const key = `r:${(+lat).toFixed(4)},${(+lng).toFixed(4)}`;
  if (cache.has(key)) return cache.get(key);
  try {
    const r = await getJSON(`${PHOTON}/reverse?lat=${lat}&lon=${lng}&lang=en&limit=1`, opts);
    const f = r.features?.[0];
    return remember(key, f ? { ...toAddress(f), lat: +lat, lng: +lng } : null);
  } catch {
    return null;
  }
}

// Address text -> pin, or null (for checkout addresses that don't name a known area).
export async function geocode(text, opts = {}) {
  const list = await searchAddress(text, opts);
  return list[0] ? { lat: list[0].lat, lng: list[0].lng } : null;
}
