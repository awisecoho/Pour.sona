#!/usr/bin/env node
/*
 * Mojibake guard.
 *
 * Scans source files for UTF-8 text that was mis-decoded as CP1252/Latin-1
 * (e.g. an em dash stored as "a-euro-trade", or a diamond stored as "a-em-circ").
 * This has bitten the admin UI repeatedly because some local editor re-saves
 * files in the wrong encoding. Runs in `prebuild`, so a corrupted glyph fails
 * the build instead of shipping garbled characters to production.
 *
 * Precision: the pattern only flags a Latin-1 lead code point (U+00C2 / U+00C3 /
 * U+00E2) IMMEDIATELY followed by another high/symbol code point -- the signature
 * of mis-decoded UTF-8. Correctly-encoded accents (cafe with acute, pate) and
 * real single-code-point glyphs/emoji are NOT matched. The pattern is built with
 * String.fromCharCode so this file stays pure ASCII and never trips its own check.
 */
const fs = require('fs')
const path = require('path')

const C = String.fromCharCode
const MOJIBAKE = new RegExp(
  '[' + C(0xC2) + C(0xC3) + '][' + C(0x80) + '-' + C(0xFF) + ']' +
  '|' + C(0xE2) + '[' + C(0x80) + '-' + C(0x2FF) + C(0x2010) + '-' + C(0x27BF) + ']'
)

const ROOT = path.resolve(__dirname, '..')
const SCAN_DIRS = ['app', 'lib', 'components', 'src']
const SCAN_FILES = ['middleware.ts']
const EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css', '.json', '.md'])
const SKIP = new Set(['node_modules', '.next', '.git', 'dist', 'build'])
const SELF = path.resolve(__filename)

const violations = []

function scanFile(file) {
  if (path.resolve(file) === SELF) return
  if (!EXTS.has(path.extname(file))) return
  const text = fs.readFileSync(file, 'utf8')
  text.split(/\r?\n/).forEach((line, i) => {
    if (MOJIBAKE.test(line)) {
      violations.push({ file: path.relative(ROOT, file), line: i + 1, text: line.trim().slice(0, 120) })
    }
  })
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full)
    else if (entry.isFile()) scanFile(full)
  }
}

for (const d of SCAN_DIRS) {
  const full = path.join(ROOT, d)
  if (fs.existsSync(full)) walk(full)
}
for (const f of SCAN_FILES) {
  const full = path.join(ROOT, f)
  if (fs.existsSync(full)) scanFile(full)
}

if (violations.length) {
  console.error('\nx Encoding check failed - mojibake (mis-decoded UTF-8) detected:\n')
  for (const v of violations) console.error(`  ${v.file}:${v.line}\n    ${v.text}`)
  console.error(`\n${violations.length} line(s) affected. Re-save the file(s) as UTF-8 with the correct glyphs.\n`)
  process.exit(1)
}

console.log('Encoding check passed - no mojibake found.')
