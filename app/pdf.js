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

function getMenuItems(order) {
  const raw = (order.order_details || "• ")
    .split("\n").map(l => l.trim())
    .filter(l => l && l !== "•" && l !== "• ");
  const filtered = raw.filter(
    l => !/^\s*•?\s*beverages?\s*$/i.test(l) && !/^\s*•?\s*paper\s+boxes?\s*$/i.test(l)
  );
  return [...filtered, "• Beverages", "• Paper boxes"];
}

// Measure total layout height for given sizes + spacing.
// Sets jsPDF font state as a side-effect (safe before rendering).
function measureLayout(doc, order, s, sp) {
  const menuItems = getMenuItems(order);
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
  // Rule 2 + gap
  h += 1.5 + 3;
  // Date/time labels + values
  h += lh(s.label, sp) + 1;
  h += lh(s.body, sp)  + 3;
  // Guest count label + HUGE value
  h += lh(s.label, sp) + 1;
  h += lh(guestPt(s.body), sp) + 4;
  // Rule 3 (heavy) + gap
  h += 1.5 + 4;
  // MENU heading
  h += lh(s.sect, sp) + 2;

  // Menu items
  doc.setFont("helvetica", "normal");
  doc.setFontSize(s.menu);
  for (const item of menuItems) {
    const text  = /^•/.test(item) ? item : "• " + item;
    const lines = doc.splitTextToSize(text, CW - 4);
    h += lines.length * lh(s.menu, sp);
  }
  h += 3;

  // Kitchen notes (optional)
  if (order.kitchen_notes?.trim()) {
    h += 1.5 + 2;                      // rule + gap
    h += lh(s.label, sp) + 1;          // label
    doc.setFont("helvetica", "normal");
    doc.setFontSize(s.notes);
    const kl = doc.splitTextToSize(order.kitchen_notes.trim(), CW - 12);
    h += kl.length * lh(s.notes, sp) + 4 + 2 + 3; // content + box padding + gap
  }

  // Delivery section: rule + gap
  h += 1.5 + 3;
  // Address / contact labels + values
  h += lh(s.label, sp) + 1;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(s.body);
  const al = doc.splitTextToSize(order.delivery_address || "—", CW / 2 - 6);
  const cl = [order.on_site_contact || "—"];
  if (order.on_site_phone) cl.push(order.on_site_phone);
  h += Math.max(al.length, cl.length) * lh(s.body, sp) + 2;

  // Driver notes (optional)
  if (order.notes?.trim()) {
    h += lh(s.label, sp) + 1;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(s.notes);
    const dl = doc.splitTextToSize(order.notes.trim(), CW);
    h += dl.length * lh(s.notes, sp) + 2;
  }

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

  const rule = (weight = 0.4) => {
    doc.setDrawColor(...RULE_CLR);
    doc.setLineWidth(weight);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 1.5;
  };

  // ── Render ───────────────────────────────────────────────────────────────

  // 1. Title
  setFont("bold", S.title);
  doc.text("Event Menu", CX, y, { align: "center", baseline: "top" });
  y += lh(S.title, SP) + 1.5;

  // 2. Order number
  setFont("normal", S.label, GRAY);
  doc.text(order.order_number || "DRC-0000", CX, y, { align: "center", baseline: "top" });
  y += lh(S.label, SP) + 3;

  rule(); y += 3;

  // 3. Client name
  setFont("bold", S.client);
  doc.text(order.client_name || "—", CX, y, { align: "center", baseline: "top" });
  y += lh(S.client, SP) + 1;

  // 4. Phone
  setFont("normal", S.label, GRAY);
  doc.text(order.client_phone || "—", CX, y, { align: "center", baseline: "top" });
  y += lh(S.label, SP) + 3;

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

  // 6. Guest count — centered and HUGE
  setFont("normal", S.label, GRAY);
  doc.text("NUMBER OF GUESTS", CX, y, { align: "center", baseline: "top" });
  y += lh(S.label, SP) + 1;

  setFont("bold", GP);
  doc.text(String(order.guest_count || "—"), CX, y, { align: "center", baseline: "top" });
  y += lh(GP, SP) + 4;

  rule(0.7); y += 4;

  // 7. Menu heading
  setFont("bold", S.sect);
  doc.text("MENU", CX, y, { align: "center", baseline: "top" });
  y += lh(S.sect, SP) + 2;

  // 8. Menu items
  setFont("normal", S.menu);
  for (const item of menuItems) {
    const text  = /^•/.test(item) ? item : "• " + item;
    const lines = doc.splitTextToSize(text, CW - 4);
    doc.text(lines, MARGIN + 2, y, { baseline: "top" });
    y += lines.length * lh(S.menu, SP);
  }
  y += 3;

  // 9. Kitchen notes (optional — highlighted box)
  if (order.kitchen_notes?.trim()) {
    rule(0.3); y += 2;

    setFont("bold", S.label, GRAY);
    doc.text("ADDITIONAL NOTES FOR KITCHEN", MARGIN, y, { baseline: "top" });
    y += lh(S.label, SP) + 1;

    setFont("normal", S.notes);
    const kLines = doc.splitTextToSize(order.kitchen_notes.trim(), CW - 12);
    const boxH   = kLines.length * lh(S.notes, SP) + 4;
    doc.setFillColor(...NOTE_BG);
    doc.roundedRect(MARGIN, y, CW, boxH + 2, 1.5, 1.5, "F");
    doc.text(kLines, MARGIN + 5, y + 2, { baseline: "top" });
    y += boxH + 2 + 3;
  }

  // 10. Delivery section
  rule(0.3); y += 3;

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
  y += Math.max(addrLines.length, ctLines.length) * lh(S.body, SP) + 2;

  // 11. Driver notes (optional)
  if (order.notes?.trim()) {
    setFont("normal", S.label, GRAY);
    doc.text("SPECIAL INSTRUCTIONS FOR DRIVER", MARGIN, y, { baseline: "top" });
    y += lh(S.label, SP) + 1;

    setFont("normal", S.notes);
    const dLines = doc.splitTextToSize(order.notes.trim(), CW);
    doc.text(dLines, MARGIN, y, { baseline: "top" });
    y += dLines.length * lh(S.notes, SP) + 2;
  }

  // 12. Footer
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
