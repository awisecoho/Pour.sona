// next.config.js
const { withSentryConfig } = require('@sentry/nextjs')

// Baseline security headers for every route. No CSP yet — the app uses inline
// styles/scripts in places, so a strict CSP needs its own pass with report-only
// rollout first. SAMEORIGIN is safe: nothing in the app is iframe-embedded.
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), payment=()' },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

module.exports = withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Upload source maps only when SENTRY_AUTH_TOKEN is set (i.e. CI/production)
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
  automaticVercelMonitors: false,
})
