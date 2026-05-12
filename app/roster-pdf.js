import jsPDF from "jspdf";

const PT_TO_MM  = 0.352778;
const PAGE_W    = 215.9;          // US Letter, mm
const PAGE_H    = 279.4;
// 0.4 inch margins all around. Held constant — auto-fit shrinks font/row
// height, never the margins (printers can clip closer than this).
const MARGIN    = 10.16;
const CW        = PAGE_W - MARGIN * 2;
const CX        = PAGE_W / 2;
const USABLE_H  = PAGE_H - MARGIN * 2;

// Cell padding (mm). ~6pt L/R, ~5pt T/B.
const CELL_PAD_X = 2.1;
const CELL_PAD_Y = 1.8;

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

// Known DR Catering delivery towns. Real-world addresses are messy (doctor
// names, suite numbers, building names embedded everywhere), so a prefix or
// right-to-left parser ends up showing garbage. Instead, scan for any known
// town as a whole word — longest match wins so "Staten Island" beats "Staten",
// "East Orange" beats "Orange", etc.
const KNOWN_TOWNS = [
  // NJ — multi-word first so longest match wins
  { name: "East Orange",        state: "NJ" },
  { name: "West Orange",        state: "NJ" },
  { name: "South Orange",       state: "NJ" },
  { name: "North Bergen",       state: "NJ" },
  { name: "Cherry Hill",        state: "NJ" },
  { name: "Jersey City",        state: "NJ" },
  { name: "New Brunswick",      state: "NJ" },
  { name: "Old Bridge",         state: "NJ" },
  { name: "Brick Township",     state: "NJ" },
  { name: "Fort Lee",           state: "NJ" },
  { name: "Englewood Cliffs",   state: "NJ" },
  { name: "Atlantic City",      state: "NJ" },
  { name: "Long Branch",        state: "NJ" },
  { name: "Asbury Park",        state: "NJ" },
  { name: "Park Ridge",         state: "NJ" },
  { name: "River Edge",         state: "NJ" },
  { name: "Cedar Grove",        state: "NJ" },
  { name: "Wood Ridge",         state: "NJ" },

  // NJ single-word
  { name: "Hackensack",         state: "NJ" },
  { name: "Union",              state: "NJ" },
  { name: "Newark",             state: "NJ" },
  { name: "Elizabeth",          state: "NJ" },
  { name: "Clifton",            state: "NJ" },
  { name: "Paterson",           state: "NJ" },
  { name: "Passaic",            state: "NJ" },
  { name: "Ridgewood",          state: "NJ" },
  { name: "Westfield",          state: "NJ" },
  { name: "Pennington",         state: "NJ" },
  { name: "Linden",             state: "NJ" },
  { name: "Teaneck",            state: "NJ" },
  { name: "Englewood",          state: "NJ" },
  { name: "Fairlawn",           state: "NJ" },
  { name: "Paramus",            state: "NJ" },
  { name: "Wayne",              state: "NJ" },
  { name: "Edison",             state: "NJ" },
  { name: "Woodbridge",         state: "NJ" },
  { name: "Bayonne",            state: "NJ" },
  { name: "Hoboken",            state: "NJ" },
  { name: "Princeton",          state: "NJ" },
  { name: "Trenton",            state: "NJ" },
  { name: "Camden",             state: "NJ" },
  { name: "Morristown",         state: "NJ" },
  { name: "Summit",             state: "NJ" },
  { name: "Millburn",           state: "NJ" },
  { name: "Maplewood",          state: "NJ" },
  { name: "Montclair",          state: "NJ" },
  { name: "Bloomfield",         state: "NJ" },
  { name: "Belleville",         state: "NJ" },
  { name: "Nutley",             state: "NJ" },
  { name: "Kearny",             state: "NJ" },
  { name: "Harrison",           state: "NJ" },
  { name: "Secaucus",           state: "NJ" },
  { name: "Lyndhurst",          state: "NJ" },
  { name: "Rutherford",         state: "NJ" },
  { name: "Garfield",           state: "NJ" },
  { name: "Lodi",               state: "NJ" },

  // NY
  { name: "Staten Island",      state: "NY" },
  { name: "New York",           state: "NY" },
  { name: "Manhattan",          state: "NY" },
  { name: "Brooklyn",           state: "NY" },
  { name: "Bronx",              state: "NY" },
  { name: "Queens",             state: "NY" },
  { name: "Yonkers",            state: "NY" },
];

// Sorted by name length DESC so multi-word towns ("Staten Island", "East Orange")
// match before any single-word substring. Computed once at module load.
const TOWNS_BY_LENGTH = [...KNOWN_TOWNS].sort((a, b) => b.name.length - a.name.length);

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Scan the address for any known town as a whole word. Returns "City, ST" or
// an empty string when no known town matches — the renderer just shows a
// blank cell. A dash was tested first but read as a missing-data warning on
// the printed sheet; blank is cleaner.
function extractCity(address) {
  if (!address) return "";
  const upper = String(address).toUpperCase();
  for (const town of TOWNS_BY_LENGTH) {
    const pattern = new RegExp("\\b" + escapeRe(town.name.toUpperCase()) + "\\b");
    if (pattern.test(upper)) return `${town.name}, ${town.state}`;
  }
  return "";
}

// Font sizes for a given reduction level. r=0 is the base / max-size state
// (small-order sheets fill the page nicely). The auto-fit loop in buildPDF
// raises r until the page fits — minimums clamp how small things can go.
function sizesFor(r) {
  return {
    title:  Math.max(16, 28 - r),                    // 28 → 16
    sub:    Math.max(11, 16 - Math.floor(r / 2)),    // 16 → ~11
    count:  Math.max(10, 13 - Math.floor(r / 2)),    // 13 → ~10
    header: Math.max(11, 16 - r),                    // 16 → 11
    body:   Math.max( 9, 14 - r),                    // 14 → 9
  };
}

// Row heights in mm. # and Driver columns get extra height so there's room
// for handwriting. Interpolated against body size so it shrinks in lockstep:
// body 14 → 32pt row, body 9 → 18pt row.
function rowHeightFor(s) {
  const heightPt = 18 + (s.body - 9) * (32 - 18) / (14 - 9);
  return Math.max(18 * PT_TO_MM, heightPt * PT_TO_MM);
}

function headerHeightFor(s) {
  // Header row matches body row height so the table reads as one block.
  return rowHeightFor(s);
}

// Inter-section spacing (mm). Added on top of the line height for each header
// element so the roster has breathing room at base sizes.
const GAP_TITLE_TO_SUB    = 3.5;   // ~10pt
const GAP_SUB_TO_COUNT    = 2.8;   // ~8pt
const GAP_COUNT_TO_TABLE  = 4.2;   // ~12pt

// Truncate a string to maxLen characters, adding "…" when it overflows.
// Applied to client_name only on this PDF — the kitchen PDF still shows the
// full name. Without this, long names wrap and the row border slices across
// the wrapped text as a strikethrough.
function truncate(text, maxLen) {
  if (!text) return text;
  return text.length > maxLen ? text.slice(0, maxLen) + "…" : text;
}

// Per-row heights based on actual wrapped line counts. Rows expand to fit
// content; the floor is the handwriting-friendly minimum from rowHeightFor.
// Must be called AFTER the doc's font is set (or it sets it itself, since
// splitTextToSize measures at the current font size).
function computeRowHeights(doc, rows, s) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(s.body);
  const minH = rowHeightFor(s);
  const lineH = s.body * PT_TO_MM * 1.15;
  return rows.map(cells => {
    let maxLines = 1;
    for (let i = 0; i < cells.length; i++) {
      const text = cells[i];
      if (!text) continue;
      const wrapped = doc.splitTextToSize(String(text), COL_W[i] - CELL_PAD_X * 2);
      if (wrapped.length > maxLines) maxLines = wrapped.length;
    }
    const contentH = maxLines * lineH + CELL_PAD_Y * 2;
    return Math.max(minH, contentH);
  });
}

// Measure total layout height using actual per-row heights.
function measureLayout(s, rowHeights) {
  let h = 0;
  h += lh(s.title, 1.15) + GAP_TITLE_TO_SUB;
  h += lh(s.sub,   1.15) + GAP_SUB_TO_COUNT;
  h += lh(s.count, 1.15) + GAP_COUNT_TO_TABLE;
  h += headerHeightFor(s);
  for (const rh of rowHeights) h += rh;
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
    const lines = doc.splitTextToSize(String(text), colW - CELL_PAD_X * 2);
    // Vertically center the text block within the row.
    const blockH = lines.length * fontSize * PT_TO_MM * 1.15;
    const ty = y + (rowH - blockH) / 2 + fontSize * PT_TO_MM * 0.9;
    doc.text(lines, colX + CELL_PAD_X, ty, { baseline: "alphabetic" });
  });
}

function buildPDF(orders, date) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });

  const rows = orders
    .slice()
    .sort((a, b) => {
      // Sort by daily_sequence ascending so the schedule matches the big
      // number on each kitchen PDF. Orders missing a sequence (legacy rows
      // that pre-date the migration) fall to the end with an empty # cell.
      const aSeq = a.daily_sequence ?? Infinity;
      const bSeq = b.daily_sequence ?? Infinity;
      if (aSeq !== bSeq) return aSeq - bSeq;
      // Stable tiebreaker — same sequence shouldn't happen in practice but
      // keep deterministic ordering by time_out just in case.
      return (a.time_out || "99:99").localeCompare(b.time_out || "99:99");
    })
    .map(o => [
      o.daily_sequence != null ? String(o.daily_sequence) : "",   // # — pre-filled from DB
      "",                                                          // Driver Name — handwritten
      extractCity(o.delivery_address),
      fmtTime12(o.time_out),
      fmtTime12(o.delivery_time),
      truncate(o.client_name || "—", 25),                          // 25-char cap so the cell stays one line
    ]);

  // Auto-fit fonts until everything fits the page, or until min sizes are hit.
  // Row heights are recomputed each iteration because the wrap-line-count
  // for any cell depends on font size and column width.
  // Range goes up to r=18 so the title (28→16) has room to keep shrinking
  // after the body has bottomed out at 9pt.
  let reduction = 0;
  let s = sizesFor(0);
  let rowHeights = computeRowHeights(doc, rows, s);
  while (reduction < 18 && measureLayout(s, rowHeights) > USABLE_H) {
    reduction++;
    s = sizesFor(reduction);
    rowHeights = computeRowHeights(doc, rows, s);
  }

  // If even the minimum sizes can't fit, allow page 2. Compute how many rows
  // fit on page 1, render them, then continue on page 2 with header repeated.
  const fitsOnePage = measureLayout(s, rowHeights) <= USABLE_H;

  let y = MARGIN;

  // ── Header section ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(s.title);
  doc.setTextColor(...BLACK);
  doc.text("Driver Delivery Schedule", CX, y, { align: "center", baseline: "top" });
  y += lh(s.title, 1.15) + GAP_TITLE_TO_SUB;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(s.sub);
  doc.setTextColor(...GRAY);
  doc.text(fmtDateLong(date), CX, y, { align: "center", baseline: "top" });
  y += lh(s.sub, 1.15) + GAP_SUB_TO_COUNT;

  doc.setFontSize(s.count);
  const countLine = `${rows.length} stop${rows.length === 1 ? "" : "s"} total`;
  doc.text(countLine, CX, y, { align: "center", baseline: "top" });
  y += lh(s.count, 1.15) + GAP_COUNT_TO_TABLE;

  // ── Table header ──
  const headerH = headerHeightFor(s);
  drawRow(doc, COL_HDRS, y, headerH, s, "bold", s.header, HDR_BG);
  y += headerH;

  // ── Body rows ──
  // Each row carries its own height (computed from the actual wrapped line
  // count of its tallest cell) so borders always sit flush at the bottom of
  // the content — no more strikethrough on long names or city strings.
  for (let i = 0; i < rows.length; i++) {
    const rh = rowHeights[i];
    // Page break if we'd overflow the page (only relevant when fitsOnePage === false).
    if (!fitsOnePage && y + rh > PAGE_H - MARGIN) {
      doc.addPage();
      y = MARGIN;
      drawRow(doc, COL_HDRS, y, headerH, s, "bold", s.header, HDR_BG);
      y += headerH;
    }
    const fill = (i % 2 === 1) ? ALT_BG : null;
    drawRow(doc, rows[i], y, rh, s, "normal", s.body, fill);
    y += rh;
  }

  return doc;
}

export function downloadRosterPDF(orders, date) {
  const doc = buildPDF(orders || [], date);
  doc.save(`DR-Catering-Roster-${date || "today"}.pdf`);
}
