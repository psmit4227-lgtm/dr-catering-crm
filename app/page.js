'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const genOrderNum = () => 'DRC-' + String(Math.floor(Math.random() * 9000) + 1000);

export default function Home() {
  const [form, setForm] = useState({
    order_number: genOrderNum(),
    client_name: '', client_phone: '', client_email: '',
    on_site_contact: '', event_type: '', delivery_address: '',
    delivery_date: '', delivery_time: '', guest_count: '',
    order_details: '• ', notes: ''
  });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [pastClients, setPastClients] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [lastOrder, setLastOrder] = useState(null);
  const [showLastOrder, setShowLastOrder] = useState(false);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    setWidth(window.innerWidth);
    const handle = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, []);

  useEffect(() => {
    supabase.from('orders').select('client_name, client_phone, client_email, order_details').order('created_at', { ascending: false }).then(({ data }) => {
      if (data) {
        const unique = [];
        const seen = new Set();
        data.forEach(d => {
          if (d.client_name && !seen.has(d.client_name)) {
            seen.add(d.client_name);
            unique.push(d);
          }
        });
        setPastClients(unique);
      }
    });
  }, []);

  const ff = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleNameChange = (val) => {
    ff('client_name', val);
    if (val.length > 1) {
      setSuggestions(pastClients.filter(c => c.client_name.toLowerCase().startsWith(val.toLowerCase())).slice(0, 4));
    } else {
      setSuggestions([]);
    }
  };

  const selectSuggestion = (client) => {
    setForm(f => ({ ...f, client_name: client.client_name, client_phone: client.client_phone || '', client_email: client.client_email || '' }));
    setSuggestions([]);
    if (client.order_details) { setLastOrder(client.order_details); setShowLastOrder(true); }
  };

  const formatPhone = (val) => {
    const digits = val.replace(/\D/g, '').slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return digits.slice(0,3) + '-' + digits.slice(3);
    return digits.slice(0,3) + '-' + digits.slice(3,6) + '-' + digits.slice(6);
  };

  const handleMenu = (e) => {
    const val = e.target.value;
    if (!val.startsWith('• ')) { ff('order_details', '• ' + val.replace(/^•\s?/, '')); return; }
    ff('order_details', val);
  };

  const handleMenuKey = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); ff('order_details', form.order_details + '\n• '); }
  };

  const save = async () => {
    if (!form.client_name) { alert('Please enter client name'); return; }
    if (!form.delivery_date) { alert('Please enter delivery date'); return; }
    if (!form.delivery_address) { alert('Please enter delivery address'); return; }
    if (!form.order_details || form.order_details === '• ') { alert('Please enter the menu'); return; }
    setSaving(true);
    const { error } = await supabase.from('orders').insert([form]);
    if (error) { alert('Error saving: ' + error.message); setSaving(false); return; }
    await fetch('/api/send-order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setDone(true);
    setSaving(false);
  };

  const reset = () => {
    setForm({ order_number: genOrderNum(), client_name: '', client_phone: '', client_email: '', on_site_contact: '', event_type: '', delivery_address: '', delivery_date: '', delivery_time: '', guest_count: '', order_details: '• ', notes: '' });
    setDone(false);
    setSuggestions([]);
    setLastOrder(null);
    setShowLastOrder(false);
  };

  const isMobile = width < 640;
  const isTablet = width >= 640 && width < 1024;
  const isDesktop = width >= 1024;

  const font = 'Calibri, Georgia, serif';
  const inputStyle = { width:'100%', padding:'11px 14px', border:'1px solid #e8e6e0', borderRadius:'10px', fontSize: isMobile ? '16px' : '14px', color:'#0f1214', boxSizing:'border-box', outline:'none', fontFamily:font, background:'#fff' };
  const labelStyle = { display:'block', fontSize:'11px', fontWeight:'600', color:'#888', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'6px', fontFamily:font };
  const sectionLabel = { fontSize:'12px', fontWeight:'700', color:'#0f1214', textTransform:'uppercase', letterSpacing:'0.08em', margin:'24px 0 14px', paddingBottom:'6px', borderBottom:'2px solid #0f1214', display:'block', fontFamily:font };
  const required = { color:'#e53e3e', marginLeft:'3px' };

  const containerStyle = {
    background:'#ffffff', borderRadius:'16px', border:'1px solid #e8e6e0',
    width:'100%',
    maxWidth: isMobile ? '100%' : isTablet ? '680px' : '1100px',
    margin:'0 auto',
    padding: isMobile ? '20px 16px' : isTablet ? '32px' : '40px 48px',
    boxSizing:'border-box'
  };

  if (done) return (
    <main style={{minHeight:'100vh', background:'#f9f8f5', display:'flex', alignItems:'center', justifyContent:'center', padding:'16px', fontFamily:font}}>
      <div style={{...containerStyle, textAlign:'center', maxWidth:'560px'}}>
        <div style={{fontSize:'48px', marginBottom:'16px'}}>✓</div>
        <h2 style={{fontSize:'22px', fontWeight:'700', color:'#0f1214', margin:'0 0 8px', fontFamily:font}}>Order saved</h2>
        <div style={{display:'inline-block', background:'#f0f0f0', borderRadius:'8px', padding:'6px 16px', fontSize:'13px', fontWeight:'700', color:'#0f1214', marginBottom:'12px', fontFamily:font}}>{form.order_number}</div>
        <p style={{fontSize:'14px', color:'#888', margin:'0 0 28px', fontFamily:font}}>Order for {form.client_name} has been saved.</p>
        <button onClick={reset} style={{background:'#0f1214', color:'#fff', borderRadius:'10px', padding:'13px 28px', fontSize:'14px', fontWeight:'600', border:'none', cursor:'pointer', fontFamily:font}}>New order</button>
      </div>
    </main>
  );

  const ClientSection = () => (
    <>
      <span style={sectionLabel}>Client Details</span>
      <div style={{marginBottom:'16px', position:'relative'}}>
        <label style={labelStyle}>Client name <span style={required}>*</span></label>
        <input style={inputStyle} placeholder="Sarah Johnson" value={form.client_name} onChange={e => handleNameChange(e.target.value)}/>
        {suggestions.length > 0 && (
          <div style={{position:'absolute', top:'100%', left:0, right:0, background:'#fff', border:'1px solid #e8e6e0', borderRadius:'10px', zIndex:10, marginTop:'4px', overflow:'hidden', boxShadow:'0 4px 12px rgba(0,0,0,0.08)'}}>
            {suggestions.map((c, i) => (
              <div key={i} onClick={() => selectSuggestion(c)}
                style={{padding:'11px 14px', fontSize:'14px', cursor:'pointer', borderBottom: i < suggestions.length-1 ? '1px solid #f5f4f0':'none', fontFamily:font, color:'#0f1214', background:'#fff'}}
                onMouseEnter={e => e.currentTarget.style.background='#f9f8f5'}
                onMouseLeave={e => e.currentTarget.style.background='#fff'}>
                {c.client_name}
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{marginBottom:'16px'}}>
        <label style={labelStyle}>Phone number <span style={required}>*</span></label>
        <input style={inputStyle} type="tel" placeholder="201-555-0000" value={form.client_phone} onChange={e => ff('client_phone', formatPhone(e.target.value))}/>
      </div>
      <div style={{marginBottom:'16px'}}>
        <label style={labelStyle}>Email <span style={{fontSize:'10px', color:'#bbb', fontWeight:'400', textTransform:'none'}}>(optional)</span></label>
        <input style={inputStyle} type="email" placeholder="sarah@company.com" value={form.client_email} onChange={e => ff('client_email', e.target.value)}/>
      </div>
      <div style={{marginBottom:'16px'}}>
        <label style={labelStyle}>On-site contact <span style={{fontSize:'10px', color:'#bbb', fontWeight:'400', textTransform:'none'}}>(optional)</span></label>
        <input style={inputStyle} placeholder="Who will receive the order?" value={form.on_site_contact} onChange={e => ff('on_site_contact', e.target.value)}/>
      </div>
      <div style={{marginBottom:'16px'}}>
        <label style={labelStyle}>Event type</label>
        <select style={inputStyle} value={form.event_type} onChange={e => ff('event_type', e.target.value)}>
          <option value="">— Select event type —</option>
          <option>Corporate lunch</option>
          <option>Birthday party</option>
          <option>Wedding</option>
          <option>Office catering</option>
          <option>Private dinner</option>
          <option>Medical office</option>
          <option>Other</option>
        </select>
      </div>
    </>
  );

  const DeliverySection = () => (
    <>
      <span style={sectionLabel}>Delivery Details</span>
      <div style={{marginBottom:'16px'}}>
        <label style={labelStyle}>Delivery address <span style={required}>*</span></label>
        <input style={inputStyle} placeholder="Full address" value={form.delivery_address} onChange={e => ff('delivery_address', e.target.value)}/>
      </div>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'16px'}}>
        <div>
          <label style={labelStyle}>Date <span style={required}>*</span></label>
          <input style={inputStyle} type="date" value={form.delivery_date} onChange={e => ff('delivery_date', e.target.value)}/>
        </div>
        <div>
          <label style={labelStyle}>Time</label>
          <input style={inputStyle} type="time" value={form.delivery_time} onChange={e => ff('delivery_time', e.target.value)}/>
        </div>
      </div>
      <div style={{marginBottom:'16px'}}>
        <label style={labelStyle}>Food for how many people?</label>
        <input style={inputStyle} type="text" placeholder="e.g. 30 + 4 vegan + 2 gluten free" value={form.guest_count} onChange={e => ff('guest_count', e.target.value)}/>
      </div>
      <span style={sectionLabel}>Menu <span style={required}>*</span></span>
      <div style={{marginBottom:'20px'}}>
        <textarea style={{...inputStyle, height:'180px', resize:'none', lineHeight:'1.8'}} value={form.order_details} onChange={handleMenu} onKeyDown={handleMenuKey}/>
        <p style={{fontSize:'11px', color:'#aaa', margin:'4px 0 0', fontFamily:font}}>Press Enter to add a new item</p>
      </div>
      <div style={{marginBottom:'28px'}}>
        <label style={labelStyle}>Notes <span style={{fontSize:'10px', color:'#bbb', fontWeight:'400', textTransform:'none'}}>(optional)</span></label>
        <textarea style={{...inputStyle, height:'70px', resize:'none'}} placeholder="Gate code, elevator only, call before arriving..." value={form.notes} onChange={e => ff('notes', e.target.value)}/>
      </div>
      <div style={{fontSize:'11px', color:'#bbb', marginBottom:'16px', fontFamily:font}}><span style={required}>*</span> Required fields</div>
      <button onClick={save} disabled={saving} style={{width:'100%', background: saving ? '#888':'#0f1214', color:'#fff', borderRadius:'10px', padding:'15px', fontSize:'15px', fontWeight:'600', border:'none', cursor: saving ? 'not-allowed':'pointer', fontFamily:font}}>
        {saving ? 'Saving...' : 'Save order'}
      </button>
    </>
  );

  return (
    <main style={{minHeight:'100vh', background:'#f9f8f5', padding: isMobile ? '0' : '24px 16px', fontFamily:font, boxSizing:'border-box'}}>
      <div style={containerStyle}>

        {/* Header */}
        <div style={{textAlign:'center', marginBottom:'24px', paddingBottom:'20px', borderBottom:'1px solid #e8e6e0'}}>
          <div style={{fontSize: isDesktop ? '28px' : '24px', fontWeight:'700', color:'#0f1214', fontFamily:font}}><strong>DR Catering</strong></div>
          <div style={{fontSize:'12px', color:'#aaa', letterSpacing:'0.05em', marginTop:'4px', fontFamily:font}}>Catering Operating System</div>
        </div>

        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
          <div style={{fontSize:'18px', fontWeight:'700', color:'#0f1214', fontFamily:font}}>New Order</div>
          <div style={{fontSize:'12px', fontWeight:'700', color:'#aaa', fontFamily:font}}>{form.order_number}</div>
        </div>

        {/* Last order popup */}
        {showLastOrder && (
          <div style={{background:'#fffbeb', border:'1px solid #f59e0b', borderRadius:'12px', padding:'16px', marginBottom:'20px'}}>
            <div style={{fontSize:'13px', fontWeight:'700', color:'#92400e', marginBottom:'8px', fontFamily:font}}>Last order for this client:</div>
            <div style={{fontSize:'13px', color:'#78350f', whiteSpace:'pre-line', marginBottom:'14px', fontFamily:font, lineHeight:'1.8'}}>{lastOrder}</div>
            <div style={{display:'flex', gap:'10px', flexWrap:'wrap'}}>
              <button onClick={() => { ff('order_details', lastOrder); setShowLastOrder(false); }} style={{background:'#0f1214', color:'#fff', padding:'9px 18px', borderRadius:'8px', border:'none', fontSize:'13px', fontWeight:'600', cursor:'pointer', fontFamily:font}}>Same menu</button>
              <button onClick={() => { ff('order_details', lastOrder); setShowLastOrder(false); }} style={{background:'#fff', color:'#0f1214', padding:'9px 18px', borderRadius:'8px', border:'1px solid #e8e6e0', fontSize:'13px', fontWeight:'600', cursor:'pointer', fontFamily:font}}>I'll update it</button>
            </div>
          </div>
        )}

        {/* DESKTOP: two columns */}
        {isDesktop ? (
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'40px'}}>
            <div><ClientSection/></div>
            <div><DeliverySection/></div>
          </div>
        ) : (
          /* MOBILE + TABLET: single column */
          <div>
            <ClientSection/>
            <DeliverySection/>
          </div>
        )}

      </div>
    </main>
  );
}