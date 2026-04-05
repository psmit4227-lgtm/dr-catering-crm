import jsPDF from "jspdf";

export function generateOrderPDF(order) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const navy = [30, 58, 95];
  const gold = [200, 160, 60];
  const dark = [40, 40, 40];
  const gray = [120, 120, 120];
  const lineGray = [200, 200, 200];

  doc.setFillColor(...gold);
  doc.rect(0, 0, pageWidth, 4, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...navy);
  doc.text("DR CATERING", margin, y + 14);

  doc.setFontSize(11);
  doc.setTextColor(...gray);
  doc.text("ORDER CONFIRMATION", pageWidth - margin, y + 8, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...navy);
  doc.text(order.orderNumber || "ORD-0000", pageWidth - margin, y + 15, { align: "right" });

  y += 24;
  doc.setDrawColor(...lineGray);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  const colRight = pageWidth / 2 + 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...gold);
  doc.text("CUSTOMER", margin, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...dark);
  doc.text(order.customerName || "—", margin, y);
  y += 5;
  doc.setTextColor(...gray);
  doc.setFontSize(9);
  if (order.customerPhone) { doc.text(order.customerPhone, margin, y); y += 4; }
  if (order.customerEmail) { doc.text(order.customerEmail, margin, y); }

  let yRight = y - (order.customerPhone ? 14 : 10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...gold);
  doc.text("EVENT DETAILS", colRight, yRight);
  yRight += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...dark);
  [
    order.eventDate && `Date: ${order.eventDate}`,
    order.eventTime && `Time: ${order.eventTime}`,
    order.eventLocation && `Location: ${order.eventLocation}`,
    order.guestCount && `Guests: ${order.guestCount}`,
  ].filter(Boolean).forEach((line) => {
    doc.text(line, colRight, yRight);
    yRight += 5;
  });

  y = Math.max(y, yRight) + 6;
  doc.setDrawColor(...lineGray);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  const colItem = margin;
  const colQty = margin + contentWidth * 0.55;
  const colPrice = margin + contentWidth * 0.72;
  const colTotal = pageWidth - margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...navy);
  doc.text("ITEM", colItem, y);
  doc.text("QTY", colQty, y);
  doc.text("PRICE", colPrice, y);
  doc.text("TOTAL", colTotal, y, { align: "right" });
  y += 3;
  doc.setDrawColor(...navy);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  let subtotal = 0;

  (order.items || []).forEach((item, i) => {
    const lineTotal = (item.qty || 0) * (item.unitPrice || 0);
    subtotal += lineTotal;

    if (i % 2 === 0) {
      doc.setFillColor(245, 245, 250);
      doc.rect(margin, y - 4, contentWidth, 7, "F");
    }

    doc.setTextColor(...dark);
    doc.text(item.name || "—", colItem, y);
    doc.text(String(item.qty || 0), colQty, y);
    doc.text(`$${(item.unitPrice || 0).toFixed(2)}`, colPrice, y);
    doc.text(`$${lineTotal.toFixed(2)}`, colTotal, y, { align: "right" });
    y += 7;

    if (y > 250) { doc.addPage(); y = margin; }
  });

  y += 3;
  doc.setDrawColor(...lineGray);
  doc.line(colPrice - 5, y, pageWidth - margin, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...gray);
  doc.text("Subtotal", colPrice - 5, y);
  doc.text(`$${subtotal.toFixed(2)}`, colTotal, y, { align: "right" });
  y += 6;

  const tax = subtotal * 0.06625;
  doc.text("Tax (6.625%)", colPrice - 5, y);
  doc.text(`$${tax.toFixed(2)}`, colTotal, y, { align: "right" });
  y += 6;

  doc.setDrawColor(...navy);
  doc.setLineWidth(0.5);
  doc.line(colPrice - 5, y, pageWidth - margin, y);
  y += 7;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...navy);
  doc.text("TOTAL DUE", colPrice - 5, y);
  doc.text(`$${(subtotal + tax).toFixed(2)}`, colTotal, y, { align: "right" });
  y += 12;

  if (order.notes) {
    doc.setDrawColor(...lineGray);
    doc.line(margin, y, pageWidth - margin, y);
    y += 7;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...gold);
    doc.text("SPECIAL INSTRUCTIONS", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...dark);
    doc.text(doc.splitTextToSize(order.notes, contentWidth), margin, y);
  }

  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.setFillColor(...gold);
  doc.rect(0, doc.internal.pageSize.getHeight() - 4, pageWidth, 4, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...gray);
  doc.text("DR Catering — Thank you for your business!", pageWidth / 2, footerY, { align: "center" });

  return doc.output("datauristring");
}