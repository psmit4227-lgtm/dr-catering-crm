import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
  try {
    const { pdfBase64, ...order } = await request.json();
    const { error } = await resend.emails.send({
      from: 'DR Catering <onboarding@resend.dev>',
      to: 'psmit4227@gmail.com',
      subject: `New Order — ${order.client_name} (${order.order_number})`,
      html: `
        <h2 style="font-family:Arial">New Order — ${order.order_number}</h2>
        <table style="font-family:Arial;font-size:14px;width:100%;border-collapse:collapse">
          <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold">Client</td><td style="padding:8px;border:1px solid #eee">${order.client_name}</td></tr>
          <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold">Phone</td><td style="padding:8px;border:1px solid #eee">${order.client_phone}</td></tr>
          <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold">Address</td><td style="padding:8px;border:1px solid #eee">${order.delivery_address}</td></tr>
          <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold">Date</td><td style="padding:8px;border:1px solid #eee">${order.delivery_date}</td></tr>
          <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold">Time</td><td style="padding:8px;border:1px solid #eee">${order.delivery_time}</td></tr>
          <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold">Guests</td><td style="padding:8px;border:1px solid #eee">${order.guest_count}</td></tr>
          <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold">Menu</td><td style="padding:8px;border:1px solid #eee">${(order.order_details || '').replace(/\n/g, '<br/>')}</td></tr>
          ${order.notes ? `<tr><td style="padding:8px;border:1px solid #eee;font-weight:bold">Notes</td><td style="padding:8px;border:1px solid #eee">${order.notes}</td></tr>` : ''}
        </table>
        <p style="font-family:Arial;font-size:12px;color:#888;margin-top:16px">PDF attached.</p>
      `,
      ...(pdfBase64 && {
        attachments: [{ filename: `DR-Catering-${order.order_number}.pdf`, content: Buffer.from(pdfBase64, 'base64') }],
      }),
    });
    if (error) return Response.json({ error }, { status: 500 });
    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}