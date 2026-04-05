import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

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

export async function POST(request) {
  const order = await request.json();

  const menuItems = (order.order_details || '').split('\n')
    .filter(item => item.trim() && item.trim() !== '•')
    .map(item => `<li style="padding:6px 0;font-size:15px;">${item.replace(/^•\s*/, '').trim()}</li>`)
    .join('');

  const { error } = await resend.emails.send({
    from: 'DR Catering <onboarding@resend.dev>',
    to: 'psmit4227@gmail.com',
    subject: `New Order — ${order.client_name} (${order.order_number})`,
    html: `
<!DOCTYPE html>
<html>
<head>
<style>
  @media print { body { margin: 0; } .no-print { display: none; } }
  body { font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 24px; color: #111; }
  h1 { text-align: center; font-size: 24px; margin: 0; }
  .sub { text-align: center; font-size: 13px; color: #888; margin: 4px 0 2px; }
  .order-num { text-align: center; font-size: 12px; color: #aaa; margin-bottom: 16px; }
  .divider { border: none; border-top: 1px solid #ccc; margin: 16px 0; }
  .two-col { display: table; width: 100%; margin-bottom: 8px; }
  .col { display: table-cell; width: 50%; vertical-align: top; padding-right: 12px; }
  .field-label { font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; color: #888; margin-bottom: 3px; }
  .field-value { font-size: 14px; margin-bottom: 14px; }
  .menu-title { text-align: center; font-size: 15px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.08em; margin: 16px 0 8px; }
  ul { margin: 0; padding-left: 20px; }
  .default-section { margin-top: 16px; }
  .default-label { font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; color: #888; }
  .footer { text-align: center; font-size: 10px; color: #aaa; margin-top: 20px; font-style: italic; }
</style>
</head>
<body>
  <h1>Event Menu</h1>
  <p class="sub">Event Menu for ${order.client_name} – ${order.order_number}</p>
  <p class="sub">Event Held On: ${formatDate(order.delivery_date)}</p>
  <hr class="divider"/>

  <div class="two-col">
    <div class="col">
      <div class="field-label">Point of Contact</div>
      <div class="field-value">${order.on_site_contact || '—'}</div>
      <div class="field-label">Phone Number</div>
      <div class="field-value">${order.client_phone || '—'}</div>
      <div class="field-label">Delivery Address</div>
      <div class="field-value">${order.delivery_address || '—'}</div>
    </div>
    <div class="col">
      <div class="field-label">Number of Guests</div>
      <div class="field-value">${order.guest_count || '—'}</div>
      <div class="field-label">Delivery Time</div>
      <div class="field-value">${formatTime(order.delivery_time)}</div>
    </div>
  </div>

  <hr class="divider"/>
  <div class="menu-title">Menu</div>
  <ul>${menuItems}</ul>

  ${order.notes ? `<hr class="divider"/><div class="field-label">Notes</div><div class="field-value">${order.notes}</div>` : ''}

  <hr class="divider"/>
  <div class="default-section">
    <div class="default-label">Default</div>
    <ul>
      <li style="padding:6px 0;font-size:15px;">Beverages</li>
      <li style="padding:6px 0;font-size:15px;">Paper Boxes</li>
    </ul>
  </div>

  <hr class="divider"/>
  <p class="footer">DR Catering — ${order.order_number} — Generated ${new Date().toLocaleDateString('en-US')}</p>
</body>
</html>
    `
  });

  if (error) return Response.json({ error }, { status: 500 });
  return Response.json({ success: true });
}