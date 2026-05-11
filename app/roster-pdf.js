import jsPDF from "jspdf";

const PT_TO_MM  = 0.352778;
const PAGE_W    = 215.9;          // US Letter, mm
const PAGE_H    = 279.4;
const MARGIN    = 12.7;           // 0.5 inch
const CW        = PAGE_W - MARGIN * 2;
const CX        = PAGE_W / 2;
const USABLE_H  = PAGE_H - MARGIN * 2;

const BLACK     = [15, 18, 20];
const GRAY      = [120, 120, 120];
const HDR_BG    = [230, 230, 230];   // header row light gray
const ALT_BG    = [245, 245, 245];   // every other body row

const lh = (pt, sp) => pt * PT_TO_MM * sp;

// Column proportions of CW. # and Driver get extra width so Dom has room to
// handwrite. Total = 1.00.
const COL_FRAC = [0.07, 0.20, 0.22, 0.13, 0.13, 0.25];
const COL_HDRS = ["#", "Driver Name", "Location", "Time Out", "Time There", "Client Name"];
const COL_X = (() => {
  const xs = [MARGIN];
  for (let i = 0; i < COL_FRAC.length - 1; i++) xs.push(xs[xs.length - 1] + COL_FRAC[i] * CW);
  return xs;
})();
const COL_W = COL_FRAC.map(f => f * CW);

function fmtTime12(t) {
  if (!t) return "—";
  const [hStr, mStr] = String(t).split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return String(t);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function fmtDateLong(d) {
  if (!d) return "";
  const [y, m, day] = String(d).split("-").map(Number);
  if (!y || !m || !day) return String(d);
  const dt = new Date(y, m - 1, day);
  const days   = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  return `${days[dt.getDay()]}, ${months[m - 1]} ${day}, ${y}`;
}

// Extract "City, ST" from a US address. Handles common shapes:
//   "30 Prospect Ave, Hackensack NJ 07601"
//   "2321 US-22, Union, NJ 07083"
//   "100 Main St, Newark, NJ"
//   "Hackensack University Medical Center, 30 Prospect Ave, Hackensack, NJ 07601"
// Falls back to first 25 chars of the original on weird input.
function extractCity(address) {
  const raw = (address || "").trim();
  if (!raw) return "—";

  const parts = raw.split(",").map(s => s.trim()).filter(Boolean);
  const stateRe = /^[A-Z]{2}(?:\s+\d{5}(?:-\d{4})?)?$/;
  const cityStateRe = /^([A-Za-z][A-Za-z\s.'-]*?)\s+([A-Z]{2})(?:\s+\d{5}(?:-\d{4})?)?$/;

  // Walk parts right-to-left looking for the City/State piece(s).
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    // "Hackensack NJ 07601" → "Hackensack, NJ"
    const m = p.match(cityStateRe);
    if (m) return `${m[1].trim()}, ${m[2]}`;
    // Stand-alone "NJ" or "NJ 07601" — city is the previous segment.
    if (stateRe.test(p) && i > 0) {
      const state = p.slice(0, 2);
      const city = parts[i - 1].trim();
      if (city) return `${city}, ${state}`;
    }
  }

  // Couldn't parse — show a clipped raw string so Dom still has a hint.
  return raw.length > 25 ? raw.slice(0, 25) + "…" : raw;
}

// Font sizes for a given reduction level. r=0 is the requested start state.
// Min is enforced below.
function sizesFor(r) {
  return {
    title:  Math.max(16, 22 - r),
    sub:    Math.max( 9, 12 - Math.floor(r / 2)),
    count:  Math.max( 9, 11 - Math.floor(r / 2)),
    header: Math.max(10, 14 - r),
    body:   Math.max( 8, 11 - r),
  };
}

// Row heights in mm. # and Driver columns get extra height so there's room
// for handwriting (~22pt feel ≈ 7.8mm at the start font). Scales gently
// with reduction so the table still tightens up if needed.
function rowHeightFor(s) {
  const writeRow = Math.max(7.5, 22 * PT_TO_MM * (s.body / 11));
  const normal   = Math.max(5.5, s.body * PT_TO_MM * 1.9);
  return Math.max(writeRow, normal);
}

function headerHeightFor(s) {
  return Math.max(6.5, s.header * PT_TO_MM * 2.0);
}

// Measure total layout height for one page worth of rows at given font sizes.
function measureLayout(s, rowCount) {
  let h = 0;
  h += lh(s.title, 1.15) + 2;          // title + gap
  h += lh(s.sub, 1.15) + 1.5;          // subtitle
  h += lh(s.count, 1.15) + 4;          // count + gap before table
  h += headerHeightFor(s);             // table header
  h += rowHeightFor(s) * rowCount;     // body rows
  return h;
}

function drawRow(doc, cells, y, rowH, s, font, fontSize, fill, drawBorder = true) {
  if (fill) {
    doc.setFillColor(...fill);
    doc.rect(MARGIN, y, CW, rowH, "F");
  }
  if (drawBorder) {
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    // Outer + verticals
    doc.rect(MARGIN, y, CW, rowH);
    let x = MARGIN;
    for (let i = 0; i < COL_W.length - 1; i++) {
      x += COL_W[i];
      doc.line(x, y, x, y + rowH);
    }
  }
  doc.setFont("helvetica", font);
  doc.setFontSize(fontSize);
  doc.setTextColor(...BLACK);
  cells.forEach((text, i) => {
    if (!text) return;
    const colX = COL_X[i];
    const colW = COL_W[i];
    const lines = doc.splitTextToSize(String(text), colW - 4);
    // Vertically center the text block within the row.
    const blockH = lines.length * fontSize * PT_TO_MM * 1.15;
    const ty = y + (rowH - blockH) / 2 + fontSize * PT_TO_MM * 0.9;
    doc.text(lines, colX + 2, ty, { baseline: "alphabetic" });
  });
}

function buildPDF(orders, date) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });

  const rows = orders
    .slice()
    .sort((a, b) => {
      const at = (a.time_out || "99:99");
      const bt = (b.time_out || "99:99");
      return at.localeCompare(bt);
    })
    .map(o => [
      "",                            // # — handwritten
      "",                            // Driver Name — handwritten
      extractCity(o.delivery_address),
      fmtTime12(o.time_out),
      fmtTime12(o.delivery_time),
      o.client_name || "—",
    ]);

  // Auto-fit fonts until everything fits the page, or until min sizes are hit.
  let reduction = 0;
  let s = sizesFor(0);
  while (reduction < 12 && measureLayout(s, rows.length) > USABLE_H) {
    reduction++;
    s = sizesFor(reduction);
  }

  // If even the minimum sizes can't fit, allow page 2. Compute how many rows
  // fit on page 1, render them, then continue on page 2.
  const fitsOnePage = measureLayout(s, rows.length) <= USABLE_H;

  let y = MARGIN;

  // ── Header section ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(s.title);
  doc.setTextColor(...BLACK);
  doc.text("Daily Delivery Roster", CX, y, { align: "center", baseline: "top" });
  y += lh(s.title, 1.15) + 2;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(s.sub);
  doc.setTextColor(...GRAY);
  doc.text(fmtDateLong(date), CX, y, { align: "center", baseline: "top" });
  y += lh(s.sub, 1.15) + 1.5;

  doc.setFontSize(s.count);
  const countLine = `${rows.length} stop${rows.length === 1 ? "" : "s"} total`;
  doc.text(countLine, CX, y, { align: "center", baseline: "top" });
  y += lh(s.count, 1.15) + 4;

  // ── Table header ──
  const headerH = headerHeightFor(s);
  drawRow(doc, COL_HDRS, y, headerH, s, "bold", s.header, HDR_BG);
  y += headerH;

  // ── Body rows ──
  const rowH = rowHeightFor(s);
  let rowIdx = 0;
  for (const cells of rows) {
    // Page break if we'd overflow the page (only relevant when fitsOnePage === false).
    if (!fitsOnePage && y + rowH > PAGE_H - MARGIN) {
      doc.addPage();
      y = MARGIN;
      drawRow(doc, COL_HDRS, y, headerH, s, "bold", s.header, HDR_BG);
      y += headerH;
    }
    const fill = (rowIdx % 2 === 1) ? ALT_BG : null;
    drawRow(doc, cells, y, rowH, s, "normal", s.body, fill);
    y += rowH;
    rowIdx++;
  }

  return doc;
}

export function downloadRosterPDF(orders, date) {
  const doc = buildPDF(orders || [], date);
  doc.save(`DR-Catering-Roster-${date || "today"}.pdf`);
}
