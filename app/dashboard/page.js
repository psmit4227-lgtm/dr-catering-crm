'use client';
import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import Navigation from '../components/Navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const FONT    = 'inherit';
const BG      = '#FFFFFF';
const NAVY    = '#1B2845';
const NAVY_SOFT = '#E8ECF4';
const TEXT_SEC = '#5C6478';
const BORDER  = '#E5E7EB';
// Kept for legacy references in this file (all values now resolve to navy).
const ESPRESSO = NAVY;
const GOLD     = NAVY;
const SHADOW   = 'none';

function localDateStr(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtDate(d) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m) - 1]} ${parseInt(day)}, ${y}`;
}

function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hr = parseInt(h);
  return `${hr % 12 || 12}:${m}${hr >= 12 ? 'pm' : 'am'}`;
}

function fmtDow(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  return days[new Date(y, m - 1, d).getDay()];
}

export default function DashboardPage() {
  const router = useRouter();
  const [screen, setScreen] = useState('loading');
  const [orders, setOrders] = useState([]);

  const todayStr    = localDateStr(0);
  const tomorrowStr = localDateStr(1);
  const weekOutStr  = localDateStr(7);
  const monthStart  = todayStr.slice(0, 7) + '-01';

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/'); return; }
      fetchOrders();
      setScreen('app');
    });
  }, []);

  async function fetchOrders() {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .gte('delivery_date', monthStart)
      .order('delivery_date', { ascending: true });
    if (data) setOrders(data);
  }

  const thisMonth  = useMemo(() => orders.filter(o => o.delivery_date >= monthStart), [orders]);
  const todayList  = useMemo(() => orders.filter(o => o.delivery_date === todayStr), [orders]);
  const upcoming   = useMemo(() => orders.filter(o => o.delivery_date > todayStr && o.delivery_date <= weekOutStr), [orders]);

  const totalOrders = thisMonth.length;
  const totalGuests = thisMonth.reduce((s, o) => s + (parseInt(o.guest_count) || 0), 0);

  if (screen === 'loading') return (
    <main style={{ minHeight:'100vh', background: BG, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:FONT }}>
      <div style={{ fontSize:14, color: TEXT_SEC }}>Loading...</div>
    </main>
  );

  const now = new Date();
  const monthName = now.toLocaleString('default', { month: 'long' });

  return (
    <>
      <Navigation />
      <main className="page-main" style={{ minHeight:'calc(100vh - 45px)', background: BG, padding:'32px 24px', fontFamily:FONT, boxSizing:'border-box' }}>
        <div style={{ maxWidth:880, margin:'0 auto' }}>

          {/* Page title */}
          <div style={{ fontSize:28, fontWeight:600, color: NAVY, marginBottom:28 }}>Dashboard</div>

          {/* Stats row */}
          <div className="stat-grid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:16, marginBottom:36 }}>
            <StatCard label={`Orders — ${monthName}`} value={totalOrders} sub={totalOrders === 1 ? 'order' : 'orders'} />
            <StatCard label={`Guests — ${monthName}`} value={totalGuests} sub={totalGuests === 1 ? 'guest' : 'guests'} />
            <StatCard label="Today"       value={todayList.length}  sub={todayList.length  === 1 ? 'delivery'  : 'deliveries'} />
            <StatCard label="Next 7 Days" value={upcoming.length}   sub={upcoming.length   === 1 ? 'upcoming'  : 'upcoming'} />
          </div>

          {/* Today's Orders */}
          <Section title={`Today's Orders — ${fmtDate(todayStr)}`}>
            {todayList.length === 0 ? (
              <EmptyNote text="No deliveries today." />
            ) : (
              todayList.map(o => <OrderRow key={o.id} order={o} highlight={false} />)
            )}
          </Section>

          {/* Upcoming Orders */}
          <Section title="Upcoming — Next 7 Days">
            {upcoming.length === 0 ? (
              <EmptyNote text="No upcoming orders in the next 7 days." />
            ) : (
              upcoming.map(o => (
                <OrderRow
                  key={o.id}
                  order={o}
                  highlight={o.delivery_date === tomorrowStr}
                  isTomorrow={o.delivery_date === tomorrowStr}
                />
              ))
            )}
          </Section>

        </div>
      </main>
    </>
  );
}

/* ── Sub-components ─────────────────────────────────────── */

function StatCard({ label, value, sub }) {
  return (
    <div className="card-hover" style={{
      background: '#FFFFFF',
      borderRadius: 12,
      border: `1px solid ${BORDER}`,
      padding: '20px 22px',
    }}>
      <div style={{ fontSize:12, fontWeight:600, color: TEXT_SEC, textTransform:'uppercase', letterSpacing:'1.5px', marginBottom:10 }}>
        {label}
      </div>
      <div style={{ fontSize:32, fontWeight:600, color: NAVY, lineHeight:1 }}>
        {value}
      </div>
      <div style={{ fontSize:13, color: TEXT_SEC, marginTop:6 }}>{sub}</div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom:36 }}>
      <div style={{ display:'flex', alignItems:'center', marginBottom:14 }}>
        <span style={{ fontSize:12, fontWeight:600, color: NAVY, textTransform:'uppercase', letterSpacing:'1.5px', whiteSpace:'nowrap', flexShrink:0, paddingRight:12 }}>
          {title}
        </span>
        <div style={{ flex:1, height:1, background: BORDER }} />
      </div>
      {children}
    </div>
  );
}

function EmptyNote({ text }) {
  return (
    <div style={{ fontSize:13, color: TEXT_SEC, fontFamily:FONT, padding:'12px 0' }}>{text}</div>
  );
}

function OrderRow({ order, isTomorrow }) {
  const rowBg      = isTomorrow ? NAVY_SOFT : '#FFFFFF';
  const borderLeft = isTomorrow ? `3px solid ${NAVY}` : '3px solid transparent';

  return (
    <div className="card-hover" style={{
      background: rowBg,
      borderRadius: 12,
      border: `1px solid ${BORDER}`,
      borderLeft,
      padding: '14px 18px',
      marginBottom: 10,
    }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>

        {/* Left: name + order # */}
        <div style={{ flexShrink:0 }}>
          {isTomorrow && (
            <div style={{ fontSize:11, fontWeight:600, color: NAVY, textTransform:'uppercase', letterSpacing:'1.5px', marginBottom:3 }}>
              Tomorrow
            </div>
          )}
          <div style={{ fontSize:11, fontWeight:600, color: TEXT_SEC, marginBottom:3, letterSpacing:'1px' }}>
            {order.order_number}
          </div>
          <div style={{ fontSize:16, fontWeight:600, color: NAVY }}>
            {order.client_name || '—'}
          </div>
        </div>

        {/* Right: date + times */}
        <div style={{ display:'flex', gap:20, flexWrap:'wrap', justifyContent:'flex-end' }}>
          <MiniStat label="Date" value={`${fmtDow(order.delivery_date)}, ${fmtDate(order.delivery_date)}`} />
          {order.time_out      && <MiniStat label="Time Out"   value={fmtTime(order.time_out)} />}
          {order.delivery_time && <MiniStat label="Time There" value={fmtTime(order.delivery_time)} />}
          {order.guest_count   && <MiniStat label="Guests"     value={order.guest_count} />}
        </div>
      </div>

      {/* Address */}
      {order.delivery_address && (
        <div style={{ fontSize:12, color: TEXT_SEC, fontFamily:FONT, marginTop:10 }}>
          📍 {order.delivery_address}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div style={{ textAlign:'right', flexShrink:0 }}>
      <div style={{ fontSize:11, fontWeight:600, color: TEXT_SEC, textTransform:'uppercase', letterSpacing:'1.5px' }}>{label}</div>
      <div style={{ fontSize:13, fontWeight:600, color: NAVY }}>{value}</div>
    </div>
  );
}
