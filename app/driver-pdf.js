import jsPDF from "jspdf";

const PT_TO_MM = 0.352778;
const PAGE_W   = 215.9;
const PAGE_H   = 279.4;
const MARGIN   = 18;
const CW       = PAGE_W - MARGIN * 2;
const CX       = PAGE_W / 2;
const USABLE_H = PAGE_H - MARGIN * 2;

const BLACK    = [15, 18, 20];
const GRAY     = [120, 120, 120];
const RULE_CLR = [210, 210, 210];
const NOTE_BG  = [255, 252, 220];
const GOLD     = [201, 168, 76];
const GOLD_DK  = [139, 105, 20];
const ESPRESSO = [30, 16, 8];

const lh = (pt, sp) => pt * PT_TO_MM * sp;

const sizesFor = (r) => ({
  driverHeader: Math.max(28, 56 - r * 2),
  depart:       Math.max(36, 72 - r * 2),
  label:        Math.max(7, 9 - Math.floor(r / 3)),
  body:         Math.max(10, 14 - r),
  stopHeader:   Math.max(12, 18 - r),
  stopBody:     Math.max(9, 13 - r),
  notes:        Math.max(8, 12 - r),
  footer:       7,
});

function fmtTime12(t) {
  if (!t) return "—";
  const [hStr, mStr] = String(t).split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return t;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function fmtDuration(min) {
  if (!min || isNaN(min)) return "—";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function measureDriverSheet(doc, driver, planDate, s, sp) {
  let h = 0;
  // Top header: "Driver N" + date
  h += lh(s.label, sp) + 1;
  h += lh(s.driverHeader, sp) + 4;
  // Rule
  h += 1.5 + 4;
  // "DEPART KITCHEN" label + huge time
  h += lh(s.label, sp) + 2;
  h += lh(s.depart, sp) + 6;
  // Driver totals row
  h += lh(s.body, sp) + 4;
  // Rule
  h += 1.5 + 4;
  // STOPS heading
  h += lh(s.stopHeader, sp) + 3;

  for (const stop of driver.stops) {
    h += lh(s.stopHeader, sp) + 1; // stop title row
    h += lh(s.label, sp) + 1;
    h += lh(s.stopBody, sp) + 1;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(s.stopBody);
    const addrLines = doc.splitTextToSize(stop.deliveryAddress || "—", CW - 14);
    h += addrLines.length * lh(s.stopBody, sp) + 1;
    if (stop.onSiteContact || stop.onSitePhone) h += lh(s.stopBody, sp) + 1;
    if (stop.driverNotes?.trim()) {
      doc.setFontSize(s.notes);
      const noteLines = doc.splitTextToSize(stop.driverNotes.trim(), CW - 18);
      h += lh(s.label, sp) + 1;
      h += noteLines.length * lh(s.notes, sp) + 4;
    }
    h += 4; // gap between stops
  }

  // Return row
  h += 1.5 + 3;
  h += lh(s.label, sp) + 1;
  h += lh(s.stopHeader, sp) + 4;
  // Footer
  h += 1.5 + 2 + lh(s.footer, sp);
  return h;
}

function renderDriverSheet(doc, driver, planDate, totalDrivers, mockMode) {
  let reduction = 0;
  let spacing = 1.25;
  while (reduction < 14) {
    const s = sizesFor(reduction);
    if (measureDriverSheet(doc, driver, planDate, s, spacing) <= USABLE_H) break;
    reduction++;
    spacing = Math.max(1.0, spacing * 0.96);
  }
  const S = sizesFor(reduction);
  const SP = spacing;

  let y = MARGIN;

  const setFont = (style, size, color = BLACK) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };

  const rule = (weight = 0.4, color = RULE_CLR) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(weight);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 1.5;
  };

  // Top label
  setFont("normal", S.label, GOLD_DK);
  const dateLabel = planDate ? `ROUTE — ${planDate}` : "ROUTE";
  doc.text(dateLabel, MARGIN, y, { baseline: "top" });
  if (mockMode) {
    doc.text("MOCK MODE", PAGE_W - MARGIN, y, { baseline: "top", align: "right" });
  }
  y += lh(S.label, SP) + 1;

  // Driver header
  setFont("bold", S.driverHeader, ESPRESSO);
  doc.text(`Driver ${driver.driverNumber}`, MARGIN, y, { baseline: "top" });
  setFont("normal", S.label, GRAY);
  doc.text(
    `of ${totalDrivers}`,
    MARGIN + doc.getStringUnitWidth(`Driver ${driver.driverNumber}`) * S.driverHeader * PT_TO_MM + 6,
    y + lh(S.driverHeader, SP) - lh(S.label, SP),
    { baseline: "top" }
  );
  y += lh(S.driverHeader, SP) + 4;

  rule(0.7, ESPRESSO); y += 4;

  // DEPART KITCHEN — huge so the driver sees it on a stack
  setFont("bold", S.label, GOLD_DK);
  doc.text("DEPART KITCHEN AT", MARGIN, y, { baseline: "top" });
  y += lh(S.label, SP) + 2;
  setFont("bold", S.depart, ESPRESSO);
  doc.text(fmtTime12(driver.departKitchen), MARGIN, y, { baseline: "top" });
  y += lh(S.depart, SP) + 6;

  // Driver totals row
  const stopsCount = driver.stops.length;
  const totals = `${stopsCount} ${stopsCount === 1 ? "stop" : "stops"}   ·   ${(driver.totalMiles || 0).toFixed(1)} mi   ·   ${fmtDuration(driver.totalDriveMinutes)}`;
  setFont("normal", S.body, GRAY);
  doc.text(totals, MARGIN, y, { baseline: "top" });
  y += lh(S.body, SP) + 4;

  rule(0.4); y += 4;

  setFont("bold", S.stopHeader, GOLD_DK);
  doc.text("STOPS", MARGIN, y, { baseline: "top" });
  y += lh(S.stopHeader, SP) + 3;

  driver.stops.forEach((stop) => {
    // Numbered badge + client name
    const badgeSize = S.stopHeader * 0.95;
    const badgeR = badgeSize * 0.5 * PT_TO_MM + 1.5;
    const badgeCX = MARGIN + badgeR;
    const badgeCY = y + badgeR;

    doc.setFillColor(...ESPRESSO);
    doc.circle(badgeCX, badgeCY, badgeR, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(badgeSize * 0.75);
    doc.setTextColor(...GOLD);
    doc.text(String(stop.stopNumber), badgeCX, badgeCY, { align: "center", baseline: "middle" });

    setFont("bold", S.stopHeader, ESPRESSO);
    doc.text(stop.clientName || "—", MARGIN + badgeR * 2 + 4, y, { baseline: "top" });
    y += lh(S.stopHeader, SP) + 1;

    // Arrival/leave row
    setFont("normal", S.label, GOLD_DK);
    const arriveText = `ARRIVE ${fmtTime12(stop.arriveAt)}   ·   SETUP 15 MIN   ·   LEAVE ${fmtTime12(stop.leaveAt)}`;
    doc.text(arriveText, MARGIN + 4, y, { baseline: "top" });
    y += lh(S.label, SP) + 1;

    // "Time there" deadline (if present)
    if (stop.deliveryDeadline) {
      setFont("italic", S.stopBody, GRAY);
      doc.text(`Customer expects setup by ${fmtTime12(stop.deliveryDeadline)}`, MARGIN + 4, y, { baseline: "top" });
      y += lh(S.stopBody, SP) + 1;
    }

    // Address
    setFont("normal", S.stopBody, BLACK);
    const addrLines = doc.splitTextToSize(stop.deliveryAddress || "—", CW - 14);
    doc.text(addrLines, MARGIN + 4, y, { baseline: "top" });
    y += addrLines.length * lh(S.stopBody, SP) + 1;

    // Contact
    if (stop.onSiteContact || stop.onSitePhone) {
      const contact = [stop.onSiteContact, stop.onSitePhone].filter(Boolean).join(" · ");
      setFont("normal", S.stopBody, GRAY);
      doc.text(contact, MARGIN + 4, y, { baseline: "top" });
      y += lh(S.stopBody, SP) + 1;
    }

    // Driver notes
    if (stop.driverNotes?.trim()) {
      setFont("bold", S.label, GRAY);
      doc.text("DRIVER NOTES", MARGIN + 4, y, { baseline: "top" });
      y += lh(S.label, SP) + 1;
      setFont("normal", S.notes);
      const noteLines = doc.splitTextToSize(stop.driverNotes.trim(), CW - 18);
      const boxH = noteLines.length * lh(S.notes, SP) + 3;
      doc.setFillColor(...NOTE_BG);
      doc.roundedRect(MARGIN + 4, y, CW - 8, boxH, 1.2, 1.2, "F");
      doc.setTextColor(...BLACK);
      doc.text(noteLines, MARGIN + 7, y + 1.5, { baseline: "top" });
      y += boxH + 1;
    }

    y += 4;
  });

  // Return row
  rule(0.4); y += 3;
  setFont("bold", S.label, GOLD_DK);
  doc.text("RETURN TO KITCHEN", MARGIN, y, { baseline: "top" });
  y += lh(S.label, SP) + 1;
  setFont("bold", S.stopHeader, ESPRESSO);
  doc.text(fmtTime12(driver.returnKitchen), MARGIN, y, { baseline: "top" });
  y += lh(S.stopHeader, SP) + 4;

  // Footer
  y = PAGE_H - MARGIN - lh(S.footer, SP) - 3;
  rule(0.3); y += 2;
  setFont("italic", S.footer, GRAY);
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  doc.text(`DR Catering — Driver ${driver.driverNumber}/${totalDrivers} — Generated ${today}`, CX, y, { align: "center", baseline: "top" });
}

function buildDriverSheetsPDF(plan, planDate, mockMode) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const drivers = plan.drivers || [];
  drivers.forEach((driver, idx) => {
    if (idx > 0) doc.addPage();
    renderDriverSheet(doc, driver, planDate, drivers.length, mockMode);
  });
  return doc;
}

export function downloadDriverSheetsPDF(plan, planDate, mockMode) {
  if (!plan?.drivers?.length) return;
  const doc = buildDriverSheetsPDF(plan, planDate, mockMode);
  doc.save(`DR-Catering-Drivers-${planDate || "plan"}.pdf`);
}
