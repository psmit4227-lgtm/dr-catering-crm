import { Resend } from 'resend';
import PDFDocument from 'pdfkit';

const resend = new Resend(process.env.RESEND_API_KEY);

function generatePDFBuffer(order) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
    const buffers = [];
    doc.on('data', chunk => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));

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

    const pageW = 612;
    const margin = 50;

    // TITLE
    doc.fontSize(22).font('Helvetica-Bold').text('Event Menu', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(12).font('Helvetica').text(`Event Menu for ${order.client_name || ''} – ${order.order_number || ''}`, { align: 'center' });
    doc.moveDown(0.3);
    doc.text(`Event Held On: ${formatDate(order.delivery_date)}`, { align: 'center' });
    doc.moveDown(0.5);
    doc.moveTo(margin, doc.y).lineTo(pageW - margin, doc.y).stroke();
    doc.moveDown(0.5);

    // LEFT RIGHT INFO
    const leftX = margin;
    const rightX = 320;
    const startY = doc.y;

    doc.fontSize(9).font('Helvetica-Bold').text('POINT OF CONTACT', leftX, startY);
    doc.fontSize(11).font('Helvetica').text(order.on_site_contact || '—', leftX, doc.y + 2);
    const afterContact = doc.y + 8;

    doc.fontSize(9).font('Helvetica-Bold').text('PHONE NUMBER', leftX, afterContact);
    doc.fontSize(11).font('Helvetica').text(order.client_phone || '—', leftX, doc.y + 2);
    const afterPhone = doc.y + 8;

    doc.fontSize(9).font('Helvetica-Bold').text('DELIVERY ADDRESS', leftX, afterPhone);
    doc.fontSize(11).font('Helvetica').text(order.delivery_address || '—', leftX, doc.y + 2, { width: 220 });
    const leftEnd = doc.y;

    doc.fontSize(9).font('Helvetica-Bold').text('NUMBER OF GUESTS', rightX, startY);
    doc.fontSize(11).font('Helvetica').text(order.guest_count || '—', rightX, startY + 14);

    doc.fontSize(9).font('Helvetica-Bold').text('DELIVERY TIME', rightX, startY + 46);
    doc.fontSize(11).font('Helvetica').text(formatTime(order.delivery_time), rightX, startY + 60);

    doc.y = Math.max(leftEnd, startY + 90) + 10;
    doc.moveTo(margin, doc.y).lineTo(pageW - margin, doc.y).stroke();
    doc.moveDown(0.8);

    // MENU
    doc.fontSize(13).font('Helvetica-Bold').text('MENU', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica');

    const menuItems = (order.order_details || '').split('\n').filter(item => item.trim() && item.trim() !== '•');
    menuItems.forEach(item => {
      const clean = item.replace(/^•\s*/, '').trim();
      if (clean) {
        doc.text(`• ${clean}`, margin + 10);
        doc.moveDown(0.3);
      }
    });

    doc.moveDown(0.5);
    doc.moveTo(margin, doc.y).lineTo(pageW - margin, doc.y).stroke();
    doc.moveDown(0.5);

    // NOTES
    if (order.notes && order.notes.trim()) {
      doc.fontSize(9).font('Helvetica-Bold').text('NOTES');
      doc.fontSize(11).font('Helvetica').text(order.notes);
      doc.moveDown(0.5);
      doc.moveTo(margin, doc.y).lineTo(pageW - margin, doc.y).stroke();
      doc.moveDown(0.5);
    }

    // DEFAULT
    doc.fontSize(9).font('Helvetica-Bold').text('DEFAULT');
    doc.moveDown(0.2);
    doc.fontSize(11).font('Helvetica');
    doc.text('• Beverages', margin + 10);
    doc.moveDown(0.3);
    doc.text('• Paper Boxes', margin + 10);
    doc.moveDown(0.8);
    doc.moveTo(margin, doc.y).lineTo(pageW - margin, doc.y).stroke();
    doc.moveDown(0.5);

    // FOOTER
    doc.fontSize(9).font('Helvetica-Oblique').fillColor('gray')
      .text(`DR Catering — ${order.order_number || ''} — Generated ${new Date().toLocaleDateString('en-US')}`, { align: 'center' });

    doc.end();
  });
}

export async function POST(request) {
  const order = await request.json();
  const pdfBuffer = await generatePDFBuffer(order);
  const pdfBase64 = pdfBuffer.toString('base64');

  const { error } = await resend.emails.send({
    from: 'DR Catering <onboarding@resend.dev>',
    to: 'psmit4227@gmail.com',
    subject: `New Order — ${order.client_name} (${order.order_number})`,
    html: `
      <h2 style="font-family:Arial">New Order Received</h2>
      <table style="font-family:Arial;font-size:14px;width:100%;border-collapse:collapse">
        <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold">Order Number</td><td style="padding:8px;border:1px solid #eee">${order.order_number}</td></tr>
        <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold">Client</td><td style="padding:8px;border:1px solid #eee">${order.client_name}</td></tr>
        <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold">Phone</td><td style="padding:8px;border:1px solid #eee">${order.client_phone}</td></tr>
        <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold">Address</td><td style="padding:8px;border:1px solid #eee">${order.delivery_address}</td></tr>
        <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold">Date</td><td style="padding:8px;border:1px solid #eee">${order.delivery_date}</td></tr>
        <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold">Time</td><td style="padding:8px;border:1px solid #eee">${order.delivery_time}</td></tr>
        <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold">Guests</td><td style="padding:8px;border:1px solid #eee">${order.guest_count}</td></tr>
        <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold">Menu</td><td style="padding:8px;border:1px solid #eee">${(order.order_details || '').replace(/\n/g, '<br/>')}</td></tr>
        ${order.notes ? `<tr><td style="padding:8px;border:1px solid #eee;font-weight:bold">Notes</td><td style="padding:8px;border:1px solid #eee">${order.notes}</td></tr>` : ''}
      </table>
      <p style="font-family:Arial;font-size:12px;color:#888;margin-top:24px">PDF attached — DR Catering CRM</p>
    `,
    attachments: [
      {
        filename: `DR-Catering-${order.order_number}.pdf`,
        content: pdfBase64,
      }
    ]
  });

  if (error) return Response.json({ error }, { status: 500 });
  return Response.json({ success: true });
}