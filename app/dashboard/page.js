'use client';
import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import Navigation from '../components/Navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const FONT = 'Calibri, Georgia, serif';

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
    <main style={{ minHeight:'100vh', background:'#f9f8f5', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:FONT }}>
      <div style={{ fontSize:14, color:'#aaa' }}>Loading...</div>
    </main>
  );

  const now = new Date();
  const monthName = now.toLocaleString('default', { month: 'long' });

  return (
    <>
      <Navigation />
      <main style={{ minHeight:'calc(100vh - 44px)', background:'#f9f8f5', padding:'32px 24px', fontFamily:FONT, boxSizing:'border-box' }}>
        <div style={{ maxWidth:880, margin:'0 auto' }}>

          {/* Page title */}
          <div style={{ fontSize:22, fontWeight:700, color:'#0f1214', fontFamily:FONT, marginBottom:24 }}>Dashboard</div>

          {/* Stats row */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:14, marginBottom:32 }}>
            <StatCard
              label={`Orders — ${monthName}`}
              value={totalOrders}
              sub={totalOrders === 1 ? 'order' : 'orders'}
            />
            <StatCard
              label={`Guests — ${monthName}`}
              value={totalGuests}
              sub={totalGuests === 1 ? 'guest' : 'guests'}
            />
            <StatCard
              label="Today"
              value={todayList.length}
              sub={todayList.length === 1 ? 'delivery' : 'deliveries'}
            />
            <StatCard
              label="Next 7 Days"
              value={upcoming.length}
              sub={upcoming.length === 1 ? 'upcoming' : 'upcoming'}
            />
          </div>

          {/* Today's Orders */}
          <Section title={`Today's Orders — ${fmtDate(todayStr)}`}>
            {todayList.length === 0 ? (
              <EmptyNote text="No deliveries today." />
            ) : (
              todayList.map(o => <OrderRow key={o.id} order={o} accent="#0f1214" />)
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
                  accent={o.delivery_date === tomorrowStr ? '#c0392b' : '#0f1214'}
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

/* ── Sub-components ─────────────────────────────────────────── */

function StatCard({ label, value, sub }) {
  return (
    <div style={{
      background:'#fff', borderRadius:12, border:'1px solid #e8e6e0',
      padding:'20px 22px', boxShadow:'0 1px 4px rgba(0,0,0,0.04)',
    }}>
      <div style={{ fontSize:11, fontWeight:700, color:'#aaa', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8, fontFamily:FONT }}>
        {label}
      </div>
      <div style={{ fontSize:34, fontWeight:700, color:'#0f1214', fontFamily:FONT, lineHeight:1 }}>
        {value}
      </div>
      <div style={{ fontSize:12, color:'#aaa', fontFamily:FONT, marginTop:4 }}>{sub}</div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom:32 }}>
      <div style={{
        fontSize:12, fontWeight:700, color:'#0f1214', textTransform:'uppercase',
        letterSpacing:'0.08em', paddingBottom:8, borderBottom:'2px solid #0f1214',
        marginBottom:14, fontFamily:FONT,
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function EmptyNote({ text }) {
  return (
    <div style={{ fontSize:13, color:'#bbb', fontFamily:FONT, padding:'12px 0' }}>{text}</div>
  );
}

function OrderRow({ order, accent, isTomorrow }) {
  const rowBg      = isTomorrow ? '#fff9f0' : '#fff';
  const borderLeft = isTomorrow ? '3px solid #c0392b' : '3px solid transparent';

  return (
    <div style={{
      background: rowBg,
      borderRadius:10,
      border:'1px solid #e8e6e0',
      borderLeft,
      padding:'14px 18px',
      marginBottom:8,
      boxShadow:'0 1px 3px rgba(0,0,0,0.03)',
    }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>

        {/* Left: name + order # */}
        <div style={{ flexShrink:0 }}>
          {isTomorrow && (
            <div style={{ fontSize:10, fontWeight:700, color:'#c0392b', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:3, fontFamily:FONT }}>
              Tomorrow
            </div>
          )}
          <div style={{ fontSize:10, fontWeight:700, color:'#bbb', fontFamily:FONT, marginBottom:2, letterSpacing:'0.04em' }}>
            {order.order_number}
          </div>
          <div style={{ fontSize:15, fontWeight:700, color: accent, fontFamily:FONT }}>
            {order.client_name || '—'}
          </div>
        </div>

        {/* Right: date + times */}
        <div style={{ display:'flex', gap:18, flexWrap:'wrap', justifyContent:'flex-end' }}>
          <MiniStat label="Date" value={`${fmtDow(order.delivery_date)}, ${fmtDate(order.delivery_date)}`} />
          {order.time_out      && <MiniStat label="Time Out"   value={fmtTime(order.time_out)} />}
          {order.delivery_time && <MiniStat label="Time There" value={fmtTime(order.delivery_time)} />}
          {order.guest_count   && <MiniStat label="Guests"     value={order.guest_count} />}
        </div>
      </div>

      {/* Address */}
      {order.delivery_address && (
        <div style={{ fontSize:12, color:'#888', fontFamily:FONT, marginTop:8 }}>
          📍 {order.delivery_address}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div style={{ textAlign:'right', flexShrink:0 }}>
      <div style={{ fontSize:10, fontWeight:600, color:'#aaa', fontFamily:FONT, textTransform:'uppercase', letterSpacing:'0.04em' }}>{label}</div>
      <div style={{ fontSize:13, fontWeight:600, color:'#0f1214', fontFamily:FONT }}>{value}</div>
    </div>
  );
}
