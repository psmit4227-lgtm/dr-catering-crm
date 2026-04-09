import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
  try {
    const { pdfBase64, ...order } = await request.json();

    const attachments = [];
    if (pdfBase64) {
      attachments.push({
        filename: `DR-Catering-${order.order_number}.pdf`,
        content: Buffer.from(pdfBase64, 'base64'),
      });
    }

    const { error } = await resend.emails.send({
      from: 'DR Catering <onboarding@resend.dev>',
      to: 'psmit4227@gmail.com',
      subject: `New Order — ${order.client_name} (${order.order_number})`,
      html: `
        <h2 style="font-family:Arial">New Order — ${order.order_number}</h2>
        <p style="font-family:Arial;font-size:14px">Order for ${order.client_name} — see attached PDF for details.</p>
      `,
      ...(attachments.length > 0 && { attachments }),
    });

    if (error) return Response.json({ error }, { status: 500 });
    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
