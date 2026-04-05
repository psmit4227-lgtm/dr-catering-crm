'use client';
import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Home() {
  const [form, setForm] = useState({
    order_source: '', client_name: '', client_phone: '', client_email: '',
    point_of_contact: '', event_type: '', delivery_address: '',
    delivery_date: '', delivery_time: '', guest_count: '', order_details: '• '
  });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const ff = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const formatPhone = (val) => {
    const digits = val.replace(/\D/g, '').slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return digits.slice(0,3) + '-' + digits.slice(3);
    return digits.slice(0,3) + '-' + digits.slice(3,6) + '-' + digits.slice(6);
  };

  const handleMenu = (e) => {
    const val = e.target.value;
    if (!val.startsWith('• ')) {
      ff('order_details', '• ' + val.replace(/^•\s?/, ''));
      return;
    }
    ff('order_details', val);
  };

  const handleMenuKey = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      ff('order_details', form.order_details + '\n• ');
    }
  };

  const save = async () => {
    if (!form.client_name) { alert('Please enter client name'); return; }
    if (!form.order_details || form.order_details === '• ') { alert('Please enter the menu'); return; }
    setSaving(true);
    const { error } = await supabase.from('orders').insert([form]);
    if (error) { alert('Error saving: ' + error.message); setSaving(false); return; }
    await fetch('/api/send-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    setDone(true);
    setSaving(false);
  };

  const reset = () => {
    setForm({
      order_source: '', client_name: '', client_phone: '', client_email: '',
      point_of_contact: '', event_type: '', delivery_address: '',
      delivery_date: '', delivery_time: '', guest_count: '', order_details: '• '
    });
    setDone(false);
  };

  const inputStyle = { width:'100%', padding:'11px 14px', border:'1px solid #e8e6e0', borderRadius:'10px', fontSize:'14px', color:'#0f1214', boxSizing:'border-box', outline:'none', fontFamily:'Arial, sans-serif', background:'#fff' };
  const labelStyle = { display:'block', fontSize:'11px', fontWeight:'600', color:'#888', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'6px' };
  const sectionLabel = { fontSize:'12px', fontWeight:'700', color:'#0f1214', textTransform:'uppercase', letterSpacing:'0.08em', margin:'24px 0 14px', paddingBottom:'6px', borderBottom:'2px solid #0f1214', display:'block' };

  if (done) return (
    <main style={{minHeight:'100vh', background:'#f9f8f5', display:'flex', alignItems:'center', justifyContent:'center', padding:'16px', fontFamily:'Arial, sans-serif'}}>
      <div style={{background:'#ffffff', borderRadius:'16px', border:'1px solid #e8e6e0', width:'100%', maxWidth:'560px', padding:'36px', textAlign:'center'}}>
        <div style={{fontSize:'48px', marginBottom:'16px'}}>✓</div>
        <h2 style={{fontSize:'22px', fontWeight:'700', color:'#0f1214', margin:'0 0 8px'}}>Order saved</h2>
        <p style={{fontSize:'14px', color:'#888', margin:'0 0 28px'}}>Order for {form.client_name} has been saved.</p>
        <button onClick={reset} style={{background:'#0f1214', color:'#fff', borderRadius:'10px', padding:'13px 28px', fontSize:'14px', fontWeight:'600', border:'none', cursor:'pointer'}}>
          New order
        </button>
      </div>
    </main>
  );

  return (
    <main style={{minHeight:'100vh', background:'#f9f8f5', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px 16px', fontFamily:'Arial, sans-serif'}}>
      <div style={{background:'#ffffff', borderRadius:'16px', border:'1px solid #e8e6e0', width:'100%', maxWidth:'560px', padding:'36px'}}>

        {/* Header */}
        <div style={{textAlign:'center', marginBottom:'28px', paddingBottom:'24px', borderBottom:'1px solid #e8e6e0'}}>
          <div style={{fontSize:'26px', fontWeight:'700', color:'#0f1214', letterSpacing:'0.02em'}}>
            DR <span style={{fontWeight:'400'}}>Catering</span>
          </div>
          <div style={{fontSize:'11px', color:'#aaa', letterSpacing:'0.1em', textTransform:'uppercase', marginTop:'4px'}}>Catering Operating System</div>
        </div>

        <div style={{fontSize:'18px', fontWeight:'700', color:'#0f1214', marginBottom:'20px'}}>New Order</div>

        {/* Order source */}
        <div style={{marginBottom:'20px'}}>
          <label style={labelStyle}>How did this order come in?</label>
          <select style={inputStyle} value={form.order_source} onChange={e => ff('order_source', e.target.value)}>
            <option value="">— Select source —</option>
            <option>Phone</option>
            <option>Online</option>
            <option>In-person</option>
            <option>SMS</option>
            <option>Email</option>
          </select>
        </div>

        {/* Client Details */}
        <span style={sectionLabel}>Client Details</span>

        <div style={{marginBottom:'16px'}}>
          <label style={labelStyle}>Client name</label>
          <input style={inputStyle} placeholder="Sarah Johnson" value={form.client_name} onChange={e => ff('client_name', e.target.value)}/>
        </div>

        <div style={{marginBottom:'16px'}}>
          <label style={labelStyle}>Phone number</label>
          <input style={inputStyle} type="tel" placeholder="201-555-0000" value={form.client_phone} onChange={e => ff('client_phone', formatPhone(e.target.value))}/>
        </div>

        <div style={{marginBottom:'16px'}}>
          <label style={labelStyle}>Email address</label>
          <input style={inputStyle} type="email" placeholder="sarah@company.com" value={form.client_email} onChange={e => ff('client_email', e.target.value)}/>
        </div>

        <div style={{marginBottom:'16px'}}>
          <label style={labelStyle}>Point of contact at delivery</label>
          <input style={inputStyle} placeholder="Who will be there to receive the order?" value={form.point_of_contact} onChange={e => ff('point_of_contact', e.target.value)}/>
        </div>

        <div style={{marginBottom:'20px'}}>
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

        {/* Delivery Details */}
        <span style={sectionLabel}>Delivery Details</span>

        <div style={{marginBottom:'16px'}}>
          <label style={labelStyle}>Delivery address</label>
          <input style={inputStyle} placeholder="Full address" value={form.delivery_address} onChange={e => ff('delivery_address', e.target.value)}/>
        </div>

        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'16px'}}>
          <div>
            <label style={labelStyle}>Delivery date</label>
            <input style={inputStyle} type="date" value={form.delivery_date} onChange={e => ff('delivery_date', e.target.value)}/>
          </div>
          <div>
            <label style={labelStyle}>Delivery time</label>
            <input style={inputStyle} type="time" value={form.delivery_time} onChange={e => ff('delivery_time', e.target.value)}/>
          </div>
        </div>

        <div style={{marginBottom:'20px'}}>
          <label style={labelStyle}>Food for how many people?</label>
          <input style={inputStyle} type="text" placeholder="e.g. 30 + 4 vegan + 2 gluten free" value={form.guest_count} onChange={e => ff('guest_count', e.target.value)}/>
        </div>

        {/* Menu */}
        <span style={sectionLabel}>Menu</span>

        <div style={{marginBottom:'28px'}}>
          <textarea
            style={{...inputStyle, height:'160px', resize:'none', lineHeight:'1.8'}}
            value={form.order_details}
            onChange={handleMenu}
            onKeyDown={handleMenuKey}
          />
          <p style={{fontSize:'11px', color:'#aaa', margin:'4px 0 0'}}>Press Enter to add a new item</p>
        </div>

        <button onClick={save} disabled={saving} style={{width:'100%', background: saving ? '#888' : '#0f1214', color:'#ffffff', borderRadius:'10px', padding:'15px', fontSize:'15px', fontWeight:'600', border:'none', cursor: saving ? 'not-allowed' : 'pointer'}}>
          {saving ? 'Saving...' : 'Save order'}
        </button>

      </div>
    </main>
  );
}