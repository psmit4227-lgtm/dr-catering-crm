import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
  try {
    const body = await request.json();
    const { pdfBase64, ...order } = body;

    const { data, error } = await resend.emails.send({
      from: 'DR Catering <onboarding@resend.dev>',
      to: 'psmit4227@gmail.com',
      subject: `New Order — ${order.client_name} (${order.order_number})`,
      html: `<h2>New Order</h2><p><strong>${order.client_name}</strong></p><p>${order.delivery_address}</p><p>${order.delivery_date} at ${order.delivery_time}</p>`,
    });

    if (error) return Response.json({ error }, { status: 500 });
    return Response.json({ success: true, data });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}