import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Resolve the next daily_sequence value for a given delivery_date.
// MAX(daily_sequence) + 1, or 1 if no prior orders exist for that date.
// Race window between SELECT and INSERT is acceptable for this kitchen's
// volume — concurrent submissions for the same date are extremely rare.
async function nextDailySequence(deliveryDate) {
  if (!deliveryDate) return null;
  const { data, error } = await supabase
    .from('orders')
    .select('daily_sequence')
    .eq('delivery_date', deliveryDate)
    .not('daily_sequence', 'is', null)
    .order('daily_sequence', { ascending: false })
    .limit(1);
  if (error) {
    // Column may not exist yet (pre-migration). Caller will fall back.
    if (/daily_sequence/i.test(error.message || '')) return null;
    throw error;
  }
  const max = data?.[0]?.daily_sequence ?? 0;
  return max + 1;
}

export async function POST(request) {
  try {
    const order = await request.json();

    // Assign per-date sequence number before insert.
    try {
      const seq = await nextDailySequence(order.delivery_date);
      if (seq != null) order.daily_sequence = seq;
    } catch (seqErr) {
      // Non-fatal — fall through and let the insert proceed without it.
      console.error('daily_sequence lookup failed:', seqErr);
    }

    let { error } = await supabase.from('orders').insert([order]);

    // If the DB hasn't been migrated yet, drop the column and retry so the
    // app still saves (just without a sequence number).
    if (error && /daily_sequence/i.test(error.message || '')) {
      const fallback = { ...order };
      delete fallback.daily_sequence;
      const retry = await supabase.from('orders').insert([fallback]);
      error = retry.error;
      // Strip from the response too so the client doesn't think it was saved.
      delete order.daily_sequence;
    }

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({
      success: true,
      daily_sequence: order.daily_sequence ?? null,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// Edit an existing order. The id field selects the row; everything else is the
// new field values. We try with updated_at first; if the column doesn't exist
// in this database we retry without it.
export async function PATCH(request) {
  try {
    const { id, ...rest } = await request.json();
    if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

    // Strip fields that should never be overwritten on edit. daily_sequence
    // is assigned once at insert and is immutable — even if delivery_date
    // changes, the original number stays so kitchen PDFs / Driver Delivery
    // Schedule references don't drift.
    delete rest.created_at;
    delete rest.daily_sequence;

    const withTs = { ...rest, updated_at: new Date().toISOString() };
    let { error } = await supabase.from('orders').update(withTs).eq('id', id);
    if (error && /updated_at/i.test(error.message || '')) {
      // Older DB without the column — retry without the timestamp.
      const retry = await supabase.from('orders').update(rest).eq('id', id);
      error = retry.error;
    }
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
