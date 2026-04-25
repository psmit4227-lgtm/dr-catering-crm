'use client';
import { useState } from 'react';

const F = 'Georgia, serif';
const BLACK  = '#1e1008';
const GOLD   = '#c9a84c';
const GOLD_D = '#8b6914';
const CREAM  = '#faf5e8';
const BORDER = '#e8dfc8';
const GRAY   = '#b5a58a';

const TRAY  = ['Half tray', 'Full tray'];
const SALAD = ['Half salad', 'Full salad'];
const COLD  = ['12 inch', '14 inch', '16 inch'];

export const WIZARD_PACKAGES = [
  {
    id: 'med', label: 'Mediterranean Sun', emoji: '🌿', dropdownValue: 'Mediterranean Sun Package',
    steps: [
      { id: 'salads', title: 'Cold Food', q: 'Which salads?', items: [
        { n: 'Mediterranean Salad',                                          t: 'size', opts: SALAD },
        { n: 'Quinoa Salad with Feta Kalamata Cherry Tomato Pickled Onion', t: 'size', opts: SALAD },
      ]},
      { id: 'proteins', title: 'Proteins', q: 'Which skewers? (enter piece count)', items: [
        { n: 'Chicken Skewers',   t: 'qty' },
        { n: 'Vegetable Skewers', t: 'qty' },
        { n: 'Beef Skewers',      t: 'qty' },
      ]},
      { id: 'sides', title: 'Sides', q: 'Which sides?', items: [
        { n: 'Lemon Parsley Potato', t: 'size', opts: TRAY },
        { n: 'Pasta with Chick Peas', t: 'size', opts: TRAY },
        { n: 'White Rice',           t: 'size', opts: TRAY },
        { n: 'Spanakopita',          t: 'size', opts: TRAY },
        { n: 'Falafel',              t: 'size', opts: TRAY },
      ]},
      { id: 'desserts', title: 'Desserts', q: 'Cookies — how many?', items: [
        { n: 'Cookies', t: 'qty_only', dflt: 24 },
      ]},
      { id: 'bev', title: 'Beverages & Extras', q: 'What else to include?', items: [
        { n: 'Tzatziki Sauce', t: 'chk', dflt: true },
        { n: 'Beverages',      t: 'chk', dflt: true },
        { n: 'Paper Goods',    t: 'chk', dflt: true },
      ]},
    ],
  },
  {
    id: 'fiesta', label: 'Fiesta Del Sol', emoji: '🌮', dropdownValue: 'Fiesta Del Sol (Mexican)',
    steps: [
      { id: 'salads', title: 'Salads', q: 'Which salad?', items: [
        { n: 'Tostada Salad', t: 'size', opts: SALAD },
      ]},
      { id: 'proteins', title: 'Proteins', q: 'Which proteins?', items: [
        { n: 'Chipotle Chicken', t: 'size', opts: TRAY },
        { n: 'Taco Meat',        t: 'size', opts: TRAY },
        { n: 'Fish Tacos',       t: 'size', opts: TRAY },
      ]},
      { id: 'sides', title: 'Sides', q: 'Which sides?', items: [
        { n: 'Lime Cilantro Rice', t: 'size', opts: TRAY },
        { n: 'Black Beans',        t: 'size', opts: TRAY },
        { n: 'Spicy Vegetables',   t: 'size', opts: TRAY },
      ]},
      { id: 'toppings', title: 'Toppings', q: 'Toppings & accompaniments?', items: [
        { n: 'Guacamole',                t: 'chk', dflt: true },
        { n: 'Cheddar Cheese',           t: 'chk', dflt: true },
        { n: 'Salsa',                    t: 'chk', dflt: true },
        { n: 'Sour Cream',               t: 'chk', dflt: true },
        { n: 'White Corn Tortilla Chips', t: 'chk', dflt: true },
        { n: 'Soft Tacos',               t: 'chk', dflt: true },
      ]},
      { id: 'desserts', title: 'Desserts', q: 'Cookies — how many?', items: [
        { n: 'Cookies', t: 'qty_only', dflt: 24 },
      ]},
      { id: 'bev', title: 'Beverages & Paper', q: 'Include?', items: [
        { n: 'Beverages',   t: 'chk', dflt: true },
        { n: 'Paper Goods', t: 'chk', dflt: true },
      ]},
    ],
  },
  {
    id: 'cold_buffet', label: 'Signature Cold Buffet', emoji: '🥗', dropdownValue: 'Signature Cold Buffet',
    steps: [
      { id: 'sandwiches', title: 'Sandwiches & Wraps', q: 'Which sandwiches & wraps?', items: [
        { n: 'Artisan Sandwiches on Focaccia', t: 'size', opts: COLD },
        { n: 'Gourmet Wraps',                  t: 'size', opts: COLD },
      ]},
      { id: 'salads', title: 'Salads', q: 'Which salads?', items: [
        { n: 'Fresh Salad',      t: 'size', opts: SALAD },
        { n: 'Cold Pasta Salad', t: 'size', opts: SALAD },
      ]},
      { id: 'extras', title: 'Extras', q: 'Extras to include?', items: [
        { n: 'Fruit and Nut Mix', t: 'chk', dflt: true },
        { n: 'Tortilla Chips',    t: 'chk', dflt: true },
      ]},
      { id: 'desserts', title: 'Desserts', q: 'How many of each?', items: [
        { n: 'Cookies',  t: 'qty_only', dflt: 24 },
        { n: 'Brownies', t: 'qty_only', dflt: 0  },
      ]},
      { id: 'bev', title: 'Beverages & Paper', q: 'Include?', items: [
        { n: 'Beverages',   t: 'chk', dflt: true },
        { n: 'Paper Goods', t: 'chk', dflt: true },
      ]},
    ],
  },
  {
    id: 'bbq', label: 'Barbecue Spread', emoji: '🍖', dropdownValue: 'Barbecue Spread',
    steps: [
      { id: 'cold', title: 'Cold Food', q: 'Which salads?', items: [
        { n: 'Cobb Salad',       t: 'size', opts: SALAD },
        { n: 'Red Potato Salad', t: 'size', opts: SALAD },
        { n: 'Cold Pasta Salad', t: 'size', opts: SALAD },
      ]},
      { id: 'proteins', title: 'Hot Proteins', q: 'Which BBQ proteins?', items: [
        { n: 'BBQ Chicken',                                                    t: 'size', opts: TRAY },
        { n: 'BBQ Ribs',                                                       t: 'size', opts: TRAY },
        { n: 'Sliders with American Cheese Lettuce Tomato Chipotle Ketchup',   t: 'size', opts: TRAY },
        { n: 'Hotdogs with Sauerkraut',                                        t: 'size', opts: TRAY },
      ]},
      { id: 'sides', title: 'Sides', q: 'Which sides?', items: [
        { n: 'Mac and Cheese',  t: 'size', opts: TRAY },
        { n: 'Corn On the Cob', t: 'size', opts: TRAY },
      ]},
      { id: 'extras', title: 'Extras', q: 'Include chips?', items: [
        { n: 'Chips', t: 'chk', dflt: true },
      ]},
      { id: 'desserts', title: 'Desserts', q: 'Cookies — how many?', items: [
        { n: 'Cookies', t: 'qty_only', dflt: 24 },
      ]},
      { id: 'bev', title: 'Beverages & Paper', q: 'Include?', items: [
        { n: 'Beverages',   t: 'chk', dflt: true },
        { n: 'Paper Goods', t: 'chk', dflt: true },
      ]},
    ],
  },
  {
    id: 'executive', label: 'Executive Package', emoji: '💼', dropdownValue: 'Executive Package',
    steps: [
      { id: 'salads', title: 'Salads', q: 'Which salads?', items: [
        { n: 'Salad',          t: 'size', opts: SALAD },
        { n: 'Quinoa Salad',   t: 'size', opts: SALAD },
      ]},
      { id: 'sandwiches', title: 'Sandwiches', q: 'Sandwich size?', items: [
        { n: 'Artisan Sandwiches', t: 'size', opts: COLD },
      ]},
      { id: 'extras', title: 'Extras', q: 'Include?', items: [
        { n: 'House-made Potato Chips', t: 'chk', dflt: true },
        { n: 'Fresh Fruit Salad',        t: 'chk', dflt: true },
      ]},
      { id: 'desserts', title: 'Desserts', q: 'How many of each?', items: [
        { n: 'Cookies',  t: 'qty_only', dflt: 24 },
        { n: 'Brownies', t: 'qty_only', dflt: 0  },
      ]},
      { id: 'bev', title: 'Beverages', q: 'Include?', items: [
        { n: 'Soft Drinks',  t: 'chk', dflt: true },
        { n: 'Paper Goods',  t: 'chk', dflt: true },
      ]},
    ],
  },
  {
    id: 'italian', label: 'Italian Package', emoji: '🍝', dropdownValue: 'Italian Package',
    steps: [
      { id: 'cold', title: 'Cold Food', q: 'Which cold items?', items: [
        { n: 'Focaccia Sandwiches',  t: 'size', opts: COLD },
        { n: 'Tuscany Wrap',         t: 'size', opts: COLD },
        { n: 'Vegetable Focaccia',   t: 'size', opts: COLD },
      ]},
      { id: 'salads', title: 'Salad', q: 'Salad size?', items: [
        { n: 'Salad', t: 'size', opts: SALAD },
      ]},
      { id: 'hot', title: 'Hot Food', q: 'Which hot dishes?', items: [
        { n: 'Pasta',   t: 'size', opts: TRAY },
        { n: 'Chicken', t: 'size', opts: TRAY },
      ]},
      { id: 'desserts', title: 'Desserts', q: 'Cookies — how many?', items: [
        { n: 'Cookies', t: 'qty_only', dflt: 24 },
      ]},
      { id: 'bev', title: 'Beverages & Paper', q: 'Include?', items: [
        { n: 'Beverages',   t: 'chk', dflt: true },
        { n: 'Paper Goods', t: 'chk', dflt: true },
      ]},
    ],
  },
  {
    id: 'hot_breakfast', label: 'Hot & Cold Breakfast', emoji: '🥞', dropdownValue: 'Hot and Cold Breakfast Buffet',
    steps: [
      { id: 'continental', title: 'Continental', q: 'Continental platter?', items: [
        { n: 'Continental Platter with Bagels Muffins Danish Croissants', t: 'size', opts: COLD },
      ]},
      { id: 'hot', title: 'Hot Food', q: 'Which hot items?', items: [
        { n: 'Eggs',          t: 'size', opts: TRAY },
        { n: 'Bacon',         t: 'size', opts: TRAY },
        { n: 'French Toast',  t: 'size', opts: TRAY },
        { n: 'Home Fries',    t: 'size', opts: TRAY },
      ]},
      { id: 'sides', title: 'Accompaniments', q: 'Include these?', items: [
        { n: 'Cream Cheese',      t: 'chk', dflt: true },
        { n: 'Butter',            t: 'chk', dflt: true },
        { n: 'Jelly',             t: 'chk', dflt: true },
        { n: 'Fruit Salad',       t: 'chk', dflt: true },
        { n: 'Yogurt with Granola', t: 'chk', dflt: true },
      ]},
      { id: 'beverages', title: 'Beverages', q: 'Which beverages?', items: [
        { n: 'Coffee',               t: 'chk', dflt: true },
        { n: 'Orange Juice',         t: 'chk', dflt: true },
        { n: 'Milk',                 t: 'chk', dflt: true },
        { n: 'Sugar Equal Stirrers', t: 'chk', dflt: true },
      ]},
      { id: 'extras', title: 'Paper', q: 'Paper goods?', items: [
        { n: 'Paper Goods', t: 'chk', dflt: true },
      ]},
    ],
  },
  {
    id: 'cold_breakfast', label: 'Cold Continental', emoji: '🥐', dropdownValue: 'Cold Continental Breakfast',
    steps: [
      { id: 'continental', title: 'Continental', q: 'Continental platter size?', items: [
        { n: 'Continental Platter with Bagels Muffins Danish Croissants', t: 'size', opts: COLD },
      ]},
      { id: 'sides', title: 'Accompaniments', q: 'Include these?', items: [
        { n: 'Cream Cheese', t: 'chk', dflt: true },
        { n: 'Butter',       t: 'chk', dflt: true },
        { n: 'Jelly',        t: 'chk', dflt: true },
        { n: 'Fruit Salad',  t: 'chk', dflt: true },
      ]},
      { id: 'beverages', title: 'Beverages', q: 'Which beverages?', items: [
        { n: 'Coffee',               t: 'chk', dflt: true },
        { n: 'Orange Juice',         t: 'chk', dflt: true },
        { n: 'Milk',                 t: 'chk', dflt: true },
        { n: 'Sugar Equal Stirrers', t: 'chk', dflt: true },
      ]},
      { id: 'extras', title: 'Paper', q: 'Paper goods?', items: [
        { n: 'Paper Goods', t: 'chk', dflt: true },
      ]},
    ],
  },
];

function initSelections(pkg) {
  const sel = {};
  for (const step of pkg.steps) {
    sel[step.id] = {};
    for (const item of step.items) {
      if      (item.t === 'size')     sel[step.id][item.n] = { checked: false, size: item.opts[0] };
      else if (item.t === 'qty')      sel[step.id][item.n] = { checked: false, qty: 1 };
      else if (item.t === 'chk')      sel[step.id][item.n] = { checked: item.dflt === true };
      else if (item.t === 'qty_only') sel[step.id][item.n] = { qty: item.dflt ?? 0 };
    }
  }
  return sel;
}

function buildMenuText(pkg, selections, customs) {
  const lines = [];
  for (const step of pkg.steps) {
    const ss = selections[step.id] || {};
    for (const item of step.items) {
      const s = ss[item.n];
      if (!s) continue;
      if      (item.t === 'size'     && s.checked)              lines.push(`${s.size} ${item.n}`);
      else if (item.t === 'qty'      && s.checked && s.qty > 0) lines.push(`${s.qty} ${item.n}`);
      else if (item.t === 'chk'      && s.checked)              lines.push(item.n);
      else if (item.t === 'qty_only' && s.qty > 0)              lines.push(`${s.qty} ${item.n}`);
    }
    const c = customs[step.id]?.trim();
    if (c) c.split('\n').filter(l => l.trim()).forEach(l => lines.push(l.trim()));
  }
  return lines.map(l => `• ${l}`).join('\n') || '• ';
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function MenuWizard({ onComplete, onCancel, isMobile, suggestedPkgId }) {
  const [phase, setPhase]   = useState(suggestedPkgId ? 'steps' : 'pick');
  const [pkg,   setPkg]     = useState(() => suggestedPkgId ? WIZARD_PACKAGES.find(p => p.id === suggestedPkgId) || null : null);
  const [stepIdx, setStep]  = useState(0);
  const [sel,   setSel]     = useState(() => {
    const p = suggestedPkgId ? WIZARD_PACKAGES.find(p => p.id === suggestedPkgId) : null;
    return p ? initSelections(p) : {};
  });
  const [customs, setCustoms] = useState({});

  const pickPkg = (p) => {
    setPkg(p);
    setSel(initSelections(p));
    setCustoms({});
    setStep(0);
    setPhase('steps');
  };

  const updateSel = (stepId, itemName, field, value) => {
    setSel(prev => ({
      ...prev,
      [stepId]: { ...prev[stepId], [itemName]: { ...prev[stepId][itemName], [field]: value } },
    }));
  };

  const step      = pkg?.steps[stepIdx];
  const total     = pkg?.steps.length || 0;
  const isLast    = stepIdx === total - 1;
  const stepSel   = sel[step?.id] || {};

  const goNext = () => {
    if (isLast) onComplete(buildMenuText(pkg, sel, customs), pkg.dropdownValue);
    else        setStep(i => i + 1);
  };

  const goBack = () => {
    if (stepIdx === 0) { setPhase('pick'); setPkg(null); }
    else setStep(i => i - 1);
  };

  const inputSty = {
    border: `1px solid ${GOLD}`, borderRadius: '8px', padding: '6px 10px',
    fontSize: isMobile ? '16px' : '14px', fontFamily: F, color: BLACK,
    background: '#fff', outline: 'none', boxSizing: 'border-box',
  };

  const btnBase = {
    border: 'none', borderRadius: '10px', padding: '11px 16px',
    fontSize: '14px', fontWeight: '700', cursor: 'pointer', fontFamily: F,
  };

  // ── Package Picker ──────────────────────────────────────────────────────────
  if (phase === 'pick') {
    return (
      <div style={{ marginBottom: '18px' }}>
        <div style={{ fontSize: '13px', color: GOLD_D, fontFamily: F, marginBottom: '12px', fontWeight: '600' }}>
          Select a package to start:
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
          gap: '10px', marginBottom: '14px',
        }}>
          {WIZARD_PACKAGES.map(p => (
            <button
              key={p.id}
              onClick={() => pickPkg(p)}
              style={{
                background: '#fff', border: `1px solid ${BORDER}`, borderRadius: '12px',
                padding: '16px 10px', cursor: 'pointer', fontFamily: F,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = GOLD; e.currentTarget.style.background = CREAM; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.background = '#fff'; }}
            >
              <span style={{ fontSize: '26px', lineHeight: 1 }}>{p.emoji}</span>
              <span style={{ fontSize: '11px', fontWeight: '700', color: BLACK, lineHeight: '1.4', textAlign: 'center' }}>{p.label}</span>
            </button>
          ))}
        </div>
        <button
          onClick={onCancel}
          style={{ fontSize: '12px', color: GRAY, background: 'none', border: 'none', cursor: 'pointer', fontFamily: F, padding: 0, textDecoration: 'underline' }}
        >
          ← Back to Quick Type
        </button>
      </div>
    );
  }

  // ── Category Step ───────────────────────────────────────────────────────────
  return (
    <div style={{ marginBottom: '18px' }}>

      {/* Progress header */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: '700', color: GOLD_D, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: F }}>
            {pkg.emoji} {pkg.label}
          </span>
          <span style={{ fontSize: '11px', color: GRAY, fontFamily: F }}>
            Step {stepIdx + 1} of {total}
          </span>
        </div>
        <div style={{ height: '4px', background: BORDER, borderRadius: '2px' }}>
          <div style={{
            height: '4px', background: GOLD, borderRadius: '2px',
            width: `${((stepIdx + 1) / total) * 100}%`,
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>

      {/* Step card */}
      <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '18px', marginBottom: '10px' }}>
        <div style={{ fontSize: '10px', fontWeight: '700', color: GOLD_D, textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: F, marginBottom: '2px' }}>
          {step.title}
        </div>
        <div style={{ fontSize: isMobile ? '17px' : '16px', fontWeight: '700', color: BLACK, fontFamily: F, marginBottom: '16px' }}>
          {step.q}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {step.items.map(item => {
            const s = stepSel[item.n] || {};
            return (
              <div key={item.n}>
                {/* size or qty — checkbox + inline control */}
                {(item.t === 'size' || item.t === 'qty') && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '9px', cursor: 'pointer', flex: 1, minWidth: '140px' }}>
                      <input
                        type="checkbox"
                        checked={s.checked || false}
                        onChange={e => updateSel(step.id, item.n, 'checked', e.target.checked)}
                        style={{ width: '18px', height: '18px', marginTop: '1px', accentColor: GOLD, cursor: 'pointer', flexShrink: 0 }}
                      />
                      <span style={{ fontSize: '14px', color: BLACK, fontFamily: F, lineHeight: '1.4' }}>{item.n}</span>
                    </label>
                    {item.t === 'size' && s.checked && (
                      <select
                        value={s.size || item.opts[0]}
                        onChange={e => updateSel(step.id, item.n, 'size', e.target.value)}
                        style={{ ...inputSty, flexShrink: 0 }}
                      >
                        {item.opts.map(o => <option key={o}>{o}</option>)}
                      </select>
                    )}
                    {item.t === 'qty' && s.checked && (
                      <input
                        type="number" min="1"
                        value={s.qty || 1}
                        onChange={e => updateSel(step.id, item.n, 'qty', Math.max(1, parseInt(e.target.value) || 1))}
                        style={{ ...inputSty, width: '72px', textAlign: 'center', flexShrink: 0 }}
                      />
                    )}
                  </div>
                )}

                {/* chk — just checkbox */}
                {item.t === 'chk' && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '9px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={s.checked || false}
                      onChange={e => updateSel(step.id, item.n, 'checked', e.target.checked)}
                      style={{ width: '18px', height: '18px', accentColor: GOLD, cursor: 'pointer', flexShrink: 0 }}
                    />
                    <span style={{ fontSize: '14px', color: BLACK, fontFamily: F }}>{item.n}</span>
                  </label>
                )}

                {/* qty_only — label + number input (no checkbox) */}
                {item.t === 'qty_only' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '14px', color: BLACK, fontFamily: F, flex: 1 }}>{item.n}</span>
                    <input
                      type="number" min="0"
                      value={s.qty ?? 0}
                      onChange={e => updateSel(step.id, item.n, 'qty', Math.max(0, parseInt(e.target.value) || 0))}
                      style={{ ...inputSty, width: '72px', textAlign: 'center', flexShrink: 0 }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Custom item input */}
        <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: `1px solid ${BORDER}` }}>
          <input
            type="text"
            placeholder="+ Add a custom item (optional)"
            value={customs[step.id] || ''}
            onChange={e => setCustoms(prev => ({ ...prev, [step.id]: e.target.value }))}
            style={{ ...inputSty, width: '100%', fontSize: '13px', color: GRAY }}
          />
        </div>
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button onClick={goBack} style={{ ...btnBase, background: '#fff', border: `1px solid ${BORDER}`, color: BLACK, fontWeight: '600', flexShrink: 0 }}>
          ← Back
        </button>
        <button
          onClick={goNext}
          style={{ ...btnBase, background: BLACK, color: GOLD, flex: 1, textAlign: 'center', letterSpacing: '0.04em' }}
        >
          {isLast ? '✓ Build Menu' : 'Next →'}
        </button>
        <button
          onClick={goNext}
          title="Skip this category"
          style={{ ...btnBase, background: '#fff', border: `1px solid ${BORDER}`, color: GRAY, fontSize: '12px', fontWeight: '600', flexShrink: 0 }}
        >
          Skip
        </button>
      </div>
    </div>
  );
}
