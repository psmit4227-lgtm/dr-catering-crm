import { Resend } from "resend";
import { NextResponse } from "next/server";

const resendApiKey = process.env.RESEND_API_KEY;

export async function POST(request) {
  if (!resendApiKey) {
    return NextResponse.json({ error: "Missing API key." }, { status: 500 });
  }

  const resend = new Resend(resendApiKey);

  try {
    const body = await request.json();
    const {
      to = "psmit4227@gmail.com",
      orderNumber = "Order",
      customerName = "Customer",
      pdfBase64,
    } = body;

    if (!pdfBase64) {
      return NextResponse.json({ error: "No PDF provided." }, { status: 400 });
    }

    const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, "");
    const pdfBuffer = Buffer.from(cleanBase64, "base64");

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 30px 20px;">
        <div style="border-bottom: 3px solid #1e3a5f; padding-bottom: 15px; margin-bottom: 20px;">
          <h1 style="color: #1e3a5f; font-size: 20px; margin: 0;">DR Catering</h1>
        </div>
        <p style="color: #333; font-size: 15px;">Hi ${customerName},</p>
        <p style="color: #333; font-size: 15px;">
          Your order <strong>${orderNumber}</strong> is confirmed.
          Please find the full order details in the attached PDF.
        </p>
        <div style="background: #f0f4f8; border-left: 4px solid #c8a03c; padding: 12px 16px; margin: 20px 0;">
          <p style="margin: 0; color: #555; font-size: 13px;">
            📎 <strong>Open the attached PDF</strong> to view or print your complete order.
          </p>
        </div>
        <p style="color: #333; font-size: 15px;">Thank you,<br/><strong>DR Catering Team</strong></p>
      </div>
    `;

    const { data, error } = await resend.emails.send({
      from: "DR Catering <onboarding@resend.dev>",
      to: [to],
      subject: `Order Confirmed — ${orderNumber}`,
      html: emailHtml,
      attachments: [
        {
          filename: `${orderNumber.replace(/\s+/g, "-")}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    if (error) {
      return NextResponse.json({ error: "Email failed", details: error }, { status: 400 });
    }

    return NextResponse.json({ success: true, emailId: data?.id });

  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}