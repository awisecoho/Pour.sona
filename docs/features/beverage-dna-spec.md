# Beverage DNA™ — Implementation Spec & Session Handoff

**Status:** Spec only. No feature code written yet.
**Created:** end of the brand-v2 + repositioning session.
**Owner decision:** build this next, as its own multi-session effort.

---

## PART 1 — SESSION HANDOFF (read first)

### Where the project is right now
- **Brand v2 paint: COMPLETE & deployed.** Palette (plum `#612A86` chrome / copper amber `#D67A31` CTA / cabernet `#C04D86` / discovery teal `#44C7C4` / darkBg `#12111A`), fonts (Sora/Inter/Outfit via `lib/brand.ts` + `next/font` in `app/layout.tsx`), logo, favicon/OG all live across marketing, login, admin chrome+content, email, QR.
- **Homepage repositioning: COMPLETE & deployed** (`b7f887a`). Now "The Beverage Intelligence Platform / Your Beverage DNA™", honest-forward (4 live verticals + 4 "Soon" cards).
- **Last production deploy:** `dpl_EPxjjcg…` READY on `pour-sona.com`. Tree clean, synced to `origin/main`.

### Standing rules (do NOT violate)
1. **LOGO IS LOCKED.** `public/brand/logo-source.png` (has coffee bean, grape cluster, leaf) stays exactly as-is. Color adjustments to surrounding UI are fine; the graphic itself never changes unless the user hands over a new file.
2. **DB = Neon only, never Supabase.** Schema changes go in `app/api/migrate/route.ts` `FIX_SCHEMA` (idempotent `ADD COLUMN … EXCEPTION WHEN duplicate_column`), deploy, then `curl -s -X POST https://pour-sona.com/api/migrate -H "Content-Type: application/json" -d '{"secret":"poursona-migrate-2026"}'`.
3. **Run `npm run build` before every push** — `tsc --noEmit` does NOT catch ESLint-as-error (e.g. `react/no-unescaped-entities`); those silently fail Vercel builds.
4. **Verify deploys via Vercel API** (`get_deployment` → `state:READY` + alias has `pour-sona.com`), not footer-string probes. Also `curl` any new `public/` asset for HTTP 200 — a logo 404'd in prod earlier this project because `public/brand/` wasn't `git add`ed.
5. **Guest page `/r/[slug]` is 95% vendor-branded.** It uses the vendor's `brand_color`/`brand_font_family`. Do NOT inject Poursona brand colors into its primary theme. The reveal additions below must inherit the vendor theme (`theme.primary`, `theme.rgbStr`, `font`), not Poursona's palette.

### Verticals live today
`brewery`, `winery`, `distillery`, `coffee` (in `lib/agent/categories.ts`). Tea/restaurants/distributors are marketing "coming soon" only — not built.

### Remaining non-DNA backlog (lower priority, note for later)
- Clerk Password auth toggle (dashboard setting, user's task, no code).
- `docs/review/03-finance-review.md` assumes flat $79 — pricing is now **tiered** (`PLAN_TIERS` in `lib/billing.ts`). Finance doc needs a refresh.
- Tier 2 (server handoff) / Tier 3 (POS) from the strategic review — separate future workstreams.

---

## PART 2 — BEVERAGE DNA™ DESIGN SPEC

### Goal
After the guest's chat produces a recommendation, also crown them with a **named taste persona** + flavor profile + confidence/discovery scores. The persona is the takeaway artifact ("This company understands my taste") and rolls up into vendor **Audience Intelligence** ("Top Personas this month").

### The persona set (from the brand brief — Doc #2)
Six canonical personas. Keep them universal across verticals (a "Bold Explorer" works for coffee, beer, wine, spirits):
- **The Bold Explorer** — seeks intensity, the unexpected, high-ABV/high-roast/big-flavor
- **The Curious Adventurer** — wants variety and discovery, open to anything new
- **The Smooth Traditionalist** — classic, balanced, approachable, no surprises
- **The Flavor Hunter** — chases specific flavor notes, nuance-driven
- **The Comfort Seeker** — familiar, easy, low-risk, "give me my usual"
- **The Refined Collector** — premium, provenance, craft, story-driven

> The model SELECTS one of these six (closed set — do not let it invent new persona names; that keeps analytics aggregatable). Everything else (flavor profile, scores, copy) is generated.

### Data model (Neon, via `FIX_SCHEMA`)
Add to the existing `sessions` table (already holds `blend_data` jsonb, `recommended_at`, etc.):
```sql
ALTER TABLE sessions ADD COLUMN beverage_dna jsonb;
```
Shape stored in `sessions.beverage_dna`:
```ts
interface BeverageDNA {
  persona: 'The Bold Explorer' | 'The Curious Adventurer' | 'The Smooth Traditionalist'
         | 'The Flavor Hunter' | 'The Comfort Seeker' | 'The Refined Collector'
  personaTagline: string        // one line, in the vendor's voice
  flavorProfile: Array<{ axis: string; value: number }>  // e.g. [{axis:'Bold',value:0.8},{axis:'Sweet',value:0.3}...], value 0-1, 4-6 axes
  confidenceScore: number       // 0-100, how sure the AI is of the match
  discoveryScore: number        // 0-100, how adventurous the guest is
  summary: string               // 1-2 sentences describing their taste identity
}
```
Optionally also a denormalized `sessions.persona text` column for cheap GROUP BY in analytics (avoids jsonb extraction in aggregate queries). Recommended:
```sql
ALTER TABLE sessions ADD COLUMN persona text;
```

### Prompt changes (`lib/agent/build-prompt.ts`)
The recommendation is emitted via a `===REC===` JSON sentinel block (see `renderRecFormat`). **Add a parallel `===DNA===` block** the model emits alongside the rec:
```
===DNA===
{
  "persona": "<one of the six exact strings>",
  "personaTagline": "string in the venue's voice",
  "flavorProfile": [{"axis":"Bold","value":0.8}, ...],   // 4-6 axes, value 0-1
  "confidenceScore": 0-100,
  "discoveryScore": 0-100,
  "summary": "1-2 sentence taste identity"
}
===END===
```
Add prompt guidance: persona MUST be one of the six exact strings; flavor axes should suit the vertical (coffee: Bright/Roasty/Sweet/Body; beer: Hoppy/Malty/Bitter/Light; wine: Dry/Bold/Fruity/Earthy; spirits: Smoky/Sweet/Spirit-forward/Smooth). The model already has the conversation + catalog context, so DNA generation is "free" (same call, more output tokens — budget impact is modest, ~150-250 extra output tokens; watch the per-vendor AI cap in `lib/chat-guardrails.ts`).

### Server parsing (`app/api/chat/route.ts`)
- The route already regex-parses `===REC===…===END===` and `===CHIPS===…===END===`. Add a `===DNA===` parse next to those (~line 245-260 area).
- Validate: persona ∈ the six; clamp scores 0-100; cap flavorProfile to 6 axes; coerce values to 0-1. Drop the whole DNA object if persona is invalid (don't persist garbage personas — analytics integrity).
- Persist: extend the `update sessions set …` (currently lines 353-359) to also set `beverage_dna = $N::jsonb` and `persona = $N`.
- Emit on the SSE `done` frame (currently `{ done, text, recData, chips, ctas, fallbackLine }` at line ~337): add `dna`.
- Funnel event: optionally insert an `events` row `beverage_dna_generated` (mirrors the existing `recommendation_shown` pattern) for analytics.

### Types (`lib/types.ts`)
- Add the `BeverageDNA` interface above.
- Extend the SSE payload type (`ChatRecommendationPayload`) with `dna?: BeverageDNA | null`.

### Reveal UI (`app/r/[slug]/page.tsx` AND `app/demo/[draftId]/page.tsx`)
Both have a `RecommendationCard`. Add a **Beverage DNA panel ABOVE or INSIDE the rec card**, rendered in the **vendor theme** (`theme.primary`, `theme.rgbStr`, `font` — NOT Poursona colors):
- Persona name as the hero ("You're a **Bold Explorer**") + personaTagline.
- A small flavor-profile visual: horizontal bars or a mini radar. Keep it lightweight/mobile-first (the page is phone-first). Bars are simpler than radar and read fine at small sizes.
- Confidence + discovery as two small stat pills.
- The summary line.
- This is the "most important screen" per the brief — but it must stay above the buy button on mobile (don't push the CTA below the fold). Consider: DNA persona + tagline always visible; flavor bars + scores in an expandable "See your full taste profile" disclosure (matches the existing "Read the story" expandable pattern already in the card).
- `/demo/[draftId]` mirrors `/r/[slug]` — apply to both so the demo-first signup flow shows DNA too.

### Vendor dashboard — Audience Intelligence (`app/admin/page.tsx`)
Add a panel:
- **Top Personas (last 30 days)** — `SELECT persona, COUNT(*) FROM sessions WHERE retailer_id=$1 AND persona IS NOT NULL AND created_at > now()-interval '30 days' GROUP BY persona ORDER BY count DESC`.
- Simple horizontal bar list of the six personas with counts/percentages.
- Possibly an avg discoveryScore gauge ("Your guests skew adventurous / traditional").
- Data source is the new `sessions.persona` column (cheap GROUP BY).

### Internal analytics (`app/poursona-admin/page.tsx`)
- Cross-vendor persona distribution on the Dashboard tab (nice-to-have, not required for v1).

### Suggested phasing
- **Phase A — generation + persistence (no UI):** schema migration, prompt `===DNA===` block, server parse + persist + SSE emit, types. Ship. Verify `sessions.persona` populates by running a real guest chat and querying Neon. Zero user-visible change yet — safe.
- **Phase B — guest reveal UI:** the DNA panel on `/r/[slug]` + `/demo/[draftId]`, vendor-themed, mobile-first, expandable. The visible payoff.
- **Phase C — vendor Audience Intelligence:** Top Personas panel on `/admin`.
- **Phase D (optional) — internal cross-vendor persona analytics.**

### Open questions to resolve with the user before/while building
1. **Persona reveal prominence:** persona panel ABOVE the product rec (taste-identity-first, per the brief's "most important screen") vs. INSIDE/below the rec (product-first). Brief implies identity-first; but product rec drives orders. Recommend: persona headline above, product rec immediately below, flavor detail expandable.
2. **Flavor visual:** horizontal bars (simple, mobile-safe — recommended) vs. radar chart (prettier, harder at small sizes, needs SVG).
3. **™ usage:** "Beverage DNA™" on the guest page — does that intrude on the 95%-vendor rule? It's a Poursona term shown to the vendor's guest. Recommend small/subtle, or let the vendor toggle it. Confirm.
4. **Trademark status:** is "Beverage DNA™" / "Discover Your Taste™" actually filed? Affects whether we show ™ (intent-to-use) vs nothing. (Legal-review open item.)
5. **Budget:** confirm the extra output tokens per chat stay within the per-vendor `AI_MONTHLY_BUDGET_USD` cap. Likely fine but verify with `lib/chat-guardrails.ts` math.

### Files this feature will touch (checklist)
- `app/api/migrate/route.ts` — `sessions.beverage_dna jsonb` + `sessions.persona text`
- `lib/types.ts` — `BeverageDNA` interface + payload type
- `lib/agent/build-prompt.ts` — `===DNA===` schema + guidance in `renderRecFormat` (or a new `renderDnaFormat`)
- `app/api/chat/route.ts` — parse, validate, persist, emit, (funnel event)
- `app/r/[slug]/page.tsx` — DNA reveal panel (vendor-themed)
- `app/demo/[draftId]/page.tsx` — mirror DNA reveal
- `app/admin/page.tsx` — Top Personas panel
- (optional) `app/poursona-admin/page.tsx` — cross-vendor persona analytics
- `tests/` — add a parse/validation test for the DNA block (mirror `tests/recommendation-enrich.test.ts` style)

### What NOT to do
- Don't let the model invent persona names outside the six (breaks aggregation).
- Don't theme the guest DNA panel in Poursona colors (vendor theme only).
- Don't block the recommendation if DNA parsing fails — DNA is additive; a missing/invalid DNA block should degrade gracefully (no panel), never kill the rec.
- Don't change the logo. (Standing rule.)
