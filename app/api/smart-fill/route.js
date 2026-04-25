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
- arrivalTime: the time we ARRIVE at the venue (time there). Triggered by:
    • "X there" or "there at X" — e.g. "2pm there", "there at 11am"
    • "arriving X", "arrive at X", "delivery at X", "set up by X"
  Always return in 12-hour format with AM/PM, e.g. "2:00 PM". Leave empty string if not mentioned.
- pickupTime: the time we LEAVE / must be OUT of the venue (time out). Triggered by:
    • "X out" or "out at X" or "out by X" — e.g. "11am out", "out by 2pm"
    • "leaving at X", "done by X", "wrap up by X", "pickup at X"
  Always return in 12-hour format with AM/PM, e.g. "11:00 AM". Leave empty string if not mentioned.
  IMPORTANT: "out" always means pickupTime (leaving), "there" always means arrivalTime (arriving). Never swap them.
- guestCount (integer): the TOTAL number of guests. Always do the math and return ONE final number:
  • "plus", "and", "+", or listing additional groups = ADDITION — sum all numbers.
    "50 plus 3" → 53, "40 plus 6 kids" → 46, "50 people, 5 vegan, 2 nut allergy" → 57
  • "including", "of which", or dietary sub-groups (vegetarian, vegan, gluten free, etc.) = SUBSET — total stays the first number.
    "10 guests including 3 vegetarian" → 10, "50 with 3 gluten free" → 50
  Return ONE integer. Use 0 if not mentioned.
  Put any dietary/group breakdowns in kitchenNotes instead.
  Examples:
  - "80 guests" → 80
  - "10 guests including 3 vegetarian and 3 gluten free" → 10
  - "10 plus 3 vegetarian plus 3 gluten free" → 16
  - "50 people, 5 vegan, 2 nut allergy" → 57
  - "40 guests plus 6 kids" → 46
- kitchenNotes (string): any allergy info, dietary restrictions, substitutions, or prep instructions. ALWAYS include guest dietary sub-groups here (e.g. "3 vegetarian, 3 gluten free" from a guest count like "50 including 3 vegetarian, 3 gluten free"), so the kitchen has a clear note even though guestCount is now just a number. Leave empty string if none.
- driverNotes (string): any delivery logistics mentioned — e.g. gate codes, parking instructions, floor/elevator info, "call before arriving". Leave empty string if none.
- menuItems (array of strings): each item is a single string. If the speaker mentions a quantity, customization, modifier, or note immediately after an item, append it inline with a dash — do NOT put it in a separate field.
  Examples:
  - "10 cheeseburgers, add jalapeños" → "10 cheeseburgers - add jalapeños"
  - "20 caesar salads, no croutons" → "20 caesar salads - no croutons"
  - "50 chicken marsala, extra sauce on the side" → "50 chicken marsala - extra sauce on the side"
  - "30 veggie wraps" → "30 veggie wraps"

Time formatting rules:
- Always include AM or PM explicitly — never return a bare number like "3" or "11"
- Always include minutes — e.g. "11:00 AM" not "11 AM"
- Use 12-hour clock — e.g. "2:00 PM" not "14:00"

Examples:
- "arriving 11am, out by 2pm"  → arrivalTime: "11:00 AM", pickupTime: "2:00 PM"
- "there at 12:30, done by 3pm" → arrivalTime: "12:30 PM", pickupTime: "3:00 PM"
- "delivery at noon, out by 2"  → arrivalTime: "12:00 PM", pickupTime: "2:00 PM"
- "11am out, 2pm there"         → arrivalTime: "2:00 PM",  pickupTime: "11:00 AM"
- "2pm there, 5pm out"          → arrivalTime: "2:00 PM",  pickupTime: "5:00 PM"
- "11:00 am out"                → arrivalTime: "",          pickupTime: "11:00 AM"
- "2:00 pm there"               → arrivalTime: "2:00 PM",  pickupTime: ""

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
