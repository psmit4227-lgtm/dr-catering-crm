import jsPDF from "jspdf";

function buildPDF(order) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth(); // 215.9mm
  const margin = 20;
  const cx = pageWidth / 2;
  const contentWidth = pageWidth - margin * 2;
  const colRight = pageWidth / 2 + 8;
  const halfWidth = contentWidth / 2 - 8;
  let y = 28;

  const black = [15, 18, 20];
  const gray = [140, 140, 140];
  const lineGray = [210, 210, 210];

  const setLabel = () => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...gray);
  };
  const setValue = () => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(...black);
  };
  const hRule = (weight = 0.5) => {
    doc.setDrawColor(...lineGray);
    doc.setLineWidth(weight);
    doc.line(margin, y, pageWidth - margin, y);
  };

  // 1. "Event Menu" — bold 20pt centered
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...black);
  doc.text("Event Menu", cx, y, { align: "center" });
  y += 9;

  // 2. Order number — gray 12pt centered
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(...gray);
  doc.text(order.order_number || "DRC-0000", cx, y, { align: "center" });
  y += 8;

  // 3. Client name — bold 14pt centered
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...black);
  doc.text(order.client_name || "—", cx, y, { align: "center" });
  y += 7;

  // 4. Client phone — gray 12pt centered
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(...gray);
  doc.text(order.client_phone || "—", cx, y, { align: "center" });
  y += 9;

  // 5. Horizontal line
  hRule(0.5);
  y += 7;

  // 6. Two columns — Delivery date | Delivery time
  setLabel();
  doc.text("DELIVERY DATE", margin, y);
  doc.text("DELIVERY TIME", colRight, y);
  y += 5;
  setValue();
  doc.text(order.delivery_date || "—", margin, y);
  doc.text(order.delivery_time || "—", colRight, y);
  y += 10;

  // 7. Two columns — Full address | Point of contact
  setLabel();
  doc.text("DELIVERY ADDRESS", margin, y);
  doc.text("POINT OF CONTACT", colRight, y);
  y += 5;
  setValue();
  const addressLines = doc.splitTextToSize(order.delivery_address || "—", halfWidth);
  doc.text(addressLines, margin, y);
  doc.text(order.on_site_contact || "—", colRight, y);
  y += addressLines.length > 1 ? addressLines.length * 5.5 + 3 : 10;

  // 8. Full width — Number of guests (value bold)
  setLabel();
  doc.text("NUMBER OF GUESTS", margin, y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...black);
  doc.text(order.guest_count || "—", margin, y);
  y += 10;

  // 9. Horizontal line
  hRule(0.5);
  y += 8;

  // 10. "MENU" — bold uppercase centered
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...black);
  doc.text("MENU", cx, y, { align: "center" });
  y += 8;

  // 11 & 12. Menu items + always append Beverages and Paper boxes
  const rawItems = (order.order_details || "• ")
    .split("\n")
    .map(l => l.trim())
    .filter(l => l && l !== "•" && l !== "• ");

  const filtered = rawItems.filter(
    l => !/^\s*•?\s*beverages?\s*$/i.test(l) && !/^\s*•?\s*paper\s+boxes?\s*$/i.test(l)
  );

  const menuItems = [...filtered, "• Beverages", "• Paper boxes"];

  doc.setFont("helvetica", "normal");
  doc.setFontSize(14);
  doc.setTextColor(...black);
  const lineH = 8;
  menuItems.forEach(item => {
    const text = /^•/.test(item) ? item : "• " + item;
    const wrapped = doc.splitTextToSize(text, contentWidth);
    doc.text(wrapped, margin, y);
    y += wrapped.length * lineH;
  });

  y += 4;

  // 13. Notes (if present) — thin line then label + text
  if (order.notes && order.notes.trim()) {
    hRule(0.3);
    y += 6;
    setLabel();
    doc.text("NOTES", margin, y);
    y += 5;
    setValue();
    const notesLines = doc.splitTextToSize(order.notes.trim(), contentWidth);
    doc.text(notesLines, margin, y);
    y += notesLines.length * 6 + 4;
  }

  // 14. Thin line + footer
  hRule(0.3);
  y += 6;
  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(...gray);
  doc.text(
    `DR Catering — ${order.order_number || ""} — Generated ${today}`,
    cx, y, { align: "center" }
  );

  return doc;
}

export function generateOrderPDF(order) {
  return buildPDF(order).output("datauristring");
}

export function downloadOrderPDF(order) {
  buildPDF(order).save(`DR-Catering-${order.order_number || "order"}.pdf`);
}
