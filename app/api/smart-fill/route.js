export async function POST(req) {
  try {
    const { description } = await req.json();
    if (!description?.trim()) {
      return Response.json({ error: 'No description provided' }, { status: 400 });
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1024,
        system:
          "You are a catering order assistant. Extract order details from the sales rep's description and return ONLY a valid JSON object with no markdown, no backticks, no extra text.",
        messages: [
          {
            role: 'user',
            content: `Extract the following fields from this catering inquiry and return a single JSON object. Use empty string "" for missing text fields, 0 for missing numeric fields, and [] for missing arrays.

Fields:
- clientName (string)
- clientPhone (digits and hyphens only, e.g. 973-555-1234)
- clientEmail (string)
- onsiteContactName (string)
- onsiteContactPhone (digits and hyphens only)
- eventType (string, e.g. "Corporate lunch")
- deliveryAddress (full address string)
- deliveryDate (YYYY-MM-DD format, leave empty if unclear)
- arrivalTime: the time we ARRIVE at the venue — indicated by words like "arriving", "arrive", "there at", "delivery at", "set up by". Format as h:MM AM/PM, e.g. "11:00 AM". Leave empty if unclear.
- pickupTime: the time we LEAVE the venue — indicated by words like "out by", "pickup at", "leaving at", "done by", "wrap up by". Format as h:MM AM/PM, e.g. "2:00 PM". Leave empty if unclear.
- guestCount (number only, e.g. 80)
- menuItems (array of strings)

Example: "arriving 11am, out by 2pm" → arrivalTime: "11:00 AM", pickupTime: "2:00 PM"
Example: "set up by 12:30, out by 3" → arrivalTime: "12:30 PM", pickupTime: "3:00 PM"

Inquiry: ${description}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return Response.json({ error: `Anthropic API error: ${res.status}` }, { status: 502 });
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || '';

    let result;
    try {
      result = JSON.parse(text);
    } catch {
      // Try to extract JSON from the response in case there's extra whitespace
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('No JSON found in response');
      result = JSON.parse(match[0]);
    }

    return Response.json({ result });
  } catch (err) {
    return Response.json({ error: err.message || 'Failed to process' }, { status: 500 });
  }
}
