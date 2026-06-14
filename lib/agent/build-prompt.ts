/**
 * Assistant Profile-driven system prompt builder.
 *
 * Composes the chat system prompt from:
 *   - the retailer's resolved AssistantProfile (with category-default fallbacks)
 *   - the category template (themes, emphasis, attribute priorities)
 *   - the live catalog, flights, featured items, take-home items
 *
 * Returns the same shape of system prompt the old lib/prompts.ts produced, plus
 * the new adaptive question-count guidance and per-vendor vocabulary rules.
 * The output format (===REC=== / ===CHIPS=== sentinels) is unchanged so the
 * existing chat route parser keeps working.
 */
import type { Retailer, AssistantProfile } from '@/lib/types'
import { sanitizePromptInput } from '@/lib/security'
import { getCategoryTemplate, type CategoryTemplate, type QuestionTheme } from '@/lib/agent/categories'
import { resolveAssistantProfile, getQuestionBounds } from '@/lib/agent/profile'

export function buildAssistantPrompt(retailer: Retailer | any, products: any[], flights: any[] = []): string {
  const profile = resolveAssistantProfile(retailer)
  const category = getCategoryTemplate(retailer.vertical)
  const { min, max } = getQuestionBounds(retailer)

  // ── Catalog formatting (unchanged from prior implementation) ────────────────
  const byCategory: Record<string, any[]> = {}
  for (const p of products) {
    const cat = p.category || 'Other'
    if (!byCategory[cat]) byCategory[cat] = []
    byCategory[cat].push(p)
  }
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
  if (flights.length > 0) {
    flightLines.push('\n[TASTING FLIGHTS]')
    for (const f of flights) {
      flightLines.push('• ' + f.name + ' — $' + f.price + ' — ' + f.count + ' x ' + f.pour_size + (f.description ? ': ' + f.description : ''))
    }
  }

  // Featured / take-home (existing fields, still relevant)
  const featuredItems: Array<{ name: string; reason: string }> =
    Array.isArray(retailer.featured_items_json) ? retailer.featured_items_json : []
  const takeHomeItems: Array<{ name: string; description: string; category: string; price: number | null }> =
    Array.isArray(retailer.take_home_json) ? retailer.take_home_json : []
  const featuredSection = featuredItems.length > 0
    ? '\n[FEATURED / SEASONAL RIGHT NOW]\n' + featuredItems.map(f => `• ${f.name} — ${f.reason}`).join('\n')
    : ''
  const takeHomeSection = takeHomeItems.length > 0 && retailer.has_take_home
    ? '\n[AVAILABLE TO TAKE HOME]\n' + takeHomeItems.map(t =>
        `• ${t.name}${t.price ? ` — $${t.price}` : ''}: ${t.description}`
      ).join('\n') + '\n\nWhen it feels natural (after your initial recommendation), ask: "Are you planning to take anything home today? We have a great selection to go."'
    : ''

  // ── Section 1: Identity ────────────────────────────────────────────────────
  const identityBlock = renderIdentity(retailer, profile, category)

  // ── Section 2: Brand context (story / culture / region / tagline) ──────────
  const storyBlock = [
    retailer.story   ? 'OUR STORY: '  + sanitizePromptInput(retailer.story)   : null,
    retailer.culture ? 'THE VIBE: '   + sanitizePromptInput(retailer.culture) : null,
    retailer.region  ? 'THE REGION: ' + sanitizePromptInput(retailer.region)  : null,
    retailer.tagline ? 'TAGLINE: '    + sanitizePromptInput(retailer.tagline) : null,
    profile.key_differentiators.length > 0 ? 'WHAT MAKES US DIFFERENT:\n' + profile.key_differentiators.map(d => `• ${sanitizePromptInput(d)}`).join('\n') : null,
  ].filter(Boolean).join('\n')

  // ── Section 3: Vocabulary rules (only if vendor configured them) ───────────
  const vocabBlock = renderVocab(profile)

  // ── Section 4: Question strategy ────────────────────────────────────────────
  const questionBlock = renderQuestionStrategy(profile, category, min, max)

  // ── Section 5: Confidence rule ──────────────────────────────────────────────
  const confidenceBlock = `CONFIDENCE RULE — read carefully:
After EACH guest answer, ask yourself: do I have enough to recommend a product that genuinely fits this guest?
- If YES → recommend NOW. Do not ask another question just because we're under the max.
- If NO → ask ONE more question, only when the last answer was vague or contradictory.
- Once you've asked ${max} questions, you MUST recommend on the next turn regardless.`

  // ── Section 6: Recommendation rules (vendor-configured if-then) ─────────────
  const ruleBlock = renderRules(profile)

  // ── Section 7: Best-sellers + emphasis ──────────────────────────────────────
  const sellersBlock = profile.best_sellers.length > 0
    ? `BEST-SELLERS — guests at ${retailer.name} consistently love these. Default toward them when the guest is undecided:\n` +
      profile.best_sellers.map(s => `• ${sanitizePromptInput(s)}`).join('\n')
    : ''
  const emphasisBlock = category.recommendation_emphasis.length > 0
    ? `RECOMMENDATION STYLE:\n` + category.recommendation_emphasis.map(e => `• ${e}`).join('\n')
    : ''

  // ── Section 8: One-question-per-turn + chips contract ───────────────────────
  const conversationRules = `CONVERSATION PACING — follow strictly:
- Ask exactly ONE question per message. Never stack two questions, never join choices with "and do you...".
- Keep each message short: at most 1-2 sentences before the question. No long paragraphs.
- Favor simple either/or or short-list questions a guest can answer in a word or two.
- When the session starts (user says START), give a warm one-sentence welcome from ${profile.agent_name}, then ask your first question.

QUICK-REPLY CHIPS — required whenever you ask a question:
Immediately AFTER your message, output 2-4 short tappable answer options (1-4 words each) that DIRECTLY answer the exact question you just asked. They must be possible answers to THAT question — not generic tags. Use this exact format:
===CHIPS===
["first option","second option","third option"]
===END===
Do NOT output a CHIPS block when you are giving the recommendation.`

  // ── Section 9: Recommendation output format (unchanged) ─────────────────────
  const recFormat = renderRecFormat(profile)

  // ── Section 10: Beverage DNA output format (parsed by lib/agent/beverage-dna.ts)
  const dnaFormat = renderDnaFormat(profile)

  // ── Override: if the vendor has a hand-built chat_system_prompt, use it as
  // the identity/voice section but keep the rest of the structured prompt.
  // This preserves the Vendor Builder workflow while still applying adaptive
  // questions, vocab rules, and the rec format.
  const vendorOverride = typeof retailer.chat_system_prompt === 'string' && retailer.chat_system_prompt.trim().length > 0
    ? sanitizePromptInput(retailer.chat_system_prompt)
    : null
  const finalIdentity = vendorOverride || identityBlock

  return [
    finalIdentity,
    storyBlock ? `ABOUT THIS PLACE:\n${storyBlock}` : '',
    vocabBlock,
    questionBlock,
    confidenceBlock,
    ruleBlock,
    sellersBlock,
    emphasisBlock,
    conversationRules,
    `YOUR CATALOG AT ${(retailer.name || '').toUpperCase()}:`,
    `Location: ${retailer.location || ''}`,
    catalogLines.join('\n') + flightLines.join('\n') + featuredSection + takeHomeSection,
    recFormat,
    dnaFormat,
  ].filter(s => s && s.trim().length > 0).join('\n\n')
}

// ── Renderers ────────────────────────────────────────────────────────────────

function renderIdentity(retailer: any, profile: AssistantProfile, category: CategoryTemplate): string {
  const venue = retailer.name || 'this place'
  const toneCopy: Record<AssistantProfile['brand_tone'], string> = {
    warm:        'Warm, welcoming, and genuine — like the best regular at this place.',
    expert:      'Confident and deeply knowledgeable. Not a snob — generous with what you know.',
    playful:     'Light, witty, and easy. Make it fun without being silly.',
    minimalist:  'Direct and uncluttered. Few words, well chosen.',
    reverent:    'Quietly passionate. Treat the craft with care; bring the guest in gently.',
  }
  const styleCopy: Record<AssistantProfile['experience_style'], string> = {
    bartender:      'You\'re the bartender — read the room, cut through choice overwhelm, make the guest feel like an insider.',
    sommelier:      'You\'re the tasting-room guide — patient, story-rich, never makes anyone feel ignorant.',
    barista:        'You\'re the barista — read whether they want technical depth or just a good cup, and meet them there.',
    'spirits-guide':'You\'re the spirits guide — bridge the cocktail world and the neat-pour world; recommend based on which one they\'re in.',
    host:           'You\'re the host — warm, attentive, generous with attention. The guest feels personally taken care of.',
  }
  const personality = profile.brand_personality.trim().length > 0
    ? ' ' + sanitizePromptInput(profile.brand_personality)
    : ''
  return `IDENTITY:
You are ${sanitizePromptInput(profile.agent_name)} at ${sanitizePromptInput(venue)}.
${styleCopy[profile.experience_style]}
TONE: ${toneCopy[profile.brand_tone]}${personality}`
}

function renderVocab(profile: AssistantProfile): string {
  const lines: string[] = []
  if (profile.preferred_vocab.length > 0) {
    lines.push('Lean on this vocabulary when natural: ' + profile.preferred_vocab.map(v => `"${sanitizePromptInput(v)}"`).join(', ') + '.')
  }
  if (profile.avoid_words.length > 0) {
    lines.push('NEVER use these words/phrases: ' + profile.avoid_words.map(v => `"${sanitizePromptInput(v)}"`).join(', ') + '.')
  }
  return lines.length > 0 ? 'BRAND VOCABULARY:\n' + lines.join('\n') : ''
}

function renderQuestionStrategy(profile: AssistantProfile, category: CategoryTemplate, min: number, max: number): string {
  // Filter category themes to only those the vendor has enabled (or all if unset).
  const enabledIds = new Set(profile.question_themes)
  const themes = category.question_themes.filter(t => enabledIds.size === 0 || enabledIds.has(t.id))
  // Stable ordering: respect the vendor's order when provided.
  themes.sort((a, b) => {
    const ai = profile.question_themes.indexOf(a.id)
    const bi = profile.question_themes.indexOf(b.id)
    if (ai === -1 && bi === -1) return 0
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })

  const themeLines = themes.map((t: QuestionTheme) => {
    const exampleList = t.example_phrasings.slice(0, 2).map(e => `   - ${e}`).join('\n')
    return `• ${t.label} (id: ${t.id})\n${exampleList}`
  }).join('\n')

  return `QUESTION STRATEGY:
- Ask between ${min} and ${max} questions total. Aim for the smallest number that lets you recommend confidently.
- DRAW QUESTIONS FROM THESE THEMES (pick the most relevant given context, ask in the order that flows naturally):
${themeLines}
- The example phrasings above are *examples*, not a script. Rewrite in your own voice so it sounds like a real ${profile.experience_style}, not a form.`
}

function renderRules(profile: AssistantProfile): string {
  if (profile.recommendation_rules.length === 0) return ''
  const lines = profile.recommendation_rules.map(r => {
    const parts: string[] = []
    if (r.prioritize_categories && r.prioritize_categories.length > 0) {
      parts.push('prioritize ' + r.prioritize_categories.join('/'))
    }
    if (r.avoid_categories && r.avoid_categories.length > 0) {
      parts.push('avoid ' + r.avoid_categories.join('/'))
    }
    return `• If the guest signals "${sanitizePromptInput(r.when_user_says)}" → ${parts.join(' and ')}.`
  }).join('\n')
  return 'VENDOR RECOMMENDATION RULES (follow these when the trigger matches):\n' + lines
}

function renderRecFormat(profile: AssistantProfile): string {
  const cta = sanitizePromptInput(profile.cta_primary || 'Order this')
  const ctaSecondary = sanitizePromptInput(profile.cta_secondary || 'Show me another')
  return `WHEN READY TO RECOMMEND — write 1-2 warm sentences as a handoff, then output the block below exactly.

HARD RULES (the guest sees a broken experience if you violate these):
- NEVER name your final pick in prose without the ===REC=== block in the SAME message. If your message says "X is the one for you", that message MUST end with the block — a recommendation without the block shows the guest nothing to order.
- Copy each product "name" EXACTLY as it appears in the catalog above, character for character. A renamed or paraphrased product gets dropped from the guest's card.
- If the guest asks you to just recommend and you already described a pick earlier, do NOT repeat the description — one short confirmation line, then the block.

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
  "serveNote": "How to enjoy it — temp, glassware, pairing, ritual (string)",
  "cocktailContext": null,
  "pairing": null,
  "upsellSuggestion": null
}
===END===

TYPE RULES — follow exactly or the app breaks:
- "price" must be a number (e.g. 12.00) or null if unknown — NEVER a string like "$12"
- "selectedProducts" must be an array with at least one item
- "flavorProfile" must be an array of 2-4 short strings
- "format" must be exactly "single" or "flight"
- "story", "whyItFitsYou", "tagline", "recommendationName", "serveNote" must be strings, never null
- "cocktailContext", "pairing", "upsellSuggestion" are OPTIONAL — set null when you have nothing real to say. Never invent.

For a flight recommendation: set format = "flight", flightDetails = { "flightName": "string", "price": 18.00, "pourSize": "4oz", "count": 3 }, selectedProducts = the individual pours in the flight.

OPTIONAL ENRICHMENT FIELDS — populate ONLY when genuinely useful:

cocktailContext — use ONLY when recommending a cocktail built around a vendor spirit (distilleries especially). The vendor's SKU stays in selectedProducts; this narrates how the cocktail uses it. Shape:
  "cocktailContext": { "cocktailName": "Old Fashioned", "cocktailDescription": "2oz of our bourbon, sugar, bitters, orange peel, big ice", "builtAround": "Exact vendor product name" }
For neat pours / non-cocktail recs: cocktailContext = null.

pairing — short food/occasion line if it genuinely improves the experience ("Stunning with sharp cheddar."). Otherwise null.

upsellSuggestion — ONE add-on or take-home nudge a real bartender would actually offer ("Grab a 4-pack to-go — same beer, same price as 4 pints"). Must reference real catalog items if implying products. Otherwise null.

CALL-TO-ACTION COPY (for the UI buttons that appear after the recommendation):
- Primary CTA: "${cta}"
- Secondary CTA: "${ctaSecondary}"
Do not output these in the message — they're rendered by the UI from the vendor's profile.

The handoff sentence before ===REC=== should feel like the best ${profile.experience_style} in the place just walked over. Specific, confident, warm.`
}

function renderDnaFormat(profile: AssistantProfile): string {
  const agent = sanitizePromptInput(profile.agent_name)
  return `BEVERAGE DNA — when (and only when) you give a recommendation, output this block IMMEDIATELY AFTER the ===REC=== block:

===DNA===
{
  "persona": "EXACTLY one of: The Bold Explorer | The Curious Adventurer | The Smooth Traditionalist | The Flavor Hunter | The Comfort Seeker | The Refined Collector",
  "tasteLine": "Because you go for … — one short second-person line, specific to THIS guest",
  "flavorProfile": [{"axis":"Bold","value":0.8},{"axis":"Sweet","value":0.3}],
  "confidenceScore": 0,
  "discoveryScore": 0,
  "summary": "1-2 sentence taste identity"
}
===END===

BEVERAGE DNA RULES — follow exactly or the data is dropped:
- "persona" MUST be one of the six exact strings above. It is an INTERNAL analytics label the guest NEVER sees — classify honestly to fit them, never to flatter, and never invent a new name.
- "tasteLine" is the guest-facing payoff: a single specific sentence grounded in what ${agent ? agent + ' ' : ''}heard this guest actually say/choose, in this venue's voice, using real flavor language. It reads as the REASON for the pick (the UI places it right above the product). Do NOT name or hint at the persona bucket in it, and do NOT use an archetype label.
- "flavorProfile": 4-6 axes suited to your category (coffee: Bright/Roasty/Sweet/Body; beer: Hoppy/Malty/Bitter/Light; wine: Dry/Bold/Fruity/Earthy; spirits: Smoky/Sweet/Spirit-forward/Smooth). Each "value" is a number 0-1.
- "confidenceScore" 0-100 = how sure you are of the match. "discoveryScore" 0-100 = how adventurous this guest is.
- Output the DNA block ONLY alongside a recommendation — never while you're still asking questions.`
}
