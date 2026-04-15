import jsPDF from "jspdf";

function buildPDF(order) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const pageWidth  = doc.internal.pageSize.getWidth();   // 215.9 mm
  const pageHeight = doc.internal.pageSize.getHeight();  // 279.4 mm
  const margin      = 20;
  const cx          = pageWidth / 2;
  const contentWidth = pageWidth - margin * 2;
  const colRight    = pageWidth / 2 + 8;
  const halfWidth   = contentWidth / 2 - 8;
  const colMid      = margin + contentWidth / 3;
  const colThird    = margin + (2 * contentWidth) / 3;
  const bottomLimit = pageHeight - 25;
  const pageTop     = 20;
  let y = 26;

  const black    = [15, 18, 20];
  const gray     = [140, 140, 140];
  const lineGray = [210, 210, 210];

  const checkY = (needed = 0) => {
    if (y + needed > bottomLimit) {
      doc.addPage();
      y = pageTop;
    }
  };

  const setLabel = () => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...gray);
  };
  const setValue = () => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...black);
  };
  const hRule = (weight = 0.5) => {
    doc.setDrawColor(...lineGray);
    doc.setLineWidth(weight);
    doc.line(margin, y, pageWidth - margin, y);
  };

  const formatTime = (t) => {
    if (!t) return "—";
    const [hStr, mStr] = t.split(":");
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (isNaN(h) || isNaN(m)) return t;
    const period = h >= 12 ? "PM" : "AM";
    const hour   = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, "0")} ${period}`;
  };

  // ── 1. Title ────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...black);
  doc.text("Event Menu", cx, y, { align: "center" });
  y += 7;

  // ── 2. Order number ─────────────────────────────────────────────
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...gray);
  doc.text(order.order_number || "DRC-0000", cx, y, { align: "center" });
  y += 6;

  // ── 3. Client name ──────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...black);
  doc.text(order.client_name || "—", cx, y, { align: "center" });
  y += 5;

  // ── 4. Client phone ─────────────────────────────────────────────
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...gray);
  doc.text(order.client_phone || "—", cx, y, { align: "center" });
  y += 7;

  // ── 5. Divider ──────────────────────────────────────────────────
  hRule(0.5);
  y += 6;

  // ── 6. Delivery date | Time out | Time there ────────────────────
  setLabel();
  doc.text("DELIVERY DATE", margin, y);
  doc.text("TIME OUT",   colMid,   y);
  doc.text("TIME THERE", colThird, y);
  y += 4;
  setValue();
  doc.text(order.delivery_date || "—",      margin,   y);
  doc.text(formatTime(order.time_out),      colMid,   y);
  doc.text(formatTime(order.delivery_time), colThird, y);
  y += 8;

  // ── 7. Delivery address | Point of contact ──────────────────────
  setLabel();
  doc.text("DELIVERY ADDRESS", margin,   y);
  doc.text("POINT OF CONTACT", colRight, y);
  y += 4;
  setValue();
  const addressLines = doc.splitTextToSize(order.delivery_address || "—", halfWidth);
  doc.text(addressLines, margin, y);
  const contactLines = [order.on_site_contact || "—"];
  if (order.on_site_phone) contactLines.push(order.on_site_phone);
  doc.text(contactLines, colRight, y);
  const maxContactLines = Math.max(addressLines.length, contactLines.length);
  y += maxContactLines > 1 ? maxContactLines * 4.5 + 3 : 8;

  // ── 8. Number of guests ─────────────────────────────────────────
  setLabel();
  doc.text("NUMBER OF GUESTS", margin, y);
  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...black);
  doc.text(order.guest_count || "—", margin, y);
  y += 8;

  // ── 9. Divider ──────────────────────────────────────────────────
  hRule(0.5);
  y += 7;

  // ── 10. "MENU" heading ──────────────────────────────────────────
  checkY(14);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...black);
  doc.text("MENU", cx, y, { align: "center" });
  y += 7;

  // ── 11 & 12. Menu items ─────────────────────────────────────────
  const rawItems = (order.order_details || "• ")
    .split("\n")
    .map(l => l.trim())
    .filter(l => l && l !== "•" && l !== "• ");

  const filtered = rawItems.filter(
    l => !/^\s*•?\s*beverages?\s*$/i.test(l) && !/^\s*•?\s*paper\s+boxes?\s*$/i.test(l)
  );

  const menuItems = [...filtered, "• Beverages", "• Paper boxes"];

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...black);
  const lineH = 6;
  menuItems.forEach(item => {
    const text    = /^•/.test(item) ? item : "• " + item;
    const wrapped = doc.splitTextToSize(text, contentWidth);
    checkY(wrapped.length * lineH);
    doc.text(wrapped, margin, y);
    y += wrapped.length * lineH;
  });

  y += 3;

  // ── 13a. Additional notes for kitchen ───────────────────────────
  if (order.kitchen_notes && order.kitchen_notes.trim()) {
    checkY(16);
    hRule(0.3);
    y += 5;
    setLabel();
    doc.text("ADDITIONAL NOTES FOR KITCHEN", margin, y);
    y += 4;
    setValue();
    const kitchenLines = doc.splitTextToSize(order.kitchen_notes.trim(), contentWidth);
    kitchenLines.forEach(line => {
      checkY(6);
      doc.text(line, margin, y);
      y += 5;
    });
    y += 3;
  }

  // ── 13b. Special instructions for driver ────────────────────────
  if (order.notes && order.notes.trim()) {
    checkY(16);
    hRule(0.3);
    y += 5;
    setLabel();
    doc.text("SPECIAL INSTRUCTIONS FOR DRIVER", margin, y);
    y += 4;
    setValue();
    const notesLines = doc.splitTextToSize(order.notes.trim(), contentWidth);
    notesLines.forEach(line => {
      checkY(6);
      doc.text(line, margin, y);
      y += 5;
    });
    y += 3;
  }

  // ── 14. Footer ──────────────────────────────────────────────────
  checkY(10);
  hRule(0.3);
  y += 5;
  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(...gray);
  doc.text(
    `DR Catering — ${order.order_number || ""} — Generated ${today}`,
    cx, y, { align: "center" }
  );

  return doc;
}

export function generateOrderPDF(order) {
  return buildPDF(order).output("datauristring").split(",")[1];
}

export function downloadOrderPDF(order) {
  buildPDF(order).save(`DR-Catering-${order.order_number || "order"}.pdf`);
}
