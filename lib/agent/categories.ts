/**
 * Category registry — extensible per-vertical templates that drive the
 * assistant's behavior when an AssistantProfile doesn't override.
 *
 * Adding a new vertical = adding an entry to CATEGORY_TEMPLATES + extending the
 * Vertical union in lib/types.ts. No changes to chat route, prompt builder, or
 * UI needed — they all read through getCategoryTemplate(vertical).
 *
 * Per-category min/max counts intentionally differ by vertical: a brewery
 * taproom benefits from a tight 2-3 question flow (impulse, mobile, choice
 * fatigue), while distillery/winery flights warrant more depth. Vendors can
 * override via AssistantProfile.{min,max}_questions.
 */
import type { Vertical, BrandTone, ExperienceStyle } from '@/lib/types'

export interface QuestionTheme {
  id: string                  // stable key, used by AssistantProfile.question_themes
  label: string               // human-readable, used in admin UI later
  example_phrasings: string[] // 2-3 brand-neutral example questions for the model
  suggested_chips: string[]   // hint chips if the model needs a default
}

export interface CategoryTemplate {
  vertical: Vertical
  default_experience_style: ExperienceStyle
  default_tone: BrandTone
  // Min/max conversational turns. These are *defaults*; a vendor profile can override.
  min_questions: number
  max_questions: number
  // Ordered list of themes the assistant should draw from. The model picks the
  // most relevant given what it already knows — not all themes get asked.
  question_themes: QuestionTheme[]
  // Free-text guidance the prompt injects to colour the recommendation reveal.
  recommendation_emphasis: string[]
  // Product attribute fields (on Product) that meaningfully drive matching here.
  // Used today as prompt context; in Phase 3 this also weights the reveal layout.
  catalog_attribute_priority: string[]
}

// ── Brewery ──────────────────────────────────────────────────────────────────
const BREWERY: CategoryTemplate = {
  vertical: 'brewery',
  default_experience_style: 'bartender',
  default_tone: 'warm',
  min_questions: 2,
  max_questions: 3,
  question_themes: [
    {
      id: 'familiarity',
      label: 'Familiar vs. adventurous',
      example_phrasings: [
        'Are you in the mood for something familiar, or feeling adventurous today?',
        'Sticking with a style you love, or want to try something new?',
      ],
      suggested_chips: ['Something familiar', 'Something new'],
    },
    {
      id: 'style_direction',
      label: 'Style direction',
      example_phrasings: [
        'Hoppy, malty, dark, or light and crushable?',
        'Are we thinking IPA territory, something darker, or crisp and clean?',
      ],
      suggested_chips: ['Hoppy', 'Dark & rich', 'Light & crisp', 'Sour or funky'],
    },
    {
      id: 'intensity',
      label: 'Intensity / ABV',
      example_phrasings: [
        'Sessionable, or something with a little more punch?',
        'Easy-drinking or a stronger sipper?',
      ],
      suggested_chips: ['Sessionable', 'Medium', 'Bring the heat'],
    },
    {
      id: 'occasion',
      label: 'Occasion',
      example_phrasings: [
        'Quick pour or settling in?',
        'On a flight, drinking with food, or just one to enjoy?',
      ],
      suggested_chips: ['Just one beer', 'A flight', 'With food'],
    },
    {
      id: 'food_pairing',
      label: 'Food pairing',
      example_phrasings: [
        'Pairing with anything from the menu?',
        'Eating with this, or solo?',
      ],
      suggested_chips: ['Pairing with food', 'Just the beer'],
    },
  ],
  recommendation_emphasis: [
    'Name the brewer or inspiration behind the pour when you can.',
    'For uncertain guests, lean toward a flight so they can taste a range.',
    'Mention ABV/IBU naturally only if the guest signaled they care.',
  ],
  catalog_attribute_priority: ['style', 'abv', 'ibu', 'flavor_notes', 'tap_handle'],
}

// ── Coffee ────────────────────────────────────────────────────────────────────
const COFFEE: CategoryTemplate = {
  vertical: 'coffee',
  default_experience_style: 'barista',
  default_tone: 'warm',
  min_questions: 3,
  max_questions: 4,
  question_themes: [
    {
      id: 'morning_style',
      label: 'Morning style',
      example_phrasings: [
        'What kind of morning are we building — calm, focused, bold, or easygoing?',
        'Energizing wake-up, or slow and comforting?',
      ],
      suggested_chips: ['Bold & energizing', 'Smooth & calm', 'Just easygoing'],
    },
    {
      id: 'brew_method',
      label: 'Brew method',
      example_phrasings: [
        'How do you usually brew — drip, pour-over, French press, espresso, cold brew?',
        'What\'s your home setup look like?',
      ],
      suggested_chips: ['Drip', 'Pour-over', 'Espresso', 'French press', 'Cold brew'],
    },
    {
      id: 'flavor_direction',
      label: 'Flavor direction',
      example_phrasings: [
        'Bright and fruity, balanced and nutty, or deep and chocolatey?',
        'Do you lean toward fruit-forward or roasty?',
      ],
      suggested_chips: ['Fruity & bright', 'Nutty & balanced', 'Chocolate & deep'],
    },
    {
      id: 'roast_comfort',
      label: 'Roast comfort zone',
      example_phrasings: [
        'Light, medium, or dark roast usually?',
        'Where do you live on the roast spectrum?',
      ],
      suggested_chips: ['Light', 'Medium', 'Dark'],
    },
    {
      id: 'daily_vs_discovery',
      label: 'Daily driver vs. discovery',
      example_phrasings: [
        'Looking for a daily driver, or something to try as a single experience?',
        'A bag for every-day, or a special pour to taste once?',
      ],
      suggested_chips: ['Daily driver', 'Something to try'],
    },
  ],
  recommendation_emphasis: [
    'Mention origin and process when the guest seems curious.',
    'Suggest a brew ratio or grind note when the brew method is known.',
    'Keep it inviting for newcomers; go technical when they signal expertise.',
  ],
  catalog_attribute_priority: ['origin', 'process', 'altitude', 'flavor_notes', 'roast_date'],
}

// ── Winery ────────────────────────────────────────────────────────────────────
const WINERY: CategoryTemplate = {
  vertical: 'winery',
  default_experience_style: 'sommelier',
  default_tone: 'reverent',
  min_questions: 3,
  max_questions: 4,
  question_themes: [
    {
      id: 'dryness',
      label: 'Dryness preference',
      example_phrasings: [
        'Do you lean dry, off-dry, or a touch of sweetness?',
        'Crisp and dry, or do you enjoy a little roundness?',
      ],
      suggested_chips: ['Dry', 'Off-dry', 'A little sweetness'],
    },
    {
      id: 'body',
      label: 'Body / texture',
      example_phrasings: [
        'Light and bright, medium and round, or full and bold?',
        'Are we thinking crisp white, silky red, or something structured?',
      ],
      suggested_chips: ['Light & crisp', 'Medium', 'Full-bodied'],
    },
    {
      id: 'occasion',
      label: 'Occasion',
      example_phrasings: [
        'Is this for a dinner, a relaxing evening, gifting, or just exploring?',
        'Drinking now, saving for an occasion, or a gift?',
      ],
      suggested_chips: ['With dinner', 'Relaxing tonight', 'A gift', 'Just exploring'],
    },
    {
      id: 'food_pairing',
      label: 'Food pairing',
      example_phrasings: [
        'Anything specific you\'d be pairing this with?',
        'Will this come out with a meal?',
      ],
      suggested_chips: ['Red meat', 'Seafood', 'Cheese', 'Just on its own'],
    },
    {
      id: 'adventure_level',
      label: 'Adventure level',
      example_phrasings: [
        'A familiar varietal, or curious about something unexpected?',
        'Sticking with a grape you know, or open to a surprise?',
      ],
      suggested_chips: ['Something familiar', 'Surprise me'],
    },
  ],
  recommendation_emphasis: [
    'Tell the winemaker / vintage / vineyard story briefly when recommending.',
    'Use sensory language ("silky tannins", "stone-fruit lift") not jargon.',
    'When unsure, lean toward a tasting flight or a wine club featured pour.',
  ],
  catalog_attribute_priority: ['varietal', 'vintage', 'appellation', 'flavor_notes', 'cellar_note'],
}

// ── Distillery ────────────────────────────────────────────────────────────────
const DISTILLERY: CategoryTemplate = {
  vertical: 'distillery',
  default_experience_style: 'spirits-guide',
  default_tone: 'expert',
  min_questions: 3,
  max_questions: 5,
  question_themes: [
    {
      id: 'base_spirit',
      label: 'Base spirit',
      example_phrasings: [
        'What do you usually reach for — bourbon, gin, vodka, tequila, rum, or something else?',
        'Is there a spirit you already know you love?',
      ],
      suggested_chips: ['Bourbon / whiskey', 'Gin', 'Vodka', 'Tequila', 'Rum', 'Show me anything'],
    },
    {
      id: 'neat_vs_cocktail',
      label: 'Neat vs. cocktail',
      example_phrasings: [
        'A simple pour to sip, or a crafted cocktail?',
        'Tasting it neat, on the rocks, or in a cocktail?',
      ],
      suggested_chips: ['Neat / rocks', 'A cocktail', 'A flight'],
    },
    {
      id: 'flavor_profile',
      label: 'Flavor profile',
      example_phrasings: [
        'Refreshing, smoky, herbal, sweet, citrusy, or spirit-forward?',
        'Are we leaning bright and citrusy, or rich and barrel-aged?',
      ],
      suggested_chips: ['Refreshing', 'Smoky', 'Sweet', 'Spirit-forward', 'Herbal'],
    },
    {
      id: 'intensity',
      label: 'Intensity / strength',
      example_phrasings: [
        'Sippable and easy, or strong and bold?',
        'Soft entry, or full proof?',
      ],
      suggested_chips: ['Sippable', 'Balanced', 'Full proof'],
    },
    {
      id: 'occasion',
      label: 'Occasion',
      example_phrasings: [
        'Just one pour today, or are you here to taste your way through?',
        'A nightcap, a session, or a bottle to take home?',
      ],
      suggested_chips: ['Just one pour', 'A flight', 'A bottle to-go'],
    },
  ],
  recommendation_emphasis: [
    'For a cocktail recommendation, keep the distillery\'s spirit visually and verbally central — the cocktail is the vehicle, the spirit is the point.',
    'Mention mash bill, barrel program, or botanicals briefly when the guest seems engaged.',
    'A flight is a great recommendation for an undecided enthusiast.',
  ],
  catalog_attribute_priority: ['style', 'abv', 'flavor_notes', 'description'],
}

// ── Registry ──────────────────────────────────────────────────────────────────
const CATEGORY_TEMPLATES: Record<Vertical, CategoryTemplate> = {
  brewery: BREWERY,
  coffee: COFFEE,
  winery: WINERY,
  distillery: DISTILLERY,
}

export function getCategoryTemplate(vertical: Vertical | string | null | undefined): CategoryTemplate {
  if (vertical && (vertical as Vertical) in CATEGORY_TEMPLATES) {
    return CATEGORY_TEMPLATES[vertical as Vertical]
  }
  // Unknown vertical → fall back to brewery (most generic beverage flow).
  return BREWERY
}

export function listCategoryTemplates(): CategoryTemplate[] {
  return Object.values(CATEGORY_TEMPLATES)
}
