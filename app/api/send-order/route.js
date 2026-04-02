import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
  const order = await request.json();

  const { error } = await resend.emails.send({
    from: 'DR Catering <onboarding@resend.dev>',
    to: 'psmit4227@gmail.com',
    subject: `New Order — ${order.client_name}`,
    html: `
      <h2>New Order Received</h2>
      <table style="font-family:Arial;font-size:14px;width:100%;border-collapse:collapse">
        <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold">Client Name</td><td style="padding:8px;border:1px solid #eee">${order.client_name}</td></tr>
        <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold">Phone</td><td style="padding:8px;border:1px solid #eee">${order.client_phone}</td></tr>
        <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold">Delivery Address</td><td style="padding:8px;border:1px solid #eee">${order.delivery_address}</td></tr>
        <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold">Delivery Date</td><td style="padding:8px;border:1px solid #eee">${order.delivery_date}</td></tr>
        <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold">Delivery Time</td><td style="padding:8px;border:1px solid #eee">${order.delivery_time}</td></tr>
        <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold">Guest Count</td><td style="padding:8px;border:1px solid #eee">${order.guest_count}</td></tr>
        <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold">Order Details</td><td style="padding:8px;border:1px solid #eee">${order.order_details}</td></tr>
      </table>
      <p style="font-family:Arial;font-size:12px;color:#888;margin-top:24px">DR Catering CRM — Auto-generated order</p>
    `
  });

  if (error) return Response.json({ error }, { status: 500 });
  return Response.json({ success: true });
}