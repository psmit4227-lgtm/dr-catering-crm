import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name');

  try {
    if (name) {
      // Return last order details for a specific client (used when selecting autocomplete suggestion)
      const { data, error } = await supabase
        .from('orders')
        .select('client_phone, client_email, delivery_address, order_details')
        .eq('client_name', name)
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ data });
    }

    // Return all unique clients for the autocomplete list
    const { data, error } = await supabase
      .from('orders')
      .select('client_name, client_phone, client_email, delivery_address, order_details')
      .order('created_at', { ascending: false });
    if (error) return Response.json({ error: error.message }, { status: 500 });

    const unique = [];
    const seen = new Set();
    (data || []).forEach(d => {
      if (d.client_name && !seen.has(d.client_name)) {
        seen.add(d.client_name);
        unique.push(d);
      }
    });
    return Response.json({ data: unique });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
