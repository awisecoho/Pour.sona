/**
 * Server-side enrichment of an AI-generated recommendation against the live
 * catalog. The model produces product *names* (cheap, can't hallucinate URLs);
 * the server resolves those names to catalog rows and injects fields the model
 * has no business inventing: image_url, real price.
 *
 * Runs after validateRecAgainstCatalog (which already drops off-menu items),
 * so every selectedProducts[i] is guaranteed to match a catalog row when we
 * get here.
 */
import type { BlendRecommendation } from '@/lib/types'

/**
 * Catalog rows can arrive straight from `select * from products` (untyped) or
 * as fully-typed Product. We only read four fields and runtime-check them, so
 * accept the loose shape — typechecks aren't load-bearing here.
 */
export interface CatalogRow {
  name?: string | null
  image_url?: string | null
  price?: number | string | null
  category?: string | null
  description?: string | null
}

/**
 * Walk selectedProducts and overlay catalog fields (image_url + a real price
 * fallback) onto each item, looked up by case-insensitive name match.
 * Returns the same recData reference for fluent use.
 */
export function enrichRecommendationWithCatalog(
  recData: BlendRecommendation | null,
  catalog: CatalogRow[]
): BlendRecommendation | null {
  if (!recData || !Array.isArray(recData.selectedProducts)) return recData

  const byName = new Map<string, CatalogRow>()
  for (const p of catalog) {
    if (typeof p.name === 'string' && p.name.trim()) {
      byName.set(p.name.trim().toLowerCase(), p)
    }
  }

  recData.selectedProducts = recData.selectedProducts.map((sp) => {
    const match = byName.get(String(sp.name || '').trim().toLowerCase())
    if (!match) return sp
    // pg returns numeric columns as strings; coerce defensively so the UI
    // can always call .toFixed() / arithmetic on price without thinking.
    const catalogPrice = typeof match.price === 'number'
      ? match.price
      : (typeof match.price === 'string' && match.price.trim() !== '' ? Number(match.price) : null)
    return {
      ...sp,
      // Only fill image_url when the catalog has one; never overwrite a real one.
      image_url: sp.image_url ?? match.image_url ?? null,
      // Prefer the model's price when present and numeric; otherwise trust catalog.
      price: typeof sp.price === 'number' && !Number.isNaN(sp.price)
        ? sp.price
        : (catalogPrice != null && !Number.isNaN(catalogPrice) ? catalogPrice : null),
    }
  })

  return recData
}
