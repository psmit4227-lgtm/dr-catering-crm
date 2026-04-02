'use client';
import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Home() {
  const [form, setForm] = useState({
    client_name: '', client_phone: '', delivery_address: '',
    delivery_date: '', delivery_time: '', guest_count: '', order_details: ''
  });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const ff = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.client_name) { alert('Please enter client name'); return; }
    if (!form.order_details) { alert('Please enter what they want'); return; }
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
    setForm({ client_name: '', client_phone: '', delivery_address: '',
      delivery_date: '', delivery_time: '', guest_count: '', order_details: '' });
    setDone(false);
  };

  const inputStyle = { width:'100%', padding:'11px 14px', border:'1px solid #e8e6e0', borderRadius:'10px', fontSize:'14px', color:'#0f1214', boxSizing:'border-box', outline:'none', fontFamily:'Arial, sans-serif' };
  const labelStyle = { display:'block', fontSize:'11px', fontWeight:'600', color:'#888', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'6px' };

  if (done) return (
    <main style={{minHeight:'100vh', background:'#f9f8f5', display:'flex', alignItems:'center', justifyContent:'center', padding:'16px', fontFamily:'Arial, sans-serif'}}>
      <div style={{background:'#ffffff', borderRadius:'16px', border:'1px solid #e8e6e0', width:'100%', maxWidth:'520px', padding:'36px', textAlign:'center'}}>
        <div style={{fontSize:'48px', marginBottom:'16px'}}>✓</div>
        <h2 style={{fontSize:'22px', fontWeight:'700', color:'#0f1214', margin:'0 0 8px'}}>Order saved</h2>
        <p style={{fontSize:'14px', color:'#888', margin:'0 0 28px'}}>Order for {form.client_name} has been saved to the database.</p>
        <button onClick={reset} style={{background:'#0f1214', color:'#fff', borderRadius:'10px', padding:'13px 28px', fontSize:'14px', fontWeight:'600', border:'none', cursor:'pointer'}}>
          New order
        </button>
      </div>
    </main>
  );

  return (
    <main style={{minHeight:'100vh', background:'#f9f8f5', display:'flex', alignItems:'center', justifyContent:'center', padding:'16px', fontFamily:'Arial, sans-serif'}}>
      <div style={{background:'#ffffff', borderRadius:'16px', border:'1px solid #e8e6e0', width:'100%', maxWidth:'520px', padding:'36px'}}>
        <h1 style={{fontSize:'24px', fontWeight:'700', color:'#0f1214', margin:'0 0 6px'}}>New Order</h1>
        <p style={{fontSize:'13px', color:'#aaa', margin:'0 0 32px'}}>Fill this in during the call</p>

        <div style={{marginBottom:'20px'}}>
          <label style={labelStyle}>Client name</label>
          <input style={inputStyle} placeholder="Who is calling?" value={form.client_name} onChange={e => ff('client_name', e.target.value)}/>
        </div>

        <div style={{marginBottom:'20px'}}>
          <label style={labelStyle}>Client phone number</label>
          <input style={inputStyle} type="tel" placeholder="201-555-0000" value={form.client_phone} onChange={e => ff('client_phone', e.target.value)}/>
        </div>

        <div style={{marginBottom:'20px'}}>
          <label style={labelStyle}>Delivery address</label>
          <input style={inputStyle} placeholder="Full address" value={form.delivery_address} onChange={e => ff('delivery_address', e.target.value)}/>
        </div>

        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'20px'}}>
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
          <input style={inputStyle} type="number" placeholder="e.g. 25" value={form.guest_count} onChange={e => ff('guest_count', e.target.value)}/>
        </div>

        <div style={{marginBottom:'28px'}}>
          <label style={labelStyle}>What do they want?</label>
          <textarea style={{...inputStyle, height:'100px', resize:'none'}} placeholder="e.g. 40 chicken skewers, 10 hummus platters" value={form.order_details} onChange={e => ff('order_details', e.target.value)}/>
        </div>

        <button onClick={save} disabled={saving} style={{width:'100%', background: saving ? '#888' : '#0f1214', color:'#ffffff', borderRadius:'10px', padding:'15px', fontSize:'15px', fontWeight:'600', border:'none', cursor: saving ? 'not-allowed' : 'pointer'}}>
          {saving ? 'Saving...' : 'Save order'}
        </button>
      </div>
    </main>
  );
}