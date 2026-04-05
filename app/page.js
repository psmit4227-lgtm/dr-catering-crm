import jsPDF from 'jspdf';

export function generateOrderPDF(order) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageW = 612;
  const margin = 48;
  let y = 48;

  const line = (yPos) => {
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(margin, yPos, pageW - margin, yPos);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '—';
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${m} ${ampm}`;
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('Event Menu', pageW / 2, y, { align: 'center' });
  y += 28;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.text(`Event Menu for ${order.client_name || ''} – ${order.order_number || ''}`, pageW / 2, y, { align: 'center' });
  y += 20;
  doc.text(`Event Held On: ${formatDate(order.delivery_date)}`, pageW / 2, y, { align: 'center' });
  y += 28;

  line(y); y += 20;

  const leftX = margin;
  const rightX = pageW / 2 + 20;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.text('POINT OF CONTACT', leftX, y);
  doc.text('NUMBER OF GUESTS', rightX, y); y += 14;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
  doc.text(order.on_site_contact || '—', leftX, y);
  doc.text(order.guest_count || '—', rightX, y); y += 18;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.text('PHONE NUMBER', leftX, y);
  doc.text('DELIVERY TIME', rightX, y); y += 14;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
  doc.text(order.client_phone || '—', leftX, y);
  doc.text(formatTime(order.delivery_time), rightX, y); y += 18;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.text('DELIVERY ADDRESS', leftX, y); y += 14;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
  const addrLines = doc.splitTextToSize(order.delivery_address || '—', (pageW / 2) - 20);
  doc.text(addrLines, leftX, y);
  y += addrLines.length * 14 + 10;

  line(y); y += 24;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  doc.text('MENU', pageW / 2, y, { align: 'center' }); y += 20;

  doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
  const menuItems = (order.order_details || '').split('\n').filter(i => i.trim() && i.trim() !== '•');
  menuItems.forEach(item => {
    const clean = item.replace(/^•\s*/, '').trim();
    if (clean) {
      const lines = doc.splitTextToSize(`• ${clean}`, pageW - margin * 2 - 10);
      doc.text(lines, margin + 10, y);
      y += lines.length * 16;
    }
  });

  y += 16; line(y); y += 20;

  if (order.notes && order.notes.trim()) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.text('NOTES', leftX, y); y += 14;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
    const noteLines = doc.splitTextToSize(order.notes, pageW - margin * 2);
    doc.text(noteLines, leftX, y);
    y += noteLines.length * 14 + 16;
    line(y); y += 20;
  }

  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.text('DEFAULT', leftX, y); y += 14;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
  doc.text('• Beverages', leftX + 10, y); y += 16;
  doc.text('• Paper Boxes', leftX + 10, y); y += 24;

  line(y); y += 16;

  doc.setFont('helvetica', 'italic'); doc.setFontSize(9);
  doc.setTextColor(150);
  doc.text(`DR Catering — ${order.order_number || ''} — Generated ${new Date().toLocaleDateString('en-US')}`, pageW / 2, y, { align: 'center' });

  return doc.output('datauristring').split(',')[1];
}

export function downloadOrderPDF(order) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageW = 612;
  const margin = 48;
  let y = 48;

  const line = (yPos) => {
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(margin, yPos, pageW - margin, yPos);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '—';
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${m} ${ampm}`;
  };

  doc.setFont('helvetica', 'bold'); doc.setFontSize(22);
  doc.text('Event Menu', pageW / 2, y, { align: 'center' }); y += 28;

  doc.setFont('helvetica', 'normal'); doc.setFontSize(12);
  doc.text(`Event Menu for ${order.client_name || ''} – ${order.order_number || ''}`, pageW / 2, y, { align: 'center' }); y += 20;
  doc.text(`Event Held On: ${formatDate(order.delivery_date)}`, pageW / 2, y, { align: 'center' }); y += 28;

  line(y); y += 20;

  const leftX = margin;
  const rightX = pageW / 2 + 20;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.text('POINT OF CONTACT', leftX, y);
  doc.text('NUMBER OF GUESTS', rightX, y); y += 14;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
  doc.text(order.on_site_contact || '—', leftX, y);
  doc.text(order.guest_count || '—', rightX, y); y += 18;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.text('PHONE NUMBER', leftX, y);
  doc.text('DELIVERY TIME', rightX, y); y += 14;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
  doc.text(order.client_phone || '—', leftX, y);
  doc.text(formatTime(order.delivery_time), rightX, y); y += 18;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.text('DELIVERY ADDRESS', leftX, y); y += 14;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
  const addrLines = doc.splitTextToSize(order.delivery_address || '—', (pageW / 2) - 20);
  doc.text(addrLines, leftX, y);
  y += addrLines.length * 14 + 10;

  line(y); y += 24;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  doc.text('MENU', pageW / 2, y, { align: 'center' }); y += 20;

  doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
  const menuItems = (order.order_details || '').split('\n').filter(i => i.trim() && i.trim() !== '•');
  menuItems.forEach(item => {
    const clean = item.replace(/^•\s*/, '').trim();
    if (clean) {
      const lines = doc.splitTextToSize(`• ${clean}`, pageW - margin * 2 - 10);
      doc.text(lines, margin + 10, y);
      y += lines.length * 16;
    }
  });

  y += 16; line(y); y += 20;

  if (order.notes && order.notes.trim()) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.text('NOTES', leftX, y); y += 14;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
    const noteLines = doc.splitTextToSize(order.notes, pageW - margin * 2);
    doc.text(noteLines, leftX, y);
    y += noteLines.length * 14 + 16;
    line(y); y += 20;
  }

  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.text('DEFAULT', leftX, y); y += 14;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
  doc.text('• Beverages', leftX + 10, y); y += 16;
  doc.text('• Paper Boxes', leftX + 10, y); y += 24;

  line(y); y += 16;

  doc.setFont('helvetica', 'italic'); doc.setFontSize(9);
  doc.setTextColor(150);
  doc.text(`DR Catering — ${order.order_number || ''} — Generated ${new Date().toLocaleDateString('en-US')}`, pageW / 2, y, { align: 'center' });

  doc.save(`DR-Catering-${order.order_number || 'Order'}.pdf`);
}