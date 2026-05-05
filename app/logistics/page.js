'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import Navigation from '../components/Navigation';
import { downloadDriverSheetsPDF } from '../driver-pdf';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const FONT      = 'inherit';
const BG        = '#FFFFFF';
const NAVY      = '#1B2845';
const NAVY_HOVER = '#2A3D63';
const NAVY_SOFT = '#E8ECF4';
const TEXT_SEC  = '#5C6478';
const BORDER    = '#E5E7EB';
const ESPRESSO  = NAVY;
const GOLD      = NAVY;
const SHADOW    = 'none';

function localDateStr(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtDateNice(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-').map(Number);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const days   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const dt = new Date(y, m - 1, day);
  return `${days[dt.getDay()]}, ${months[m - 1]} ${day}`;
}

function fmtTime12(t) {
  if (!t) return '—';
  const [h, m] = String(t).split(':');
  const hr = parseInt(h, 10);
  const min = parseInt(m, 10);
  if (isNaN(hr) || isNaN(min)) return t;
  return `${hr % 12 || 12}:${String(min).padStart(2, '0')} ${hr >= 12 ? 'PM' : 'AM'}`;
}

function fmtDuration(min) {
  if (!min || isNaN(min)) return '—';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

export default function LogisticsPage() {
  const router = useRouter();
  const [screen, setScreen]                       = useState('loading');
  // gate: 'modal' (confirm before planning) | 'waiting' (idle, came-back-later) | 'planner'
  const [gate, setGate]                           = useState('modal');
  const [planDate, setPlanDate]                   = useState(localDateStr(1));
  const [modalDate, setModalDate]                 = useState(localDateStr(1));
  const [useTolls, setUseTolls]                   = useState(true);
  const [planning, setPlanning]                   = useState(false);
  const [plan, setPlan]                           = useState(null);
  const [error, setError]                         = useState('');
  const [expanded, setExpanded]                   = useState({});
  const [averages, setAverages]                   = useState(null);
  const [ordersCount, setOrdersCount]             = useState(null);
  const [modalOrdersCount, setModalOrdersCount]   = useState(null);
  const [ordersCountAtPlan, setOrdersCountAtPlan] = useState(null);
  const [brokenOrders, setBrokenOrders]           = useState(null);

  // Track which date last fired a status fetch so the page-level date picker
  // can re-fetch when the user changes it.
  const lastStatusDateRef = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/'); return; }
      setScreen('app');
      fetchAverages();
      // Initial gate decision: if a saved plan already exists for the default
      // date, skip the modal and show that plan directly. Otherwise gate.
      const status = await fetchStatus(localDateStr(1));
      if (status?.savedPlan) {
        setPlan(status.savedPlan);
        setOrdersCountAtPlan(status.ordersCountAtPlan);
        setOrdersCount(status.ordersCount);
        setGate('planner');
      } else {
        setOrdersCount(status?.ordersCount ?? 0);
        setModalOrdersCount(status?.ordersCount ?? 0);
        setGate('modal');
      }
    });
  }, []);

  async function fetchAverages() {
    try {
      const r = await fetch('/api/plan-day');
      const j = await r.json();
      if (j.averages) setAverages(j.averages);
    } catch {}
  }

  async function fetchStatus(date) {
    try {
      lastStatusDateRef.current = date;
      const r = await fetch(`/api/plan-day?date=${encodeURIComponent(date)}`);
      const j = await r.json();
      // Guard against a stale response landing after a newer date change.
      if (lastStatusDateRef.current !== date) return null;
      return j;
    } catch {
      return null;
    }
  }

  // Refetch order count when the modal's date picker changes.
  useEffect(() => {
    if (gate !== 'modal') return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/plan-day?date=${encodeURIComponent(modalDate)}`);
        const j = await r.json();
        if (!cancelled) setModalOrdersCount(j.ordersCount ?? 0);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [modalDate, gate]);

  async function planDay(tollsOverride, dateOverride) {
    setPlanning(true);
    setError('');
    setBrokenOrders(null);
    setExpanded({});
    const targetDate = dateOverride || planDate;
    try {
      const r = await fetch('/api/plan-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: targetDate,
          deliveryMethod: 'DR Catering Driver',
          useTolls: typeof tollsOverride === 'boolean' ? tollsOverride : useTolls,
        }),
      });
      const j = await r.json();
      if (j.error === 'broken_orders' && Array.isArray(j.brokenOrders)) {
        setBrokenOrders(j.brokenOrders);
        setPlan(null);
      } else if (j.error) {
        setError(j.error);
        setPlan(null);
      } else {
        setPlan(j);
        setOrdersCountAtPlan(j.ordersCountAtPlan ?? null);
        const status = await fetchStatus(targetDate);
        if (status) setOrdersCount(status.ordersCount);
        fetchAverages();
      }
    } catch (e) {
      setError(e.message);
    }
    setPlanning(false);
  }

  function toggleTolls(next) {
    if (next === useTolls) return;
    setUseTolls(next);
    if (plan) planDay(next);
  }

  function toggleStop(driverIdx, stopIdx) {
    const k = `${driverIdx}:${stopIdx}`;
    setExpanded(prev => ({ ...prev, [k]: !prev[k] }));
  }

  // Modal answers
  async function handleModalYes() {
    setPlanDate(modalDate);
    setGate('planner');
    await planDay(undefined, modalDate);
  }

  function handleModalNo() {
    setPlanDate(modalDate);
    setGate('waiting');
  }

  function handleImDoneNow() {
    setModalDate(planDate);
    setGate('modal');
  }

  // When the user changes the page-level date picker (only visible in 'planner'
  // state), refresh status and either show the saved plan or clear it.
  async function handlePlanDateChange(newDate) {
    setPlanDate(newDate);
    setPlan(null);
    setOrdersCountAtPlan(null);
    setBrokenOrders(null);
    const status = await fetchStatus(newDate);
    if (!status) return;
    setOrdersCount(status.ordersCount);
    if (status.savedPlan) {
      setPlan(status.savedPlan);
      setOrdersCountAtPlan(status.ordersCountAtPlan);
    }
  }

  if (screen === 'loading') {
    return (
      <main style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT }}>
        <div style={{ fontSize: 14, color: TEXT_SEC }}>Loading...</div>
      </main>
    );
  }

  const newOrdersCount = (ordersCount != null && ordersCountAtPlan != null && ordersCount > ordersCountAtPlan)
    ? ordersCount - ordersCountAtPlan
    : 0;

  return (
    <>
      <Navigation />
      <main className="page-main" style={{ minHeight: 'calc(100vh - 45px)', background: BG, padding: '32px 24px', fontFamily: FONT, boxSizing: 'border-box' }}>
        <div style={{ maxWidth: 880, margin: '0 auto' }}>

          <div style={{ fontSize: 28, fontWeight: 600, color: NAVY, marginBottom: 6 }}>
            Logistics
          </div>
          <div style={{ fontSize: 14, color: TEXT_SEC, marginBottom: 24 }}>
            Plan your day. Pulls all DR Catering Driver deliveries and clusters them into routes.
          </div>

          {gate === 'waiting' ? (
            <WaitingScreen
              date={planDate}
              count={ordersCount}
              onResume={handleImDoneNow}
            />
          ) : (
            <>
              {/* Order count banner — always visible above the planner */}
              <OrderCountBanner date={planDate} count={ordersCount} />

              {plan?.mockMode && (
                <div style={{
                  background: NAVY_SOFT,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 8,
                  padding: '10px 14px',
                  fontSize: 13,
                  color: NAVY,
                  marginBottom: 16,
                }}>
                  🧪 Mock mode — real Google Maps data activates when API key is added
                </div>
              )}

              {newOrdersCount > 0 && !brokenOrders && (
                <NewOrdersWarning
                  count={newOrdersCount}
                  date={planDate}
                  onReplan={() => planDay()}
                  busy={planning}
                />
              )}

              {brokenOrders && brokenOrders.length > 0 && (
                <BrokenOrdersBanner brokenOrders={brokenOrders} />
              )}

              {/* Section 1 — Date Picker + Plan button */}
              <Section title="Plan a Day">
                <div className="plan-row" style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 220px', minWidth: 200 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: TEXT_SEC, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                      Delivery Date
                    </label>
                    <input
                      type="date"
                      value={planDate}
                      onChange={e => handlePlanDateChange(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '11px 14px',
                        border: `1px solid ${GOLD}`,
                        borderRadius: 12,
                        fontSize: 15,
                        color: ESPRESSO,
                        background: '#fff',
                        fontFamily: FONT,
                        boxSizing: 'border-box',
                        outline: 'none',
                      }}
                    />
                  </div>
                  <button
                    onClick={() => planDay()}
                    disabled={planning}
                    className="plan-btn"
                    style={{
                      background: planning ? '#9CA3AF' : NAVY,
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: 8,
                      padding: '13px 28px',
                      fontSize: 15,
                      fontWeight: 600,
                      cursor: planning ? 'not-allowed' : 'pointer',
                      flex: '0 1 auto',
                    }}
                  >
                    {planning ? 'Planning…' : (plan ? 'Re-plan Day' : 'Plan My Day')}
                  </button>
                </div>
                {error && (
                  <div style={{ marginTop: 12, padding: '10px 14px', background: '#fdecea', color: '#8b1e1e', borderRadius: 8, fontSize: 13 }}>
                    {error}
                  </div>
                )}
              </Section>

              {plan && plan.totalStops === 0 && !brokenOrders && (
                <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${BORDER}`, padding: 28, textAlign: 'center', color: TEXT_SEC, fontSize: 14, marginTop: 12 }}>
                  {plan.message || 'No DR Catering Driver deliveries for this date.'}
                </div>
              )}

              {plan && plan.totalStops > 0 && !brokenOrders && (
                <>
                  {/* Section 2 — Summary Cards */}
                  <div className="summary-grid" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                    gap: 14,
                    marginTop: 28,
                    marginBottom: 24,
                  }}>
                    <SummaryCard label="Total Stops" value={plan.totalStops} sub={plan.totalStops === 1 ? 'stop' : 'stops'} />
                    <SummaryCard label="Drivers Needed" value={plan.driversNeeded} sub={plan.driversNeeded === 1 ? 'driver' : 'drivers'} big />
                    <SummaryCard label="Total Distance" value={`${plan.totalMiles}`} sub="miles" />
                    <SummaryCard label="Total Drive Time" value={fmtDuration(plan.totalDriveMinutes)} sub="" />
                  </div>

                  {/* Section 3 — Toll Toggle */}
                  <div className="toll-row" style={{ display: 'flex', gap: 10, marginBottom: 28, flexWrap: 'wrap' }}>
                    <TollButton selected={useTolls}  onClick={() => toggleTolls(true)}  title="With Tolls"  sub="(faster)" />
                    <TollButton selected={!useTolls} onClick={() => toggleTolls(false)} title="No Tolls"    sub="(cheaper)" />
                  </div>

                  {/* Section 4 — Driver Route Cards */}
                  <div style={{ marginBottom: 28 }}>
                    {plan.drivers.map((driver, di) => (
                      <DriverCard
                        key={di}
                        driver={driver}
                        expanded={expanded}
                        onToggleStop={(si) => toggleStop(di, si)}
                        driverIdx={di}
                      />
                    ))}
                  </div>

                  {/* Section 5 — Print Driver Sheets */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 36 }}>
                    <button
                      onClick={() => downloadDriverSheetsPDF(plan, planDate, plan.mockMode)}
                      style={{
                        background: NAVY,
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: 8,
                        padding: '12px 22px',
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      📄 Print Driver Sheets
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {/* Historical averages widget — always visible at bottom */}
          {averages && (
            <div style={{
              background: '#FFFFFF',
              borderRadius: 12,
              border: `1px solid ${BORDER}`,
              padding: '20px 22px',
              marginTop: 24,
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: NAVY, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 12 }}>
                Last 30 Days
              </div>
              <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 11, color: TEXT_SEC, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Avg Drivers/Day</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: ESPRESSO }}>{averages.avgDriversPerDay}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: TEXT_SEC, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Highest Day</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: ESPRESSO }}>{averages.highestDay}</div>
                </div>
              </div>
              {Object.keys(averages.byWeekday || {}).length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: TEXT_SEC, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>By Weekday</div>
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                      averages.byWeekday[d] != null && (
                        <div key={d} style={{ fontSize: 13, color: ESPRESSO }}>
                          <span style={{ color: TEXT_SEC, fontWeight: 700, marginRight: 4 }}>{d}</span>
                          {averages.byWeekday[d]}
                        </div>
                      )
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {gate === 'modal' && (
          <ConfirmModal
            date={modalDate}
            onDateChange={setModalDate}
            count={modalOrdersCount}
            onYes={handleModalYes}
            onNo={handleModalNo}
          />
        )}

        <style jsx>{`
          @media (max-width: 600px) {
            .toll-row { flex-direction: column; }
            .toll-row > * { width: 100%; }
            .plan-btn { width: 100%; }
          }
          @media (max-width: 720px) {
            .summary-grid { grid-template-columns: repeat(2, 1fr) !important; }
          }
          @media (max-width: 420px) {
            .summary-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </main>
    </>
  );
}

/* ── Sub-components ─────────────────────────────────────── */

function ConfirmModal({ date, onDateChange, count, onYes, onNo }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(30, 16, 8, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 100,
        animation: 'logistics-modal-fade 0.2s ease-out',
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="logistics-modal-box"
        style={{
          background: '#fff',
          borderRadius: 16,
          width: '100%',
          maxWidth: 440,
          padding: '28px 28px 24px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
          fontFamily: FONT,
          boxSizing: 'border-box',
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 700, color: ESPRESSO, marginBottom: 6 }}>
          Done taking orders?
        </div>
        <div style={{ fontSize: 16, color: '#666', marginBottom: 18, lineHeight: 1.4 }}>
          Are you finished entering orders for <span style={{ color: ESPRESSO, fontWeight: 700 }}>{fmtDateNice(date)}</span>?
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: TEXT_SEC, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            Delivery Date
          </label>
          <input
            type="date"
            value={date}
            onChange={e => onDateChange(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: `1px solid ${GOLD}`,
              borderRadius: 10,
              fontSize: 14,
              color: ESPRESSO,
              background: '#fff',
              fontFamily: FONT,
              boxSizing: 'border-box',
              outline: 'none',
            }}
          />
        </div>

        <div style={{ fontSize: 14, color: GOLD, fontWeight: 700, marginBottom: 22 }}>
          {count == null
            ? 'Counting orders…'
            : `${count} ${count === 1 ? 'order' : 'orders'} for ${fmtDateNice(date)} so far`}
        </div>

        <div className="logistics-modal-buttons" style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={onNo}
            style={{
              flex: 1,
              background: '#fff',
              color: ESPRESSO,
              border: '1px solid #c8bfae',
              borderRadius: 12,
              padding: '12px 14px',
              fontSize: 13,
              fontWeight: 700,
              fontFamily: FONT,
              cursor: 'pointer',
              letterSpacing: '0.03em',
            }}
          >
            NO, more orders coming
          </button>
          <button
            type="button"
            onClick={onYes}
            style={{
              flex: 1,
              background: NAVY,
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 12,
              padding: '12px 14px',
              fontSize: 13,
              fontWeight: 700,
              fontFamily: FONT,
              cursor: 'pointer',
              letterSpacing: '0.03em',
              boxShadow: SHADOW,
            }}
          >
            YES, plan the day
          </button>
        </div>
      </div>

      <style jsx global>{`
        @keyframes logistics-modal-fade {
          from { opacity: 0; transform: scale(0.98); }
          to   { opacity: 1; transform: scale(1); }
        }
        @media (max-width: 480px) {
          .logistics-modal-buttons { flex-direction: column; }
        }
      `}</style>
    </div>
  );
}

function WaitingScreen({ date, count, onResume }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 16,
      border: `1px solid ${BORDER}`,
      borderTop: `3px solid ${GOLD}`,
      padding: '40px 28px',
      textAlign: 'center',
      boxShadow: SHADOW,
      marginBottom: 24,
    }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: ESPRESSO, marginBottom: 8 }}>
        Come back when you're done taking orders for {fmtDateNice(date)}.
      </div>
      <div style={{ fontSize: 13, color: TEXT_SEC, marginBottom: 22 }}>
        {count == null ? '' : `${count} ${count === 1 ? 'order' : 'orders'} entered so far`}
      </div>
      <button
        type="button"
        onClick={onResume}
        style={{
          background: NAVY,
          color: '#FFFFFF',
          border: 'none',
          borderRadius: 12,
          padding: '12px 22px',
          fontSize: 14,
          fontWeight: 700,
          fontFamily: FONT,
          cursor: 'pointer',
          letterSpacing: '0.04em',
          boxShadow: SHADOW,
        }}
      >
        I'm done now, plan it
      </button>
    </div>
  );
}

function OrderCountBanner({ date, count }) {
  return (
    <div style={{
      background: NAVY_SOFT,
      borderLeft: `4px solid ${NAVY}`,
      borderRadius: 6,
      padding: '10px 14px',
      fontSize: 14,
      color: NAVY,
      marginBottom: 16,
    }}>
      📋 <span style={{ fontWeight: 600 }}>
        {count == null ? '…' : count} {count === 1 ? 'order' : 'orders'}
      </span>{' '}
      for {fmtDateNice(date)}
    </div>
  );
}

function BrokenOrdersBanner({ brokenOrders }) {
  return (
    <div style={{
      background: '#fdecea',
      border: '2px solid #c0392b',
      borderRadius: 12,
      padding: '16px 18px',
      marginBottom: 24,
      fontFamily: FONT,
      color: '#5a1313',
    }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#8b1e1e', marginBottom: 10 }}>
        🚫 Cannot plan day — fix these orders first:
      </div>
      <ul style={{ margin: '0 0 14px', paddingLeft: 22, fontSize: 13.5, lineHeight: 1.55 }}>
        {brokenOrders.map((bo, i) => (
          <li key={i} style={{ marginBottom: 4 }}>
            <span style={{ fontWeight: 700 }}>{bo.orderNumber}</span>
            {bo.clientName && bo.clientName !== '—' && (
              <span style={{ color: '#7a3a3a' }}> ({bo.clientName})</span>
            )}
            {' — '}
            {bo.reasons.join('; ')}
          </li>
        ))}
      </ul>
      <a
        href="/orders"
        style={{
          display: 'inline-block',
          background: NAVY,
          color: '#FFFFFF',
          border: 'none',
          borderRadius: 10,
          padding: '8px 18px',
          fontSize: 13,
          fontWeight: 700,
          fontFamily: FONT,
          textDecoration: 'none',
          letterSpacing: '0.04em',
        }}
      >
        Open Order History
      </a>
    </div>
  );
}

function NewOrdersWarning({ count, date, onReplan, busy }) {
  return (
    <div className="warn-banner" style={{
      background: '#FEF9E7',
      border: '1px solid #F4D35E',
      borderRadius: 8,
      padding: '12px 16px',
      marginBottom: 16,
      display: 'flex',
      gap: 12,
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      color: '#5C4A1B',
      fontSize: 13,
      lineHeight: 1.4,
    }}>
      <div style={{ flex: '1 1 240px', minWidth: 0 }}>
        ⚠️ <span style={{ fontWeight: 600 }}>{count} new {count === 1 ? 'order' : 'orders'}</span> added for {fmtDateNice(date)} since you last planned. Click <em>Re-plan day</em> to update.
      </div>
      <button
        type="button"
        onClick={onReplan}
        disabled={busy}
        style={{
          background: busy ? '#9CA3AF' : NAVY,
          color: '#FFFFFF',
          border: 'none',
          borderRadius: 8,
          padding: '8px 16px',
          fontSize: 13,
          fontWeight: 600,
          cursor: busy ? 'not-allowed' : 'pointer',
          flexShrink: 0,
        }}
      >
        {busy ? 'Planning…' : 'Re-plan day'}
      </button>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: NAVY, textTransform: 'uppercase', letterSpacing: '1.5px', whiteSpace: 'nowrap', flexShrink: 0, paddingRight: 12 }}>
          {title}
        </span>
        <div style={{ flex: 1, height: 1, background: BORDER }} />
      </div>
      {children}
    </div>
  );
}

function SummaryCard({ label, value, sub, big }) {
  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: 12,
      border: `1px solid ${BORDER}`,
      padding: '18px 20px',
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: TEXT_SEC, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: big ? 40 : 30, fontWeight: 600, color: NAVY, lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 13, color: TEXT_SEC, marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

function TollButton({ selected, onClick, title, sub }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: '1 1 200px',
        background: selected ? NAVY : '#FFFFFF',
        color: selected ? '#FFFFFF' : NAVY,
        border: `1px solid ${NAVY}`,
        borderRadius: 8,
        padding: '14px 18px',
        fontSize: 14,
        fontWeight: 600,
        cursor: 'pointer',
        textAlign: 'center',
        transition: 'background 0.15s, color 0.15s',
      }}
    >
      {title} <span style={{ fontWeight: 400, opacity: 0.85 }}>{sub}</span>
    </button>
  );
}

function DriverCard({ driver, expanded, onToggleStop, driverIdx }) {
  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: 12,
      border: `1px solid ${BORDER}`,
      padding: '20px 22px',
      marginBottom: 16,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_SEC, textTransform: 'uppercase', letterSpacing: '1.5px' }}>
            Driver
          </span>
          <span style={{ fontSize: 22, fontWeight: 600, color: NAVY }}>
            {driver.driverNumber}
          </span>
        </div>
        <div style={{ fontSize: 13, color: TEXT_SEC }}>
          {driver.stops.length} {driver.stops.length === 1 ? 'stop' : 'stops'} · {(driver.totalMiles || 0).toFixed(1)} mi · {fmtDuration(driver.totalDriveMinutes)}
        </div>
      </div>

      <ScheduleRow icon="🕒" label="Depart Kitchen" time={driver.departKitchen} bold />

      {driver.stops.map((stop, si) => {
        const key = `${driverIdx}:${si}`;
        const isOpen = !!expanded[key];
        return (
          <div key={si} style={{ marginTop: 10 }}>
            <button
              type="button"
              onClick={() => onToggleStop(si)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                background: 'transparent',
                border: 'none',
                padding: '6px 0',
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
                fontFamily: FONT,
              }}
            >
              <StopBadge n={stop.stopNumber} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: NAVY }}>
                  {stop.clientName || '—'}
                </div>
                <div style={{ fontSize: 12, color: TEXT_SEC, marginTop: 2 }}>
                  Arrive {fmtTime12(stop.arriveAt)} · Setup 15 min · Leave {fmtTime12(stop.leaveAt)}
                </div>
                {stop.driverDepartFromOrder && (
                  <div style={{ fontSize: 11, color: TEXT_SEC, marginTop: 2, fontStyle: 'italic' }}>
                    Driver depart: {fmtTime12(stop.driverDepartFromOrder)} (from order)
                  </div>
                )}
              </div>
              <div style={{ fontSize: 11, color: NAVY, fontWeight: 600, paddingTop: 3 }}>
                {isOpen ? '▾' : '▸'}
              </div>
            </button>

            {isOpen && (
              <div style={{
                marginTop: 6,
                marginLeft: 32,
                padding: '10px 12px',
                background: NAVY_SOFT,
                borderLeft: `2px solid ${NAVY}`,
                borderRadius: 6,
                fontSize: 13,
                color: NAVY,
              }}>
                <div style={{ marginBottom: 4 }}>
                  <span style={{ color: TEXT_SEC, fontWeight: 700, marginRight: 6 }}>Address:</span>
                  {stop.deliveryAddress || '—'}
                </div>
                {stop.deliveryDeadline && (
                  <div style={{ marginBottom: 4 }}>
                    <span style={{ color: TEXT_SEC, fontWeight: 700, marginRight: 6 }}>Time There:</span>
                    {fmtTime12(stop.deliveryDeadline)}
                  </div>
                )}
                {(stop.onSiteContact || stop.onSitePhone) && (
                  <div style={{ marginBottom: 4 }}>
                    <span style={{ color: TEXT_SEC, fontWeight: 700, marginRight: 6 }}>On-site:</span>
                    {[stop.onSiteContact, stop.onSitePhone].filter(Boolean).join(' · ')}
                  </div>
                )}
                {stop.driverNotes?.trim() && (
                  <div style={{ marginTop: 6, padding: '8px 10px', background: '#FEF9E7', border: '1px solid #F4D35E', borderRadius: 4, color: '#5C4A1B' }}>
                    <span style={{ color: '#5C4A1B', fontWeight: 600, marginRight: 6 }}>Driver Notes:</span>
                    {stop.driverNotes}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ScheduleRow({ icon, label, time, bold }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_SEC, textTransform: 'uppercase', letterSpacing: '1.5px' }}>
          {label}
        </span>
      </div>
      <span style={{ fontSize: 14, fontWeight: 700, color: ESPRESSO, fontFamily: FONT }}>
        {fmtTime12(time)}
      </span>
    </div>
  );
}

function StopBadge({ n }) {
  return (
    <div style={{
      width: 24,
      height: 24,
      borderRadius: '50%',
      background: NAVY,
      color: '#FFFFFF',
      fontWeight: 700,
      fontSize: 12,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      fontFamily: FONT,
    }}>
      {n}
    </div>
  );
}
