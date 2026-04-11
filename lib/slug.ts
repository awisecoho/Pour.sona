export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export function ensureUniqueSlug(base: string, existing: string[] = []): string {
  let slug = slugify(base)
  if (!existing.includes(slug)) return slug
  let i = 2
  while (existing.includes(`${slug}-${i}`)) i++
  return `${slug}-${i}`
}