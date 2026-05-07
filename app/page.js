'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import Navigation from './components/Navigation';
import OrderForm from './components/OrderForm';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const FONT     = 'inherit';
const NAVY     = '#1B2845';
const TEXT_SEC = '#5C6478';
const BORDER   = '#E5E7EB';

const cardStyle  = { background:'#FFFFFF', borderRadius:'12px', border:`1px solid ${BORDER}`, width:'100%', boxSizing:'border-box' };
const authInput  = { width:'100%', padding:'11px 14px', border:`1px solid ${BORDER}`, borderRadius:'8px', fontSize:'15px', color:NAVY, boxSizing:'border-box', outline:'none', background:'#FFFFFF' };
const authLabel  = { display:'block', fontSize:'12px', fontWeight:'600', color:TEXT_SEC, textTransform:'uppercase', letterSpacing:'1.5px', marginBottom:'6px' };
const primaryBtn = (disabled) => ({ width:'100%', background: disabled ? '#9CA3AF' : NAVY, color: '#FFFFFF', borderRadius:'8px', padding:'14px', fontSize:'15px', fontWeight:'600', border:'none', cursor: disabled ? 'not-allowed' : 'pointer' });

function AuthShell({ children }) {
  return (
    <main style={{minHeight:'100vh', background:'#FFFFFF', display:'flex', alignItems:'center', justifyContent:'center', padding:'16px'}}>
      <div style={{...cardStyle, maxWidth:'400px', padding:'40px 36px'}}>
        <div style={{textAlign:'center', marginBottom:'32px', paddingBottom:'24px', borderBottom:`1px solid ${BORDER}`}}>
          <div style={{fontSize:'20px', fontWeight:'600', color:NAVY, letterSpacing:'3px', textTransform:'uppercase'}}>DR Catering</div>
          <div style={{fontSize:'12px', color:TEXT_SEC, letterSpacing:'1.5px', marginTop:'8px', textTransform:'uppercase'}}>Catering Operating System</div>
        </div>
        {children}
      </div>
    </main>
  );
}

export default function Home() {
  const [screen, setScreen] = useState('loading');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setScreen(session ? 'app' : 'login');
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setScreen('login');
        setLoginEmail(''); setLoginPassword(''); setLoginError('');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSignIn = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
    if (error) { setLoginError('Invalid email or password.'); setLoginLoading(false); return; }
    setScreen('app');
    setLoginLoading(false);
  };

  if (screen === 'loading') return (
    <main style={{minHeight:'100vh', background:'#FFFFFF', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:FONT}}>
      <div style={{fontSize:'14px', color:TEXT_SEC}}>Loading...</div>
    </main>
  );

  if (screen === 'login') return (
    <AuthShell>
      <form onSubmit={handleSignIn}>
        <div style={{marginBottom:'16px'}}>
          <label style={authLabel}>Email</label>
          <input type="email" required autoComplete="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} style={authInput} placeholder="you@example.com"/>
        </div>
        <div style={{marginBottom:'24px'}}>
          <label style={authLabel}>Password</label>
          <input type="password" required autoComplete="current-password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} style={authInput} placeholder="••••••••"/>
        </div>
        {loginError && <div style={{fontSize:'13px', color:'#e53e3e', marginBottom:'16px', textAlign:'center'}}>{loginError}</div>}
        <button type="submit" disabled={loginLoading} style={primaryBtn(loginLoading)}>
          {loginLoading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </AuthShell>
  );

  return (
    <>
      <Navigation />
      <OrderForm mode="new" />
    </>
  );
}
