'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navigation from '../components/Navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const FONT      = 'inherit';
const BG        = '#FFFFFF';
const NAVY      = '#1B2845';
const NAVY_SOFT = '#E8ECF4';
const TEXT_SEC  = '#5C6478';
const BORDER    = '#E5E7EB';
const ESPRESSO  = NAVY;
const GOLD      = NAVY;
const SHADOW    = 'none';

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

function fmtUpdated(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const hr = d.getHours();
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} · ${hr % 12 || 12}:${mins}${hr >= 12 ? 'pm' : 'am'}`;
}

export default function OrdersPage() {
  const router = useRouter();
  const [screen, setScreen]   = useState('loading');
  const [orders, setOrders]   = useState([]);
  const [search, setSearch]   = useState('');
  const [expanded, setExpanded] = useState(null);

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
      .order('delivery_date', { ascending: false });
    if (data) setOrders(data);
  }

  const filtered = orders.filter(o => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      (o.client_name   || '').toLowerCase().includes(q) ||
      (o.delivery_date || '').includes(q) ||
      (o.order_number  || '').toLowerCase().includes(q)
    );
  });

  if (screen === 'loading') return (
    <main style={{ minHeight:'100vh', background: BG, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:FONT }}>
      <div style={{ fontSize:14, color: TEXT_SEC }}>Loading...</div>
    </main>
  );

  return (
    <>
      <Navigation />
      <main className="page-main" style={{ minHeight:'calc(100vh - 45px)', background: BG, padding:'32px 24px', fontFamily:FONT, boxSizing:'border-box' }}>
        <div style={{ maxWidth:880, margin:'0 auto' }}>

          {/* Header row */}
          <div className="orders-header" style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:12, marginBottom:28 }}>
            <div>
              <div style={{ fontSize:28, fontWeight:600, color: NAVY }}>Orders History</div>
              <div style={{ fontSize:13, color: TEXT_SEC, marginTop:4, fontFamily:FONT }}>
                {filtered.length} order{filtered.length !== 1 ? 's' : ''}
              </div>
            </div>
            <input
              className="orders-search"
              type="search"
              placeholder="Search by client, date, or order #..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                padding:'10px 16px', border:`1px solid ${BORDER}`, borderRadius:12,
                fontSize:14, color: ESPRESSO, background:'#fff', outline:'none',
                fontFamily:FONT, width:280, boxSizing:'border-box',
              }}
            />
          </div>

          {/* Order list */}
          {filtered.length === 0 ? (
            <div style={{ textAlign:'center', padding:'60px 0', color: TEXT_SEC, fontFamily:FONT, fontSize:14 }}>
              {search ? 'No orders match your search.' : 'No orders yet.'}
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {filtered.map(order => {
                const isOpen = expanded === order.id;
                const label  = order.event_type === 'Other' && order.event_type_other
                  ? order.event_type_other
                  : order.event_type;

                return (
                  <div
                    key={order.id}
                    style={{
                      background:'#fff', borderRadius:16, border:`1px solid ${BORDER}`,
                      overflow:'hidden', boxShadow: SHADOW,
                    }}
                  >
                    {/* Collapsed row */}
                    <div
                      className="card-hover"
                      onClick={() => setExpanded(isOpen ? null : order.id)}
                      style={{ padding:'14px 18px', cursor:'pointer', display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}
                    >
                      {/* Order # + client */}
                      <div style={{ flexShrink:0, minWidth:160 }}>
                        <div style={{ fontSize:10, fontWeight:700, color: TEXT_SEC, fontFamily:FONT, marginBottom:3, letterSpacing:'0.06em' }}>
                          {order.order_number}
                        </div>
                        <div style={{ fontSize:16, fontWeight:700, color: ESPRESSO, fontFamily:FONT }}>
                          {order.client_name || '—'}
                        </div>
                      </div>

                      {/* Event badge — navy soft pill */}
                      {label && (
                        <span style={{
                          fontSize:12, fontWeight:500, padding:'3px 10px', borderRadius:20,
                          background:NAVY_SOFT, color: NAVY, border:`1px solid ${BORDER}`,
                          whiteSpace:'nowrap', flexShrink:0,
                        }}>
                          {label}
                        </span>
                      )}

                      {/* Delivery method badge */}
                      {order.delivery_method && (
                        <span style={{
                          fontSize:12, fontWeight:500, padding:'3px 10px', borderRadius:20,
                          background: order.delivery_method === 'Metrobi' ? NAVY_SOFT : NAVY,
                          color:      order.delivery_method === 'Metrobi' ? NAVY      : '#FFFFFF',
                          border:     order.delivery_method === 'Metrobi' ? `1px solid ${BORDER}` : `1px solid ${NAVY}`,
                          whiteSpace:'nowrap', flexShrink:0,
                        }}>
                          {order.delivery_method === 'Metrobi' ? '🚚 Metrobi' : '🏠 DR Catering'}
                        </span>
                      )}

                      {/* Right-side stats */}
                      <div style={{ display:'flex', gap:20, flex:1, justifyContent:'flex-end', alignItems:'center', flexWrap:'wrap' }}>
                        <div style={{ textAlign:'right', flexShrink:0 }}>
                          <div style={{ fontSize:10, fontWeight:700, color: GOLD, fontFamily:FONT, textTransform:'uppercase', letterSpacing:'0.06em' }}>Date</div>
                          <div style={{ fontSize:13, fontWeight:600, color: ESPRESSO, fontFamily:FONT }}>{fmtDate(order.delivery_date)}</div>
                        </div>
                        <div style={{ textAlign:'right', flexShrink:0 }}>
                          <div style={{ fontSize:10, fontWeight:700, color: GOLD, fontFamily:FONT, textTransform:'uppercase', letterSpacing:'0.06em' }}>Guests</div>
                          <div style={{ fontSize:13, fontWeight:600, color: ESPRESSO, fontFamily:FONT }}>{order.guest_count || '—'}</div>
                        </div>
                        <Link
                          href={`/orders/${order.id}/edit`}
                          onClick={e => e.stopPropagation()}
                          style={{ fontSize:12, color:NAVY, fontFamily:FONT, fontWeight:600, textDecoration:'none', padding:'4px 10px', borderRadius:6, border:`1px solid ${BORDER}`, flexShrink:0 }}
                        >
                          Edit
                        </Link>
                        <div style={{ fontSize:13, color: NAVY, fontFamily:FONT, flexShrink:0 }}>{isOpen ? '▲' : '▼'}</div>
                      </div>
                    </div>

                    {/* Address preview (collapsed only) */}
                    {!isOpen && order.delivery_address && (
                      <div style={{ padding:'0 18px 12px', fontSize:12, color: TEXT_SEC, fontFamily:FONT }}>
                        📍 {order.delivery_address}
                      </div>
                    )}

                    {/* Expanded details */}
                    {isOpen && (
                      <div style={{ borderTop:`1px solid ${BORDER}`, padding:20, background:NAVY_SOFT }}>

                        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(170px, 1fr))', gap:16, marginBottom:16 }}>
                          <DetailBlock label="Delivery Address" value={order.delivery_address} />
                          <DetailBlock label="Times" value={
                            [order.time_out && `Out: ${fmtTime(order.time_out)}`, order.delivery_time && `There: ${fmtTime(order.delivery_time)}`]
                              .filter(Boolean).join(' · ') || '—'
                          } />
                          <DetailBlock label="Client Contact" value={
                            [order.client_phone, order.client_email].filter(Boolean).join(' · ') || '—'
                          } />
                          <DetailBlock label="On-site Contact" value={
                            [order.on_site_contact, order.on_site_phone].filter(Boolean).join(' · ') || '—'
                          } />
                        </div>

                        <div style={{ height:1, background: BORDER, marginBottom:16 }} />

                        {order.order_details && (
                          <div style={{ marginBottom:14 }}>
                            <div style={{ fontSize:10, fontWeight:700, color: GOLD, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:6, fontFamily:FONT }}>Menu</div>
                            <div style={{ background:'#fff', borderRadius:10, border:`1px solid ${BORDER}`, padding:'12px 14px', fontFamily:FONT }}>
                              {order.menu_package && order.menu_package !== 'Custom' && (
                                <div style={{ fontSize:11, fontWeight:700, color: GOLD, marginBottom:6, fontFamily:FONT, letterSpacing:'0.04em' }}>
                                  Package: {order.menu_package}
                                </div>
                              )}
                              <div style={{ fontSize:13, color: ESPRESSO, whiteSpace:'pre-wrap', lineHeight:1.7, fontFamily:FONT }}>
                                {order.order_details}
                              </div>
                            </div>
                          </div>
                        )}

                        {(order.kitchen_notes || order.notes) && (
                          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:12 }}>
                            {order.kitchen_notes && <DetailBlock label="Kitchen Notes" value={order.kitchen_notes} pre />}
                            {order.notes        && <DetailBlock label="Driver Notes"  value={order.notes}         pre />}
                          </div>
                        )}

                      </div>
                    )}

                    {order.updated_at && (
                      <div style={{ padding:'8px 18px 10px', fontSize:11, color: TEXT_SEC, fontFamily:FONT, borderTop: isOpen ? 'none' : `1px solid ${BORDER}` }}>
                        Last updated: {fmtUpdated(order.updated_at)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
}

function DetailBlock({ label, value, pre }) {
  return (
    <div>
      <div style={{ fontSize:10, fontWeight:700, color: GOLD, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:4, fontFamily: FONT }}>
        {label}
      </div>
      <div style={{ fontSize:13, color: NAVY, fontFamily: FONT, lineHeight:1.6, whiteSpace: pre ? 'pre-wrap' : 'normal' }}>
        {value || '—'}
      </div>
    </div>
  );
}
