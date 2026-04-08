'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { generateOrderPDF, downloadOrderPDF } from './pdf';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const genOrderNum = () => 'DRC-' + String(Math.floor(Math.random() * 9000) + 1000);

const FONT = 'Calibri, Georgia, serif';
const cardStyle = { background:'#ffffff', borderRadius:'16px', border:'1px solid #e8e6e0', width:'100%', boxSizing:'border-box' };
const authInput = { width:'100%', padding:'11px 14px', border:'1px solid #e8e6e0', borderRadius:'10px', fontSize:'15px', color:'#0f1214', boxSizing:'border-box', outline:'none', fontFamily:FONT, background:'#fff' };
const authLabel = { display:'block', fontSize:'11px', fontWeight:'600', color:'#888', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'6px', fontFamily:FONT };
const primaryBtn = (disabled) => ({ width:'100%', background: disabled ? '#bbb' : '#0f1214', color:'#fff', borderRadius:'10px', padding:'14px', fontSize:'15px', fontWeight:'700', border:'none', cursor: disabled ? 'not-allowed' : 'pointer', fontFamily:FONT });

function AuthShell({ children }) {
  return (
    <main style={{minHeight:'100vh', background:'#f9f8f5', display:'flex', alignItems:'center', justifyContent:'center', padding:'16px', fontFamily:FONT}}>
      <div style={{...cardStyle, maxWidth:'400px', padding:'40px 36px'}}>
        <div style={{textAlign:'center', marginBottom:'32px', paddingBottom:'24px', borderBottom:'1px solid #e8e6e0'}}>
          <div style={{fontSize:'28px', fontWeight:'700', color:'#0f1214', fontFamily:FONT}}><strong>DR Catering</strong></div>
          <div style={{fontSize:'12px', color:'#aaa', letterSpacing:'0.05em', marginTop:'6px', fontFamily:FONT}}>Catering Operating System</div>
        </div>
        {children}
      </div>
    </main>
  );
}

export default function Home() {
  // ── Auth state ────────────────────────────────────────────────
  const [screen, setScreen] = useState('loading'); // 'loading'|'login'|'mfa-enroll'|'mfa-verify'|'app'

  // Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // MFA enroll
  const [enrollFactorId, setEnrollFactorId] = useState('');
  const [enrollQR, setEnrollQR] = useState('');
  const [enrollSecret, setEnrollSecret] = useState('');
  const [enrollCode, setEnrollCode] = useState('');
  const [enrollError, setEnrollError] = useState('');
  const [enrollLoading, setEnrollLoading] = useState(false);

  // MFA verify
  const [verifyFactorId, setVerifyFactorId] = useState('');
  const [verifyChallengeId, setVerifyChallengeId] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);

  // ── Auth helpers ──────────────────────────────────────────────
  const startEnrollment = async () => {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      issuer: 'DR Catering',
      friendlyName: 'Authenticator',
    });
    if (error) { console.error('Enroll error:', error); return; }
    setEnrollFactorId(data.id);
    setEnrollQR(data.totp.qr_code);   // data URI — render as <img>
    setEnrollSecret(data.totp.secret);
    setScreen('mfa-enroll');
  };

  const startChallenge = async (factorId) => {
    const { data, error } = await supabase.auth.mfa.challenge({ factorId });
    if (error) { console.error('Challenge error:', error); return; }
    setVerifyFactorId(factorId);
    setVerifyChallengeId(data.id);
    setScreen('mfa-verify');
  };

  const checkMfaStatus = async () => {
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalData.currentLevel === 'aal2') { setScreen('app'); return; }

    const { data: factorsData } = await supabase.auth.mfa.listFactors();
    const verifiedTotp = (factorsData?.totp || []).filter(f => f.status === 'verified');

    if (verifiedTotp.length > 0) {
      await startChallenge(verifiedTotp[0].id);
    } else {
      await startEnrollment();
    }
  };

  // ── Auth init ─────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setScreen('login'); return; }
      await checkMfaStatus();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setScreen('login');
        setLoginEmail(''); setLoginPassword(''); setLoginError('');
        setEnrollCode(''); setEnrollError('');
        setVerifyCode(''); setVerifyError('');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Auth actions ──────────────────────────────────────────────
  const handleSignIn = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
    if (error) { setLoginError('Invalid email or password.'); setLoginLoading(false); return; }
    await checkMfaStatus();
    setLoginLoading(false);
  };

  const handleEnrollVerify = async (e) => {
    e.preventDefault();
    setEnrollError('');
    setEnrollLoading(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: enrollFactorId,
      code: enrollCode.replace(/\s/g, ''),
    });
    if (error) { setEnrollError('Invalid code — try again.'); setEnrollLoading(false); return; }
    setScreen('app');
    setEnrollLoading(false);
  };

  const handleMfaVerify = async (e) => {
    e.preventDefault();
    setVerifyError('');
    setVerifyLoading(true);
    const { error } = await supabase.auth.mfa.verify({
      factorId: verifyFactorId,
      challengeId: verifyChallengeId,
      code: verifyCode.replace(/\s/g, ''),
    });
    if (error) { setVerifyError('Invalid code — try again.'); setVerifyLoading(false); return; }
    setScreen('app');
    setVerifyLoading(false);
  };

  const handleSignOut = async () => { await supabase.auth.signOut(); };

  // ── App state ─────────────────────────────────────────────────
  const [form, setForm] = useState({
    order_number: genOrderNum(),
    client_name: '', client_phone: '', client_email: '',
    on_site_contact: '', event_type: '', event_type_other: '',
    delivery_address: '', delivery_date: '', delivery_time: '',
    guest_count: '', order_details: '• ', notes: ''
  });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [savedOrder, setSavedOrder] = useState(null);
  const [pastClients, setPastClients] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [returnModal, setReturnModal] = useState(null);
  const [width, setWidth] = useState(0);
  const [guestTotal, setGuestTotal] = useState(0);
  const [listening, setListening] = useState(null);
  const recognitionRef = useRef(null);
  const speechBaseRef = useRef('');
  const speechAccumulatedRef = useRef('');

  useEffect(() => {
    setWidth(window.innerWidth);
    const handle = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, []);

  useEffect(() => {
    if (screen !== 'app') return;
    supabase.from('orders').select('client_name, client_phone, client_email, delivery_address, order_details').order('created_at', { ascending: false }).then(({ data }) => {
      if (data) {
        const unique = [];
        const seen = new Set();
        data.forEach(d => {
          if (d.client_name && !seen.has(d.client_name)) { seen.add(d.client_name); unique.push(d); }
        });
        setPastClients(unique);
      }
    });
  }, [screen]);

  const ff = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleNameChange = (val) => {
    ff('client_name', val);
    if (val.length > 1) {
      setSuggestions(pastClients.filter(c => c.client_name.toLowerCase().startsWith(val.toLowerCase())).slice(0, 4));
    } else {
      setSuggestions([]);
    }
  };

  const selectSuggestion = async (client) => {
    setForm(f => ({ ...f, client_name: client.client_name }));
    setSuggestions([]);
    const { data, error } = await supabase
      .from('orders')
      .select('client_phone, client_email, delivery_address, order_details')
      .eq('client_name', client.client_name)
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) { console.error('Error fetching last order:', error); return; }
    if (data && data[0]) {
      const last = data[0];
      setForm(f => ({ ...f, client_phone: last.client_phone || '', client_email: last.client_email || '' }));
      if (last.delivery_address || last.order_details) {
        setReturnModal({ lastAddress: last.delivery_address || '', lastMenu: last.order_details || '' });
      }
    }
  };

  const formatPhone = (val) => {
    const digits = val.replace(/\D/g, '').slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return digits.slice(0,3) + '-' + digits.slice(3);
    return digits.slice(0,3) + '-' + digits.slice(3,6) + '-' + digits.slice(6);
  };

  const handleGuestCount = (val) => {
    const cleaned = val.replace(/[^0-9+a-zA-Z ]/g, '');
    ff('guest_count', cleaned);
    const segments = cleaned.split('+');
    let total = 0;
    segments.forEach(seg => { const num = seg.trim().match(/^\d+/); if (num) total += parseInt(num[0]); });
    setGuestTotal(total);
  };

  const handleMenu = (e) => {
    const val = e.target.value;
    if (!val.startsWith('• ')) { ff('order_details', '• ' + val.replace(/^•\s?/, '')); return; }
    ff('order_details', val);
  };

  const handleMenuKey = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); ff('order_details', form.order_details + '\n• '); }
  };

  const formatAsBullets = (text) => {
    return text.split('\n').map(l => l.trim()).filter(l => l)
      .map(l => /^•/.test(l) ? (l.startsWith('• ') ? l : '• ' + l.slice(1)) : '• ' + l)
      .join('\n') || '• ';
  };

  const simpleFields = new Set(['client_name', 'client_phone', 'client_email', 'on_site_contact', 'delivery_address', 'guest_count']);

  const startListening = (field) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('Speech recognition is not supported. Please use Chrome or Safari.'); return; }
    if (listening === field) { recognitionRef.current?.stop(); return; }
    if (recognitionRef.current) { recognitionRef.current.abort(); }

    const recognition = new SR();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    const isSimple = simpleFields.has(field);
    const isMenu = field === 'menu';
    const base = isSimple ? '' : (isMenu ? form.order_details : form.notes);
    speechBaseRef.current = base;
    speechAccumulatedRef.current = '';

    const needsSpace = (b) => b && !b.endsWith('\n') && !b.endsWith(' ');
    const commitSimple = (text) => {
      const val = text.trim();
      if (field === 'client_phone') ff('client_phone', formatPhone(val));
      else if (field === 'client_name') handleNameChange(val);
      else if (field === 'client_email') ff('client_email', val.replace(/\s+/g, '').toLowerCase());
      else if (field === 'guest_count') handleGuestCount(val);
      else ff(field, val);
    };

    let aborted = false;
    recognition.onstart = () => setListening(field);
    recognition.onresult = (e) => {
      let finalText = '';
      let interimText = '';
      for (let i = 0; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) { finalText += isMenu ? t.replace(/\b(next item|new item|next)\b/gi, '\n• ') + ' ' : t + ' '; }
        else { interimText += t; }
      }
      speechAccumulatedRef.current = finalText;
      if (isSimple) { commitSimple(finalText + interimText); }
      else { const sep = needsSpace(base) && finalText ? ' ' : ''; ff(isMenu ? 'order_details' : 'notes', base + sep + finalText + interimText); }
    };
    recognition.onend = () => {
      setListening(null);
      recognitionRef.current = null;
      if (aborted) return;
      const acc = speechAccumulatedRef.current;
      const b = speechBaseRef.current;
      if (isSimple) { commitSimple(acc); }
      else { const sep = needsSpace(b) && acc ? ' ' : ''; const raw = b + sep + acc; ff(isMenu ? 'order_details' : 'notes', isMenu ? formatAsBullets(raw) : (raw.trim() || '')); }
    };
    recognition.onerror = (e) => {
      if (e.error === 'aborted') { aborted = true; return; }
      console.warn('Speech error:', e.error);
      setListening(null);
      recognitionRef.current = null;
    };
    recognition.start();
  };

  const MicIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15">
      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z"/>
    </svg>
  );

  const micBtn = (field) => ({
    background: listening === field ? '#e53e3e' : '#f0efeb',
    color: listening === field ? '#fff' : '#555',
    border: 'none', borderRadius: '50%',
    width: '30px', height: '30px', cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, transition: 'background 0.15s', marginLeft: '8px',
  });

  const save = async () => {
    if (!form.client_name) { alert('Please enter client name'); return; }
    if (!form.delivery_date) { alert('Please enter delivery date'); return; }
    if (!form.delivery_address) { alert('Please enter delivery address'); return; }
    if (!form.order_details || form.order_details === '• ') { alert('Please enter the menu'); return; }
    if (form.event_type === 'Other' && !form.event_type_other) { alert('Please specify the event type'); return; }
    setSaving(true);
    const finalEventType = form.event_type === 'Other' ? `Other: ${form.event_type_other}` : form.event_type;
    const orderToSave = { ...form, event_type: finalEventType, guest_count: form.guest_count + (guestTotal > 0 ? ` (Total: ${guestTotal})` : '') };
    const { error } = await supabase.from('orders').insert([orderToSave]);
    if (error) { alert('Error saving: ' + error.message); setSaving(false); return; }
    let pdfUrl = null;
    try {
      console.log('PDF generation starting');
      const pdfBase64 = generateOrderPDF(orderToSave);
      console.log('PDF generated, length:', pdfBase64?.length);
      const pdfBlob = new Blob([Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0))], { type: 'application/pdf' });
      const fileName = `${orderToSave.order_number}.pdf`;
      const { data: uploadData, error: uploadError } = await supabase.storage.from('order-pdfs').upload(fileName, pdfBlob, { contentType: 'application/pdf', upsert: true });
      if (uploadError) { console.error('PDF upload failed:', uploadError); }
      else {
        console.log('PDF uploaded to storage:', uploadData);
        const { data: urlData } = supabase.storage.from('order-pdfs').getPublicUrl(fileName);
        pdfUrl = urlData.publicUrl;
        console.log('PDF URL:', pdfUrl);
      }
    } catch (pdfErr) { console.error('PDF generation/upload failed:', pdfErr); }
    await fetch('/api/send-order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...orderToSave, pdfUrl }) });
    setSavedOrder(orderToSave);
    setDone(true);
    setSaving(false);
  };

  const reset = () => {
    setForm({ order_number: genOrderNum(), client_name: '', client_phone: '', client_email: '', on_site_contact: '', event_type: '', event_type_other: '', delivery_address: '', delivery_date: '', delivery_time: '', guest_count: '', order_details: '• ', notes: '' });
    setDone(false); setSavedOrder(null); setSuggestions([]); setReturnModal(null); setGuestTotal(0);
  };

  // ── Render: auth screens ──────────────────────────────────────

  if (screen === 'loading') return (
    <main style={{minHeight:'100vh', background:'#f9f8f5', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:FONT}}>
      <div style={{fontSize:'14px', color:'#aaa'}}>Loading...</div>
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

  if (screen === 'mfa-enroll') return (
    <AuthShell>
      <div style={{textAlign:'center', marginBottom:'20px'}}>
        <div style={{fontSize:'16px', fontWeight:'700', color:'#0f1214', marginBottom:'8px', fontFamily:FONT}}>Set up two-factor authentication</div>
        <div style={{fontSize:'13px', color:'#888', lineHeight:'1.6', fontFamily:FONT}}>Scan this QR code with Google Authenticator or any authenticator app, then enter the 6-digit code below.</div>
      </div>

      {enrollQR && (
        <div style={{display:'flex', justifyContent:'center', marginBottom:'20px'}}>
          <div style={{padding:'12px', background:'#fff', border:'1px solid #e8e6e0', borderRadius:'12px', display:'inline-block'}}>
            <img src={enrollQR} alt="QR code" width="180" height="180" style={{display:'block'}}/>
          </div>
        </div>
      )}

      {enrollSecret && (
        <div style={{background:'#f9f8f5', borderRadius:'10px', padding:'12px 16px', marginBottom:'20px', textAlign:'center'}}>
          <div style={{fontSize:'10px', fontWeight:'700', color:'#aaa', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'4px', fontFamily:FONT}}>Manual entry code</div>
          <div style={{fontSize:'13px', fontWeight:'700', color:'#0f1214', letterSpacing:'0.15em', fontFamily:'monospace, monospace'}}>{enrollSecret}</div>
        </div>
      )}

      <form onSubmit={handleEnrollVerify}>
        <div style={{marginBottom:'20px'}}>
          <label style={authLabel}>6-digit code from your app</label>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            value={enrollCode}
            onChange={e => setEnrollCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            style={{...authInput, fontSize:'22px', letterSpacing:'0.3em', textAlign:'center', fontFamily:'monospace, monospace'}}
            placeholder="000000"
          />
        </div>
        {enrollError && <div style={{fontSize:'13px', color:'#e53e3e', marginBottom:'16px', textAlign:'center'}}>{enrollError}</div>}
        <button type="submit" disabled={enrollLoading || enrollCode.length < 6} style={primaryBtn(enrollLoading || enrollCode.length < 6)}>
          {enrollLoading ? 'Verifying...' : 'Verify and enable 2FA'}
        </button>
      </form>
    </AuthShell>
  );

  if (screen === 'mfa-verify') return (
    <AuthShell>
      <div style={{textAlign:'center', marginBottom:'24px'}}>
        <div style={{fontSize:'32px', marginBottom:'12px'}}>🔐</div>
        <div style={{fontSize:'16px', fontWeight:'700', color:'#0f1214', marginBottom:'8px', fontFamily:FONT}}>Enter your authentication code</div>
        <div style={{fontSize:'13px', color:'#888', lineHeight:'1.6', fontFamily:FONT}}>Open your authenticator app and enter the 6-digit code for DR Catering.</div>
      </div>

      <form onSubmit={handleMfaVerify}>
        <div style={{marginBottom:'20px'}}>
          <label style={authLabel}>6-digit code</label>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            autoFocus
            value={verifyCode}
            onChange={e => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            style={{...authInput, fontSize:'22px', letterSpacing:'0.3em', textAlign:'center', fontFamily:'monospace, monospace'}}
            placeholder="000000"
          />
        </div>
        {verifyError && <div style={{fontSize:'13px', color:'#e53e3e', marginBottom:'16px', textAlign:'center'}}>{verifyError}</div>}
        <button type="submit" disabled={verifyLoading || verifyCode.length < 6} style={primaryBtn(verifyLoading || verifyCode.length < 6)}>
          {verifyLoading ? 'Verifying...' : 'Verify'}
        </button>
      </form>
    </AuthShell>
  );

  // ── Render: app ───────────────────────────────────────────────

  const isMobile = width < 640;
  const font = FONT;
  const inputStyle = { width:'100%', padding:'11px 14px', border:'1px solid #e8e6e0', borderRadius:'10px', fontSize: isMobile ? '16px' : '15px', color:'#0f1214', boxSizing:'border-box', outline:'none', fontFamily:font, background:'#fff' };
  const labelStyle = { display:'block', fontSize:'11px', fontWeight:'600', color:'#888', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'6px', fontFamily:font };
  const sectionLabel = { fontSize:'12px', fontWeight:'700', color:'#0f1214', textTransform:'uppercase', letterSpacing:'0.08em', margin:'28px 0 16px', paddingBottom:'8px', borderBottom:'2px solid #0f1214', display:'block', fontFamily:font };
  const required = { color:'#e53e3e', marginLeft:'3px' };

  if (done) return (
    <main style={{minHeight:'100vh', background:'#f9f8f5', display:'flex', alignItems:'center', justifyContent:'center', padding:'16px', fontFamily:font}}>
      <div style={{background:'#ffffff', borderRadius:'16px', border:'1px solid #e8e6e0', width:'100%', maxWidth:'600px', margin:'0 auto', padding:'36px', textAlign:'center', boxSizing:'border-box'}}>
        <div style={{fontSize:'48px', marginBottom:'16px'}}>✓</div>
        <h2 style={{fontSize:'22px', fontWeight:'700', color:'#0f1214', margin:'0 0 8px', fontFamily:font}}>Order sent to kitchen</h2>
        <div style={{display:'inline-block', background:'#f0f0f0', borderRadius:'8px', padding:'6px 16px', fontSize:'13px', fontWeight:'700', color:'#0f1214', marginBottom:'12px', fontFamily:font}}>{savedOrder?.order_number}</div>
        <p style={{fontSize:'14px', color:'#888', margin:'0 0 28px', fontFamily:font}}>Order for {savedOrder?.client_name} has been saved and emailed.</p>
        <button onClick={reset} style={{background:'#0f1214', color:'#fff', borderRadius:'10px', padding:'13px 28px', fontSize:'14px', fontWeight:'600', border:'none', cursor:'pointer', fontFamily:font}}>New order</button>
      </div>
    </main>
  );

  return (
    <main style={{minHeight:'100vh', background:'#f9f8f5', padding: isMobile ? '0' : '32px 24px', fontFamily:font, boxSizing:'border-box'}}>
      <div style={{background:'#ffffff', borderRadius: isMobile ? '0' : '16px', border:'1px solid #e8e6e0', width:'100%', maxWidth:'720px', margin:'0 auto', padding: isMobile ? '20px 16px' : '40px 48px', boxSizing:'border-box'}}>

        <div style={{position:'relative', textAlign:'center', marginBottom:'28px', paddingBottom:'24px', borderBottom:'1px solid #e8e6e0'}}>
          <div style={{fontSize:'28px', fontWeight:'700', color:'#0f1214', fontFamily:font}}><strong>DR Catering</strong></div>
          <div style={{fontSize:'12px', color:'#aaa', letterSpacing:'0.05em', marginTop:'6px', fontFamily:font}}>Catering Operating System</div>
          <div style={{fontSize:'12px', fontWeight:'700', color:'#bbb', marginTop:'6px', fontFamily:font}}>{form.order_number}</div>
          <button
            onClick={handleSignOut}
            style={{position:'absolute', top:0, right:0, background:'transparent', border:'1px solid #e8e6e0', borderRadius:'8px', padding:'5px 12px', fontSize:'12px', fontWeight:'600', color:'#888', cursor:'pointer', fontFamily:font}}
          >
            Sign out
          </button>
        </div>

        <div style={{fontSize:'20px', fontWeight:'700', color:'#0f1214', fontFamily:font, marginBottom:'24px'}}>New Order</div>

        {returnModal && (
          <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px'}}
            onClick={() => setReturnModal(null)}>
            <div style={{background:'#fff', borderRadius:'16px', width:'100%', maxWidth:'480px', padding:'28px', boxShadow:'0 8px 32px rgba(0,0,0,0.18)', fontFamily:font}}
              onClick={e => e.stopPropagation()}>
              <div style={{fontSize:'16px', fontWeight:'700', color:'#0f1214', marginBottom:'20px'}}>Welcome back! Last order details:</div>

              {returnModal.lastAddress && (
                <div style={{marginBottom:'20px', padding:'14px', background:'#f9f8f5', borderRadius:'10px'}}>
                  <div style={{fontSize:'11px', fontWeight:'700', color:'#888', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'6px'}}>Delivery Address</div>
                  <div style={{fontSize:'13px', color:'#0f1214', marginBottom:'12px', lineHeight:'1.6'}}>{returnModal.lastAddress}</div>
                  <div style={{display:'flex', gap:'8px', flexWrap:'wrap'}}>
                    <button onClick={() => { ff('delivery_address', returnModal.lastAddress); setReturnModal(m => m.lastMenu ? { ...m, lastAddress: null } : null); }} style={{background:'#0f1214', color:'#fff', padding:'8px 16px', borderRadius:'8px', border:'none', fontSize:'13px', fontWeight:'600', cursor:'pointer', fontFamily:font}}>Same address</button>
                    <button onClick={() => { setReturnModal(m => m.lastMenu ? { ...m, lastAddress: null } : null); }} style={{background:'#fff', color:'#0f1214', padding:'8px 16px', borderRadius:'8px', border:'1px solid #e8e6e0', fontSize:'13px', fontWeight:'600', cursor:'pointer', fontFamily:font}}>I'll update it</button>
                  </div>
                </div>
              )}

              {returnModal.lastMenu && (
                <div style={{marginBottom:'4px', padding:'14px', background:'#f9f8f5', borderRadius:'10px'}}>
                  <div style={{fontSize:'11px', fontWeight:'700', color:'#888', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'6px'}}>Menu</div>
                  <div style={{fontSize:'13px', color:'#0f1214', whiteSpace:'pre-line', marginBottom:'12px', lineHeight:'1.8', maxHeight:'160px', overflowY:'auto'}}>{returnModal.lastMenu}</div>
                  <div style={{display:'flex', gap:'8px', flexWrap:'wrap'}}>
                    <button onClick={() => { ff('order_details', returnModal.lastMenu); setReturnModal(m => m.lastAddress ? { ...m, lastMenu: null } : null); }} style={{background:'#0f1214', color:'#fff', padding:'8px 16px', borderRadius:'8px', border:'none', fontSize:'13px', fontWeight:'600', cursor:'pointer', fontFamily:font}}>Same menu</button>
                    <button onClick={() => { setReturnModal(m => m.lastAddress ? { ...m, lastMenu: null } : null); }} style={{background:'#fff', color:'#0f1214', padding:'8px 16px', borderRadius:'8px', border:'1px solid #e8e6e0', fontSize:'13px', fontWeight:'600', cursor:'pointer', fontFamily:font}}>I'll update it</button>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        <span style={sectionLabel}>Client Details</span>

        <div style={{marginBottom:'18px', position:'relative'}}>
          <label style={labelStyle}>Client name <span style={required}>*</span></label>
          <input style={inputStyle} placeholder="Sarah Johnson" value={form.client_name} onChange={e => handleNameChange(e.target.value)}/>
          {suggestions.length > 0 && (
            <div style={{position:'absolute', top:'100%', left:0, right:0, background:'#fff', border:'1px solid #e8e6e0', borderRadius:'10px', zIndex:10, marginTop:'4px', overflow:'hidden', boxShadow:'0 4px 12px rgba(0,0,0,0.08)'}}>
              {suggestions.map((c, i) => (
                <div key={i} onClick={() => selectSuggestion(c)}
                  style={{padding:'12px 16px', fontSize:'14px', cursor:'pointer', borderBottom: i < suggestions.length-1 ? '1px solid #f5f4f0':'none', fontFamily:font, color:'#0f1214', background:'#fff'}}
                  onMouseEnter={e => e.currentTarget.style.background='#f9f8f5'}
                  onMouseLeave={e => e.currentTarget.style.background='#fff'}>
                  {c.client_name}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:'16px', marginBottom:'18px'}}>
          <div>
            <label style={labelStyle}>Phone number <span style={required}>*</span></label>
            <input style={inputStyle} type="tel" placeholder="201-555-0000" value={form.client_phone} onChange={e => ff('client_phone', formatPhone(e.target.value))}/>
          </div>
          <div>
            <label style={labelStyle}>Email <span style={{fontSize:'10px', color:'#bbb', fontWeight:'400', textTransform:'none'}}>(optional)</span></label>
            <input style={inputStyle} type="email" placeholder="sarah@company.com" value={form.client_email} onChange={e => ff('client_email', e.target.value)}/>
          </div>
        </div>

        <div style={{display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:'16px', marginBottom:'18px'}}>
          <div>
            <label style={labelStyle}>On-site contact <span style={{fontSize:'10px', color:'#bbb', fontWeight:'400', textTransform:'none'}}>(optional)</span></label>
            <input style={inputStyle} placeholder="Who will receive the order?" value={form.on_site_contact} onChange={e => ff('on_site_contact', e.target.value)}/>
          </div>
          <div>
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
        </div>

        {form.event_type === 'Other' && (
          <div style={{marginBottom:'18px'}}>
            <label style={labelStyle}>Please specify event type <span style={required}>*</span></label>
            <input style={inputStyle} placeholder="Describe the event..." value={form.event_type_other} onChange={e => ff('event_type_other', e.target.value)}/>
          </div>
        )}

        <span style={sectionLabel}>Delivery Details</span>

        <div style={{marginBottom:'18px'}}>
          <label style={labelStyle}>Delivery address <span style={required}>*</span></label>
          <input style={inputStyle} placeholder="Full address" value={form.delivery_address} onChange={e => ff('delivery_address', e.target.value)}/>
        </div>

        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px', marginBottom:'18px'}}>
          <div>
            <label style={labelStyle}>Delivery date <span style={required}>*</span></label>
            <input style={inputStyle} type="date" value={form.delivery_date} onChange={e => ff('delivery_date', e.target.value)}/>
          </div>
          <div>
            <label style={labelStyle}>Delivery time</label>
            <input style={inputStyle} type="time" value={form.delivery_time} onChange={e => ff('delivery_time', e.target.value)}/>
          </div>
        </div>

        <div style={{marginBottom:'18px'}}>
          <label style={labelStyle}>Number of guests</label>
          <input style={inputStyle} type="text" placeholder="40 + 6 vegetarian + 3 gluten free" value={form.guest_count} onChange={e => handleGuestCount(e.target.value)}/>
          {guestTotal > 0 && <p style={{fontSize:'13px', fontWeight:'700', color:'#0f1214', margin:'6px 0 0', fontFamily:font}}>= {guestTotal} total guests</p>}
          <p style={{fontSize:'11px', color:'#aaa', margin:'4px 0 0', fontFamily:font}}>Use + to separate groups</p>
        </div>

        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:'12px', fontWeight:'700', color:'#0f1214', textTransform:'uppercase', letterSpacing:'0.08em', margin:'28px 0 16px', paddingBottom:'8px', borderBottom:'2px solid #0f1214', fontFamily:font}}>
          <span>Menu <span style={required}>*</span></span>
          <button onClick={() => startListening('menu')} style={micBtn('menu')} title={listening === 'menu' ? 'Stop listening' : 'Voice input'}>
            <MicIcon />
          </button>
        </div>

        <div style={{marginBottom:'20px'}}>
          <textarea style={{...inputStyle, height:'200px', resize:'none', lineHeight:'1.8'}} value={form.order_details} onChange={handleMenu} onKeyDown={handleMenuKey}/>
          {listening === 'menu'
            ? <p style={{fontSize:'11px', color:'#e53e3e', margin:'4px 0 0', fontFamily:font}}>Listening... say "next" to start a new item</p>
            : <p style={{fontSize:'11px', color:'#aaa', margin:'4px 0 0', fontFamily:font}}>Press Enter or tap mic to add items</p>
          }
        </div>

        <div style={{marginBottom:'32px'}}>
          <label style={labelStyle}>Notes <span style={{fontSize:'10px', color:'#bbb', fontWeight:'400', textTransform:'none'}}>(optional)</span></label>
          <textarea style={{...inputStyle, height:'80px', resize:'none'}} placeholder="Gate code, elevator only, call before arriving..." value={form.notes} onChange={e => ff('notes', e.target.value)}/>
        </div>

        <div style={{fontSize:'11px', color:'#bbb', marginBottom:'16px', fontFamily:font}}><span style={required}>*</span> Required fields</div>

        <button onClick={save} disabled={saving} style={{width:'100%', background: saving ? '#888':'#0f1214', color:'#fff', borderRadius:'10px', padding:'16px', fontSize:'16px', fontWeight:'700', border:'none', cursor: saving ? 'not-allowed':'pointer', fontFamily:font, letterSpacing:'0.01em'}}>
          {saving ? 'Sending...' : 'Send order to kitchen'}
        </button>

      </div>
    </main>
  );
}
