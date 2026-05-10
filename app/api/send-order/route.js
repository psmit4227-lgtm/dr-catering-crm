import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const { pdfUrl, ...order } = await request.json();

    const attachments = [];
    if (pdfUrl) {
      try {
        const pdfResponse = await fetch(pdfUrl);
        if (!pdfResponse.ok) throw new Error(`Fetch failed: ${pdfResponse.status}`);
        const arrayBuffer = await pdfResponse.arrayBuffer();
        attachments.push({
          filename: `DR-Catering-${order.order_number}.pdf`,
          content: Buffer.from(arrayBuffer),
        });
      } catch (fetchErr) {
        console.error('Failed to fetch PDF from storage:', fetchErr);
      }
    }

    const dateLabel = order.delivery_date || order.order_number;

    const { error } = await resend.emails.send({
      from: 'DR Catering <onboarding@resend.dev>',
      to: 'domrizz@gmail.com',
      subject: `[NEW ORDER] ${order.client_name} - ${dateLabel}`,
      html: `
        <h2 style="font-family:Arial">New Order — ${order.order_number}</h2>
        <p style="font-family:Arial;font-size:14px">Order for ${order.client_name} — see attached PDF for details.</p>
      `,
      ...(attachments.length > 0 && { attachments }),
    });

    if (error) return Response.json({ error }, { status: 500 });

    if (pdfUrl) {
      const fileName = pdfUrl.split('/').pop();
      await supabase.storage.from('order-pdfs').remove([fileName]);
    }

    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
