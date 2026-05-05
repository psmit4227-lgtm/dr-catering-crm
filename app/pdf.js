import jsPDF from "jspdf";

const PT_TO_MM  = 0.352778;
const PAGE_W    = 215.9;
const PAGE_H    = 279.4;
const MARGIN    = 18;
const CW        = PAGE_W - MARGIN * 2;   // 179.9 mm usable width
const CX        = PAGE_W / 2;
const USABLE_H  = PAGE_H - MARGIN * 2;   // 243.4 mm usable height

const BLACK    = [15, 18, 20];
const GRAY     = [120, 120, 120];
const RULE_CLR = [210, 210, 210];
const NOTE_BG  = [255, 252, 220];        // pale amber for kitchen notes
const GOLD     = [201, 168, 76];         // #c9a84c — bullets, section underline, prep border
const GOLD_DK  = [139, 105, 20];         // #8b6914 — modifier / inline prep text
const PREP_BG  = [255, 248, 231];        // #fff8e7 — prep note box fill
const ESPRESSO = [30, 16, 8];            // #1e1008 — delivery-order box border

// Top-right "DELIVERY ORDER #" handwriting box. Logistics writes a route stop
// number with a marker after printing; box must be readable on a stack of 10.
const ORDER_BOX_W = 64;
const ORDER_BOX_H = 38;
const ORDER_BOX_X = PAGE_W - MARGIN - ORDER_BOX_W;
const ORDER_BOX_Y = MARGIN;

// Line height: font pt → mm, scaled by spacing factor
const lh = (pt, sp) => pt * PT_TO_MM * sp;

// Sizes as a function of reduction level (reduces 1pt per step, clamped to min)
const getSizes = (r) => ({
  title:  Math.max(18, 28 - r),
  client: Math.max(14, 22 - r),
  sect:   Math.max(12, 18 - r),
  body:   Math.max(10, 16 - r),
  menu:   Math.max(10, 16 - r),
  notes:  Math.max(9,  15 - r),
  label:  Math.max(6,  8  - Math.floor(r / 3)),
  footer: 7,
});

const guestPt = (bodyPt) => Math.max(20, Math.round(bodyPt * 2.1));

function formatTime(t) {
  if (!t) return "—";
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return t;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

// Auto-detect dressings from salad mentions in the menu text.
// Returns a single string like "Dressing - Large Caesar AND Small House", or null.
function detectDressings(menuText) {
  const dressingMap = [
    { keyword: /mediterranean/i,    name: "Regular Balsamic" },
    { keyword: /\beliza\b/i,        name: "Creamy Balsamic"  },
    { keyword: /\b(?:caesar|ceaser)\b/i, name: "Caesar"      },
    { keyword: /\bgarden\b/i,       name: "House"            },
  ];

  // Split on lines, commas, " and ", " plus " so each segment carries one salad.
  const segments = (menuText || "")
    .split(/\n|,|\s+and\s+|\s+plus\s+/i)
    .map(s => s.trim())
    .filter(Boolean);

  const detected = [];
  const seen = new Set();
  for (const seg of segments) {
    for (const { keyword, name } of dressingMap) {
      if (!keyword.test(seg)) continue;
      if (seen.has(name)) continue;
      let size;
      if (/(?:1\/2|\bhalf\b|\bsmall\b)/i.test(seg)) {
        size = "Small";
      } else if (/(?:\bfull\b|\blarge\b|\b1\s+tray\b)/i.test(seg)) {
        size = "Large";
      } else {
        size = "Large";
      }
      detected.push({ size, name });
      seen.add(name);
    }
  }

  if (detected.length === 0) return null;
  return `Dressing - ${detected.map(d => `${d.size} ${d.name}`).join(" AND ")}`;
}

// ── Food-group categorization for auto-spacing ────────────────────────────────
// Match priority differs from output order — multi-word phrases & specific
// containers (wraps/sandwiches) win over generic single-word fallbacks
// (e.g. "chicken caesar wrap" → Sandwiches, not Hot Food or Salads).
const GROUP_KEYWORDS = {
  Sandwiches: [/\bfocaccia\b/, /\bsandwich/, /\bwrap/, /\bhero\b/, /\bsub\b/, /\bpanini/, /\bbagel/, /\bcroissant/, /\bmuffin/, /\bdanish/],
  ColdFood:   [/\bhummus\b/, /\bpita\b/, /\bolives?\b/, /\bcold\s+pasta\b/, /\bpotato\s+salad\b/, /\bfruit\s+salad\b/, /\bfresh\s+fruit\b/, /\btortilla\s+chips\b/, /\bchips\b/, /\bdip\b/, /\btatziki\b/, /\bguacamole\b/, /\bsalsa\b/, /\bsour\s+cream\b/, /\bcheese\s+platter\b/, /\bantipasto\b/],
  Desserts:   [/\bcookies?\b/, /\bbrownies?\b/, /\btiramisu\b/, /\bcannoli\b/, /\bcakes?\b/, /\bfruit\s+platter\b/, /\bwatermelon\b/, /\byogurt\b/, /\bgranola\b/],
  Salads:     [/\bsalads?\b/, /\bcaesar\b/, /\bceaser\b/, /\bmediterranean\b/, /\beliza\b/, /\bgarden\b/, /\bquinoa\b/, /\bcobb\b/, /\btossed\b/],
  Sides:      [/\bcornbread\b/, /\bvegetables\b/, /\bbroccoli\b/, /\bbeans\b/, /\bcorn\b/, /\bmashed\b/, /\bspanakopita\b/, /\bfalafel\b/],
  HotFood:    [/\bchicken\b/, /\bbeef\b/, /\bpork\b/, /\bribs\b/, /\beggplant\b/, /\bmarsala\b/, /\bparm\b/, /\bparmigiana\b/, /\bvodka\b/, /\balfredo\b/, /\bpasta\b/, /\bpenne\b/, /\bziti\b/, /\blasagna\b/, /\bmeatballs?\b/, /\bshrimp\b/, /\bsalmon\b/, /\bfish\b/, /\btray\b/, /\bhot\b/, /\bsoup\b/, /\brice\b/, /\bmac\b/, /\btacos?\b/, /\bburritos?\b/, /\bfries\b/, /\beggs\b/, /\bbacon\b/, /\bfrench\s+toast\b/, /\bsausage\b/, /\bskewers?\b/, /\bstir\s+fry\b/, /\bgarlic\s+bread\b/],
};
const MATCH_ORDER  = ["Sandwiches", "ColdFood", "Desserts", "Salads", "Sides", "HotFood"];
const OUTPUT_ORDER = ["Salads", "ColdFood", "Sandwiches", "HotFood", "Uncategorized", "Sides", "Desserts"];

function categorizeMenuItem(text) {
  const t = (text || "").toLowerCase();
  for (const group of MATCH_ORDER) {
    for (const re of GROUP_KEYWORDS[group]) if (re.test(t)) return group;
  }
  return "Uncategorized";
}

function getMenuItems(order) {
  const raw = (order.order_details || "")
    .split("\n").map(l => l.replace(/\s+$/, ""));
  const filtered = raw.filter(
    l => !/^\s*•?\s*beverages?\s*$/i.test(l)
      && !/^\s*•?\s*paper\s+(?:boxes?|goods?)\s*$/i.test(l)
      && !/^\s*•?\s*dressings?\b/i.test(l)
  );
  const isBlank = l => /^\s*•?\s*$/.test(l);
  while (filtered.length && isBlank(filtered[0])) filtered.shift();
  while (filtered.length && isBlank(filtered[filtered.length - 1])) filtered.pop();

  const dressingLine = detectDressings(filtered.join("\n"));

  // Group user items by food category and add blank-line separators.
  const grouped = groupMenuItems(filtered);

  // Dressings always appears as a default — specific (e.g. "Dressing - Small
  // Caesar AND Large House") when a salad is detected, otherwise the generic
  // "Dressings" line so the kitchen still has a slot to fill in.
  const tail = [];
  tail.push(`• ${dressingLine || "Dressings"}`);
  tail.push("• Beverages", "• Paper boxes");

  const result = [...grouped];
  if (grouped.length > 0) result.push(""); // blank line above defaults
  result.push(...tail);
  return result;
}

// ── Rich menu line parsing ───────────────────────────────────────────────────
const QTY_UNITS = "oz|lb|lbs|pt|qt|gal|pint|pints|quart|quarts|tray|trays|pan|pans|gallon|gallons|dozen|dz|ct|count|piece|pieces|pcs|each";
const QTY_LEAD_RE  = new RegExp(`^((?:\\d+(?:\\/\\d+)?(?:\\.\\d+)?)\\s*(?:${QTY_UNITS})?)\\s+(.+)$`, "i");
const QTY_TRAIL_RE = new RegExp(`^(.+?)\\s+[-–]\\s+(\\d+(?:\\/\\d+)?(?:\\.\\d+)?(?:\\s*(?:${QTY_UNITS}))?)$`, "i");
const PREP_LINE_RE   = /^(?:please\s+)?(?:pack(?:\s+(?:in|hot|cold|on|with))?|make\s+sure|please\s+send|send|ensure|don'?t\s+forget|remember\s+to|label)\b/i;
const PREP_INLINE_RE = /\s+[-–]\s+((?:please\s+)?(?:pack(?:\s+(?:in|hot|cold|on|with))?|make\s+sure|please\s+send|send|ensure|don'?t\s+forget|remember\s+to)[^()]*)$/i;

function parseMenuLine(rawLine) {
  if (!rawLine || !rawLine.trim()) return { type: "blank" };

  let stripped = rawLine.trim().replace(/^•\s*/, "").trim();
  let isSub = false;
  if (/^[-*›]\s+/.test(stripped)) {
    isSub = true;
    stripped = stripped.replace(/^[-*›]\s+/, "");
  }
  if (!stripped) return { type: "blank" };

  if (!isSub && /:\s*$/.test(stripped)) {
    return { type: "section", text: stripped.replace(/:\s*$/, "").trim() };
  }

  if (PREP_LINE_RE.test(stripped)) {
    return { type: "prep", text: stripped, sub: isSub };
  }

  let mainText = stripped;

  let inlinePrep = null;
  const inlineMatch = mainText.match(PREP_INLINE_RE);
  if (inlineMatch) {
    inlinePrep = inlineMatch[1].trim();
    mainText = mainText.slice(0, inlineMatch.index).trim();
  }

  let modifier = null;
  const modMatch = mainText.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
  if (modMatch) {
    mainText = modMatch[1].trim();
    modifier = modMatch[2].trim();
  }

  let quantity = null;
  const trailMatch = mainText.match(QTY_TRAIL_RE);
  if (trailMatch) {
    quantity = trailMatch[2].trim();
    mainText = trailMatch[1].trim();
  } else {
    const leadMatch = mainText.match(QTY_LEAD_RE);
    if (leadMatch) {
      quantity = leadMatch[1].trim();
      mainText = leadMatch[2].trim();
    }
  }

  if (!mainText && !quantity && !modifier && !inlinePrep) return { type: "blank" };
  return { type: isSub ? "sub" : "item", quantity, text: mainText, modifier, inlinePrep };
}

// Group menu lines by food category. Sub-items / prep notes / inline modifiers
// stay attached to their parent item. Section headers (lines ending ":") are
// treated as user-curated structure — when present, items keep their original
// order. Otherwise items are sorted into OUTPUT_ORDER. A blank line is inserted
// between blocks of different categories so the kitchen has writing room.
function groupMenuItems(items) {
  const blocks = [];
  let current = null;
  let hasSection = false;

  const orderIdxOf = (cat) => {
    const i = OUTPUT_ORDER.indexOf(cat);
    return i === -1 ? OUTPUT_ORDER.indexOf("Uncategorized") : i;
  };

  for (const line of items) {
    const parsed = parseMenuLine(line);
    if (parsed.type === "blank") continue; // dropped — auto-blanks regenerated below
    if (parsed.type === "section") {
      hasSection = true;
      blocks.push({ lines: [line], category: `_section_${blocks.length}`, sortKey: blocks.length + 1000 });
      current = null;
      continue;
    }
    if (parsed.type === "item") {
      const cat = categorizeMenuItem(line);
      current = { lines: [line], category: cat, sortKey: orderIdxOf(cat) };
      blocks.push(current);
      continue;
    }
    // sub or prep — attach to the most recent item block
    if (current) {
      current.lines.push(line);
    } else {
      const cat = categorizeMenuItem(line);
      current = { lines: [line], category: cat, sortKey: orderIdxOf(cat) };
      blocks.push(current);
    }
  }

  if (!hasSection) {
    blocks.forEach((b, i) => { b.origIdx = i; });
    blocks.sort((a, b) => a.sortKey !== b.sortKey ? a.sortKey - b.sortKey : a.origIdx - b.origIdx);
  }

  const out = [];
  let prevCat = null;
  for (const b of blocks) {
    if (prevCat !== null && b.category !== prevCat) out.push("");
    for (const line of b.lines) out.push(line);
    prevCat = b.category;
  }
  return out;
}

// Process (measure or render) a parsed menu line. Returns vertical advance in mm.
// mode: "measure" or "render".
function processMenuLine(doc, parsed, y, S, SP, mode, isFirst) {
  if (parsed.type === "blank") {
    // ~1.5x line-height of vertical space — gives the kitchen room to handwrite
    // notes between food groups. Auto-fit will shrink fonts if it overflows.
    return Math.max(2, lh(S.menu, SP) * 1.5);
  }

  if (parsed.type === "section") {
    const sectSize = S.menu * 1.05;
    const topPad   = isFirst ? 0.5 : 2.5;
    const headerH  = lh(sectSize, SP);
    const ulOffset = headerH * 0.78;
    const bottomPad = 1.6;
    if (mode === "render") {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(sectSize);
      doc.setTextColor(...BLACK);
      const text = parsed.text.toUpperCase();
      doc.text(text, MARGIN, y + topPad, { baseline: "top" });
      const w = doc.getTextWidth(text);
      doc.setDrawColor(...GOLD);
      doc.setLineWidth(0.4);
      doc.line(MARGIN, y + topPad + ulOffset + 0.4, MARGIN + w, y + topPad + ulOffset + 0.4);
    }
    return topPad + headerH + bottomPad;
  }

  if (parsed.type === "prep") {
    const padX = 3, padY = 1.6;
    const startX = MARGIN + 12;
    const boxW = CW - 14;
    const fontSize = S.notes;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(parsed.text, boxW - padX * 2);
    const textH = lines.length * lh(fontSize, SP);
    const boxH = textH + padY * 2;
    if (mode === "render") {
      doc.setFillColor(...PREP_BG);
      doc.setDrawColor(...GOLD);
      doc.setLineWidth(0.25);
      doc.roundedRect(startX, y, boxW, boxH, 1.2, 1.2, "FD");
      doc.setTextColor(...GOLD_DK);
      doc.text(lines, startX + padX, y + padY, { baseline: "top" });
    }
    return boxH + 1.5;
  }

  // item or sub
  const sub = parsed.type === "sub";
  const baseSize = sub ? Math.max(8, S.menu * 0.94) : S.menu;
  const startX = MARGIN + (sub ? 12 : 2);
  const maxX = PAGE_W - MARGIN;
  const lineGap = lh(baseSize, SP);

  const bullet = sub ? "›  " : "•  ";
  doc.setFont("helvetica", "normal");
  doc.setFontSize(baseSize);
  const bulletW = doc.getTextWidth(bullet);
  const contStartX = startX + bulletW;

  if (mode === "render") {
    doc.setTextColor(...GOLD);
    doc.text(bullet, startX, y, { baseline: "top" });
  }
  let curX = contStartX;
  let curY = y;
  let lineCount = 1;

  if (parsed.quantity) {
    doc.setFont("helvetica", "bold");
    if (mode === "render") {
      doc.setTextColor(...BLACK);
      doc.text(parsed.quantity, curX, curY, { baseline: "top" });
    }
    curX += doc.getTextWidth(parsed.quantity);
    doc.setFont("helvetica", "normal");
    curX += doc.getTextWidth("  ");
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(baseSize);
  if (parsed.text) {
    const remW = Math.max(maxX - curX, 20);
    const textLines = doc.splitTextToSize(parsed.text, remW);
    if (mode === "render") {
      doc.setTextColor(...BLACK);
      textLines.forEach((tl, i) => {
        const tx = i === 0 ? curX : contStartX;
        doc.text(tl, tx, curY + i * lineGap, { baseline: "top" });
      });
    }
    if (textLines.length > 1) {
      lineCount += textLines.length - 1;
      curY += (textLines.length - 1) * lineGap;
      curX = contStartX + doc.getTextWidth(textLines[textLines.length - 1]);
    } else {
      curX += doc.getTextWidth(textLines[0]);
    }
  }

  const renderTrailing = (text, gapBefore) => {
    const modSize = Math.max(8, baseSize * 0.92);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(modSize);
    const inlineText = gapBefore + text;
    const inlineW = doc.getTextWidth(inlineText);
    if (curX + inlineW <= maxX) {
      if (mode === "render") {
        doc.setTextColor(...GOLD_DK);
        doc.text(inlineText, curX, curY, { baseline: "top" });
      }
      curX += inlineW;
    } else {
      curY += lineGap;
      lineCount += 1;
      const wrapW = Math.max(maxX - contStartX, 20);
      const wrapped = doc.splitTextToSize(text, wrapW);
      if (mode === "render") {
        doc.setTextColor(...GOLD_DK);
        wrapped.forEach((wl, i) => {
          doc.text(wl, contStartX, curY + i * lineGap, { baseline: "top" });
        });
      }
      if (wrapped.length > 1) {
        lineCount += wrapped.length - 1;
        curY += (wrapped.length - 1) * lineGap;
        curX = contStartX + doc.getTextWidth(wrapped[wrapped.length - 1]);
      } else {
        curX = contStartX + doc.getTextWidth(wrapped[0]);
      }
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(baseSize);
  };

  if (parsed.modifier) renderTrailing(`(${parsed.modifier})`, "  ");
  if (parsed.inlinePrep) renderTrailing(`— ${parsed.inlinePrep}`, "  ");

  return lineCount * lineGap;
}

// Build a guest count breakdown string for display below the big number.
// Returns null when no breakdown is needed (plain number).
function formatGuestBreakdown(order) {
  const original = (order.guest_count_original || "").trim();
  if (!original || /^\d+$/.test(original)) return null;

  // Subset: "50 including 6 vegetarian" → "50 (includes 6 vegetarian)"
  if (/\b(including|of which|of them|among them)\b/i.test(original)) {
    const base  = (original.match(/^\d+/) || [""])[0];
    const after = original.replace(/^\d+\s+(?:including|of which|of them|among them)\s*/i, "");
    return `${base} (includes ${after})`;
  }

  // Addition: normalize "plus" → "+" and append "= N total"
  const normalized = original.replace(/\bplus\b/gi, "+").replace(/\s{2,}/g, " ").trim();
  const total = order.guest_count;
  if (total && String(total) !== "0") return `${normalized} = ${total} total`;
  return normalized;
}

// Measure total layout height for given sizes + spacing.
// Sets jsPDF font state as a side-effect (safe before rendering).
function measureLayout(doc, order, s, sp) {
  const menuItems = getMenuItems(order);
  const showOrderBox = order.delivery_method !== "Metrobi";
  let h = 0;

  // Title
  h += lh(s.title, sp) + 1.5;
  // Order number
  h += lh(s.label, sp) + 3;
  // Rule 1 + gap
  h += 1.5 + 3;
  // Client name
  h += lh(s.client, sp) + 1;
  // Phone
  h += lh(s.label, sp) + 3;
  // Reserve enough vertical space for the top-right delivery-order box —
  // box height is fixed regardless of font reduction, so the header section
  // must consume at least ORDER_BOX_H + a small gap before continuing.
  // Skipped for Metrobi orders, where the box is hidden and the space is
  // reclaimed by the rest of the layout.
  if (showOrderBox) h = Math.max(h, ORDER_BOX_H + 2);
  // Rule 2 + gap
  h += 1.5 + 3;
  // Date/time labels + values
  h += lh(s.label, sp) + 1;
  h += lh(s.body, sp)  + 3;
  // Guest count label + HUGE value + optional breakdown
  h += lh(s.label, sp) + 1;
  h += lh(guestPt(s.body), sp) + 2;
  const bd = formatGuestBreakdown(order);
  if (bd) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(s.notes);
    const bdLines = doc.splitTextToSize(bd, CW - 4);
    h += bdLines.length * lh(s.notes, sp) + 3;
  } else {
    h += 4;
  }
  // Rule 3 (heavy) + gap
  h += 1.5 + 4;

  // ── Metadata block (now ABOVE the menu) ──
  // Address / contact labels + values
  h += lh(s.label, sp) + 1;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(s.body);
  const al = doc.splitTextToSize(order.delivery_address || "—", CW / 2 - 6);
  const cl = [order.on_site_contact || "—"];
  if (order.on_site_phone) cl.push(order.on_site_phone);
  h += Math.max(al.length, cl.length) * lh(s.body, sp) + 3;

  // Kitchen notes (optional, yellow box)
  if (order.kitchen_notes?.trim()) {
    h += lh(s.label, sp) + 1;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(s.notes);
    const kl = doc.splitTextToSize(order.kitchen_notes.trim(), CW - 12);
    h += kl.length * lh(s.notes, sp) + 4 + 2 + 3;
  }

  // Driver notes (optional, yellow box)
  if (order.notes?.trim()) {
    h += lh(s.label, sp) + 1;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(s.notes);
    const dl = doc.splitTextToSize(order.notes.trim(), CW - 12);
    h += dl.length * lh(s.notes, sp) + 4 + 2 + 3;
  }

  // Delivery method badge (optional)
  if (order.delivery_method) {
    h += lh(s.label, sp) + 1;
    h += lh(s.body, sp) + 6;
  }

  // Divider before menu
  h += 1.5 + 4;

  // MENU heading
  h += lh(s.sect, sp) + 2;

  // Menu items (rich formatting)
  let firstNonBlank = true;
  for (const item of menuItems) {
    const parsed = parseMenuLine(item);
    if (parsed.type === "blank") {
      if (!firstNonBlank) h += processMenuLine(doc, parsed, h, s, sp, "measure", false);
      continue;
    }
    h += processMenuLine(doc, parsed, h, s, sp, "measure", firstNonBlank);
    firstNonBlank = false;
  }
  h += 3;

  // Footer: rule + gap + text
  h += 1.5 + 2;
  h += lh(s.footer, sp);

  return h;
}

function buildPDF(order) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });

  const menuItems = getMenuItems(order);

  // ── Find fitting font sizes ──────────────────────────────────────────────
  let reduction = 0;
  let spacing   = 1.25;

  while (reduction < 10) {
    const s = getSizes(reduction);
    if (measureLayout(doc, order, s, spacing) <= USABLE_H) break;
    reduction++;
    spacing = Math.max(1.0, spacing * 0.95);
  }

  const S  = getSizes(reduction);
  const SP = spacing;
  const GP = guestPt(S.body);

  // ── Helpers ──────────────────────────────────────────────────────────────
  let y = MARGIN;

  const setFont = (style, size, color = BLACK) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };

  const rule = (weight = 0.4, x1 = MARGIN, x2 = PAGE_W - MARGIN) => {
    doc.setDrawColor(...RULE_CLR);
    doc.setLineWidth(weight);
    doc.line(x1, y, x2, y);
    y += 1.5;
  };

  // ── Render ───────────────────────────────────────────────────────────────

  // 0. Top-right "DELIVERY ORDER #" handwriting box (drawn first so the
  //    surrounding header text is centered into the LEFT zone beside it).
  //    Hidden for Metrobi orders — Metrobi handles their own routing, so the
  //    box has no purpose and the space is reclaimed by full-width header text.
  const showOrderBox = order.delivery_method !== "Metrobi";
  if (showOrderBox) {
    doc.setDrawColor(...ESPRESSO);
    doc.setLineWidth(0.7);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(ORDER_BOX_X, ORDER_BOX_Y, ORDER_BOX_W, ORDER_BOX_H, 3, 3, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(Math.max(7, S.label + 2));
    doc.setTextColor(...GOLD_DK);
    doc.text(
      "DELIVERY ORDER #",
      ORDER_BOX_X + ORDER_BOX_W / 2,
      ORDER_BOX_Y + 4,
      { align: "center", baseline: "top" }
    );
  }

  // Header text centers in the LEFT zone (margin → box left edge) when the
  // box is shown, or across the full page when hidden.
  const leftCX = showOrderBox ? (MARGIN + ORDER_BOX_X) / 2 : CX;

  // 1. Title
  setFont("bold", S.title);
  doc.text("Event Menu", leftCX, y, { align: "center", baseline: "top" });
  y += lh(S.title, SP) + 1.5;

  // 2. Order number
  setFont("normal", S.label, GRAY);
  doc.text(order.order_number || "DRC-0000", leftCX, y, { align: "center", baseline: "top" });
  y += lh(S.label, SP) + 3;

  // First rule sits inside the box's vertical span when the box is shown —
  // shorten it to stop before the box so the line doesn't cross the corner.
  // Full-width when the box is hidden (Metrobi).
  if (showOrderBox) {
    rule(0.4, MARGIN, ORDER_BOX_X - 2);
  } else {
    rule(0.4);
  }
  y += 3;

  // 3. Client name
  setFont("bold", S.client);
  doc.text(order.client_name || "—", leftCX, y, { align: "center", baseline: "top" });
  y += lh(S.client, SP) + 1;

  // 4. Phone
  setFont("normal", S.label, GRAY);
  doc.text(order.client_phone || "—", leftCX, y, { align: "center", baseline: "top" });
  y += lh(S.label, SP) + 3;

  // Ensure the next rule + date row start below the box bottom, regardless
  // of how much font reduction has been applied. Skipped when the box is
  // hidden so other content can reclaim the space.
  if (showOrderBox) y = Math.max(y, ORDER_BOX_Y + ORDER_BOX_H + 2);

  rule(); y += 3;

  // 5. Date / time — three columns
  const col1 = MARGIN;
  const col2 = MARGIN + CW / 3;
  const col3 = MARGIN + (2 * CW) / 3;

  setFont("normal", S.label, GRAY);
  doc.text("DELIVERY DATE", col1, y, { baseline: "top" });
  doc.text("TIME OUT",      col2, y, { baseline: "top" });
  doc.text("TIME THERE",    col3, y, { baseline: "top" });
  y += lh(S.label, SP) + 1;

  setFont("bold", S.body);
  doc.text(order.delivery_date || "—",      col1, y, { baseline: "top" });
  doc.text(formatTime(order.time_out),       col2, y, { baseline: "top" });
  doc.text(formatTime(order.delivery_time),  col3, y, { baseline: "top" });
  y += lh(S.body, SP) + 3;

  // 6. Guest count — centered and HUGE + optional breakdown
  setFont("normal", S.label, GRAY);
  doc.text("NUMBER OF GUESTS", CX, y, { align: "center", baseline: "top" });
  y += lh(S.label, SP) + 1;

  setFont("bold", GP);
  doc.text(String(order.guest_count || "—"), CX, y, { align: "center", baseline: "top" });
  y += lh(GP, SP) + 2;

  const guestBreakdown = formatGuestBreakdown(order);
  if (guestBreakdown) {
    setFont("normal", S.notes, GRAY);
    const bdLines = doc.splitTextToSize(guestBreakdown, CW - 4);
    doc.text(bdLines, CX, y, { align: "center", baseline: "top" });
    y += bdLines.length * lh(S.notes, SP) + 3;
  } else {
    y += 4;
  }

  rule(0.7); y += 4;

  // 7. Delivery address | Point of contact (moved up)
  setFont("normal", S.label, GRAY);
  doc.text("DELIVERY ADDRESS",  MARGIN,          y, { baseline: "top" });
  doc.text("POINT OF CONTACT",  PAGE_W / 2 + 4,  y, { baseline: "top" });
  y += lh(S.label, SP) + 1;

  setFont("normal", S.body);
  const addrLines = doc.splitTextToSize(order.delivery_address || "—", CW / 2 - 6);
  const ctLines   = [order.on_site_contact || "—"];
  if (order.on_site_phone) ctLines.push(order.on_site_phone);
  doc.text(addrLines, MARGIN,         y, { baseline: "top" });
  doc.text(ctLines,   PAGE_W / 2 + 4, y, { baseline: "top" });
  y += Math.max(addrLines.length, ctLines.length) * lh(S.body, SP) + 3;

  // 8. Kitchen notes (moved up — yellow highlight)
  if (order.kitchen_notes?.trim()) {
    setFont("bold", S.label, GRAY);
    doc.text("ADDITIONAL NOTES FOR KITCHEN", MARGIN, y, { baseline: "top" });
    y += lh(S.label, SP) + 1;

    setFont("normal", S.notes);
    const kLines = doc.splitTextToSize(order.kitchen_notes.trim(), CW - 12);
    const boxH   = kLines.length * lh(S.notes, SP) + 4;
    doc.setFillColor(...NOTE_BG);
    doc.roundedRect(MARGIN, y, CW, boxH + 2, 1.5, 1.5, "F");
    doc.setTextColor(...BLACK);
    doc.text(kLines, MARGIN + 5, y + 2, { baseline: "top" });
    y += boxH + 2 + 3;
  }

  // 9. Driver notes (moved up — yellow highlight)
  if (order.notes?.trim()) {
    setFont("bold", S.label, GRAY);
    doc.text("SPECIAL INSTRUCTIONS FOR DRIVER", MARGIN, y, { baseline: "top" });
    y += lh(S.label, SP) + 1;

    setFont("normal", S.notes);
    const dLines = doc.splitTextToSize(order.notes.trim(), CW - 12);
    const boxH   = dLines.length * lh(S.notes, SP) + 4;
    doc.setFillColor(...NOTE_BG);
    doc.roundedRect(MARGIN, y, CW, boxH + 2, 1.5, 1.5, "F");
    doc.setTextColor(...BLACK);
    doc.text(dLines, MARGIN + 5, y + 2, { baseline: "top" });
    y += boxH + 2 + 3;
  }

  // 10. Delivery method badge (moved up)
  if (order.delivery_method) {
    setFont("normal", S.label, GRAY);
    doc.text("DELIVERY METHOD", MARGIN, y, { baseline: "top" });
    y += lh(S.label, SP) + 1;

    const badgeText = order.delivery_method === "Metrobi" ? "DELIVERY: Metrobi" : "DELIVERY: DR Catering Driver";
    setFont("bold", S.body);
    const badgeW  = doc.getTextWidth(badgeText) + 16;
    const badgeH  = lh(S.body, SP) + 4;
    doc.setFillColor(255, 248, 231);
    doc.setDrawColor(201, 168, 76);
    doc.setLineWidth(0.5);
    doc.roundedRect(MARGIN, y, badgeW, badgeH, 2, 2, "FD");
    doc.setTextColor(...BLACK);
    doc.text(badgeText, MARGIN + 8, y + badgeH / 2, { baseline: "middle" });
    y += badgeH + 4;
  }

  // 11. Divider before menu
  rule(0.3); y += 4;

  // 12. Menu heading
  setFont("bold", S.sect);
  doc.text("MENU", CX, y, { align: "center", baseline: "top" });
  y += lh(S.sect, SP) + 2;

  // 13. Menu items (rich formatting: sections, sub-items, prep notes, quantity bolding)
  let firstNonBlank = true;
  for (const item of menuItems) {
    const parsed = parseMenuLine(item);
    if (parsed.type === "blank") {
      if (!firstNonBlank) y += processMenuLine(doc, parsed, y, S, SP, "render", false);
      continue;
    }
    y += processMenuLine(doc, parsed, y, S, SP, "render", firstNonBlank);
    firstNonBlank = false;
  }
  y += 3;

  // 14. Footer
  rule(0.3); y += 2;
  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
  setFont("italic", S.footer, GRAY);
  doc.text(
    `DR Catering — ${order.order_number || ""} — Generated ${today}`,
    CX, y, { align: "center", baseline: "top" }
  );

  return doc;
}

export function generateOrderPDF(order) {
  return buildPDF(order).output("datauristring").split(",")[1];
}

export function downloadOrderPDF(order) {
  buildPDF(order).save(`DR-Catering-${order.order_number || "order"}.pdf`);
}
