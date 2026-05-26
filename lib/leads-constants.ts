/**
 * Shared lifecycle + activity type constants for the prospect leads CRM.
 * Lives outside the API route files because Next.js disallows arbitrary
 * named exports from `app/.../route.ts` files (it tries to type-check every
 * export against the known route-handler shape and trips on anything else).
 */

export const LEAD_STATUSES = [
  'new',
  'contacted',
  'replied',
  'demo_scheduled',
  'qualified',
  'closed_won',
  'closed_lost',
] as const

export type LeadStatus = typeof LEAD_STATUSES[number]

export const ACTIVITY_TYPES = [
  'note',
  'email_sent',
  'email_replied',
  'call',
  'demo_scheduled',
  'demo_completed',
  'status_change',
  'contact_added',
  'saved',
  'resaved',
] as const

export type ActivityType = typeof ACTIVITY_TYPES[number]
