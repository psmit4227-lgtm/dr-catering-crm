'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter, useParams } from 'next/navigation';
import Navigation from '../../../components/Navigation';
import OrderForm from '../../../components/OrderForm';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const FONT     = 'inherit';
const BG       = '#FFFFFF';
const TEXT_SEC = '#5C6478';

export default function EditOrderPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id;

  const [screen, setScreen] = useState('loading');
  const [order, setOrder]   = useState(null);
  const [error, setError]   = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/'); return; }
      if (!id) { setError('Missing order id.'); setScreen('error'); return; }
      const { data, error: fetchErr } = await supabase
        .from('orders')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (fetchErr) { setError(fetchErr.message); setScreen('error'); return; }
      if (!data) { setError('Order not found.'); setScreen('error'); return; }
      setOrder(data);
      setScreen('app');
    });
  }, [id]);

  if (screen === 'loading') {
    return (
      <main style={{minHeight:'100vh', background:BG, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:FONT}}>
        <div style={{fontSize:14, color:TEXT_SEC}}>Loading order...</div>
      </main>
    );
  }

  if (screen === 'error') {
    return (
      <>
        <Navigation />
        <main style={{minHeight:'calc(100vh - 45px)', background:BG, display:'flex', alignItems:'center', justifyContent:'center', padding:'32px', fontFamily:FONT}}>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:18, fontWeight:600, color:'#8b1e1e', marginBottom:8}}>Could not load order</div>
            <div style={{fontSize:13, color:TEXT_SEC, marginBottom:20}}>{error}</div>
            <button
              onClick={() => router.push('/orders')}
              style={{background:'#1B2845', color:'#fff', border:'none', borderRadius:8, padding:'10px 20px', fontSize:14, fontWeight:600, cursor:'pointer'}}
            >
              Back to Order History
            </button>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Navigation />
      <OrderForm
        mode="edit"
        initialOrder={order}
        onCancel={() => router.push('/orders')}
      />
    </>
  );
}
