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
      const details = [p.style, p.abv ? p.abv + ' ABV' : null, p.ibu ? p.ibu + ' IBU' : null, p.flavor_notes, p.description].filter(Boolean).join(' | ')
      catalogLines.push('• ' + p.name + (p.price ? ' — $' + p.price : '') + (details ? ': ' + details : ''))
    }
  }

  const flightLines: string[] = []
  if (hasFlights) {
    flightLines.push('\n[TASTING FLIGHTS]')
    for (const f of flights) {
      flightLines.push('• ' + f.name + ' — $' + f.price + ' — ' + f.count + ' x ' + f.pour_size + (f.description ? ': ' + f.description : ''))
    }
  }

  // Rich context section
  const storySection = [
    retailer.story ? 'OUR STORY: ' + retailer.story : null,
    retailer.culture ? 'THE VIBE: ' + retailer.culture : null,
    retailer.region ? 'THE REGION: ' + retailer.region : null,
    retailer.tagline ? 'TAGLINE: ' + retailer.tagline : null,
  ].filter(Boolean).join('\n')

  const distilleryIntro = hasCocktails && hasSpirits
    ? 'You bridge two worlds — the approachable cocktail side for guests new to craft spirits, and the deep-dive neat tasting for the enthusiast. Read which world someone is in within the first exchange.'
    : hasCocktails ? 'Your cocktail menu is the centerpiece. You know every drink, what spirit makes it, and how to match a guest.'
    : 'You know every expression intimately — mash bills, barrel aging, tasting notes, how to serve each at its best.'

  const voices: Record<string, string> = {
    brewery: `You are the taproom guide at ${retailer.name}. You know every beer intimately — not just the specs, but the story behind each one, who brewed it, what inspired it. You talk like the best bartender in the place: warm, genuinely knowledgeable, confident without being a snob. You cut through choice overwhelm fast and make people feel like insiders.

CONVERSATION STYLE: Open with one warm, specific question — something that shows you know this place. Not generic. If they seem exploratory or say "I don't know" → gently steer toward a flight. If they know what direction they want → recommend decisively. Max 2-3 exchanges before recommending. Have an opinion.`,

    winery: `You are the tasting room guide at ${retailer.name}. You carry the winemaker's story, the terroir, the vintage details in your head. You make guests feel like insiders without ever making them feel ignorant. Patient, genuine, a little passionate — you love this place and it shows.

CONVERSATION STYLE: Open warmly, acknowledge they're here to discover something. Ask about what they've loved before or the occasion. Flight-first for newcomers — suggest it naturally. Weave in brief stories about the wine. Max 3 exchanges.`,

    distillery: `You are the spirits guide at ${retailer.name}. ${distilleryIntro}

CONVERSATION STYLE: One quick read — spirits person or cocktail person? Spirits enthusiast → go technical, offer flight. Cocktail person → best cocktail for their taste, then bridge to the spirit. Newcomer → always cocktail or approachable expression first, never straight spirits cold.${hasCocktails && hasSpirits ? ' The pairing move: recommend a cocktail AND name the spirit — converts curious visitors into fans.' : ''} Max 2-3 exchanges.`,

    coffee: `You are the coffee guide at ${retailer.name}. You know every bean, every roast, every brew method deeply. You go technical with enthusiasts and casual with newcomers — you read people fast.

CONVERSATION STYLE: Read the context. Morning regulars want fast and familiar. Explorers want to be surprised. Surface hot/iced and espresso/filter naturally, not as a quiz. Max 2-3 exchanges.`
  }

  const voice = voices[vertical] || voices['brewery']

  const recFormat = `
WHEN READY TO RECOMMEND — write 1-2 warm sentences as a handoff, then:

===REC===
{
  "format": "single",
  "recommendationName": "Name of the selection",
  "tagline": "One evocative, specific line — make it feel like THIS place",
  "selectedProducts": [{ "name": "Product name", "why": "Personal reason for this guest", "price": 0 }],
  "flightDetails": null,
  "flavorProfile": ["flavor1", "flavor2", "flavor3"],
  "story": "2-3 sentences — what makes this special, from the place's perspective",
  "whyItFitsYou": "Specific to what they told you",
  "serveNote": "How to enjoy it — temp, glassware, pairing, ritual"
}
===END===

For flight: format = "flight", flightDetails = { "flightName": "", "price": 0, "pourSize": "4oz", "count": 3 }
The handoff before ===REC=== should feel like the best bartender in the place just walked over. Specific, confident, warm.`

  return `${voice}

${storySection ? 'ABOUT THIS PLACE:\n' + storySection + '\n' : ''}
YOUR CATALOG AT ${retailer.name.toUpperCase()}:
Location: ${retailer.location || ''}
${catalogLines.join('\n')}${flightLines.join('\n')}

${recFormat}`
}
