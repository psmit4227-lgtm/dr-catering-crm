'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import Navigation from '../components/Navigation';
import { downloadDriverSheetsPDF } from '../driver-pdf';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const FONT     = 'Georgia, serif';
const BG       = '#f5f0e8';
const ESPRESSO = '#1e1008';
const GOLD     = '#c9a84c';
const TEXT_SEC = '#8b6914';
const SHADOW   = '0 4px 12px rgba(30,16,8,0.08)';

function localDateStr(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
  const [screen, setScreen]       = useState('loading');
  const [planDate, setPlanDate]   = useState(localDateStr(1));
  const [useTolls, setUseTolls]   = useState(true);
  const [planning, setPlanning]   = useState(false);
  const [plan, setPlan]           = useState(null);
  const [error, setError]         = useState('');
  const [expanded, setExpanded]   = useState({});
  const [averages, setAverages]   = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/'); return; }
      setScreen('app');
      fetchAverages();
    });
  }, []);

  async function fetchAverages() {
    try {
      const r = await fetch('/api/plan-day');
      const j = await r.json();
      if (j.averages) setAverages(j.averages);
    } catch {}
  }

  async function planDay(tollsOverride) {
    setPlanning(true);
    setError('');
    setExpanded({});
    try {
      const r = await fetch('/api/plan-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: planDate,
          deliveryMethod: 'DR Catering Driver',
          useTolls: typeof tollsOverride === 'boolean' ? tollsOverride : useTolls,
        }),
      });
      const j = await r.json();
      if (j.error) {
        setError(j.error);
        setPlan(null);
      } else {
        setPlan(j);
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

  if (screen === 'loading') {
    return (
      <main style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT }}>
        <div style={{ fontSize: 14, color: TEXT_SEC }}>Loading...</div>
      </main>
    );
  }

  return (
    <>
      <Navigation />
      <main className="page-main" style={{ minHeight: 'calc(100vh - 45px)', background: BG, padding: '32px 24px', fontFamily: FONT, boxSizing: 'border-box' }}>
        <div style={{ maxWidth: 880, margin: '0 auto' }}>

          <div style={{ fontSize: 22, fontWeight: 700, color: ESPRESSO, fontFamily: FONT, marginBottom: 6, letterSpacing: '0.04em' }}>
            Logistics
          </div>
          <div style={{ fontSize: 13, color: TEXT_SEC, marginBottom: 24 }}>
            Plan your day. Pulls all DR Catering Driver deliveries and clusters them into routes.
          </div>

          {plan?.mockMode && (
            <div style={{
              background: '#fff8e7',
              border: `1px solid ${GOLD}`,
              borderRadius: 12,
              padding: '10px 14px',
              fontSize: 12,
              color: ESPRESSO,
              marginBottom: 16,
            }}>
              🧪 Mock mode — real Google Maps data activates when API key is added
            </div>
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
                  onChange={e => setPlanDate(e.target.value)}
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
                  background: planning ? '#b5a58a' : ESPRESSO,
                  color: GOLD,
                  border: 'none',
                  borderRadius: 12,
                  padding: '13px 28px',
                  fontSize: 15,
                  fontWeight: 700,
                  fontFamily: FONT,
                  cursor: planning ? 'not-allowed' : 'pointer',
                  letterSpacing: '0.05em',
                  boxShadow: SHADOW,
                  flex: '0 1 auto',
                }}
              >
                {planning ? 'Planning…' : 'Plan My Day'}
              </button>
            </div>
            {error && (
              <div style={{ marginTop: 12, padding: '10px 14px', background: '#fdecea', color: '#8b1e1e', borderRadius: 8, fontSize: 13 }}>
                {error}
              </div>
            )}
          </Section>

          {plan && plan.totalStops === 0 && (
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e8dfc8', padding: 28, textAlign: 'center', color: TEXT_SEC, fontSize: 14, marginTop: 12 }}>
              {plan.message || 'No DR Catering Driver deliveries for this date.'}
            </div>
          )}

          {plan && plan.totalStops > 0 && (
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
                    background: ESPRESSO,
                    color: GOLD,
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
                  📄 Print Driver Sheets
                </button>
              </div>
            </>
          )}

          {/* Historical averages widget */}
          {averages && (
            <div style={{
              background: '#fff',
              borderRadius: 16,
              border: '1px solid #e8dfc8',
              borderTop: `3px solid ${GOLD}`,
              padding: '20px 22px',
              boxShadow: SHADOW,
              marginTop: 24,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: GOLD, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>
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

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ width: 16, height: 1, background: GOLD }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: GOLD, textTransform: 'uppercase', letterSpacing: '0.15em' }}>
          {title}
        </span>
        <div style={{ flex: 1, height: 1, background: GOLD }} />
      </div>
      {children}
    </div>
  );
}

function SummaryCard({ label, value, sub, big }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 16,
      border: '1px solid #e8dfc8',
      borderTop: `3px solid ${GOLD}`,
      padding: '18px 20px',
      boxShadow: SHADOW,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: GOLD, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: big ? 44 : 32, fontWeight: 700, color: ESPRESSO, lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: TEXT_SEC, marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

function TollButton({ selected, onClick, title, sub }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: '1 1 200px',
        background: selected ? ESPRESSO : '#fff',
        color: selected ? GOLD : ESPRESSO,
        border: `2px solid ${GOLD}`,
        borderRadius: 12,
        padding: '14px 18px',
        fontFamily: FONT,
        fontSize: 14,
        fontWeight: 700,
        cursor: 'pointer',
        letterSpacing: '0.04em',
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
      background: '#fff',
      borderRadius: 16,
      border: '1px solid #e8dfc8',
      borderTop: `4px solid ${GOLD}`,
      padding: '20px 22px',
      marginBottom: 16,
      boxShadow: SHADOW,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: GOLD, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
            Driver
          </span>
          <span style={{ fontSize: 22, fontWeight: 700, color: ESPRESSO, letterSpacing: '0.04em' }}>
            {driver.driverNumber}
          </span>
        </div>
        <div style={{ fontSize: 12, color: TEXT_SEC }}>
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
                <div style={{ fontSize: 14, fontWeight: 700, color: ESPRESSO }}>
                  {stop.clientName || '—'}
                </div>
                <div style={{ fontSize: 12, color: TEXT_SEC, marginTop: 2 }}>
                  Arrive {fmtTime12(stop.arriveAt)} · Setup 15 min · Leave {fmtTime12(stop.leaveAt)}
                </div>
              </div>
              <div style={{ fontSize: 11, color: GOLD, fontWeight: 700, paddingTop: 3 }}>
                {isOpen ? '▾' : '▸'}
              </div>
            </button>

            {isOpen && (
              <div style={{
                marginTop: 6,
                marginLeft: 32,
                padding: '10px 12px',
                background: '#fdf9ef',
                borderLeft: `2px solid ${GOLD}`,
                borderRadius: 6,
                fontSize: 12.5,
                color: ESPRESSO,
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
                  <div style={{ marginTop: 6, padding: '8px 10px', background: '#fffcdc', borderRadius: 4 }}>
                    <span style={{ color: TEXT_SEC, fontWeight: 700, marginRight: 6 }}>Driver Notes:</span>
                    {stop.driverNotes}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      <div style={{ marginTop: 12 }}>
        <ScheduleRow icon="🏠" label="Return to Kitchen" time={driver.returnKitchen} bold />
      </div>
    </div>
  );
}

function ScheduleRow({ icon, label, time, bold }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{ fontSize: 13, fontWeight: bold ? 700 : 600, color: GOLD, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
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
      background: ESPRESSO,
      color: GOLD,
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
