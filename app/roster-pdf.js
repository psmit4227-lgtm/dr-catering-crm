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

// Structural city parser. The town is the word(s) right before the state
// name in the address. Supports all 50 states + DC, abbreviation or spelled
// out. No maintained town list — new delivery cities just work.
//
// Why pick the LATEST state mention instead of the earliest: addresses like
// "1600 Pennsylvania Ave NW Washington DC" contain a state-name as a street
// (Pennsylvania Ave). Latest wins so we resolve to DC, not PA.

const US_STATES = {
  "AL": "AL", "ALABAMA": "AL",
  "AK": "AK", "ALASKA": "AK",
  "AZ": "AZ", "ARIZONA": "AZ",
  "AR": "AR", "ARKANSAS": "AR",
  "CA": "CA", "CALIFORNIA": "CA",
  "CO": "CO", "COLORADO": "CO",
  "CT": "CT", "CONNECTICUT": "CT",
  "DE": "DE", "DELAWARE": "DE",
  "FL": "FL", "FLORIDA": "FL",
  "GA": "GA", "GEORGIA": "GA",
  "HI": "HI", "HAWAII": "HI",
  "ID": "ID", "IDAHO": "ID",
  "IL": "IL", "ILLINOIS": "IL",
  "IN": "IN", "INDIANA": "IN",
  "IA": "IA", "IOWA": "IA",
  "KS": "KS", "KANSAS": "KS",
  "KY": "KY", "KENTUCKY": "KY",
  "LA": "LA", "LOUISIANA": "LA",
  "ME": "ME", "MAINE": "ME",
  "MD": "MD", "MARYLAND": "MD",
  "MA": "MA", "MASSACHUSETTS": "MA",
  "MI": "MI", "MICHIGAN": "MI",
  "MN": "MN", "MINNESOTA": "MN",
  "MS": "MS", "MISSISSIPPI": "MS",
  "MO": "MO", "MISSOURI": "MO",
  "MT": "MT", "MONTANA": "MT",
  "NE": "NE", "NEBRASKA": "NE",
  "NV": "NV", "NEVADA": "NV",
  "NH": "NH", "NEW HAMPSHIRE": "NH",
  "NJ": "NJ", "NEW JERSEY": "NJ",
  "NM": "NM", "NEW MEXICO": "NM",
  "NY": "NY", "NEW YORK": "NY",
  "NC": "NC", "NORTH CAROLINA": "NC",
  "ND": "ND", "NORTH DAKOTA": "ND",
  "OH": "OH", "OHIO": "OH",
  "OK": "OK", "OKLAHOMA": "OK",
  "OR": "OR", "OREGON": "OR",
  "PA": "PA", "PENNSYLVANIA": "PA",
  "RI": "RI", "RHODE ISLAND": "RI",
  "SC": "SC", "SOUTH CAROLINA": "SC",
  "SD": "SD", "SOUTH DAKOTA": "SD",
  "TN": "TN", "TENNESSEE": "TN",
  "TX": "TX", "TEXAS": "TX",
  "UT": "UT", "UTAH": "UT",
  "VT": "VT", "VERMONT": "VT",
  "VA": "VA", "VIRGINIA": "VA",
  "WA": "WA", "WASHINGTON": "WA",
  "WV": "WV", "WEST VIRGINIA": "WV",
  "WI": "WI", "WISCONSIN": "WI",
  "WY": "WY", "WYOMING": "WY",
  "DC": "DC", "DISTRICT OF COLUMBIA": "DC",
};

// Tokens that shouldn't be the start of a town name. The compass-direction
// abbreviations (N/S/E/W/NE/NW/SE/SW) are here so "NW Washington" → "Washington".
const STREET_SUFFIXES = new Set([
  "AVE", "AVENUE", "ST", "STREET", "RD", "ROAD", "BLVD", "BOULEVARD",
  "DR", "DRIVE", "LN", "LANE", "PL", "PLACE", "WAY", "CT", "COURT",
  "PLAZA", "PKWY", "PARKWAY", "HWY", "HIGHWAY", "TRAIL", "PATH",
  "SUITE", "SITE", "UNIT", "APT", "FLOOR", "BUILDING", "BLDG",
  "WING", "NORTH", "SOUTH", "EAST", "WEST", "N", "S", "E", "W",
  "NE", "NW", "SE", "SW",
  "ROUTE", "RTE", "TURNPIKE", "TPKE", "EXPRESSWAY", "EXPY",
  "CIRCLE", "CIR", "TERRACE", "TER", "SQUARE", "SQ",
]);

// State keys sorted by length DESC so multi-word names ("NEW JERSEY") win
// over "NJ" if both happen to match in the same iteration. Computed once.
const STATE_KEYS_BY_LENGTH = Object.keys(US_STATES).sort((a, b) => b.length - a.length);

function extractCity(address) {
  if (!address || typeof address !== "string") return "";
  const upper = address.toUpperCase();

  // Find the LATEST state mention in the address. Walking through every
  // state key and taking the max index across all matches.
  let best = null;
  for (const key of STATE_KEYS_BY_LENGTH) {
    const re = new RegExp(
      "(?:^|[\\s,])" + key.replace(/\s+/g, "\\s+") + "(?=[\\s,]|$|\\s*\\d)",
      "gi",
    );
    let m;
    while ((m = re.exec(upper)) !== null) {
      if (!best || m.index > best.index) {
        best = { index: m.index, abbr: US_STATES[key] };
      }
      // Guard against zero-width pathology — exec on the same lastIndex would loop.
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  }

  if (!best) return "";

  // Everything before the matched separator is the prefix. Trim trailing
  // whitespace/commas and split into words.
  const before = address.substring(0, best.index).trim();
  if (!before) return "";

  const words = before
    .split(/[\s,]+/)
    .map(w => w.replace(/[.,]+$/, ""))
    .filter(Boolean);
  if (words.length === 0) return "";

  // Multi-word towns ("Toms River", "Los Angeles", "Staten Island") need the
  // last 2; if the first of those is a street suffix or compass direction,
  // drop it so single-word towns ("Newark", "Brooklyn") come out clean.
  let townWords = words.slice(-2);
  if (STREET_SUFFIXES.has(townWords[0].toUpperCase())) {
    townWords = townWords.slice(-1);
  }

  const town = townWords
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
  if (!town) return "";

  return `${town}, ${best.abbr}`;
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

// Strip operator notes / prices / scribbles out of client_name for display on
// this PDF only (DB, kitchen PDF, order history all keep the raw value).
// Cuts the name at the first digit, special char (+ $ # % @ *), or stop word
// — whichever comes first. Roman numerals, suffixes, apostrophes, hyphens,
// and accented letters aren't in those patterns, so they're preserved.
// If the cleanup empties the string (the whole name is itself a stop word,
// e.g. "Party Hosts Inc"), return the raw value so the row doesn't show
// blank.
const CLEAN_STOP_RE = new RegExp(
  "\\d|[+$#%@*]|\\b(?:party|call|note|text|email|pay|price|see|delivery|tax|credit)\\b",
  "i",
);

function cleanClientName(raw) {
  if (!raw) return raw;
  const match = raw.match(CLEAN_STOP_RE);
  let cleaned = match ? raw.slice(0, match.index) : raw;
  // Trim trailing whitespace + dangling commas/periods.
  cleaned = cleaned.replace(/[\s,.]+$/, "").replace(/^\s+/, "");
  return cleaned || raw;
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
      truncate(cleanClientName(o.client_name || "—"), 25),         // strip notes/prices, then cap at 25 chars
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
  const countLine = `${rows.length} route${rows.length === 1 ? "" : "s"} total`;
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
