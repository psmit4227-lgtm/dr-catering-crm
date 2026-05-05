import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SETUP_MIN          = 15;   // minutes setup at every stop
const ARRIVE_BUFFER_MIN  = 5;    // minutes before "time there"
const MAX_STOPS_PER_DRV  = 3;    // hard limit
const MOCK_STOP_MIN      = 20;   // mock drive between stops
const MOCK_KITCHEN_MIN   = 25;   // mock drive from/to kitchen
const MOCK_STOP_MILES    = 12;
const MOCK_KITCHEN_MILES = 15;
const METERS_PER_MILE    = 1609.344;

function isMockMode() {
  const k = process.env.GOOGLE_MAPS_API_KEY;
  return !k || !k.trim();
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

// Build a [N+1]x[N+1] matrix of {minutes, miles}.
// Index 0 = kitchen, indexes 1..N = stops.
async function buildMatrixMock(stops) {
  const n = stops.length + 1;
  const matrix = Array.from({ length: n }, () => Array(n).fill(null));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) { matrix[i][j] = { minutes: 0, miles: 0 }; continue; }
      const involvesKitchen = (i === 0 || j === 0);
      matrix[i][j] = involvesKitchen
        ? { minutes: MOCK_KITCHEN_MIN, miles: MOCK_KITCHEN_MILES }
        : { minutes: MOCK_STOP_MIN,    miles: MOCK_STOP_MILES };
    }
  }
  return matrix;
}

async function buildMatrixGoogle(stops, useTolls) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const kitchen = process.env.DR_CATERING_KITCHEN_ADDRESS || '';
  const points = [kitchen, ...stops.map(s => s.delivery_address || '')];
  const n = points.length;

  // Distance Matrix accepts up to 25 origins/destinations per request, so a
  // single round-trip is fine for catering-day volumes (max ~10 stops in practice).
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
        // Fall back to mock for failed cells so planning still completes
        const involvesKitchen = (i === 0 || j === 0);
        matrix[i][j] = involvesKitchen
          ? { minutes: MOCK_KITCHEN_MIN, miles: MOCK_KITCHEN_MILES }
          : { minutes: MOCK_STOP_MIN,    miles: MOCK_STOP_MILES };
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

// Greedy assignment: sort by deadline, try to slot each stop onto an existing
// driver if it still arrives within buffer, else open a new driver.
function clusterStops(stops, matrix) {
  // Each driver: { stopIdxs: [originalIndex], lastIdx: matrixIndex (0=kitchen at start) }
  const drivers = [];

  // Sort stops by their "time there" deadline (earliest first).
  const sortedStopOrder = [...stops.map((s, i) => i)].sort((a, b) => {
    const ta = timeToMinutes(stops[a].delivery_time) ?? 24 * 60;
    const tb = timeToMinutes(stops[b].delivery_time) ?? 24 * 60;
    return ta - tb;
  });

  for (const origIdx of sortedStopOrder) {
    const stop = stops[origIdx];
    const stopMatrixIdx = origIdx + 1; // 0 is kitchen
    const deadline = timeToMinutes(stop.delivery_time);
    let placed = false;

    for (const drv of drivers) {
      if (drv.stops.length >= MAX_STOPS_PER_DRV) continue;
      const lastEntry = drv.stops[drv.stops.length - 1];
      const driveMin  = matrix[lastEntry.matrixIdx][stopMatrixIdx].minutes;
      const arrival   = lastEntry.leaveAt + driveMin;
      const required  = (deadline ?? Infinity) - ARRIVE_BUFFER_MIN;

      if (deadline == null || arrival <= required) {
        // Effective arrival respects the deadline if we're early.
        const effectiveArrival = deadline != null
          ? Math.min(arrival, deadline - ARRIVE_BUFFER_MIN)
          : arrival;
        const realArrival = Math.max(arrival, effectiveArrival); // we don't go backward
        drv.stops.push({
          origIdx,
          matrixIdx: stopMatrixIdx,
          arriveAt:  realArrival,
          leaveAt:   realArrival + SETUP_MIN,
          driveMin,
          driveMiles: matrix[lastEntry.matrixIdx][stopMatrixIdx].miles,
        });
        placed = true;
        break;
      }
    }

    if (!placed) {
      // New driver: depart kitchen so we arrive ARRIVE_BUFFER_MIN before deadline.
      const driveFromKitchen = matrix[0][stopMatrixIdx].minutes;
      const milesFromKitchen = matrix[0][stopMatrixIdx].miles;
      const arrival = deadline != null
        ? deadline - ARRIVE_BUFFER_MIN
        : 9 * 60 + driveFromKitchen; // fallback: depart at 9am
      const departKitchen = arrival - driveFromKitchen;
      drivers.push({
        departKitchen,
        stops: [{
          origIdx,
          matrixIdx: stopMatrixIdx,
          arriveAt:  arrival,
          leaveAt:   arrival + SETUP_MIN,
          driveMin:  driveFromKitchen,
          driveMiles: milesFromKitchen,
          fromKitchen: true,
        }],
      });
    }
  }

  // Compute return-to-kitchen for each driver.
  for (const drv of drivers) {
    const last = drv.stops[drv.stops.length - 1];
    const back = matrix[last.matrixIdx][0];
    drv.returnAt    = last.leaveAt + back.minutes;
    drv.returnMin   = back.minutes;
    drv.returnMiles = back.miles;
  }

  return drivers;
}

function summarize(drivers, stops) {
  let totalMiles = 0;
  let totalDriveMin = 0;
  const out = drivers.map((drv, di) => {
    const driverMiles = drv.stops.reduce((s, st) => s + (st.driveMiles || 0), 0) + (drv.returnMiles || 0);
    const driverMin   = drv.stops.reduce((s, st) => s + (st.driveMin   || 0), 0) + (drv.returnMin   || 0);
    totalMiles    += driverMiles;
    totalDriveMin += driverMin;
    return {
      driverNumber: di + 1,
      departKitchen: minutesToTime(drv.departKitchen),
      returnKitchen: minutesToTime(drv.returnAt),
      totalMiles: +driverMiles.toFixed(1),
      totalDriveMinutes: driverMin,
      stops: drv.stops.map((st, si) => {
        const o = stops[st.origIdx];
        return {
          stopNumber: si + 1,
          orderId: o.id,
          orderNumber: o.order_number,
          clientName: o.client_name,
          deliveryAddress: o.delivery_address,
          onSiteContact: o.on_site_contact,
          onSitePhone: o.on_site_phone,
          deliveryDeadline: o.delivery_time,
          driverNotes: o.notes,
          guestCount: o.guest_count,
          arriveAt: minutesToTime(st.arriveAt),
          leaveAt:  minutesToTime(st.leaveAt),
          driveMinutesFromPrev: st.driveMin,
          driveMilesFromPrev:   +(st.driveMiles || 0).toFixed(1),
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

export async function POST(request) {
  try {
    const { date, deliveryMethod = 'DR Catering Driver', useTolls = true } = await request.json();
    if (!date) return Response.json({ error: 'Missing date' }, { status: 400 });

    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .eq('delivery_date', date)
      .eq('delivery_method', deliveryMethod);

    if (error) return Response.json({ error: error.message }, { status: 500 });

    const stops = (orders || []).filter(o => (o.delivery_address || '').trim().length > 0);

    if (stops.length === 0) {
      return Response.json({
        drivers: [],
        totalStops: 0,
        driversNeeded: 0,
        totalMiles: 0,
        totalDriveMinutes: 0,
        mockMode: isMockMode(),
        message: 'No DR Catering Driver deliveries for this date.',
      });
    }

    const mock = isMockMode();
    const matrix = mock
      ? await buildMatrixMock(stops)
      : await buildMatrixGoogle(stops, useTolls).catch(async (e) => {
          console.error('Distance Matrix failed, falling back to mock:', e.message);
          return buildMatrixMock(stops);
        });

    const drivers = clusterStops(stops, matrix);
    const summary = summarize(drivers, stops);

    // Persist the plan so the historical-averages widget can read it.
    await supabase.from('daily_plans').insert([{
      plan_date:           date,
      drivers_needed:      summary.driversNeeded,
      total_stops:         summary.totalStops,
      total_distance_miles: summary.totalMiles,
      total_drive_minutes: summary.totalDriveMinutes,
      with_tolls_chosen:   useTolls,
      plan_data:           summary,
    }]).then(() => null, () => null); // ignore insert failures (e.g. table not created yet)

    return Response.json({ ...summary, mockMode: mock });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function GET() {
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

  // Average across distinct days (use latest plan per date).
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
