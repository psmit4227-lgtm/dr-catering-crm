import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const order = await request.json();
    const { error } = await supabase.from('orders').insert([order]);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ success: true });
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

    // Strip fields that should never be overwritten on edit.
    delete rest.created_at;

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
