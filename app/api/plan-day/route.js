import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Locked kitchen address — used as the depart point for distance calc when
// reporting per-driver miles to/from the first stop. The actual depart TIME
// comes from the first order's time_out, not from this address.
const KITCHEN_ADDRESS_FALLBACK = '2321 US-22, Union, NJ 07083';

const SETUP_MIN          = 15;   // minutes setup at every stop
const ARRIVE_EARLY_MIN   = 10;   // aim to arrive this many minutes before time_there
const MAX_STOPS_PER_DRV  = 3;    // hard limit
const MOCK_STOP_MIN      = 20;   // mock drive between any two points
const MOCK_STOP_MILES    = 12;
const METERS_PER_MILE    = 1609.344;

function isMockMode() {
  const k = process.env.GOOGLE_MAPS_API_KEY;
  return !k || !k.trim();
}

function kitchenAddress() {
  const addr = process.env.DR_CATERING_KITCHEN_ADDRESS;
  return (addr && addr.trim()) ? addr : KITCHEN_ADDRESS_FALLBACK;
}

function timeToMinutes(t) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

function minutesToTime(mins) {
  if (mins == null || isNaN(mins)) return null;
  let m = ((mins % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(m / 60);
  const min = Math.floor(m % 60);
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

// Validate every DR Driver order for the date. Returns { valid, brokenOrders }.
// Each broken order is { orderNumber, clientName, reasons: [string] }.
function validateOrders(orders) {
  const brokenOrders = [];
  for (const o of orders) {
    const reasons = [];
    if (!o.time_out)            reasons.push('Missing Time Out');
    if (!o.delivery_time)       reasons.push('Missing Time There');
    if (!(o.delivery_address || '').trim()) reasons.push('Missing delivery address');
    const tOut  = timeToMinutes(o.time_out);
    const tThere = timeToMinutes(o.delivery_time);
    if (tOut != null && tThere != null && tThere <= tOut) {
      reasons.push('Time There is before Time Out');
    }
    if (reasons.length) {
      brokenOrders.push({
        id:          o.id,
        orderNumber: o.order_number || o.id,
        clientName:  o.client_name || '—',
        reasons,
      });
    }
  }
  return { valid: brokenOrders.length === 0, brokenOrders };
}

// Build an N×N matrix of {minutes, miles} between stops (no kitchen — depart
// times come from orders). Used by clustering to check whether a new stop can
// fit on an existing driver after the previous stop.
async function buildMatrixMock(stops) {
  const n = stops.length;
  const matrix = Array.from({ length: n }, () => Array(n).fill(null));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      matrix[i][j] = (i === j)
        ? { minutes: 0, miles: 0 }
        : { minutes: MOCK_STOP_MIN, miles: MOCK_STOP_MILES };
    }
  }
  return matrix;
}

async function buildMatrixGoogle(stops, useTolls) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const points = stops.map(s => s.delivery_address || '');
  const n = points.length;

  const origins = points.map(p => encodeURIComponent(p)).join('|');
  const destinations = origins;
  const avoid = useTolls ? '' : '&avoid=tolls';
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origins}&destinations=${destinations}&units=imperial${avoid}&key=${apiKey}`;

  const resp = await fetch(url);
  const json = await resp.json();
  if (json.status !== 'OK') throw new Error(`Distance Matrix: ${json.status}`);

  const matrix = Array.from({ length: n }, () => Array(n).fill(null));
  for (let i = 0; i < n; i++) {
    const row = json.rows[i];
    for (let j = 0; j < n; j++) {
      if (i === j) { matrix[i][j] = { minutes: 0, miles: 0 }; continue; }
      const cell = row?.elements?.[j];
      if (!cell || cell.status !== 'OK') {
        matrix[i][j] = { minutes: MOCK_STOP_MIN, miles: MOCK_STOP_MILES };
        continue;
      }
      matrix[i][j] = {
        minutes: Math.round(cell.duration.value / 60),
        miles:   +(cell.distance.value / METERS_PER_MILE).toFixed(2),
      };
    }
  }
  return matrix;
}

// Also fetch kitchen → first-stop drive distances in a single call so each
// driver can show miles for the kitchen-leg in their summary. Failures fall
// back to mock — the times stay correct (they come from the order).
async function kitchenLegMiles(stops, useTolls) {
  if (isMockMode()) return stops.map(() => MOCK_STOP_MILES);
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    const origin = encodeURIComponent(kitchenAddress());
    const destinations = stops.map(s => encodeURIComponent(s.delivery_address || '')).join('|');
    const avoid = useTolls ? '' : '&avoid=tolls';
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin}&destinations=${destinations}&units=imperial${avoid}&key=${apiKey}`;
    const resp = await fetch(url);
    const json = await resp.json();
    if (json.status !== 'OK') throw new Error(json.status);
    return stops.map((_, j) => {
      const cell = json.rows?.[0]?.elements?.[j];
      if (!cell || cell.status !== 'OK') return MOCK_STOP_MILES;
      return +(cell.distance.value / METERS_PER_MILE).toFixed(2);
    });
  } catch {
    return stops.map(() => MOCK_STOP_MILES);
  }
}

// Internal meal-bucket classifier (silent — never exposed to UI or PDFs).
// The kitchen preps in two waves: breakfast and lunch. A driver can chain
// stops within a bucket but never across them. Late-day deliveries (2 PM,
// 5 PM, …) still count as lunch for routing.
//   Breakfast: time_there <  10:30 AM  (< 630 minutes)
//   Lunch:     time_there >= 10:30 AM
function mealBucket(timeThereStr) {
  const m = timeToMinutes(timeThereStr);
  if (m == null) return 'lunch'; // unreachable after broken-orders validation; default safely
  if (m < 630) return 'breakfast';
  return 'lunch';
}

// Greedy clustering for a subset of stop indexes. Same chaining rules as
// before — the bucket separation happens at the call site, by passing only
// the indexes belonging to a single meal bucket.
//
// Sort by time_out (driver leaves earliest first), greedily fit each new
// stop onto an existing driver if there's enough drive time between
// previous stop's leave and new stop's time_there (10-min early-arrival
// target). Else open a new driver.
function clusterStops(stops, matrix, indexes) {
  const idxList = indexes || stops.map((_, i) => i);
  const drivers = [];

  const sortedOrder = [...idxList].sort((a, b) => {
    const ta = timeToMinutes(stops[a].time_out) ?? 24 * 60;
    const tb = timeToMinutes(stops[b].time_out) ?? 24 * 60;
    return ta - tb;
  });

  for (const idx of sortedOrder) {
    const stop = stops[idx];
    const tOut   = timeToMinutes(stop.time_out);
    const tThere = timeToMinutes(stop.delivery_time);
    let placed = false;

    for (const drv of drivers) {
      if (drv.stops.length >= MAX_STOPS_PER_DRV) continue;
      const last = drv.stops[drv.stops.length - 1];
      const driveMin = matrix[last.idx][idx].minutes;
      // Driver leaves previous stop after setup, drives, must arrive before tThere.
      const arrival = last.leaveAt + driveMin;
      if (arrival <= tThere) {
        // Fit. Prefer arriving 10 min early when there's time.
        const planned = Math.min(arrival, tThere - ARRIVE_EARLY_MIN);
        const realArrival = Math.max(planned, arrival); // never travel back in time
        drv.stops.push({
          idx,
          arriveAt:  realArrival,
          leaveAt:   realArrival + SETUP_MIN,
          driveMin,
          driveMiles: matrix[last.idx][idx].miles,
        });
        placed = true;
        break;
      }
    }

    if (!placed) {
      // New driver. Depart kitchen at the order's time_out (trust the order).
      // Plan arrival 10 min before tThere.
      const arrival = tThere - ARRIVE_EARLY_MIN;
      drivers.push({
        departKitchen: tOut,
        stops: [{
          idx,
          arriveAt:  arrival,
          leaveAt:   arrival + SETUP_MIN,
          driveMin:  Math.max(0, arrival - tOut), // implied kitchen → first-stop drive time
          driveMiles: 0, // filled in later from kitchenLegMiles
          fromKitchen: true,
        }],
      });
    }
  }
  return drivers;
}

function summarize(drivers, stops, kitchenMilesByStopIdx) {
  let totalMiles = 0;
  let totalDriveMin = 0;
  const out = drivers.map((drv, di) => {
    // First stop's drive_miles comes from kitchen → that stop.
    const first = drv.stops[0];
    if (first?.fromKitchen) {
      first.driveMiles = kitchenMilesByStopIdx[first.idx] ?? first.driveMiles ?? 0;
    }
    const driverMiles = drv.stops.reduce((s, st) => s + (st.driveMiles || 0), 0);
    const driverMin   = drv.stops.reduce((s, st) => s + (st.driveMin   || 0), 0);
    totalMiles    += driverMiles;
    totalDriveMin += driverMin;
    return {
      driverNumber: di + 1,
      departKitchen: minutesToTime(drv.departKitchen),
      totalMiles: +driverMiles.toFixed(1),
      totalDriveMinutes: driverMin,
      stops: drv.stops.map((st, si) => {
        const o = stops[st.idx];
        return {
          stopNumber: si + 1,
          orderId: o.id,
          orderNumber: o.order_number,
          clientName: o.client_name,
          deliveryAddress: o.delivery_address,
          onSiteContact: o.on_site_contact,
          onSitePhone: o.on_site_phone,
          deliveryDeadline: o.delivery_time,
          driverDepartFromOrder: o.time_out, // shown as "Driver depart: X (from order)"
          driverNotes: o.notes,
          guestCount: o.guest_count,
          arriveAt: minutesToTime(st.arriveAt),
          leaveAt:  minutesToTime(st.leaveAt),
          driveMinutesFromPrev: st.driveMin,
          driveMilesFromPrev:   +(st.driveMiles || 0).toFixed(1),
          fromKitchen: !!st.fromKitchen,
        };
      }),
    };
  });

  return {
    drivers: out,
    totalStops: stops.length,
    driversNeeded: drivers.length,
    totalMiles: +totalMiles.toFixed(1),
    totalDriveMinutes: totalDriveMin,
  };
}

async function countOrdersForDate(date) {
  const { count, error } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('delivery_date', date);
  if (error) return 0;
  return count || 0;
}

export async function POST(request) {
  try {
    const { date, useTolls = true } = await request.json();
    if (!date) return Response.json({ error: 'Missing date' }, { status: 400 });

    // All orders are DR Catering deliveries — no third-party filter.
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .eq('delivery_date', date);

    if (error) return Response.json({ error: error.message }, { status: 500 });

    const plannable = orders || [];
    const ordersCountAtPlan = await countOrdersForDate(date);

    if (plannable.length === 0) {
      return Response.json({
        drivers: [],
        totalStops: 0,
        driversNeeded: 0,
        totalMiles: 0,
        totalDriveMinutes: 0,
        mockMode: isMockMode(),
        ordersCountAtPlan,
        message: 'No deliveries for this date.',
      });
    }

    // BLOCKING validation — refuse to plan if any order is broken. This is the
    // safety net behind the New-Order-form validation: even if a bad order
    // somehow lands in the DB, the planner will not silently route around it.
    const { valid, brokenOrders } = validateOrders(plannable);
    if (!valid) {
      return Response.json({
        error: 'broken_orders',
        brokenOrders,
        mockMode: isMockMode(),
        ordersCountAtPlan,
      }, { status: 422 });
    }

    const mock = isMockMode();
    const matrix = mock
      ? await buildMatrixMock(plannable)
      : await buildMatrixGoogle(plannable, useTolls).catch(async (e) => {
          console.error('Distance Matrix failed, falling back to mock:', e.message);
          return buildMatrixMock(plannable);
        });

    const kitchenMiles = await kitchenLegMiles(plannable, useTolls);
    const kitchenMilesByIdx = plannable.map((_, i) => kitchenMiles[i]);

    // Internal meal-bucket separation: a driver can chain within breakfast
    // or within lunch — but never across the two. The frontend never sees
    // the bucket; we just run the existing clustering twice and concatenate
    // the results so they get numbered Driver 1, 2, 3, …
    const byBucket = { breakfast: [], lunch: [] };
    plannable.forEach((o, i) => {
      byBucket[mealBucket(o.delivery_time)].push(i);
    });
    const drivers = [
      ...clusterStops(plannable, matrix, byBucket.breakfast),
      ...clusterStops(plannable, matrix, byBucket.lunch),
    ];
    const summary = summarize(drivers, plannable, kitchenMilesByIdx);

    // Persist the plan so the historical-averages widget and the new-orders
    // warning can read it later. orders_count_at_plan column may not exist on
    // older databases — try with the column first, fall back without it.
    const baseRow = {
      plan_date:           date,
      drivers_needed:      summary.driversNeeded,
      total_stops:         summary.totalStops,
      total_distance_miles: summary.totalMiles,
      total_drive_minutes: summary.totalDriveMinutes,
      with_tolls_chosen:   useTolls,
      plan_data:           summary,
    };
    const withCount = { ...baseRow, orders_count_at_plan: ordersCountAtPlan };
    const { error: insErr } = await supabase.from('daily_plans').insert([withCount]);
    if (insErr) {
      await supabase.from('daily_plans').insert([baseRow]).then(() => null, () => null);
    }

    return Response.json({ ...summary, mockMode: mock, ordersCountAtPlan });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

async function getStatusForDate(date) {
  const ordersCount = await countOrdersForDate(date);

  const { data: plans } = await supabase
    .from('daily_plans')
    .select('*')
    .eq('plan_date', date)
    .order('created_at', { ascending: false })
    .limit(1);

  const latest = plans?.[0] || null;
  const savedPlan = latest?.plan_data
    ? { ...latest.plan_data, mockMode: isMockMode() }
    : null;
  const ordersCountAtPlan = latest?.orders_count_at_plan ?? null;

  return { date, ordersCount, savedPlan, ordersCountAtPlan };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');

  if (date) {
    try {
      return Response.json(await getStatusForDate(date));
    } catch (err) {
      return Response.json({ ordersCount: 0, savedPlan: null, ordersCountAtPlan: null, error: err.message });
    }
  }

  // Last-30-days averages for the historical widget.
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceStr = since.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('daily_plans')
    .select('plan_date, drivers_needed')
    .gte('plan_date', sinceStr)
    .order('plan_date', { ascending: true });

  if (error) return Response.json({ averages: null, error: error.message });

  const plans = data || [];
  if (plans.length === 0) {
    return Response.json({ averages: { avgDriversPerDay: 0, highestDay: 0, byWeekday: {} } });
  }

  const latestByDate = new Map();
  for (const p of plans) latestByDate.set(p.plan_date, p);
  const distinct = Array.from(latestByDate.values());

  const total = distinct.reduce((s, p) => s + (p.drivers_needed || 0), 0);
  const highest = distinct.reduce((m, p) => Math.max(m, p.drivers_needed || 0), 0);

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const byWeekdaySum = {};
  const byWeekdayCount = {};
  for (const p of distinct) {
    const [y, m, d] = p.plan_date.split('-').map(Number);
    const dow = dayNames[new Date(y, m - 1, d).getDay()];
    byWeekdaySum[dow]   = (byWeekdaySum[dow]   || 0) + (p.drivers_needed || 0);
    byWeekdayCount[dow] = (byWeekdayCount[dow] || 0) + 1;
  }
  const byWeekday = {};
  for (const k of dayNames) {
    if (byWeekdayCount[k]) byWeekday[k] = +(byWeekdaySum[k] / byWeekdayCount[k]).toFixed(1);
  }

  return Response.json({
    averages: {
      avgDriversPerDay: +(total / distinct.length).toFixed(1),
      highestDay: highest,
      byWeekday,
    },
  });
}
