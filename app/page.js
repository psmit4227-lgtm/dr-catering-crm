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
  const [screen, setScreen] = useState('loading'); // 'loading'|'login'|'app'

  // Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);


  // ── Auth init ─────────────────────────────────────────────────
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

  // ── Auth actions ──────────────────────────────────────────────
  const handleSignIn = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
    if (error) { setLoginError('Invalid email or password.'); setLoginLoading(false); return; }
    setScreen('app');
    setLoginLoading(false);
  };

  const handleSignOut = async () => { await supabase.auth.signOut(); };

  // ── App state ─────────────────────────────────────────────────
  const [form, setForm] = useState({
    order_number: genOrderNum(),
    client_name: '', client_phone: '', client_email: '',
    on_site_contact: '', on_site_phone: '', event_type: '', event_type_other: '',
    delivery_address: '', delivery_date: '', time_out: '', delivery_time: '',
    guest_count: '', menu_package: 'Custom', order_details: '• ', kitchen_notes: '', notes: ''
  });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [savedOrder, setSavedOrder] = useState(null);
  const [pastClients, setPastClients] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [returnModal, setReturnModal] = useState(null);
  const [width, setWidth] = useState(0);
  const [guestTotal, setGuestTotal] = useState(0);
  const [menuItems, setMenuItems] = useState([]);
  const [listening, setListening] = useState(null);
  const recognitionRef = useRef(null);
  const speechBaseRef = useRef('');
  const speechAccumulatedRef = useRef('');

  // AI Smart Fill state
  const [aiDescription, setAiDescription] = useState('');
  const [aiPlacesQuery, setAiPlacesQuery] = useState('');
  const [smartFillLoading, setSmartFillLoading] = useState(false);
  const [smartFillError, setSmartFillError] = useState('');
  const [aiMicListening, setAiMicListening] = useState(false);
  const [aiMicProcessing, setAiMicProcessing] = useState(false);
  const [googleLoaded, setGoogleLoaded] = useState(false);
  const aiAddressInputRef = useRef(null);
  const aiMicRef = useRef(null);
  const aiAutoFillTimerRef = useRef(null);

  useEffect(() => {
    setWidth(window.innerWidth);
    const handle = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, []);

  useEffect(() => {
    if (screen !== 'app') return;
    fetch('/api/clients').then(r => r.json()).then(({ data }) => {
      if (data) setPastClients(data);
    });
  }, [screen]);

  // Inject spinner keyframe once
  useEffect(() => {
    const s = document.createElement('style');
    s.textContent = '@keyframes ai-spin { to { transform: rotate(360deg); } }';
    document.head.appendChild(s);
    return () => s.remove();
  }, []);

  // Load Google Places script
  useEffect(() => {
    if (screen !== 'app') return;
    const key = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
    if (!key) return;
    if (window.google?.maps?.places) { setGoogleLoaded(true); return; }
    window.__googlePlacesReady = () => setGoogleLoaded(true);
    if (!document.querySelector('script[data-gp]')) {
      const s = document.createElement('script');
      s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&callback=__googlePlacesReady`;
      s.async = true; s.setAttribute('data-gp', '1');
      document.head.appendChild(s);
    }
  }, [screen]);

  // Init autocomplete once Google is loaded
  useEffect(() => {
    if (!googleLoaded || !aiAddressInputRef.current) return;
    const ac = new window.google.maps.places.Autocomplete(aiAddressInputRef.current, { types: ['address'] });
    ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      const addr = place.formatted_address || aiAddressInputRef.current.value;
      setAiPlacesQuery(addr);
      ff('delivery_address', addr);
    });
  }, [googleLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const res = await fetch(`/api/clients?name=${encodeURIComponent(client.client_name)}`);
    const { data, error } = await res.json();
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

  const startAiListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('Speech recognition not supported. Please use Chrome or Safari.'); return; }
    // User clicked stop manually — suppress auto-fill, let them review text first
    if (aiMicListening) {
      aiMicRef.current._manualStop = true;
      aiMicRef.current?.stop();
      return;
    }
    if (aiMicRef.current) aiMicRef.current.abort();
    const r = new SR();
    aiMicRef.current = r;
    r.continuous = true; r.interimResults = true; r.lang = 'en-US';
    const base = aiDescription;
    let accumulated = ''; let aborted = false;
    r.onstart = () => setAiMicListening(true);
    r.onresult = (e) => {
      let final = '', interim = '';
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript + ' ';
        else interim += e.results[i][0].transcript;
      }
      accumulated = final;
      const sep = base && !base.endsWith(' ') ? ' ' : '';
      setAiDescription(base + (base && final ? sep : '') + final + interim);
    };
    r.onend = () => {
      if (aborted) return;
      const wasManual = r._manualStop === true;
      setAiMicListening(false); aiMicRef.current = null;
      const finalText = accumulated
        ? (base + (base && !base.endsWith(' ') ? ' ' : '') + accumulated).trim()
        : base;
      if (accumulated) setAiDescription(finalText);
      // Only auto-trigger on natural silence — not when user clicked stop
      if (!wasManual && finalText.trim()) {
        setAiMicProcessing(true);
        aiAutoFillTimerRef.current = setTimeout(() => {
          setAiMicProcessing(false);
          handleSmartFill(finalText);
        }, 1500);
      }
    };
    r.onerror = (e) => {
      if (e.error === 'aborted') { aborted = true; return; }
      console.warn('AI mic error:', e.error);
      setAiMicListening(false); aiMicRef.current = null;
    };
    r.start();
  };

  const EVENT_TYPES = ['Corporate lunch','Birthday party','Wedding','Office catering','Private dinner','Medical office'];

  // Convert 12-hour "11:00 AM" / "2:00 PM" → 24-hour "11:00" / "14:00"
  // required by <input type="time"> which stores HH:MM internally
  // (the browser then displays it in the user's locale format, e.g. 12-hour with AM/PM)
  const to24h = (t) => {
    if (!t) return '';
    // Match optional minutes: "2 PM", "2:00 PM", "14:00"
    const match = t.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);
    if (!match) return '';
    let h = parseInt(match[1], 10);
    const m = match[2] || '00';
    const period = (match[3] || '').toUpperCase();
    if (period === 'PM' && h !== 12) h += 12;   // 2 PM → 14
    if (period === 'AM' && h === 12) h = 0;      // 12 AM → 00 (midnight)
    // If no AM/PM given, treat as already 24-hour (pass through)
    return String(h).padStart(2, '0') + ':' + m;
  };

  const handleSmartFill = async (textOverride) => {
    const text = typeof textOverride === 'string' ? textOverride : aiDescription;
    if (!text.trim()) return;
    setSmartFillLoading(true); setSmartFillError('');
    try {
      const res = await fetch('/api/smart-fill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: text }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const p = data.result;
      if (p.clientName) handleNameChange(p.clientName);
      if (p.clientPhone) ff('client_phone', formatPhone(p.clientPhone));
      if (p.clientEmail) ff('client_email', p.clientEmail);
      if (p.onsiteContactName) ff('on_site_contact', p.onsiteContactName);
      if (p.onsiteContactPhone) ff('on_site_phone', formatPhone(p.onsiteContactPhone));
      if (p.eventType) {
        const match = EVENT_TYPES.find(t => t.toLowerCase() === p.eventType.toLowerCase());
        if (match) ff('event_type', match);
        else { ff('event_type', 'Other'); ff('event_type_other', p.eventType); }
      }
      if (p.deliveryAddress) ff('delivery_address', p.deliveryAddress);
      if (p.deliveryDate) ff('delivery_date', p.deliveryDate);
      if (p.arrivalTime) ff('delivery_time', to24h(p.arrivalTime));
      if (p.pickupTime) ff('time_out', to24h(p.pickupTime));
      if (p.guestCount) handleGuestCount(String(p.guestCount));
      if (p.menuItems?.length) {
        ff('menu_package', 'Custom');
        setMenuItems([]);
        ff('order_details', p.menuItems.map(i => `• ${i}`).join('\n'));
      }
      if (p.kitchenNotes) ff('kitchen_notes', p.kitchenNotes);
      if (p.driverNotes) ff('notes', p.driverNotes);
    } catch (err) {
      setSmartFillError(err.message || 'Could not parse response. Please try again.');
    }
    setSmartFillLoading(false);
  };

  const CAT_SIZES = {
    HOT:   ['Half tray', 'Full tray', '9in shallow', 'Full shallow'],
    COLD:  ['12 inch', '14 inch', '16 inch'],
    SALAD: ['Half salad', 'Full salad'],
    SMALL: null,
  };

  const PACKAGE_ITEMS = {
    'Mediterranean Sun Package': [
      { name: 'Mediterranean Salad', cat: 'SALAD' },
      { name: 'Chicken Skewers with Lemon Parsley Potato', cat: 'HOT' },
      { name: 'Vegetable Skewers with Falafel', cat: 'HOT' },
      { name: 'Beef Skewers', cat: 'HOT' },
      { name: 'Quinoa Salad with Feta Kalamata Cherry Tomato Pickled Onion', cat: 'SALAD' },
      { name: 'Pasta with Chick Peas', cat: 'HOT' },
      { name: 'White Rice', cat: 'HOT' },
      { name: 'Spanakopita', cat: 'HOT' },
      { name: 'Tzatziki Sauce', cat: 'SMALL' },
      { name: 'Cookies', cat: 'SMALL' },
    ],
    'Fiesta Del Sol (Mexican)': [
      { name: 'Tostada Salad', cat: 'SALAD' },
      { name: 'Guacamole', cat: 'SMALL' },
      { name: 'Cheddar Cheese', cat: 'SMALL' },
      { name: 'Salsa', cat: 'SMALL' },
      { name: 'Sour Cream', cat: 'SMALL' },
      { name: 'White Corn Tortilla Chips', cat: 'SMALL' },
      { name: 'Soft Tacos', cat: 'SMALL' },
      { name: 'Chipotle Chicken', cat: 'HOT' },
      { name: 'Taco Meat', cat: 'HOT' },
      { name: 'Lime Cilantro Rice', cat: 'HOT' },
      { name: 'Black Beans', cat: 'HOT' },
      { name: 'Spicy Vegetables', cat: 'HOT' },
      { name: 'Fish Tacos', cat: 'HOT' },
      { name: 'Cookies', cat: 'SMALL' },
    ],
    'Signature Cold Buffet': [
      { name: 'Artisan Sandwiches on Focaccia', cat: 'COLD' },
      { name: 'Gourmet Wraps', cat: 'COLD' },
      { name: 'Fresh Salad', cat: 'SALAD' },
      { name: 'Fruit and Nut Mix', cat: 'SMALL' },
      { name: 'Cold Pasta Salad', cat: 'SALAD' },
      { name: 'Tortilla Chips', cat: 'SMALL' },
      { name: 'Cookies', cat: 'SMALL' },
      { name: 'Brownies', cat: 'SMALL' },
    ],
    'Barbecue Spread': [
      { name: 'Cobb Salad', cat: 'SALAD' },
      { name: 'Red Potato Salad', cat: 'SALAD' },
      { name: 'Cold Pasta Salad', cat: 'SALAD' },
      { name: 'BBQ Chicken', cat: 'HOT' },
      { name: 'BBQ Ribs', cat: 'HOT' },
      { name: 'Sliders with American Cheese Lettuce Tomato Chipotle Ketchup', cat: 'HOT' },
      { name: 'Hotdogs with Sauerkraut', cat: 'HOT' },
      { name: 'Mac and Cheese', cat: 'HOT' },
      { name: 'Corn On the Cob', cat: 'HOT' },
      { name: 'Chips', cat: 'SMALL' },
      { name: 'Cookies', cat: 'SMALL' },
    ],
    'Executive Package': [
      { name: 'Salad', cat: 'SALAD' },
      { name: 'Quinoa Salad', cat: 'SALAD' },
      { name: 'Artisan Sandwiches', cat: 'COLD' },
      { name: 'House-made Potato Chips', cat: 'SMALL' },
      { name: 'Fresh Fruit Salad', cat: 'SMALL' },
      { name: 'Cookies', cat: 'SMALL' },
      { name: 'Brownies', cat: 'SMALL' },
      { name: 'Soft Drinks', cat: 'SMALL' },
    ],
    'Italian Package': [
      { name: 'Salad', cat: 'SALAD' },
      { name: 'Focaccia Sandwiches', cat: 'COLD' },
      { name: 'Tuscany Wrap', cat: 'COLD' },
      { name: 'Vegetable Focaccia', cat: 'COLD' },
      { name: 'Pasta', cat: 'HOT' },
      { name: 'Chicken', cat: 'HOT' },
      { name: 'Cookies', cat: 'SMALL' },
    ],
    'Hot and Cold Breakfast Buffet': [
      { name: 'Continental Platter with Bagels Muffins Danish Croissants', cat: 'COLD' },
      { name: 'Cream Cheese', cat: 'SMALL' },
      { name: 'Butter', cat: 'SMALL' },
      { name: 'Jelly', cat: 'SMALL' },
      { name: 'Eggs', cat: 'HOT' },
      { name: 'Bacon', cat: 'HOT' },
      { name: 'French Toast', cat: 'HOT' },
      { name: 'Home Fries', cat: 'HOT' },
      { name: 'Fruit Salad', cat: 'SMALL' },
      { name: 'Yogurt with Granola', cat: 'SMALL' },
      { name: 'Coffee', cat: 'SMALL' },
      { name: 'Orange Juice', cat: 'SMALL' },
      { name: 'Milk', cat: 'SMALL' },
      { name: 'Sugar Equal Stirrers', cat: 'SMALL' },
    ],
    'Cold Continental Breakfast': [
      { name: 'Continental Platter with Bagels Muffins Danish Croissants', cat: 'COLD' },
      { name: 'Cream Cheese', cat: 'SMALL' },
      { name: 'Butter', cat: 'SMALL' },
      { name: 'Jelly', cat: 'SMALL' },
      { name: 'Fruit Salad', cat: 'SMALL' },
      { name: 'Coffee', cat: 'SMALL' },
      { name: 'Orange Juice', cat: 'SMALL' },
      { name: 'Milk', cat: 'SMALL' },
      { name: 'Sugar Equal Stirrers', cat: 'SMALL' },
    ],
  };

  const serializeMenuItems = (items) => items.map(item => {
    let line = `• ${item.name}`;
    if (item.size) line += ` - ${item.size}`;
    line += ` x${item.qty}`;
    if (item.cat === 'SALAD' && item.size) {
      line += item.size === 'Half salad' ? ' + half pint dressing' : ' + 1 pint dressing';
    }
    return line;
  }).join('\n');

  const handlePackageChange = (pkg) => {
    ff('menu_package', pkg);
    if (pkg === 'Custom') {
      ff('order_details', '• ');
      setMenuItems([]);
    } else {
      const items = PACKAGE_ITEMS[pkg].map(({ name, cat }) => ({
        name, cat,
        size: CAT_SIZES[cat] ? CAT_SIZES[cat][0] : '',
        qty: 1,
      }));
      setMenuItems(items);
      ff('order_details', serializeMenuItems(items));
    }
  };

  const updateMenuItem = (index, field, value) => {
    const updated = menuItems.map((item, i) =>
      i === index ? { ...item, [field]: field === 'qty' ? parseInt(value) : value } : item
    );
    setMenuItems(updated);
    ff('order_details', serializeMenuItems(updated));
  };

  const simpleFields = new Set(['client_name', 'client_phone', 'client_email', 'on_site_contact', 'on_site_phone', 'delivery_address', 'guest_count']);

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
    if (!form.on_site_contact) { alert('Please enter on-site contact'); return; }
    if (!form.on_site_phone) { alert('Please enter on-site contact phone number'); return; }
    if (!form.order_details || form.order_details === '• ') { alert('Please enter the menu'); return; }
    if (form.event_type === 'Other' && !form.event_type_other) { alert('Please specify the event type'); return; }
    setSaving(true);
    const finalEventType = form.event_type === 'Other' ? `Other: ${form.event_type_other}` : form.event_type;
    const orderToSave = { ...form, event_type: finalEventType, guest_count: form.guest_count + (guestTotal > 0 ? ` (Total: ${guestTotal})` : '') };
    const insertRes = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(orderToSave) });
    const insertData = await insertRes.json();
    if (insertData.error) { alert('Error saving: ' + insertData.error); setSaving(false); return; }
    let pdfUrl = null;
    try {
      const pdfBase64 = generateOrderPDF(orderToSave);
      const pdfBlob = new Blob(
        [Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0))],
        { type: 'application/pdf' }
      );
      const fileName = `${orderToSave.order_number}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from('order-pdfs')
        .upload(fileName, pdfBlob, { contentType: 'application/pdf', upsert: true });
      if (uploadError) {
        console.error('PDF upload failed:', uploadError);
      } else {
        const { data: urlData } = supabase.storage.from('order-pdfs').getPublicUrl(fileName);
        pdfUrl = urlData.publicUrl;
      }
    } catch (pdfErr) { console.error('PDF generation/upload failed:', pdfErr); }
    await fetch('/api/send-order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...orderToSave, pdfUrl }) });
    setSavedOrder(orderToSave);
    setDone(true);
    setSaving(false);
  };

  const reset = () => {
    setForm({ order_number: genOrderNum(), client_name: '', client_phone: '', client_email: '', on_site_contact: '', on_site_phone: '', event_type: '', event_type_other: '', delivery_address: '', delivery_date: '', time_out: '', delivery_time: '', guest_count: '', menu_package: 'Custom', order_details: '• ', kitchen_notes: '', notes: '' });
    setDone(false); setSavedOrder(null); setSuggestions([]); setReturnModal(null); setGuestTotal(0);
    setAiPlacesQuery(''); setAiDescription(''); setAiMicProcessing(false); setSmartFillError('');
    clearTimeout(aiAutoFillTimerRef.current);
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

        {/* ── AI Smart Fill ───────────────────────────────────── */}
        <div style={{marginBottom:'32px'}}>
          <div style={{fontSize:'11px', fontWeight:'700', color:'#c0392b', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'10px', fontFamily:font}}>
            ✦ AI Smart Fill
          </div>

          {/* Box 1: Address + Places autocomplete */}
          <div style={{background:'#fff', borderRadius:'12px', border:'1px solid #e8e6e0', padding:'10px 14px', marginBottom:'10px', display:'flex', alignItems:'center', gap:'10px', boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
            <span style={{fontSize:'17px', flexShrink:0, userSelect:'none', lineHeight:1}}>📍</span>
            <input
              ref={aiAddressInputRef}
              style={{flex:1, border:'none', outline:'none', fontSize: isMobile ? '16px' : '15px', color:'#0f1214', fontFamily:font, background:'transparent', padding:'4px 0'}}
              placeholder="Please enter the delivery address"
              value={aiPlacesQuery}
              onChange={e => setAiPlacesQuery(e.target.value)}
              autoComplete="off"
            />
          </div>

          {/* Box 2: Event description + mic + chips + Smart Fill button */}
          <div style={{background:'#fff', borderRadius:'12px', border:'1px solid #e8e6e0', padding:'12px 14px', boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
            <div style={{display:'flex', gap:'10px'}}>
              <span style={{fontSize:'17px', flexShrink:0, marginTop:'3px', userSelect:'none', lineHeight:1}}>💡</span>
              <div style={{flex:1, position:'relative'}}>
                <textarea
                  style={{width:'100%', border:'none', outline:'none', resize:'none', height:'96px', fontSize: isMobile ? '16px' : '15px', color:'#0f1214', fontFamily:font, background:'transparent', lineHeight:'1.6', paddingRight:'38px', boxSizing:'border-box'}}
                  placeholder={"I'm booking a corporate lunch for 80 people on Friday at noon, client is John Smith, 973-555-1234..."}
                  value={aiDescription}
                  onChange={e => setAiDescription(e.target.value)}
                />
                <button
                  onClick={startAiListening}
                  title={aiMicListening ? 'Stop listening' : 'Voice input'}
                  style={{
                    position:'absolute', bottom:'4px', right:'0px',
                    background: aiMicListening ? '#e53e3e' : '#f0efeb',
                    color: aiMicListening ? '#fff' : '#555',
                    border:'none', borderRadius:'50%', width:'30px', height:'30px',
                    cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                    transition:'background 0.15s', flexShrink:0,
                  }}
                >
                  <MicIcon />
                </button>
                {aiMicProcessing && (
                  <div style={{position:'absolute', bottom:'-20px', right:'0px', fontSize:'11px', color:'#c0392b', fontFamily:font, fontWeight:'600', whiteSpace:'nowrap'}}>
                    Processing…
                  </div>
                )}
              </div>
            </div>

            {/* Hint chips */}
            <div style={{display:'flex', flexWrap:'wrap', gap:'5px', marginTop:'10px', paddingLeft:'27px'}}>
              {[
                ['Client Name',   /\b([A-Z][a-z]+ [A-Z][a-z]+)/.test(aiDescription) || /\b(client|customer)\s+(is\s+)?\S/i.test(aiDescription)],
                ['Phone',         /(\d{3}[-.\s]?\d{3}[-.\s]?\d{4}|\(\d{3}\)\s?\d{3})/.test(aiDescription)],
                ['Date & Time',   /\b(mon|tue|wed|thu|fri|sat|sun|today|tomorrow|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{1,2}\/\d{1,2}|noon|midnight|\d{1,2}:\d{2}|\d{1,2}\s*(am|pm))\b/i.test(aiDescription)],
                ['Guest Count',   /\b\d+\s*(people|guests|pax|persons|attendees|heads)\b/i.test(aiDescription) || /\bfor\s+\d+\b/i.test(aiDescription)],
                ['Menu',          /\b(menu|lunch|dinner|breakfast|food|catering|buffet|package|sandwich|pizza|pasta|taco|bbq|salad|burger|wrap|cuisine)\b/i.test(aiDescription)],
                ['On-site Contact', /\b(on.?site|contact is|will receive|greet)\b/i.test(aiDescription)],
                ['Email',         /\b[\w.+-]+@[\w-]+\.\w+\b/.test(aiDescription)],
              ].map(([label, active]) => (
                <span key={label} style={{
                  fontSize:'11px', fontWeight:'600', padding:'3px 9px',
                  borderRadius:'20px', border:'1px solid',
                  borderColor: active ? '#22a05e' : '#e0dfdb',
                  background: active ? '#e8f8f0' : '#f5f4f0',
                  color: active ? '#22a05e' : '#bbb',
                  transition:'all 0.2s', fontFamily:font, lineHeight:'1.6',
                }}>
                  ● {label}
                </span>
              ))}
            </div>

            {/* Smart Fill button row */}
            <div style={{display:'flex', justifyContent:'flex-end', alignItems:'center', gap:'10px', marginTop:'12px'}}>
              {smartFillError && (
                <span style={{fontSize:'12px', color:'#e53e3e', fontFamily:font}}>{smartFillError}</span>
              )}
              <button
                onClick={handleSmartFill}
                disabled={smartFillLoading || aiMicProcessing || !aiDescription.trim()}
                style={{
                  background: (!aiDescription.trim() || smartFillLoading || aiMicProcessing) ? '#aaa' : '#c0392b',
                  color:'#fff', border:'none', borderRadius:'10px',
                  padding:'10px 20px', fontSize:'14px', fontWeight:'700',
                  cursor: (!aiDescription.trim() || smartFillLoading || aiMicProcessing) ? 'not-allowed' : 'pointer',
                  fontFamily:font, display:'flex', alignItems:'center', gap:'8px',
                  transition:'background 0.15s', letterSpacing:'0.01em',
                }}
              >
                {smartFillLoading ? (
                  <>
                    <span style={{width:'13px', height:'13px', border:'2px solid rgba(255,255,255,0.35)', borderTopColor:'#fff', borderRadius:'50%', display:'inline-block', animation:'ai-spin 0.8s linear infinite'}} />
                    Filling…
                  </>
                ) : 'Smart Fill →'}
              </button>
            </div>
          </div>
        </div>

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
          <div style={{display:'flex', flexDirection:'column', gap:'16px'}}>
            <div>
              <label style={labelStyle}>On-site contact <span style={required}>*</span></label>
              <input style={inputStyle} placeholder="Who will receive the order?" value={form.on_site_contact} onChange={e => ff('on_site_contact', e.target.value)}/>
            </div>
            <div>
              <label style={labelStyle}>On-site contact phone number <span style={required}>*</span></label>
              <input style={inputStyle} type="tel" placeholder="201-555-0000" value={form.on_site_phone} onChange={e => ff('on_site_phone', formatPhone(e.target.value))}/>
            </div>
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

        <div style={{display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap:'16px', marginBottom:'18px'}}>
          <div>
            <label style={labelStyle}>Delivery date <span style={required}>*</span></label>
            <input style={inputStyle} type="date" value={form.delivery_date} onChange={e => ff('delivery_date', e.target.value)}/>
          </div>
          <div>
            <label style={labelStyle}>Time out</label>
            <input style={inputStyle} type="time" value={form.time_out} onChange={e => ff('time_out', e.target.value)}/>
          </div>
          <div>
            <label style={labelStyle}>Time there</label>
            <input style={inputStyle} type="time" value={form.delivery_time} onChange={e => ff('delivery_time', e.target.value)}/>
          </div>
        </div>

        <div style={{marginBottom:'18px'}}>
          <label style={labelStyle}>Number of guests</label>
          <input style={inputStyle} type="text" placeholder="40 + 6 vegetarian + 3 gluten free" value={form.guest_count} onChange={e => handleGuestCount(e.target.value)}/>
          {guestTotal > 0 && <p style={{fontSize:'13px', fontWeight:'700', color:'#0f1214', margin:'6px 0 0', fontFamily:font}}>= {guestTotal} total guests</p>}
          <p style={{fontSize:'11px', color:'#aaa', margin:'4px 0 0', fontFamily:font}}>Use + to separate groups</p>
        </div>

        <div style={{marginBottom:'18px'}}>
          <label style={labelStyle}>Menu package</label>
          <select style={inputStyle} value={form.menu_package} onChange={e => handlePackageChange(e.target.value)}>
            <option value="Custom">Custom</option>
            <option>Mediterranean Sun Package</option>
            <option>Fiesta Del Sol (Mexican)</option>
            <option>Signature Cold Buffet</option>
            <option>Barbecue Spread</option>
            <option>Executive Package</option>
            <option>Italian Package</option>
            <option>Hot and Cold Breakfast Buffet</option>
            <option>Cold Continental Breakfast</option>
          </select>
        </div>

        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:'12px', fontWeight:'700', color:'#0f1214', textTransform:'uppercase', letterSpacing:'0.08em', margin:'0 0 16px', paddingBottom:'8px', borderBottom:'2px solid #0f1214', fontFamily:font}}>
          <span>Menu <span style={required}>*</span></span>
          {form.menu_package === 'Custom' && (
            <button onClick={() => startListening('menu')} style={micBtn('menu')} title={listening === 'menu' ? 'Stop listening' : 'Voice input'}>
              <MicIcon />
            </button>
          )}
        </div>

        {form.menu_package === 'Custom' ? (
          <div style={{marginBottom:'18px'}}>
            <textarea style={{...inputStyle, height:'200px', resize:'none', lineHeight:'1.8'}} value={form.order_details} onChange={handleMenu} onKeyDown={handleMenuKey}/>
            {listening === 'menu'
              ? <p style={{fontSize:'11px', color:'#e53e3e', margin:'4px 0 0', fontFamily:font}}>Listening... say "next" to start a new item</p>
              : <p style={{fontSize:'11px', color:'#aaa', margin:'4px 0 0', fontFamily:font}}>Press Enter or tap mic to add items</p>
            }
          </div>
        ) : (
          <div style={{marginBottom:'18px', border:'1px solid #e8e6e0', borderRadius:'12px', overflow:'hidden'}}>
            {/* Column headers */}
            <div style={{display:'grid', gridTemplateColumns:'1fr 148px 68px', gap:'8px', padding:'8px 14px 8px 16px', background:'#f9f8f5', borderBottom:'1px solid #e8e6e0'}}>
              <div style={{fontSize:'10px', fontWeight:'700', color:'#888', textTransform:'uppercase', letterSpacing:'0.06em', fontFamily:font}}>Item</div>
              <div style={{fontSize:'10px', fontWeight:'700', color:'#888', textTransform:'uppercase', letterSpacing:'0.06em', fontFamily:font}}>Size</div>
              <div style={{fontSize:'10px', fontWeight:'700', color:'#888', textTransform:'uppercase', letterSpacing:'0.06em', fontFamily:font, textAlign:'center'}}>Qty</div>
            </div>
            {menuItems.map((item, i) => (
              <div key={i} style={{display:'grid', gridTemplateColumns:'1fr 148px 68px', gap:'8px', padding:'10px 14px 10px 16px', alignItems:'center', borderBottom: i < menuItems.length - 1 ? '1px solid #f0efeb' : 'none', background:'#fff'}}>
                <div style={{fontSize:'14px', fontWeight:'500', color:'#0f1214', fontFamily:font, lineHeight:'1.35', minWidth:0}}>{item.name}</div>
                <div>
                  {CAT_SIZES[item.cat] ? (
                    <select
                      value={item.size}
                      onChange={e => updateMenuItem(i, 'size', e.target.value)}
                      style={{width:'100%', minHeight:'44px', padding:'8px 10px', border:'1px solid #e8e6e0', borderRadius:'8px', fontSize:'13px', color:'#0f1214', fontFamily:font, background:'#fff', outline:'none'}}
                    >
                      {CAT_SIZES[item.cat].map(s => <option key={s}>{s}</option>)}
                    </select>
                  ) : (
                    <div style={{fontSize:'12px', color:'#ccc', fontFamily:font, textAlign:'center', padding:'4px 0'}}>—</div>
                  )}
                </div>
                <select
                  value={item.qty}
                  onChange={e => updateMenuItem(i, 'qty', e.target.value)}
                  style={{width:'100%', minHeight:'44px', padding:'8px 4px', border:'1px solid #e8e6e0', borderRadius:'8px', fontSize:'15px', fontWeight:'600', color:'#0f1214', fontFamily:font, background:'#fff', outline:'none', textAlign:'center'}}
                >
                  {[1,2,3,4].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}

        <div style={{marginBottom:'18px'}}>
          <label style={labelStyle}>Additional notes for kitchen <span style={{fontSize:'10px', color:'#bbb', fontWeight:'400', textTransform:'none'}}>(optional)</span></label>
          <textarea style={{...inputStyle, height:'80px', resize:'none'}} placeholder="Allergy notes, substitutions, prep instructions..." value={form.kitchen_notes} onChange={e => ff('kitchen_notes', e.target.value)}/>
        </div>

        <div style={{marginBottom:'32px'}}>
          <label style={labelStyle}>Special instructions for driver <span style={{fontSize:'10px', color:'#bbb', fontWeight:'400', textTransform:'none'}}>(optional)</span></label>
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
