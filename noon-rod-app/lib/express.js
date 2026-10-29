// Which delivery speed an address gets, and when it arrives. One rule set for the website
// (product page, cart, area picker) and for Shopify checkout rates (carrier-calculated shipping).
//
//   express   within EXPRESS_MAX_KM driving of the warehouse: noon on-demand rider, ~2 hours
//   4hr       the rest of Dubai: noon 4-hour delivery
//   standard  everywhere else in the UAE: 1–2 working days
//
// Driving distance is estimated as straight-line distance x ROAD_FACTOR until the area list is
// measured with a routing service. Express and 4-hour run Mon–Sat until the cutoff (5 pm Dubai);
// orders after that go out on the next working day.

// [name, lat, lng, extra words that identify it in an address]
export const AREAS = [
  ['Dubai Investments Park 1', 25.0, 55.16, ['dip 1', 'dip1', 'investment park 1', 'green community']],
  ['Dubai Investments Park 2', 24.978, 55.188, ['dip 2', 'dip2', 'investment park 2', 'dubai investments park', 'dubai investment park']],
  ['Expo City Dubai', 24.963, 55.15, ['expo city', 'expo 2020']],
  ['Dubai South', 24.89, 55.16, ['dubai south', 'emaar south', 'dubai world central', 'dwc']],
  ['Jebel Ali', 25.0, 55.11, ['jebel ali', 'jafza']],
  ['Al Furjan', 25.026, 55.145, ['furjan']],
  ['Discovery Gardens', 25.04, 55.14, ['discovery gardens']],
  ['The Gardens', 25.043, 55.133, ['jebel ali gardens', 'the gardens']],
  ['Jumeirah Park', 25.045, 55.157, ['jumeirah park']],
  ['Jumeirah Islands', 25.058, 55.159, ['jumeirah islands']],
  ['Jumeirah Golf Estates', 25.02, 55.2, ['jumeirah golf', 'jge']],
  ['Jumeirah Lake Towers (JLT)', 25.069, 55.141, ['jlt', 'jumeirah lake towers', 'jumeirah lakes towers']],
  ['Dubai Marina', 25.08, 55.14, ['marina']],
  ['JBR', 25.078, 55.133, ['jbr', 'jumeirah beach residence']],
  ['Bluewaters', 25.08, 55.12, ['bluewaters', 'blue waters']],
  ['Dubai Harbour', 25.09, 55.14, ['dubai harbour', 'emaar beachfront']],
  ['Emirates Hills', 25.069, 55.168, ['emirates hills']],
  ['The Springs', 25.054, 55.18, ['the springs', 'springs']],
  ['The Meadows', 25.06, 55.17, ['meadows']],
  ['The Lakes', 25.065, 55.177, ['the lakes']],
  ['The Greens', 25.093, 55.175, ['the greens', 'greens']],
  ['The Views', 25.095, 55.17, ['the views']],
  ['Barsha Heights (Tecom)', 25.097, 55.178, ['barsha heights', 'tecom']],
  ['Dubai Media City', 25.094, 55.156, ['media city']],
  ['Dubai Internet City', 25.096, 55.162, ['internet city']],
  ['Al Sufouh', 25.1, 55.165, ['sufouh', 'knowledge village']],
  ['Al Barsha', 25.11, 55.198, ['al barsha', 'barsha 1', 'barsha 2', 'barsha 3', 'mall of the emirates']],
  ['Al Barsha South', 25.065, 55.215, ['barsha south']],
  ['Jumeirah Village Circle (JVC)', 25.058, 55.209, ['jvc', 'jumeirah village circle']],
  ['Jumeirah Village Triangle (JVT)', 25.047, 55.19, ['jvt', 'jumeirah village triangle']],
  ['Dubai Production City (IMPZ)', 25.035, 55.19, ['impz', 'production city']],
  ['Dubai Sports City', 25.04, 55.222, ['sports city']],
  ['Motor City', 25.045, 55.235, ['motor city', 'uptown motor city']],
  ['Arjan', 25.062, 55.235, ['arjan', 'science park', 'miracle garden']],
  ['Al Quoz', 25.14, 55.23, ['al quoz', 'alquoz']],
  ['Al Khail Gate', 25.14, 55.245, ['al khail gate']],
  ['Dubai Hills Estate', 25.105, 55.25, ['dubai hills']],
  ['Living Legends', 25.075, 55.245, ['living legends']],
  ['Arabian Ranches', 25.055, 55.27, ['arabian ranches 1', 'arabian ranches']],
  ['Arabian Ranches 2', 25.035, 55.285, ['arabian ranches 2', 'ranches 2']],
  ['Arabian Ranches 3', 25.02, 55.29, ['arabian ranches 3', 'ranches 3']],
  ['Mudon', 25.03, 55.27, ['mudon']],
  ['Damac Hills', 25.025, 55.25, ['damac hills', 'akoya oxygen']],
  ['Tilal Al Ghaf', 25.045, 55.255, ['tilal al ghaf']],
  ['Remraam', 25.005, 55.245, ['remraam']],
  ['Town Square', 25.0, 55.28, ['town square']],
  ['Damac Hills 2', 24.985, 55.32, ['damac hills 2', 'akoya']],
  ['Villanova & Serena', 25.025, 55.31, ['villanova', 'serena', 'la quinta']],
  ['The Villa', 25.075, 55.32, ['the villa']],
  ['Al Barari', 25.105, 55.32, ['barari']],
  ['Majan & Dubailand', 25.085, 55.3, ['majan', 'dubailand', 'dubai land']],
  ['Palm Jumeirah', 25.112, 55.139, ['palm jumeirah', 'the palm']],
  ['Umm Suqeim', 25.15, 55.21, ['umm suqeim']],
  ['Jumeirah', 25.205, 55.25, ['jumeirah 1', 'jumeirah 2', 'jumeirah 3', 'jumeirah']],
  ['Al Wasl & City Walk', 25.205, 55.26, ['al wasl', 'city walk']],
  ['Meydan & MBR City', 25.16, 55.3, ['meydan', 'mbr city', 'mohammed bin rashid city', 'district one']],
  ['Sobha Hartland', 25.18, 55.31, ['sobha hartland', 'hartland']],
  ['Nad Al Sheba', 25.16, 55.33, ['nad al sheba']],
  ['Business Bay', 25.185, 55.27, ['business bay']],
  ['Downtown Dubai', 25.197, 55.274, ['downtown']],
  ['DIFC', 25.212, 55.282, ['difc', 'financial centre', 'financial center']],
  ['Al Jaddaf', 25.22, 55.33, ['jaddaf', 'culture village']],
  ['Dubai Festival City', 25.22, 55.35, ['festival city']],
  ['Dubai Silicon Oasis', 25.12, 55.38, ['silicon oasis', 'dso']],
  ['International City', 25.165, 55.405, ['international city']],
  ['Al Warqa', 25.19, 55.42, ['warqa']],
  ['Mirdif', 25.22, 55.42, ['mirdif', 'mirdiff']],
  ['Al Rashidiya', 25.23, 55.39, ['rashidiya']],
  ['Al Garhoud', 25.245, 55.35, ['garhoud']],
  ['Karama', 25.245, 55.305, ['karama']],
  ['Bur Dubai', 25.255, 55.295, ['bur dubai', 'oud metha', 'mankhool']],
  ['Deira', 25.27, 55.31, ['deira', 'port saeed', 'al rigga', 'muraqqabat']],
  ['Al Qusais', 25.27, 55.38, ['qusais']],
  ['Al Nahda (Dubai)', 25.29, 55.37, ['al nahda']],
];

// Places outside Dubai: typed or found, they get standard delivery.
const ELSEWHERE = ['sharjah', 'abu dhabi', 'ajman', 'ras al khaimah', 'rak', 'umm al quwain', 'fujairah', 'al ain'];
export const OTHER_EMIRATES = ['Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Umm Al Quwain', 'Fujairah', 'Al Ain'];

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const norm = (s) => ` ${String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;

export function expressSettings(env = process.env) {
  return {
    warehouse: { lat: Number(env.WAREHOUSE_LAT || 24.978), lng: Number(env.WAREHOUSE_LNG || 55.188) },
    expressMaxKm: Number(env.EXPRESS_MAX_KM || 20),
    roadFactor: Number(env.ROAD_FACTOR || 1.3),
    cutoffHour: Number(env.CUTOFF_HOUR_GST || 17),
    openHour: Number(env.OPEN_HOUR_GST || 9),
    workDays: String(env.WORK_DAYS || '1,2,3,4,5,6').split(',').map(Number), // 0 = Sunday
    freeOver: Number(env.FREE_DELIVERY_OVER_AED || 99),
    fee: Number(env.DELIVERY_FEE_AED || 15),
    paused: /^(1|true|yes)$/i.test(env.EXPRESS_PAUSED || ''),
  };
}

export function straightKm(a, b) {
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const drivingKm = (point, s) => straightKm(s.warehouse, point) * s.roadFactor;

// Rough Dubai outline for a location that isn't near a listed area.
const inDubai = ({ lat, lng }) => lat > 24.75 && lat < 25.36 && lng > 54.89 && lng < 55.65 && !(lat > 25.29 && lng > 55.36);

export function areaList(s = expressSettings()) {
  const list = AREAS.map(([name, lat, lng]) => {
    const km = drivingKm({ lat, lng }, s);
    return { id: slug(name), name, tier: km <= s.expressMaxKm ? 'express' : '4hr', km: Math.round(km) };
  });
  for (const name of OTHER_EMIRATES) list.push({ id: slug(name), name, tier: 'standard', km: null });
  return list;
}

// Where is this? Accepts an area id, a lat/lng, or free address text (city, community, street).
export function locate({ area, lat, lng, address } = {}, s = expressSettings()) {
  const list = areaList(s);
  if (area) {
    const hit = list.find((a) => a.id === area);
    if (hit) return hit;
  }
  if (lat != null && lng != null && Number.isFinite(+lat) && Number.isFinite(+lng)) {
    const p = { lat: +lat, lng: +lng };
    let best = null;
    for (const [name, alat, alng] of AREAS) {
      const d = straightKm(p, { lat: alat, lng: alng });
      if (!best || d < best.d) best = { d, name };
    }
    const km = drivingKm(p, s);
    const tier = !inDubai(p) ? 'standard' : km <= s.expressMaxKm ? 'express' : '4hr';
    const name = best && best.d < 4 ? best.name : tier === 'standard' ? 'Outside Dubai' : 'Dubai';
    return { id: best && best.d < 4 ? slug(best.name) : 'location', name, tier, km: Math.round(km) };
  }
  if (address) {
    const text = norm(address);
    let hit = null;
    for (const [name, , , words] of AREAS) {
      for (const w of [name, ...words]) {
        const k = norm(w);
        if (text.includes(k) && (!hit || k.length > hit.len)) hit = { name, len: k.length };
      }
    }
    if (hit) return list.find((a) => a.name === hit.name);
    for (const e of ELSEWHERE) if (text.includes(norm(e))) return { id: slug(e), name: e.replace(/\b\w/g, (c) => c.toUpperCase()), tier: 'standard', km: null };
    if (text.includes(' dubai ')) return { id: 'dubai', name: 'Dubai', tier: '4hr', km: null };
  }
  return null;
}

// Dubai local time parts for a Date.
function dubai(now) {
  const t = new Date(now.getTime() + 4 * 3600e3);
  return { day: t.getUTCDay(), hour: t.getUTCHours(), min: t.getUTCMinutes(), date: t };
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// When the next express / 4-hour run goes out: today (with seconds left to the cutoff) or a later day.
export function schedule(now = new Date(), s = expressSettings()) {
  const d = dubai(now);
  if (s.workDays.includes(d.day) && d.hour < s.cutoffHour) {
    const cutoff = new Date(Date.UTC(d.date.getUTCFullYear(), d.date.getUTCMonth(), d.date.getUTCDate(), s.cutoffHour - 4));
    return { when: 'today', label: 'Today', cutoff: cutoff.toISOString(), secondsLeft: Math.max(0, Math.round((cutoff - now) / 1000)) };
  }
  for (let i = 1; i <= 7; i++) {
    const day = (d.day + i) % 7;
    if (s.workDays.includes(day)) {
      const label = i === 1 ? 'Tomorrow' : DAY_NAMES[day];
      return { when: i === 1 ? 'tomorrow' : 'later', label, cutoff: null, secondsLeft: 0 };
    }
  }
  return { when: 'later', label: 'Soon', cutoff: null, secondsLeft: 0 };
}

const openLabel = (s) => (s.openHour > 12 ? `${s.openHour - 12} pm` : `${s.openHour} am`);

// What to tell the shopper for an area at a moment in time.
export function promise(place, now = new Date(), s = expressSettings()) {
  if (!place) return { tier: 'unknown' };
  let tier = place.tier;
  if (s.paused && tier !== 'standard') tier = 'standard';
  const base = { tier, area: { id: place.id, name: place.name } };
  if (tier === 'standard') {
    return { ...base, title: 'Delivery in 1–2 working days', detail: place.tier === 'standard' ? 'Express is Dubai-only for now.' : 'Express is paused right now.' };
  }
  const sch = schedule(now, s);
  const today = sch.when === 'today';
  if (tier === 'express') {
    return {
      ...base,
      when: sch.when,
      secondsLeft: sch.secondsLeft,
      cutoff: sch.cutoff,
      title: today ? 'Plaay Express · Today' : `Plaay Express · ${sch.label} from ${openLabel(s)}`,
      detail: today ? 'Usually within 2 hours' : 'Order now and it’s first out of the door.',
    };
  }
  return {
    ...base,
    when: sch.when,
    secondsLeft: sch.secondsLeft,
    cutoff: sch.cutoff,
    title: today ? '4-hour delivery · Today' : `4-hour delivery · ${sch.label}`,
    detail: today ? 'Within 4 hours of your order' : `Goes out ${sch.label.toLowerCase()} from ${openLabel(s)}.`,
  };
}

// Shopify carrier-calculated shipping: rates for one checkout. `rate` is Shopify's request body.
export function checkoutRates(rate, now = new Date(), s = expressSettings()) {
  const dest = rate?.destination || {};
  const currency = rate?.currency || 'AED';
  const subtotal = (rate?.items || []).reduce((sum, i) => sum + Number(i.price || 0) * Number(i.quantity || 0), 0); // fils
  const price = subtotal >= s.freeOver * 100 ? 0 : s.fee * 100;
  const standard = { service_name: 'Standard delivery', service_code: 'standard', description: '1–2 working days', total_price: String(price), currency };
  if (String(dest.country || '').toUpperCase() !== 'AE') return [standard];

  const address = [dest.address1, dest.address2, dest.address3, dest.city, dest.province].filter(Boolean).join(', ');
  const place = locate(dest.latitude != null && dest.longitude != null ? { lat: dest.latitude, lng: dest.longitude } : { address }, s);
  const p = promise(place, now, s);
  const rates = [];
  if (p.tier === 'express') {
    rates.push({ service_name: p.when === 'today' ? 'Plaay Express · today' : `Plaay Express · ${p.title.split('· ')[1].toLowerCase()}`, service_code: 'plaay-express', description: p.detail, total_price: String(price), currency });
  }
  if (p.tier === 'express' || p.tier === '4hr') {
    const four = promise({ ...place, tier: '4hr' }, now, s);
    rates.push({ service_name: `4-hour delivery · ${four.when === 'today' ? 'today' : four.title.split('· ')[1].toLowerCase()}`, service_code: '4hr-delivery', description: four.detail, total_price: String(price), currency });
  }
  rates.push(standard);
  return rates;
}
