import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto'

// ── Platform registry ─────────────────────────────────────────────────────────
// Each platform's OAuth config + the env vars that must be set before it can be
// connected. Posting/research only goes live once these credentials exist AND
// (for Meta/LinkedIn) the platform has approved the app's posting scopes.
export type Platform = 'facebook' | 'instagram' | 'linkedin' | 'twitter'

export interface PlatformDef {
  id: Platform
  label: string
  icon: string
  authorizeUrl: string
  tokenUrl: string
  scopes: string
  clientIdEnv: string
  clientSecretEnv: string
  /** Honest note about what the owner must do for live posting. */
  note: string
}

export const PLATFORMS: Record<Platform, PlatformDef> = {
  facebook: {
    id: 'facebook',
    label: 'Facebook / Instagram',
    icon: '📘',
    authorizeUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
    scopes: 'pages_manage_posts,pages_read_engagement,instagram_basic,instagram_content_publish',
    clientIdEnv: 'META_APP_ID',
    clientSecretEnv: 'META_APP_SECRET',
    note: 'Requires a Meta app with Business verification + app review for the posting scopes.',
  },
  instagram: {
    id: 'instagram',
    label: 'Instagram',
    icon: '📷',
    authorizeUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
    scopes: 'instagram_basic,instagram_content_publish,pages_show_list',
    clientIdEnv: 'META_APP_ID',
    clientSecretEnv: 'META_APP_SECRET',
    note: 'Uses the same Meta app as Facebook; the IG account must be a Business/Creator account linked to a Page.',
  },
  linkedin: {
    id: 'linkedin',
    label: 'LinkedIn',
    icon: '💼',
    authorizeUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    scopes: 'w_member_social,r_liteprofile',
    clientIdEnv: 'LINKEDIN_CLIENT_ID',
    clientSecretEnv: 'LINKEDIN_CLIENT_SECRET',
    note: 'Posting (w_member_social) requires LinkedIn partner-program approval.',
  },
  twitter: {
    id: 'twitter',
    label: 'X / Twitter',
    icon: '𝕏',
    authorizeUrl: 'https://twitter.com/i/oauth2/authorize',
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    scopes: 'tweet.read tweet.write users.read offline.access',
    clientIdEnv: 'X_CLIENT_ID',
    clientSecretEnv: 'X_CLIENT_SECRET',
    note: 'Posting requires a paid X API tier (Basic or higher).',
  },
}

export function isPlatform(v: unknown): v is Platform {
  return typeof v === 'string' && v in PLATFORMS
}

/** Whether the OAuth credentials for a platform are present in the environment. */
export function isConfigured(platform: Platform): boolean {
  const def = PLATFORMS[platform]
  return Boolean(process.env[def.clientIdEnv] && process.env[def.clientSecretEnv])
}

/** Public-safe view of a platform for the UI (no secrets). */
export function platformStatus(platform: Platform) {
  const def = PLATFORMS[platform]
  return {
    id: def.id,
    label: def.label,
    icon: def.icon,
    configured: isConfigured(platform),
    note: def.note,
  }
}

// ── Token encryption (AES-256-GCM) ────────────────────────────────────────────
// OAuth tokens are secrets. We never store them in plaintext. The key is derived
// from SOCIAL_TOKEN_KEY (any string) via SHA-256 → 32 bytes. Format on disk:
//   v1:<iv-hex>:<authTag-hex>:<ciphertext-hex>
const ENC_PREFIX = 'v1:'

function getKey(): Buffer | null {
  const raw = process.env.SOCIAL_TOKEN_KEY
  if (!raw) return null
  return createHash('sha256').update(raw).digest() // 32 bytes
}

export function tokenEncryptionReady(): boolean {
  return Boolean(process.env.SOCIAL_TOKEN_KEY)
}

export function encryptToken(plaintext: string | null | undefined): string | null {
  if (!plaintext) return null
  const key = getKey()
  if (!key) throw new Error('SOCIAL_TOKEN_KEY is not set — cannot store OAuth tokens securely')
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${ENC_PREFIX}${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`
}

export function decryptToken(stored: string | null | undefined): string | null {
  if (!stored) return null
  if (!stored.startsWith(ENC_PREFIX)) return stored // tolerate legacy/plaintext
  const key = getKey()
  if (!key) throw new Error('SOCIAL_TOKEN_KEY is not set — cannot decrypt OAuth tokens')
  const [, ivHex, tagHex, dataHex] = stored.split(':')
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  const dec = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()])
  return dec.toString('utf8')
}

// ── Helpers ───────────────────────────────────────────────────────────────────
/** Canonical OAuth redirect URI for a platform callback. */
export function redirectUri(platform: Platform, origin: string): string {
  return `${origin.replace(/\/$/, '')}/api/poursona-admin/social/callback/${platform}`
}
