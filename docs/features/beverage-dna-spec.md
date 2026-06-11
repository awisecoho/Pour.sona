# Beverage DNA™ — Implementation Spec & Session Handoff

**Status:** Phases A (generation + persistence) **and B (guest reveal UI)** both **built in code** as of 2026-06-11 — see the phasing section. Not yet deployed; the Neon migration still needs to run against production (Phase A persistence + Phase C rollup). Phase B renders straight from the SSE payload, so it works on live chat without the migration. Phases C–D unstarted.
**Created:** end of the brand-v2 + repositioning session.
**Owner decision:** build this next, as its own multi-session effort.
**Reveal direction (decided 2026-06-10):** product-first, taste as the "because." The six personas became a **silent vendor-only analytics classification** — the guest never sees a named persona. The guest instead gets a bespoke, conversation-specific taste line folded into the recommendation as its justification, with flavor detail in a "why this matched" expandable. This replaces the original persona-hero panel (see PART 2 reveal section). Resolves the "personas feel gimmicky" + "competes with the rec" concerns.

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
Two jobs, deliberately split apart (the original spec conflated them into one named persona, which is what made it feel gimmicky and compete with the rec):

1. **Guest side — taste-justified recommendation.** After the chat produces a rec, fold in a short, bespoke, conversation-specific **taste line** that frames *why this pick* ("Because you go for bright, clean coffees with a little adventure…"). The product stays the single focal point; the taste insight is the connective tissue, not a rival identity card. Flavor profile + confidence/discovery scores live in a "why this matched" expandable, below the product, so the buy CTA stays high. **The guest never sees a named persona.**
2. **Vendor side — Audience Intelligence.** The model *silently* classifies each session into one of six canonical personas (closed set, for aggregatability). This is persisted and rolls up into the vendor dashboard ("Top Personas this month"). It is an analytics tag only — never rendered to the guest.

### The persona set (from the brand brief — Doc #2)
**These six are now vendor-analytics-only — a silent classification, never shown to the guest.** Keep them universal across verticals (a "Bold Explorer" aggregates the same across coffee, beer, wine, spirits):
- **The Bold Explorer** — seeks intensity, the unexpected, high-ABV/high-roast/big-flavor
- **The Curious Adventurer** — wants variety and discovery, open to anything new
- **The Smooth Traditionalist** — classic, balanced, approachable, no surprises
- **The Flavor Hunter** — chases specific flavor notes, nuance-driven
- **The Comfort Seeker** — familiar, easy, low-risk, "give me my usual"
- **The Refined Collector** — premium, provenance, craft, story-driven

> The model SELECTS one of these six (closed set — do not let it invent new persona names; that keeps analytics aggregatable). The selected name feeds the vendor dashboard ONLY. Everything the **guest** sees (the taste line, flavor profile, scores, summary) is freely generated and specific to their conversation — that specificity is what makes it read as intelligence rather than a quiz bucket.

### Data model (Neon, via `FIX_SCHEMA`)
Add to the existing `sessions` table (already holds `blend_data` jsonb, `recommended_at`, etc.):
```sql
ALTER TABLE sessions ADD COLUMN beverage_dna jsonb;
```
Shape stored in `sessions.beverage_dna`:
```ts
interface BeverageDNA {
  // ── Vendor analytics only — NEVER rendered to the guest ──
  persona: 'The Bold Explorer' | 'The Curious Adventurer' | 'The Smooth Traditionalist'
         | 'The Flavor Hunter' | 'The Comfort Seeker' | 'The Refined Collector'

  // ── Guest-facing ──
  tasteLine: string             // the hero "because…" line: short, 2nd person, conversation-specific,
                                //   in the venue's voice. Ties the rec to their taste. Shown ABOVE the product.
                                //   e.g. "Because you go for bright, clean coffees with a little adventure…"
  flavorProfile: Array<{ axis: string; value: number }>  // e.g. [{axis:'Bold',value:0.8},{axis:'Sweet',value:0.3}...], value 0-1, 4-6 axes — expandable detail
  confidenceScore: number       // 0-100, how sure the AI is of the match — expandable detail
  discoveryScore: number        // 0-100, how adventurous the guest is — expandable detail (also feeds vendor avg)
  summary: string               // 1-2 sentence taste identity — expandable detail
}
```
Note: `tasteLine` replaces the old `personaTagline` field. The guest reveal renders `tasteLine` (hero) + the flavor/score/summary block (expandable); it does **not** render `persona`.
Also add a denormalized `sessions.persona text` column for cheap GROUP BY in the vendor analytics rollup (avoids jsonb extraction in aggregate queries). This is the **only** place the persona name is consumed — recommended:
```sql
ALTER TABLE sessions ADD COLUMN persona text;
```

### Prompt changes (`lib/agent/build-prompt.ts`)
The recommendation is emitted via a `===REC===` JSON sentinel block (see `renderRecFormat`). **Add a parallel `===DNA===` block** the model emits alongside the rec:
```
===DNA===
{
  "persona": "<one of the six exact strings — INTERNAL analytics tag, not shown to guest>",
  "tasteLine": "Because you go for … — short, 2nd person, specific to THIS chat, in the venue's voice",
  "flavorProfile": [{"axis":"Bold","value":0.8}, ...],   // 4-6 axes, value 0-1
  "confidenceScore": 0-100,
  "discoveryScore": 0-100,
  "summary": "1-2 sentence taste identity"
}
===END===
```
Add prompt guidance:
- `persona` MUST be one of the six exact strings. Tell the model this is an **internal label** the guest will never see, so it should classify honestly for analytics, not to flatter.
- `tasteLine` is the **guest-facing payoff**: a single specific sentence grounded in what they actually said/picked this session — concrete flavor language, not an archetype. Start it so it reads as the *reason* for the rec (the UI places it directly above the product). Do NOT name or imply the persona bucket in it.
- Flavor axes should suit the vertical (coffee: Bright/Roasty/Sweet/Body; beer: Hoppy/Malty/Bitter/Light; wine: Dry/Bold/Fruity/Earthy; spirits: Smoky/Sweet/Spirit-forward/Smooth).
- The model already has the conversation + catalog context, so DNA generation is "free" (same call, more output tokens — budget impact is modest, ~150-250 extra output tokens; watch the per-vendor AI cap in `lib/chat-guardrails.ts`).

### Server parsing (`app/api/chat/route.ts`)
- The route already regex-parses `===REC===…===END===` and `===CHIPS===…===END===`. Add a `===DNA===` parse next to those (~line 245-260 area).
- Validate: persona ∈ the six; require a non-empty `tasteLine` (it's the guest payoff); clamp scores 0-100; cap flavorProfile to 6 axes; coerce values to 0-1. Drop the whole DNA object if persona is invalid (don't persist garbage personas — analytics integrity).
- Persist: extend the `update sessions set …` (currently lines 353-359) to also set `beverage_dna = $N::jsonb` and `persona = $N` (the `persona` column powers the vendor rollup only).
- Emit on the SSE `done` frame (currently `{ done, text, recData, chips, ctas, fallbackLine }` at line ~337): add `dna`.
- Funnel event: optionally insert an `events` row `beverage_dna_generated` (mirrors the existing `recommendation_shown` pattern) for analytics.

### Types (`lib/types.ts`)
- Add the `BeverageDNA` interface above.
- Extend the SSE payload type (`ChatRecommendationPayload`) with `dna?: BeverageDNA | null`.

### Reveal UI (`app/r/[slug]/page.tsx` AND `app/demo/[draftId]/page.tsx`)
**Direction: product-first, taste as the "because."** Do NOT build a separate persona-identity panel that rivals the product. Instead weave the taste insight *into* the existing `RecommendationCard` as the reason for the pick. Rendered in the **vendor theme** (`theme.primary`, `theme.rgbStr`, `font` — NOT Poursona colors).

Layout (top → bottom), all inside/atop the one rec card so there's a single focal point:
1. **`tasteLine` as a short lead-in ABOVE the product** — the "Because you go for bright, clean coffees with a little adventure…" line, in the vendor voice/theme. One or two lines, smaller than the product name. This is the only DNA element shown by default.
2. **The product recommendation** — unchanged, stays the hero: name, notes, price.
3. **Buy CTA** — stays immediately under the product, above the fold on mobile. Nothing about DNA may push it down.
4. **"Why this matched my taste" expandable** — collapsed by default, below the CTA. Reuses the existing "Read the story" disclosure pattern already in the card. Expands to: the flavor-profile bars (horizontal, mobile-safe — not radar), the two score pills (confidence/discovery), and the `summary` line.

Hard rules for this screen:
- **No persona name anywhere on the guest page.** The six personas never render here — they're vendor-only. The guest sees `tasteLine` + (expandable) flavor/scores/summary, nothing bucket-shaped.
- The taste lead-in must read as the *justification* for the product, not a standalone identity card. If it ever competes with the product for the eye, it's wrong.
- Mobile-first: `tasteLine` + product + CTA must all be reachable without expanding anything; the flavor detail is opt-in.
- `/demo/[draftId]` mirrors `/r/[slug]` — apply to both so the demo-first signup flow shows the taste-justified rec too.

### Vendor dashboard — Audience Intelligence (`app/admin/page.tsx`)
Add a panel:
- **Top Personas (last 30 days)** — `SELECT persona, COUNT(*) FROM sessions WHERE retailer_id=$1 AND persona IS NOT NULL AND created_at > now()-interval '30 days' GROUP BY persona ORDER BY count DESC`.
- Simple horizontal bar list of the six personas with counts/percentages.
- Possibly an avg discoveryScore gauge ("Your guests skew adventurous / traditional").
- Data source is the new `sessions.persona` column (cheap GROUP BY).

### Internal analytics (`app/poursona-admin/page.tsx`)
- Cross-vendor persona distribution on the Dashboard tab (nice-to-have, not required for v1).

### Suggested phasing
- **Phase A — generation + persistence (no UI): ✅ BUILT IN CODE 2026-06-11.** Implemented:
  - `app/api/migrate/route.ts` — `sessions.beverage_dna jsonb` + `sessions.persona text` + `idx_sessions_retailer_persona` (partial index for the Phase C rollup).
  - `lib/types.ts` — `BEVERAGE_DNA_PERSONAS`, `BeverageDnaPersona`, `BeverageDNA`; `dna?` on `ChatRecommendationPayload`.
  - `lib/agent/beverage-dna.ts` — `parseBeverageDNA()` (extract/validate/normalise; drops off-list persona or missing tasteLine).
  - `lib/agent/build-prompt.ts` — `renderDnaFormat()` appended to the prompt (`===DNA===` block + rules).
  - `app/api/chat/route.ts` — parse + SSE-emit `dna` + persist `beverage_dna`/`persona` + `beverage_dna_generated` funnel event.
  - `app/api/demo/chat/route.ts` — parse + SSE-emit `dna` (emit-only; demo writes no sessions row).
  - `app/r/[slug]/page.tsx` + `app/demo/[draftId]/page.tsx` — explicit `===DNA===` strip so the raw block never shows to guests.
  - `tests/beverage-dna.test.ts` — 11 parse/validation tests. Full suite: 98 passing. `npm run build` clean.
  - **STILL TODO to ship Phase A:** deploy, then run the migrate curl against prod (columns don't exist on Neon until then), then verify `sessions.persona` populates via a real guest chat + Neon query. Zero user-visible change.
- **Phase B — guest reveal UI: ✅ BUILT IN CODE 2026-06-11.** Implemented:
  - `app/_components/BeverageDnaReveal.tsx` — shared `DnaTasteLine` (the "because…" lead-in, placed above the product) + `DnaDetails` (the "See your taste profile" expandable below the CTA: horizontal flavor bars, Match/Adventure score pills, summary). Vendor-themed via `primary`/`rgbStr`/`font` props; renders nothing when `dna` is absent; never shows the persona name.
  - `app/r/[slug]/page.tsx` — captures `dna` from the SSE `done` frame into state, resets it on "try another", passes it to `RecommendationCard`, renders both pieces.
  - `app/demo/[draftId]/page.tsx` — same wiring into `DemoRecommendationCard` (shared component, so no drift).
  - `npm run build` clean; 98 tests still pass.
  - **NOT yet visually verified** in a running guest chat (needs env/API keys + a seeded session/draft). Code + types are correct; the pixels haven't been eyeballed.
- **Phase C — vendor Audience Intelligence:** Top Personas panel on `/admin`.
- **Phase D (optional) — internal cross-vendor persona analytics.**

### Open questions
1. ~~**Persona reveal prominence:** above vs. inside/below the rec.~~ **RESOLVED 2026-06-10 → product-first, taste as the "because."** No standalone persona panel; `tasteLine` is a lead-in above the product, flavor detail is an expandable below the CTA. See the reveal section.
2. ~~**Flavor visual:** bars vs. radar.~~ **RESOLVED → horizontal bars** (simple, mobile-safe), inside the "why this matched" expandable.
3. ~~**™ usage on the guest page.~~ **RESOLVED / mostly moot** — the guest page no longer carries a "Beverage DNA™" header at all; the guest only sees the bespoke `tasteLine` + expandable detail. The "Beverage DNA" brand term now lives **vendor-side** (dashboard / marketing), so it no longer intrudes on the 95%-vendor guest rule. (If a guest-side label is ever wanted, make it vendor-toggleable — but default is none.)
4. **Trademark status (still open — legal):** is "Beverage DNA™" / "Discover Your Taste™" actually filed? Now only affects the **vendor-facing** surfaces (dashboard label, marketing), not the guest reveal. Determines ™ vs. nothing there.
5. **Budget (still open):** confirm the extra output tokens per chat (persona + tasteLine + profile, ~150-250 out) stay within the per-vendor `AI_MONTHLY_BUDGET_USD` cap. Likely fine but verify with `lib/chat-guardrails.ts` math.

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
- **Don't show the persona name to the guest.** The six personas are a silent vendor-only analytics tag. The guest sees `tasteLine` + expandable flavor detail, never a bucket name. (This is the whole point of the 2026-06-10 redesign.)
- Don't build a standalone persona/identity panel that competes with the product rec — taste is the "because," the product stays the focal point, the CTA stays above the fold.
- Don't let the model invent persona names outside the six (breaks aggregation).
- Don't theme the guest taste lead-in or expandable in Poursona colors (vendor theme only).
- Don't block the recommendation if DNA parsing fails — DNA is additive; a missing/invalid DNA block should degrade gracefully (no panel), never kill the rec.
- Don't change the logo. (Standing rule.)
