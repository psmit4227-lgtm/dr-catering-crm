'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { generateOrderPDF } from '../pdf';
import MenuWizard, { WIZARD_PACKAGES } from './MenuWizard';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const genOrderNum = () => 'DRC-' + String(Math.floor(Math.random() * 9000) + 1000);

// Returns true when both fields are filled AND time_there is at or before
// time_out — i.e. driver would arrive before leaving.
function timesInvalid(timeOut, timeThere) {
  if (!timeOut || !timeThere) return false;
  const [oh, om] = timeOut.split(':').map(Number);
  const [th, tm] = timeThere.split(':').map(Number);
  if (isNaN(oh) || isNaN(om) || isNaN(th) || isNaN(tm)) return false;
  return (th * 60 + tm) <= (oh * 60 + om);
}

const DIETARY_RE = /\b(vegetarian|vegan|gluten.?free|nut.?free|dairy.?free|lactose|kosher|halal|pescatarian|plant.?based|allerg|intoleran|celiac)\b/i;
const SUBSET_RE  = /\b(including|of which|of them|among them)\b/i;

function parseGuestCount(raw) {
  const str = (raw || '').trim();
  if (!str) return { total: 0, display: '', hint: '' };
  const firstNum = parseInt((str.match(/\d+/) || [])[0], 10);
  if (isNaN(firstNum)) return { total: 0, display: str, hint: '' };
  if (/^\d+$/.test(str)) return { total: firstNum, display: str, hint: '' };
  if (SUBSET_RE.test(str)) {
    return { total: firstNum, display: String(firstNum), hint: `Calculated from: "${str}"` };
  }
  const withDietary = str.match(/\bwith\s+\d+\s+([\w][\w\s-]*)/i);
  if (withDietary && DIETARY_RE.test(withDietary[1])) {
    return { total: firstNum, display: String(firstNum), hint: `Calculated from: "${str}"` };
  }
  const norm = str
    .replace(/\bplus\b/gi, '+')
    .replace(/\band\s+(\d)/gi, '+$1')
    .replace(/\bwith\s+(\d)/gi, '+$1');
  const parts = norm.split('+');
  let total = 0;
  const addends = [];
  for (const part of parts) {
    const m = part.trim().match(/^(\d+)/);
    if (m) { const n = parseInt(m[1], 10); total += n; addends.push(n); }
  }
  if (total > firstNum) {
    return { total, display: String(total), hint: `Calculated: ${addends.join(' + ')} = ${total}` };
  }
  return { total: firstNum, display: String(firstNum), hint: '' };
}

const FONT       = 'inherit';
const NAVY       = '#1B2845';
const NAVY_HOVER = '#2A3D63';
const NAVY_SOFT  = '#E8ECF4';
const TEXT_SEC   = '#5C6478';
const BORDER     = '#E5E7EB';

const EVENT_TYPES = ['Corporate lunch','Birthday party','Wedding','Office catering','Private dinner','Medical office'];

const to24h = (t) => {
  if (!t) return '';
  const match = t.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (!match) return '';
  let h = parseInt(match[1], 10);
  const m = match[2] || '00';
  const period = (match[3] || '').toUpperCase();
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return String(h).padStart(2, '0') + ':' + m;
};

const CAT_SIZES = {
  HOT:   ['Half tray', 'Full tray', '9in shallow', 'Full shallow'],
  COLD:  ['12 inch', '14 inch', '16 inch'],
  SALAD: ['Half salad', 'Full salad'],
  SMALL: null,
};

// Build initial form state. In edit mode, hydrate from the order row, splitting
// "Other: X" event_type back into ('Other', 'X') and re-parsing guest_count.
function buildInitialForm(initialOrder) {
  if (!initialOrder) {
    return {
      order_number: genOrderNum(),
      client_name: '', client_phone: '', client_email: '',
      on_site_contact: '', on_site_phone: '', event_type: '', event_type_other: '',
      delivery_address: '', delivery_date: '', time_out: '', delivery_time: '',
      guest_count: '', guest_count_original: '', menu_package: '', order_details: '• ',
      kitchen_notes: '', notes: '', delivery_method: 'DR Catering Driver',
    };
  }
  const ev = initialOrder.event_type || '';
  let event_type = '';
  let event_type_other = '';
  if (ev.startsWith('Other: ')) {
    event_type = 'Other';
    event_type_other = ev.slice('Other: '.length);
  } else {
    event_type = ev;
  }
  return {
    order_number:        initialOrder.order_number || genOrderNum(),
    client_name:         initialOrder.client_name || '',
    client_phone:        initialOrder.client_phone || '',
    client_email:        initialOrder.client_email || '',
    on_site_contact:     initialOrder.on_site_contact || '',
    on_site_phone:       initialOrder.on_site_phone || '',
    event_type,
    event_type_other,
    delivery_address:    initialOrder.delivery_address || '',
    delivery_date:       initialOrder.delivery_date || '',
    time_out:            initialOrder.time_out || '',
    delivery_time:       initialOrder.delivery_time || '',
    guest_count:         initialOrder.guest_count != null ? String(initialOrder.guest_count) : '',
    guest_count_original: initialOrder.guest_count_original || '',
    menu_package:        initialOrder.menu_package || '',
    order_details:       initialOrder.order_details || '• ',
    kitchen_notes:       initialOrder.kitchen_notes || '',
    notes:               initialOrder.notes || '',
    delivery_method:     initialOrder.delivery_method || 'DR Catering Driver',
  };
}

export default function OrderForm({ mode = 'new', initialOrder = null, onCancel }) {
  const router = useRouter();
  const isEdit = mode === 'edit';

  const [form, setForm]               = useState(() => buildInitialForm(initialOrder));
  const [saving, setSaving]           = useState(false);
  const [done, setDone]               = useState(false);
  const [savedOrder, setSavedOrder]   = useState(null);
  const [pastClients, setPastClients] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [returnModal, setReturnModal] = useState(null);
  const [width, setWidth]             = useState(0);
  const [guestTotal, setGuestTotal]   = useState(() => {
    const g = initialOrder?.guest_count;
    if (!g) return 0;
    return parseGuestCount(String(g)).total;
  });
  const [guestHint, setGuestHint]     = useState('');
  const [menuMode, setMenuMode]       = useState('quick');
  const [menuViewMode, setMenuViewMode] = useState('text');
  const [wizardSuggestedId, setWizardSuggestedId] = useState(null);
  const [menuItems, setMenuItems]     = useState([]);
  const [listening, setListening]     = useState(null);
  const recognitionRef = useRef(null);
  const speechBaseRef = useRef('');
  const speechAccumulatedRef = useRef('');

  // AI Smart Fill (only used in 'new' mode)
  const [aiDescription, setAiDescription]       = useState('');
  const [aiPlacesQuery, setAiPlacesQuery]       = useState('');
  const [smartFillLoading, setSmartFillLoading] = useState(false);
  const [smartFillError, setSmartFillError]     = useState('');
  const [aiMicListening, setAiMicListening]     = useState(false);
  const [aiMicProcessing, setAiMicProcessing]   = useState(false);
  const [googleLoaded, setGoogleLoaded]         = useState(false);
  const aiAddressInputRef = useRef(null);
  const aiMicRef = useRef(null);
  const aiAutoFillTimerRef = useRef(null);

  // Edit-mode toast state
  const [toast, setToast] = useState('');

  useEffect(() => {
    setWidth(window.innerWidth);
    const handle = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, []);

  useEffect(() => {
    fetch('/api/clients').then(r => r.json()).then(({ data }) => {
      if (data) setPastClients(data);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const s = document.createElement('style');
    s.textContent = '@keyframes ai-spin { to { transform: rotate(360deg); } }';
    document.head.appendChild(s);
    return () => s.remove();
  }, []);

  // Google Places — only in 'new' mode where Smart Fill is shown.
  useEffect(() => {
    if (isEdit) return;
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
  }, [isEdit]);

  useEffect(() => {
    if (isEdit) return;
    if (!googleLoaded || !aiAddressInputRef.current) return;
    const ac = new window.google.maps.places.Autocomplete(aiAddressInputRef.current, { types: ['address'] });
    ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      const addr = place.formatted_address || aiAddressInputRef.current.value;
      setAiPlacesQuery(addr);
      ff('delivery_address', addr);
    });
  }, [googleLoaded, isEdit]); // eslint-disable-line react-hooks/exhaustive-deps

  const ff = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleNameChange = (val) => {
    ff('client_name', val);
    if (!isEdit && val.length > 1) {
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

  const handleGuestChange = (val) => {
    const cleaned = val.replace(/[^0-9+a-zA-Z ]/g, '');
    ff('guest_count', cleaned);
    const parsed = parseGuestCount(cleaned);
    setGuestTotal(parsed.total);
    setGuestHint('');
  };

  const handleGuestBlur = () => {
    const val = (form.guest_count || '').trim();
    if (!val) return;
    const parsed = parseGuestCount(val);
    ff('guest_count_original', val);
    if (parsed.display && parsed.display !== val) {
      ff('guest_count', parsed.display);
      setGuestTotal(parsed.total);
      setGuestHint(parsed.hint);
    }
  };

  const applyGuestCount = (val) => {
    const parsed = parseGuestCount(val);
    ff('guest_count_original', val);
    ff('guest_count', parsed.display || val);
    setGuestTotal(parsed.total);
    setGuestHint(parsed.hint);
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
      const aiOut   = p.pickupTime  ? to24h(p.pickupTime)  : '';
      const aiThere = p.arrivalTime ? to24h(p.arrivalTime) : '';
      if (aiOut && aiThere && timesInvalid(aiOut, aiThere)) {
        setSmartFillError('⚠️ AI detected invalid times. Please enter Time Out and Time There manually.');
      } else {
        if (aiThere) ff('delivery_time', aiThere);
        if (aiOut)   ff('time_out',      aiOut);
      }
      if (p.guestCount && p.guestCount !== '0' && p.guestCount !== 0) applyGuestCount(p.guestCountOriginal || String(p.guestCount));
      if (p.menuItems?.length) {
        setMenuItems([]);
        ff('order_details', p.menuItems.map(i => `• ${i}`).join('\n'));
        setMenuViewMode('text');
        ff('menu_package', '');
      }
      if (p.kitchenNotes) ff('kitchen_notes', p.kitchenNotes);
      if (p.driverNotes) ff('notes', p.driverNotes);
      if (p.suggestedPackage) {
        const match = WIZARD_PACKAGES.find(wp =>
          wp.label.toLowerCase().includes(p.suggestedPackage.toLowerCase()) ||
          p.suggestedPackage.toLowerCase().includes(wp.label.toLowerCase())
        );
        if (match) {
          setWizardSuggestedId(match.id);
          ff('menu_package', match.dropdownValue);
        }
      }
    } catch (err) {
      setSmartFillError(err.message || 'Could not parse response. Please try again.');
    }
    setSmartFillLoading(false);
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
    if (!pkg) {
      ff('order_details', '• ');
      setMenuItems([]);
      setMenuViewMode('text');
    } else {
      const items = PACKAGE_ITEMS[pkg].map(({ name, cat }) => ({
        name, cat,
        size: CAT_SIZES[cat] ? CAT_SIZES[cat][0] : '',
        qty: 1,
      }));
      setMenuItems(items);
      ff('order_details', serializeMenuItems(items));
      setMenuViewMode('grid');
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
      else if (field === 'guest_count') applyGuestCount(val);
      else ff(field, val);
    };

    let aborted = false;
    recognition.onstart = () => setListening(field);
    recognition.onresult = (e) => {
      let finalText = '';
      let interimText = '';
      for (let i = 0; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) { finalText += isMenu ? t.replace(/\b(next item|new item|next one|next)\b/gi, '\n• ') + ' ' : t + ' '; }
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
    background: listening === field ? '#c0392b' : BORDER,
    color: listening === field ? '#fff' : TEXT_SEC,
    border: 'none', borderRadius: '50%',
    width: '30px', height: '30px', cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, transition: 'background 0.15s', marginLeft: '8px',
  });

  // Required-field check shared by 'new' and 'edit'. Used to drive the disabled
  // Save button + the "Fix missing fields to save" message in edit mode.
  function missingRequired() {
    const missing = [];
    if (!form.client_name) missing.push('client name');
    if (!form.client_phone) missing.push('client phone');
    if (!form.delivery_date) missing.push('delivery date');
    if (!form.delivery_address) missing.push('delivery address');
    if (!form.on_site_contact) missing.push('on-site contact');
    if (!form.on_site_phone) missing.push('on-site contact phone');
    if (!form.time_out) missing.push('time out');
    if (!form.delivery_time) missing.push('time there');
    if (!form.guest_count) missing.push('guest count');
    if (!form.order_details || form.order_details === '• ') missing.push('menu');
    if (form.event_type === 'Other' && !form.event_type_other) missing.push('event type detail');
    return missing;
  }

  const save = async () => {
    if (!form.client_name) { alert('Please enter client name'); return; }
    if (!form.delivery_date) { alert('Please enter delivery date'); return; }
    if (!form.delivery_address) { alert('Please enter delivery address'); return; }
    if (!form.on_site_contact) { alert('Please enter on-site contact'); return; }
    if (!form.on_site_phone) { alert('Please enter on-site contact phone number'); return; }
    if (!form.order_details || form.order_details === '• ') { alert('Please enter the menu'); return; }
    if (form.event_type === 'Other' && !form.event_type_other) { alert('Please specify the event type'); return; }
    if (timesInvalid(form.time_out, form.delivery_time)) {
      alert("Time There must be after Time Out. Driver can't arrive before leaving.");
      return;
    }
    setSaving(true);
    const finalEventType = form.event_type === 'Other' ? `Other: ${form.event_type_other}` : form.event_type;
    // All orders are DR Catering Driver — Metrobi has been retired. Hardcode
    // on submit so the column stays populated for historical consistency.
    const orderToSave = { ...form, event_type: finalEventType, delivery_method: 'DR Catering Driver' };

    if (isEdit) {
      // Update only — no PDF regeneration, no email. Sales rep is responsible
      // for verbally telling the kitchen if anything material changed.
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: initialOrder.id, ...orderToSave }),
      });
      const data = await res.json();
      if (data.error) { alert('Error saving: ' + data.error); setSaving(false); return; }
      setToast('Order updated');
      // Flag Logistics to re-validate broken orders the next time the page mounts.
      try { sessionStorage.setItem('logistics_replan', '1'); } catch {}
      setTimeout(() => router.push('/orders'), 700);
      return;
    }

    const insertRes = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(orderToSave) });
    const insertData = await insertRes.json();
    if (insertData.error) { alert('Error saving: ' + insertData.error); setSaving(false); return; }
    // Pull the server-assigned per-date sequence onto orderToSave so the
    // kitchen PDF (and any downstream use) shows the right big number.
    if (insertData.daily_sequence != null) {
      orderToSave.daily_sequence = insertData.daily_sequence;
    }
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
    setForm({ order_number: genOrderNum(), client_name: '', client_phone: '', client_email: '', on_site_contact: '', on_site_phone: '', event_type: '', event_type_other: '', delivery_address: '', delivery_date: '', time_out: '', delivery_time: '', guest_count: '', guest_count_original: '', menu_package: '', order_details: '• ', kitchen_notes: '', notes: '', delivery_method: 'DR Catering Driver' });
    setDone(false); setSavedOrder(null); setSuggestions([]); setReturnModal(null); setGuestTotal(0); setGuestHint('');
    setMenuMode('quick'); setMenuViewMode('text'); setWizardSuggestedId(null);
    setAiPlacesQuery(''); setAiDescription(''); setAiMicProcessing(false); setSmartFillError('');
    clearTimeout(aiAutoFillTimerRef.current);
  };

  const isMobile = width < 640;
  const font = FONT;
  const inputStyle = { width:'100%', padding:'11px 14px', border:`1px solid ${BORDER}`, borderRadius:'8px', fontSize: isMobile ? '16px' : '15px', color:NAVY, boxSizing:'border-box', outline:'none', background:'#FFFFFF' };
  const labelStyle = { display:'block', fontSize:'12px', fontWeight:'600', color:TEXT_SEC, textTransform:'uppercase', letterSpacing:'1.5px', marginBottom:'6px' };
  const sectionDivider = (label, action) => (
    <div style={{display:'flex', alignItems:'center', gap:10, margin:'28px 0 16px'}}>
      <span style={{fontSize:12, fontWeight:600, color:NAVY, textTransform:'uppercase', letterSpacing:'1.5px', whiteSpace:'nowrap', flexShrink:0, paddingRight:8}}>{label}</span>
      <div style={{flex:1, height:1, background:BORDER}}/>
      {action && <div style={{flexShrink:0}}>{action}</div>}
    </div>
  );
  const required = { color:'#c0392b', marginLeft:'3px' };

  const timeError = timesInvalid(form.time_out, form.delivery_time);
  const timeInputStyle = (bad) => bad
    ? { ...inputStyle, border: '2px solid #c0392b', background: '#fff5f3' }
    : inputStyle;

  // Success card — only shown in 'new' mode.
  if (!isEdit && done) return (
    <main style={{minHeight:'calc(100vh - 45px)', background:'#FFFFFF', display:'flex', alignItems:'center', justifyContent:'center', padding:'16px'}}>
      <div style={{background:'#FFFFFF', borderRadius:'12px', border:`1px solid ${BORDER}`, width:'100%', maxWidth:'600px', margin:'0 auto', padding:'36px', textAlign:'center', boxSizing:'border-box'}}>
        <div style={{width:'56px', height:'56px', borderRadius:'50%', background:NAVY, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px'}}>
          <span style={{fontSize:'22px', color:'#FFFFFF'}}>✓</span>
        </div>
        <h2 style={{fontSize:'24px', fontWeight:'600', color:NAVY, margin:'0 0 8px'}}>Order Sent to Kitchen</h2>
        <div style={{display:'inline-block', background:NAVY_SOFT, border:`1px solid ${BORDER}`, borderRadius:'6px', padding:'6px 16px', fontSize:'13px', fontWeight:'600', color:NAVY, marginBottom:'12px', letterSpacing:'1px'}}>{savedOrder?.order_number}</div>
        <p style={{fontSize:'14px', color:TEXT_SEC, margin:'0 0 28px'}}>Order for {savedOrder?.client_name} has been saved and emailed.</p>
        <button onClick={reset} style={{background:NAVY, color:'#FFFFFF', borderRadius:'8px', padding:'13px 28px', fontSize:'14px', fontWeight:'600', border:'none', cursor:'pointer', width: isMobile ? '100%' : 'auto'}}>New Order</button>
      </div>
    </main>
  );

  const missing = missingRequired();
  const hasMissing = missing.length > 0;
  const saveDisabled = saving || timeError || (isEdit && hasMissing);

  return (
    <main style={{minHeight:'calc(100vh - 45px)', background:'#FFFFFF', padding: isMobile ? '0' : '32px 24px', boxSizing:'border-box'}}>
      <div style={{background:'#FFFFFF', borderRadius: isMobile ? '0' : '12px', border:`1px solid ${BORDER}`, width:'100%', maxWidth:'720px', margin:'0 auto', padding: isMobile ? '20px 16px' : '40px 48px', boxSizing:'border-box'}}>

        <div style={{textAlign:'center', marginBottom:'24px', paddingBottom:'20px', borderBottom:`1px solid ${BORDER}`}}>
          <div style={{fontSize:'12px', fontWeight:'600', color:TEXT_SEC, letterSpacing:'1.5px', textTransform:'uppercase'}}>{form.order_number}</div>
        </div>

        <div style={{fontSize:'24px', fontWeight:'600', color:NAVY, marginBottom:'24px'}}>
          {isEdit ? 'Edit Order' : 'New Order'}
        </div>

        {/* AI Smart Fill — only on new orders */}
        {!isEdit && (
          <div style={{marginBottom:'32px'}}>
            <div style={{fontSize:'12px', fontWeight:'600', color:NAVY, textTransform:'uppercase', letterSpacing:'1.5px', marginBottom:'10px'}}>
              ✦ AI Smart Fill
            </div>

            <div style={{background:NAVY_SOFT, borderRadius:'12px', border:`1px solid ${BORDER}`, padding:'12px 14px'}}>
              <div style={{display:'flex', gap:'10px'}}>
                <span style={{fontSize:'17px', flexShrink:0, marginTop:'3px', userSelect:'none', lineHeight:1}}>💡</span>
                <div style={{flex:1, position:'relative'}}>
                  <textarea
                    style={{width:'100%', border:'none', outline:'none', resize:'none', height:'96px', fontSize: isMobile ? '16px' : '15px', color:NAVY, fontFamily:font, background:'transparent', lineHeight:'1.6', paddingRight:'38px', boxSizing:'border-box'}}
                    placeholder={"I'm booking a corporate lunch for 80 people on Friday at noon, client is John Smith, 973-555-1234..."}
                    value={aiDescription}
                    onChange={e => setAiDescription(e.target.value)}
                  />
                  <button
                    onClick={startAiListening}
                    title={aiMicListening ? 'Stop listening' : 'Voice input'}
                    style={{
                      position:'absolute', bottom:'4px', right:'0px',
                      background: aiMicListening ? '#c0392b' : BORDER,
                      color: aiMicListening ? '#fff' : TEXT_SEC,
                      border:'none', borderRadius:'50%', width:'30px', height:'30px',
                      cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                      transition:'background 0.15s', flexShrink:0,
                    }}
                  >
                    <MicIcon />
                  </button>
                  {aiMicProcessing && (
                    <div style={{position:'absolute', bottom:'-20px', right:'0px', fontSize:'11px', color:NAVY, fontFamily:font, fontWeight:'600', whiteSpace:'nowrap'}}>
                      Processing…
                    </div>
                  )}
                </div>
              </div>

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
                    fontSize:'12px', fontWeight:'500', padding:'3px 9px',
                    borderRadius:'20px', border:'1px solid',
                    borderColor: active ? NAVY : BORDER,
                    background: active ? NAVY_SOFT : '#FFFFFF',
                    color: active ? NAVY : '#9CA3AF',
                    transition:'all 0.2s', lineHeight:'1.6',
                  }}>
                    ● {label}
                  </span>
                ))}
              </div>

              <div style={{display:'flex', justifyContent: isMobile ? 'stretch' : 'flex-end', alignItems:'center', gap:'10px', marginTop:'12px', flexWrap:'wrap'}}>
                {smartFillError && (
                  <span style={{fontSize:'12px', color:'#e53e3e', fontFamily:font, width: isMobile ? '100%' : 'auto'}}>{smartFillError}</span>
                )}
                <button
                  onClick={handleSmartFill}
                  disabled={smartFillLoading || aiMicProcessing || !aiDescription.trim()}
                  style={{
                    background: (!aiDescription.trim() || smartFillLoading || aiMicProcessing) ? '#9CA3AF' : NAVY,
                    color: '#FFFFFF',
                    border:'none', borderRadius:'8px',
                    padding:'10px 20px', fontSize:'14px', fontWeight:'600',
                    cursor: (!aiDescription.trim() || smartFillLoading || aiMicProcessing) ? 'not-allowed' : 'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center', gap:'8px',
                    transition:'background 0.15s',
                    width: isMobile ? '100%' : 'auto',
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
        )}

        {!isEdit && returnModal && (
          <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px'}}
            onClick={() => setReturnModal(null)}>
            <div style={{background:'#fff', borderRadius:'16px', width:'100%', maxWidth:'480px', padding:'28px', boxShadow:'0 8px 32px rgba(30,16,8,0.18)', fontFamily:font, border:`1px solid ${BORDER}`}}
              onClick={e => e.stopPropagation()}>
              <div style={{fontSize:'16px', fontWeight:'700', color:NAVY, marginBottom:'20px', letterSpacing:'0.03em'}}>Welcome back! Last order details:</div>

              {returnModal.lastAddress && (
                <div style={{marginBottom:'20px', padding:'14px', background:NAVY_SOFT, borderRadius:'12px', border:`1px solid ${BORDER}`}}>
                  <div style={{fontSize:'11px', fontWeight:'700', color:TEXT_SEC, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'6px'}}>Delivery Address</div>
                  <div style={{fontSize:'13px', color:NAVY, marginBottom:'12px', lineHeight:'1.6'}}>{returnModal.lastAddress}</div>
                  <div style={{display:'flex', gap:'8px', flexWrap:'wrap'}}>
                    <button onClick={() => { ff('delivery_address', returnModal.lastAddress); setReturnModal(m => m.lastMenu ? { ...m, lastAddress: null } : null); }} style={{background:NAVY, color:'#FFFFFF', padding:'8px 16px', borderRadius:'10px', border:'none', fontSize:'13px', fontWeight:'700', cursor:'pointer', fontFamily:font, letterSpacing:'0.04em'}}>Same address</button>
                    <button onClick={() => { setReturnModal(m => m.lastMenu ? { ...m, lastAddress: null } : null); }} style={{background:'#FFFFFF', color:NAVY, padding:'8px 16px', borderRadius:'8px', border:`1px solid ${NAVY}`, fontSize:'13px', fontWeight:'600', cursor:'pointer'}}>I'll update it</button>
                  </div>
                </div>
              )}

              {returnModal.lastMenu && (
                <div style={{marginBottom:'4px', padding:'14px', background:NAVY_SOFT, borderRadius:'12px', border:`1px solid ${BORDER}`}}>
                  <div style={{fontSize:'11px', fontWeight:'700', color:TEXT_SEC, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'6px'}}>Menu</div>
                  <div style={{fontSize:'13px', color:NAVY, whiteSpace:'pre-line', marginBottom:'12px', lineHeight:'1.8', maxHeight:'160px', overflowY:'auto'}}>{returnModal.lastMenu}</div>
                  <div style={{display:'flex', gap:'8px', flexWrap:'wrap'}}>
                    <button onClick={() => { ff('order_details', returnModal.lastMenu); setReturnModal(m => m.lastAddress ? { ...m, lastMenu: null } : null); }} style={{background:NAVY, color:'#FFFFFF', padding:'8px 16px', borderRadius:'10px', border:'none', fontSize:'13px', fontWeight:'700', cursor:'pointer', fontFamily:font, letterSpacing:'0.04em'}}>Same menu</button>
                    <button onClick={() => { setReturnModal(m => m.lastAddress ? { ...m, lastMenu: null } : null); }} style={{background:'#FFFFFF', color:NAVY, padding:'8px 16px', borderRadius:'8px', border:`1px solid ${NAVY}`, fontSize:'13px', fontWeight:'600', cursor:'pointer'}}>I'll update it</button>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        {sectionDivider('Client Details')}

        <div style={{marginBottom:'18px', position:'relative'}}>
          <label style={labelStyle}>Client name <span style={required}>*</span></label>
          <input style={inputStyle} placeholder="Sarah Johnson" value={form.client_name} onChange={e => handleNameChange(e.target.value)}/>
          {suggestions.length > 0 && (
            <div style={{position:'absolute', top:'100%', left:0, right:0, background:'#fff', border:`1px solid ${BORDER}`, borderRadius:'12px', zIndex:10, marginTop:'4px', overflow:'hidden', boxShadow:'0 4px 12px rgba(30,16,8,0.1)'}}>
              {suggestions.map((c, i) => (
                <div key={i} onClick={() => selectSuggestion(c)}
                  style={{padding:'12px 16px', fontSize:'14px', cursor:'pointer', borderBottom: i < suggestions.length-1 ? `1px solid ${BORDER}`:'none', fontFamily:font, color:NAVY, background:'#fff'}}
                  onMouseEnter={e => e.currentTarget.style.background=NAVY_SOFT}
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
            <label style={labelStyle}>Email <span style={{fontSize:'10px', color:'#9CA3AF', fontWeight:'400', textTransform:'none'}}>(optional)</span></label>
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

        {sectionDivider('Delivery Details')}

        <div style={{marginBottom:'18px'}}>
          <label style={labelStyle}>Delivery address <span style={required}>*</span></label>
          <input style={inputStyle} placeholder="e.g. Hackensack University Medical Center, 30 Prospect Ave, Hackensack NJ 07601" value={form.delivery_address} onChange={e => ff('delivery_address', e.target.value)}/>
        </div>

        <div style={{marginBottom:'18px'}}>
          <label style={labelStyle}>Special instructions for driver <span style={{fontSize:'10px', color:'#9CA3AF', fontWeight:'400', textTransform:'none'}}>(optional)</span></label>
          <textarea style={{...inputStyle, height:'80px', resize:'none'}} placeholder="Gate code, elevator only, call before arriving..." value={form.notes} onChange={e => ff('notes', e.target.value)}/>
        </div>

        <div style={{marginBottom:'18px'}}>
          <div style={{display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap:'16px'}}>
            <div>
              <label style={labelStyle}>Delivery date <span style={required}>*</span></label>
              <input style={inputStyle} type="date" value={form.delivery_date} onChange={e => ff('delivery_date', e.target.value)}/>
            </div>
            <div>
              <label style={labelStyle}>Time out <span style={required}>*</span></label>
              <input style={timeInputStyle(timeError)} type="time" value={form.time_out} onChange={e => ff('time_out', e.target.value)}/>
            </div>
            <div>
              <label style={labelStyle}>Time there <span style={required}>*</span></label>
              <input style={timeInputStyle(timeError)} type="time" value={form.delivery_time} onChange={e => ff('delivery_time', e.target.value)}/>
            </div>
          </div>
          {timeError && (
            <div style={{marginTop:'8px', padding:'8px 12px', background:'#fdecea', color:'#8b1e1e', border:'1px solid #c0392b', borderRadius:'8px', fontSize:'13px', fontFamily:font}}>
              ⚠️ Time There must be after Time Out. Driver can't arrive before leaving.
            </div>
          )}
        </div>

        <div style={{marginBottom:'18px'}}>
          <label style={labelStyle}>Number of guests <span style={required}>*</span></label>
          <input style={inputStyle} type="text" placeholder='e.g. "50 plus 3" or "50 including 3 vegetarian"' value={form.guest_count} onChange={e => handleGuestChange(e.target.value)} onBlur={handleGuestBlur}/>
          {guestTotal > 0 && <p style={{fontSize:'13px', fontWeight:'700', color:NAVY, margin:'6px 0 0', fontFamily:font}}>= {guestTotal} total guests</p>}
          {guestHint && <p style={{fontSize:'11px', color:'#9CA3AF', margin:'3px 0 0', fontFamily:font}}>{guestHint}</p>}
          <p style={{fontSize:'11px', color:'#9CA3AF', margin:'4px 0 0', fontFamily:font}}>Use "plus" or + to add groups; "including" for dietary subsets</p>
        </div>

        {sectionDivider(
          <span>Menu <span style={required}>*</span></span>,
          <div style={{display:'flex', gap:'6px', alignItems:'center'}}>
            {(['quick','wizard']).map(m => (
              <button
                key={m}
                onClick={() => setMenuMode(m)}
                style={{
                  padding:'4px 11px', fontSize:'12px', fontWeight:'600',
                  border:`1px solid ${menuMode === m ? NAVY : BORDER}`,
                  background: menuMode === m ? NAVY : '#FFFFFF',
                  color: menuMode === m ? '#FFFFFF' : TEXT_SEC,
                  borderRadius:'6px', cursor:'pointer', whiteSpace:'nowrap',
                }}
              >
                {m === 'quick' ? 'Custom' : 'Signature Selections'}
              </button>
            ))}
            {menuMode === 'quick' && menuViewMode === 'text' && (
              <button onClick={() => startListening('menu')} style={micBtn('menu')} title={listening === 'menu' ? 'Stop listening' : 'Voice input'}>
                <MicIcon />
              </button>
            )}
          </div>
        )}

        {menuMode === 'wizard' ? (
          <>
            <div style={{marginBottom:'18px'}}>
              <label style={labelStyle}>Menu package</label>
              <select
                style={inputStyle}
                value={form.menu_package}
                onChange={e => {
                  const pkg = e.target.value;
                  ff('menu_package', pkg);
                  if (pkg) {
                    const match = WIZARD_PACKAGES.find(wp => wp.dropdownValue === pkg);
                    if (match) setWizardSuggestedId(match.id);
                  } else {
                    setWizardSuggestedId(null);
                  }
                }}
              >
                <option value="">— Select a package —</option>
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

            {wizardSuggestedId && (
              <MenuWizard
                key={wizardSuggestedId}
                isMobile={isMobile}
                suggestedPkgId={wizardSuggestedId}
                onComplete={(text, pkgDropdownValue) => {
                  ff('order_details', text);
                  ff('menu_package', pkgDropdownValue || '');
                  setMenuItems([]);
                  setMenuViewMode('text');
                  setWizardSuggestedId(null);
                  setMenuMode('quick');
                }}
                onCancel={() => { setWizardSuggestedId(null); ff('menu_package', ''); }}
              />
            )}
          </>
        ) : (
          <>
            <div style={{marginBottom:'18px'}}>
              <textarea style={{...inputStyle, height:'200px', resize:'none', lineHeight:'1.8'}} value={form.order_details} onChange={handleMenu} onKeyDown={handleMenuKey}/>
              {listening === 'menu'
                ? <p style={{fontSize:'11px', color:'#c0392b', margin:'4px 0 0', fontFamily:font}}>Listening... say "next" to start a new item</p>
                : <p style={{fontSize:'11px', color:'#9CA3AF', margin:'4px 0 0', fontFamily:font}}>Press Enter or tap mic to add items &nbsp;·&nbsp; <span style={{color:NAVY}}>Tip: say "next" to add a new menu item</span></p>
              }
            </div>
          </>
        )}

        {menuMode === 'quick' && menuViewMode === 'grid' && (
          <div style={{marginBottom:'18px', border:`1px solid ${BORDER}`, borderRadius:'12px', overflow:'hidden'}}>
            <div style={{display:'grid', gridTemplateColumns:'1fr 148px 68px', gap:'8px', padding:'8px 14px 8px 16px', background:NAVY_SOFT, borderBottom:`1px solid ${BORDER}`}}>
              <div style={{fontSize:'10px', fontWeight:'700', color:TEXT_SEC, textTransform:'uppercase', letterSpacing:'0.08em', fontFamily:font}}>Item</div>
              <div style={{fontSize:'10px', fontWeight:'700', color:TEXT_SEC, textTransform:'uppercase', letterSpacing:'0.08em', fontFamily:font}}>Size</div>
              <div style={{fontSize:'10px', fontWeight:'700', color:TEXT_SEC, textTransform:'uppercase', letterSpacing:'0.08em', fontFamily:font, textAlign:'center'}}>Qty</div>
            </div>
            {menuItems.map((item, i) => (
              <div key={i} style={{display:'grid', gridTemplateColumns:'1fr 148px 68px', gap:'8px', padding:'10px 14px 10px 16px', alignItems:'center', borderBottom: i < menuItems.length - 1 ? `1px solid ${BORDER}` : 'none', background:'#fff'}}>
                <div style={{fontSize:'14px', fontWeight:'500', color:NAVY, fontFamily:font, lineHeight:'1.35', minWidth:0}}>{item.name}</div>
                <div>
                  {CAT_SIZES[item.cat] ? (
                    <select
                      value={item.size}
                      onChange={e => updateMenuItem(i, 'size', e.target.value)}
                      style={{width:'100%', minHeight:'44px', padding:'8px 10px', border:`1px solid ${BORDER}`, borderRadius:'8px', fontSize:'13px', color:NAVY, fontFamily:font, background:'#fff', outline:'none'}}
                    >
                      {CAT_SIZES[item.cat].map(s => <option key={s}>{s}</option>)}
                    </select>
                  ) : (
                    <div style={{fontSize:'12px', color:'#9CA3AF', fontFamily:font, textAlign:'center', padding:'4px 0'}}>—</div>
                  )}
                </div>
                <select
                  value={item.qty}
                  onChange={e => updateMenuItem(i, 'qty', e.target.value)}
                  style={{width:'100%', minHeight:'44px', padding:'8px 4px', border:`1px solid ${BORDER}`, borderRadius:'8px', fontSize:'15px', fontWeight:'600', color:NAVY, fontFamily:font, background:'#fff', outline:'none', textAlign:'center'}}
                >
                  {[1,2,3,4].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}

        <div style={{marginBottom:'18px'}}>
          <label style={labelStyle}>Additional notes for kitchen <span style={{fontSize:'10px', color:'#9CA3AF', fontWeight:'400', textTransform:'none'}}>(optional)</span></label>
          <textarea style={{...inputStyle, height:'80px', resize:'none'}} placeholder="Allergy notes, substitutions, prep instructions..." value={form.kitchen_notes} onChange={e => ff('kitchen_notes', e.target.value)}/>
        </div>

        <div style={{fontSize:'11px', color:'#9CA3AF', marginTop:'24px', marginBottom:'16px', fontFamily:font}}><span style={required}>*</span> Required fields</div>

        {/* Edit mode shows two buttons (Save Changes + Cancel); new mode shows one. */}
        {isEdit ? (
          <>
            {hasMissing && !timeError && (
              <div style={{marginBottom:'10px', fontSize:'13px', color:'#8b1e1e', fontFamily:font}}>
                Fix missing fields to save: {missing.join(', ')}.
              </div>
            )}
            <div style={{display:'flex', gap:'12px', flexDirection: isMobile ? 'column' : 'row'}}>
              <button
                onClick={save}
                disabled={saveDisabled}
                title={timeError ? "Fix Time There — must be after Time Out" : (hasMissing ? 'Fix missing fields to save' : undefined)}
                style={{flex:1, background: saveDisabled ? '#9CA3AF':NAVY, color: '#FFFFFF', borderRadius:'8px', padding:'16px', fontSize:'16px', fontWeight:'600', border:'none', cursor: saveDisabled ? 'not-allowed':'pointer'}}
              >
                {saving ? 'Saving…' : (timeError ? 'Fix times to save' : (hasMissing ? 'Fix missing fields to save' : 'Save Changes'))}
              </button>
              <button
                onClick={() => { if (onCancel) onCancel(); else router.push('/orders'); }}
                disabled={saving}
                style={{flex: isMobile ? 1 : '0 0 160px', background:'#FFFFFF', color:NAVY, borderRadius:'8px', padding:'16px', fontSize:'16px', fontWeight:'600', border:`1px solid ${NAVY}`, cursor: saving ? 'not-allowed':'pointer'}}
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <button
            onClick={save}
            disabled={saving || timeError}
            title={timeError ? "Fix Time There — must be after Time Out" : undefined}
            style={{width:'100%', background: (saving || timeError) ? '#9CA3AF':NAVY, color: '#FFFFFF', borderRadius:'8px', padding:'16px', fontSize:'16px', fontWeight:'600', border:'none', cursor: (saving || timeError) ? 'not-allowed':'pointer'}}
          >
            {saving ? 'Sending...' : (timeError ? 'Fix times to send order' : 'Send order to kitchen')}
          </button>
        )}

      </div>

      {toast && (
        <div style={{
          position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)',
          background:NAVY, color:'#fff', padding:'12px 20px', borderRadius:10,
          fontSize:14, fontWeight:600, fontFamily:font, zIndex:200,
          boxShadow:'0 4px 12px rgba(0,0,0,0.15)',
        }}>
          ✓ {toast}
        </div>
      )}
    </main>
  );
}
