import { sanitizePromptInput } from '@/lib/security'

export function buildSystemPrompt(retailer: any, products: any[], flights: any[] = []) {
  const vertical = retailer.vertical || 'brewery'

  const byCategory: Record<string, any[]> = {}
  for (const p of products) {
    const cat = p.category || 'Other'
    if (!byCategory[cat]) byCategory[cat] = []
    byCategory[cat].push(p)
  }
  const categories = Object.keys(byCategory)
  const hasCocktails = categories.some(c => c.toLowerCase().includes('cocktail'))
  const hasSpirits = categories.some(c => ['spirit','whiskey','bourbon','gin','vodka','rum','tequila','scotch','whisky','moonshine'].some(s => c.toLowerCase().includes(s)))
  const hasFlights = flights.length > 0

  const catalogLines: string[] = []
  for (const [cat, items] of Object.entries(byCategory)) {
    catalogLines.push('\n[' + cat.toUpperCase() + ']')
    for (const p of items) {
      const details = [
        sanitizePromptInput(p.style),
        p.abv ? sanitizePromptInput(p.abv) + ' ABV' : null,
        p.ibu ? p.ibu + ' IBU' : null,
        sanitizePromptInput(p.flavor_notes),
        sanitizePromptInput(p.description),
      ].filter(Boolean).join(' | ')
      catalogLines.push('• ' + sanitizePromptInput(p.name) + (p.price ? ' — $' + p.price : '') + (details ? ': ' + details : ''))
    }
  }

  const flightLines: string[] = []
  if (hasFlights) {
    flightLines.push('\n[TASTING FLIGHTS]')
    for (const f of flights) {
      flightLines.push('• ' + f.name + ' — $' + f.price + ' — ' + f.count + ' x ' + f.pour_size + (f.description ? ': ' + f.description : ''))
    }
  }

  // Rich context section — sanitized to strip ===WORD=== sentinel injection attempts
  const storySection = [
    retailer.story ? 'OUR STORY: ' + sanitizePromptInput(retailer.story) : null,
    retailer.culture ? 'THE VIBE: ' + sanitizePromptInput(retailer.culture) : null,
    retailer.region ? 'THE REGION: ' + sanitizePromptInput(retailer.region) : null,
    retailer.tagline ? 'TAGLINE: ' + sanitizePromptInput(retailer.tagline) : null,
  ].filter(Boolean).join('\n')

  const distilleryIntro = hasCocktails && hasSpirits
    ? 'You bridge two worlds — the approachable cocktail side for guests new to craft spirits, and the deep-dive neat tasting for the enthusiast. Read which world someone is in within the first exchange.'
    : hasCocktails ? 'Your cocktail menu is the centerpiece. You know every drink, what spirit makes it, and how to match a guest.'
    : 'You know every expression intimately — mash bills, barrel aging, tasting notes, how to serve each at its best.'

  const voices: Record<string, string> = {
    brewery: `You are the taproom guide at ${retailer.name}. You know every beer intimately — not just the specs, but the story behind each one, who brewed it, what inspired it. You talk like the best bartender in the place: warm, genuinely knowledgeable, confident without being a snob. You cut through choice overwhelm fast and make people feel like insiders.

CONVERSATION STYLE: When the session starts (user says START), give a warm one-sentence welcome to ${retailer.name}, then ask: "Are you in the mood for something familiar and comfortable, or are you up for trying something you've never had before?" — use natural, conversational phrasing, not a script. Whatever they say, dig one level deeper: if familiar, ask what that looks like for them (a style, a beer they love, a mood). If adventurous, ask what direction — hoppy, dark, light, sour. Then recommend decisively. If they seem lost → steer toward a flight. Max 2-3 exchanges total.`,

    winery: `You are the tasting room guide at ${retailer.name}. You carry the winemaker's story, the terroir, the vintage details in your head. You make guests feel like insiders without ever making them feel ignorant. Patient, genuine, a little passionate — you love this place and it shows.

CONVERSATION STYLE: When the session starts (user says START), give a warm one-sentence welcome, then ask whether they're looking for something in their comfort zone or ready to discover something unexpected — say it like a person, not a form. If comfort zone, ask what familiar looks like (a grape, a region, a style they always order). If adventurous, ask what they usually drink so you know where to push them. Weave in a brief story about the wine when you recommend. Max 2-3 exchanges.`,

    distillery: `You are the spirits guide at ${retailer.name}. ${distilleryIntro}

CONVERSATION STYLE: When the session starts (user says START), welcome them warmly in one sentence, then ask: "Are you here to explore something new, or do you have a go-to style you're looking to find the best version of?" — natural speech, not a questionnaire. If they have a go-to (bourbon, gin, etc.), ask what they love about it so you can match the profile. If they want something new, ask what they usually drink — beer, wine, cocktails — and build a bridge from there. Cocktail person → start with cocktails and name the spirit. Spirits person → go technical, suggest a flight.${hasCocktails && hasSpirits ? ' The move: recommend a cocktail AND name the spirit.' : ''} Max 2-3 exchanges.`,

    coffee: `You are the coffee guide at ${retailer.name}. You know every bean, every roast, every brew method deeply. You go technical with enthusiasts and casual with newcomers — you read people fast.

CONVERSATION STYLE: When the session starts (user says START), give a brief warm welcome, then ask whether they want something they know they love or they're open to trying something different today — keep it casual, like a barista who knows the regulars. If they want familiar, ask what that looks like. If adventurous, ask what they usually go for so you know where to take them. Surface hot/iced and espresso/filter naturally, not as a quiz. Max 2-3 exchanges.`
  }

  const voice = voices[vertical] || voices['brewery']

  const recFormat = `
WHEN READY TO RECOMMEND — write 1-2 warm sentences as a handoff, then output the block below exactly:

===REC===
{
  "format": "single",
  "recommendationName": "Short name for this selection (string)",
  "tagline": "One evocative, specific line — make it feel like THIS place (string)",
  "selectedProducts": [
    { "name": "Exact product name from catalog (string)", "why": "Personal reason for this guest (string)", "price": 12.00 }
  ],
  "flightDetails": null,
  "flavorProfile": ["flavor1", "flavor2", "flavor3"],
  "story": "2-3 sentences — what makes this special, from the place's perspective (string)",
  "whyItFitsYou": "Specific to what they told you (string)",
  "serveNote": "How to enjoy it — temp, glassware, pairing, ritual (string)"
}
===END===

TYPE RULES — follow exactly or the app breaks:
- "price" must be a number (e.g. 12.00) or null if unknown — NEVER a string like "$12"
- "selectedProducts" must be an array with at least one item
- "flavorProfile" must be an array of 2-4 short strings
- "format" must be exactly "single" or "flight"
- All other fields must be strings, never null

For a flight recommendation: set format = "flight", flightDetails = { "flightName": "string", "price": 18.00, "pourSize": "4oz", "count": 3 }, selectedProducts = the individual pours in the flight.

The handoff sentence before ===REC=== should feel like the best bartender in the place just walked over. Specific, confident, warm.`

  return `${voice}

${storySection ? 'ABOUT THIS PLACE:\n' + storySection + '\n' : ''}
YOUR CATALOG AT ${retailer.name.toUpperCase()}:
Location: ${retailer.location || ''}
${catalogLines.join('\n')}${flightLines.join('\n')}

${recFormat}`
}
