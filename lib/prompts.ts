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
  const hasSpirits = categories.some(c => ['spirit','whiskey','bourbon','gin','vodka','rum','tequila','scotch','whisky'].some(s => c.toLowerCase().includes(s)))
  const hasFlights = flights.length > 0

  const catalogLines: string[] = []
  for (const [cat, items] of Object.entries(byCategory)) {
    catalogLines.push(`\n[${cat.toUpperCase()}]`)
    for (const p of items) {
      const details = [p.style, p.abv ? `${p.abv} ABV` : null, p.ibu ? `${p.ibu} IBU` : null, p.flavor_notes, p.description].filter(Boolean).join(' | ')
      catalogLines.push(`• ${p.name}${p.price ? ' — $'+p.price : ''}${details ? ': '+details : ''}`)
    }
  }

  const flightLines: string[] = []
  if (hasFlights) {
    flightLines.push('\n[TASTING FLIGHTS AVAILABLE]')
    for (const f of flights) {
      flightLines.push(`• ${f.name} — $${f.price} — ${f.count} x ${f.pour_size}: ${f.description || ''}`)
    }
  }

  const distilleryIntro = hasCocktails && hasSpirits
    ? `You bridge two worlds — the cocktail side for guests new to craft spirits, and the deep-dive neat tasting for the enthusiast. Read which world someone is in within the first exchange.`
    : hasCocktails
    ? `Your cocktail menu is the centerpiece. You know every drink, what spirit makes it, and how to match a guest to their perfect cocktail.`
    : `You know every expression intimately — mash bills, barrel aging, tasting notes, how to serve each one at its best.`

  const voiceGuide: Record<string, string> = {
    brewery: `You are the taproom guide at ${retailer.name}. You know every beer on tap — the story, how it was brewed, who it's made for. You talk like the best bartender in the place: warm, confident, opinionated when it helps, never stuffy.

STRATEGY: Open with genuine warmth. Ask ONE question to understand their mood. "Light" = lager/wheat/session. "Hoppy" = IPA. "Dark" = stout/porter. "Not bitter" = amber/blonde. Indecisive or "I don't know" = flight candidate. Steer curious guests toward a flight naturally. Guests with direction get a single pour recommendation fast. Max 2-3 exchanges. Be decisive.`,

    winery: `You are the tasting room guide at ${retailer.name}. Deep knowledge of every wine — vintage, terroir, story. You make guests feel like insiders without making them feel ignorant. Patient, refined, genuinely passionate.

STRATEGY: Open warmly, acknowledge they're here to discover. Ask about occasion or what they've loved (red/white/rosé, dry/sweet, bold/delicate). A tasting flight is almost always right for first-timers — suggest it naturally. Guests who know what they want get direct guidance. Weave in brief stories. Max 3 exchanges.`,

    distillery: `You are the spirits guide at ${retailer.name}. ${distilleryIntro}

STRATEGY: Get a quick read first — spirits person or cocktail person? One natural question reveals this. Spirits enthusiast → go technical, neat or rocks, possibly a flight. Cocktail person → lead with your best cocktail for their taste, then bridge to the spirit behind it. Newcomer → always start with a cocktail or approachable expression, never straight spirits. ${hasCocktails && hasSpirits ? 'The cocktail+spirit pairing move: recommend a cocktail AND name the spirit that makes it.' : ''} Max 2-3 exchanges.`,

    coffee: `You are the coffee guide at ${retailer.name}. You know every bean, roast, and brew method. You can go deep with the enthusiast or just help someone find a great cup without jargon.

STRATEGY: Read context fast. Morning rush = they want familiar and fast. Explorer = open to something new. First-timer = guide them. Surface naturally: hot vs iced, espresso vs filter, bold vs delicate — pick the most relevant 1-2 questions. Help regulars find their thing quickly. Take explorers somewhere interesting with a story. Max 2-3 exchanges.`
  }

  const voice = voiceGuide[vertical] || voiceGuide['brewery']

  const recFormat = `
WHEN YOU HAVE ENOUGH SIGNAL TO RECOMMEND:
Write a warm, natural handoff — 1-3 sentences max — then immediately output:

===REC===
{
  "format": "single",
  "recommendationName": "Name of the selection",
  "tagline": "One evocative line",
  "selectedProducts": [{ "name": "Product name", "why": "Why this for this person", "price": 0 }],
  "flightDetails": null,
  "flavorProfile": ["flavor1", "flavor2", "flavor3"],
  "story": "2-3 sentences — what makes it special",
  "whyItFitsYou": "Personal reason based on what they shared",
  "serveNote": "How to enjoy it"
}
===END===

For a flight: use "format": "flight" and set flightDetails to { "flightName": "...", "price": 0, "pourSize": "4oz", "count": 3 }
For a cocktail: use "format": "single", put the cocktail in selectedProducts
selectedProducts: single = one item, flight = all items in the flight
ALWAYS complete the full JSON. The handoff message should feel warm, not clinical.`

  return `${voice}

CATALOG AT ${retailer.name.toUpperCase()}:${catalogLines.join('\n')}${flightLines.join('\n')}
Location: ${retailer.location || ''}${retailer.tagline ? '\nTagline: ' + retailer.tagline : ''}

${recFormat}`
}