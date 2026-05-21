import { describe, it, expect } from 'vitest'
import { validateScrapeUrl } from '@/lib/security'

describe('validateScrapeUrl (SSRF guard)', () => {
  it('allows normal public http(s) URLs', () => {
    expect(validateScrapeUrl('https://chattanoogawhiskey.com').ok).toBe(true)
    expect(validateScrapeUrl('http://example.com/menu').ok).toBe(true)
  })

  it('rejects non-http(s) schemes', () => {
    for (const u of ['ftp://example.com', 'file:///etc/passwd', 'javascript:alert(1)', 'data:text/html,x']) {
      expect(validateScrapeUrl(u).ok, u).toBe(false)
    }
  })

  it('rejects embedded credentials', () => {
    expect(validateScrapeUrl('https://user:pass@example.com').ok).toBe(false)
  })

  it('blocks loopback and localhost', () => {
    for (const u of ['http://localhost', 'http://127.0.0.1', 'http://127.5.5.5', 'http://[::1]']) {
      expect(validateScrapeUrl(u).ok, u).toBe(false)
    }
  })

  it('blocks RFC1918 private ranges', () => {
    for (const u of ['http://10.0.0.1', 'http://192.168.1.1', 'http://172.16.0.1', 'http://172.31.255.255']) {
      expect(validateScrapeUrl(u).ok, u).toBe(false)
    }
  })

  it('allows public addresses adjacent to private ranges', () => {
    // 172.15 and 172.32 are NOT in the 172.16/12 private block
    expect(validateScrapeUrl('http://172.15.0.1').ok).toBe(true)
    expect(validateScrapeUrl('http://172.32.0.1').ok).toBe(true)
  })

  it('blocks link-local / cloud metadata and unspecified', () => {
    for (const u of ['http://169.254.169.254', 'http://0.0.0.0']) {
      expect(validateScrapeUrl(u).ok, u).toBe(false)
    }
  })

  it('blocks IPv6 unique-local and link-local', () => {
    for (const u of ['http://[fc00::1]', 'http://[fd12::1]', 'http://[fe80::1]']) {
      expect(validateScrapeUrl(u).ok, u).toBe(false)
    }
  })

  it('blocks internal TLDs', () => {
    expect(validateScrapeUrl('http://db.local').ok).toBe(false)
    expect(validateScrapeUrl('http://api.internal').ok).toBe(false)
  })

  it('rejects empty/garbage input', () => {
    expect(validateScrapeUrl('').ok).toBe(false)
    expect(validateScrapeUrl('not a url').ok).toBe(false)
    expect(validateScrapeUrl(null).ok).toBe(false)
  })
})
