/**
 * Regenerate Poursona brand assets from the locked master logo.
 *
 * Input:  public/brand/logo-source.png (630×616 — mark on top, wordmark below)
 * Output:
 *   app/icon.png              256×256 favicon (mark only, transparent bg)
 *   app/apple-icon.png        180×180 iOS touch icon (mark on dark bg)
 *   app/opengraph-image.jpg   1200×630 OG share image (full lockup on plum gradient)
 *   app/twitter-image.jpg     1200×630 Twitter card (mirror of OG)
 *   (deletes public/cuvai-logo.jpg if present)
 *
 * Run: node scripts/generate-brand-assets.js
 * Re-run any time the master logo changes — outputs are deterministic.
 */
const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const ROOT     = path.join(__dirname, '..')
const SRC      = path.join(ROOT, 'public', 'brand', 'logo-source.png')
const APP_DIR  = path.join(ROOT, 'app')
const PUB_DIR  = path.join(ROOT, 'public')

// Mark crop box inside the 630×616 source. Determined visually: the circular
// mark composition sits roughly in the top ~67% of the height, centered
// horizontally with a little vertical padding. Tweak if the source ever
// changes; everything downstream resizes off the cropped buffer.
const MARK_CROP = { left: 85, top: 15, width: 460, height: 420 }

// Poursona v2 palette (mirrors lib/brand.ts; kept here as constants so this
// script has no app dependencies).
const PLUM   = '#612A86'
const DARK   = '#12111A'
const COPPER = '#D67A31'

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`Missing source logo at ${SRC}`)
    process.exit(1)
  }

  // 1. Extract the mark only (no wordmark/tagline) so favicon reads at 16×16
  console.log('• Cropping mark from source…')
  const markBuf = await sharp(SRC)
    .extract(MARK_CROP)
    // Square pad to 512×512 with transparent background so resizes downstream
    // stay crisp regardless of target size.
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()

  // 2. Favicon — transparent background, mark only, 256×256
  console.log('• Writing app/icon.png (256×256 favicon)…')
  await sharp(markBuf)
    .resize(256, 256)
    .png()
    .toFile(path.join(APP_DIR, 'icon.png'))

  // 3. Apple touch icon — iOS rounds corners automatically; use a solid
  //    Poursona dark background and mark inset 10px on each side.
  console.log('• Writing app/apple-icon.png (180×180 iOS touch icon)…')
  const appleBg = await sharp({
    create: {
      width: 180, height: 180, channels: 4,
      background: { r: 18, g: 17, b: 26, alpha: 1 },  // BRAND.darkBg
    },
  }).png().toBuffer()
  const markInsetBuf = await sharp(markBuf).resize(160, 160).png().toBuffer()
  await sharp(appleBg)
    .composite([{ input: markInsetBuf, top: 10, left: 10 }])
    .png()
    .toFile(path.join(APP_DIR, 'apple-icon.png'))

  // 4. OG share image — 1200×630, plum-tinted radial glow on dark, full
  //    Poursona lockup (logo + wordmark + tagline) centered.
  console.log('• Writing app/opengraph-image.jpg (1200×630 social share)…')
  const ogBackdrop = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
      <defs>
        <radialGradient id="g" cx="50%" cy="50%" r="65%">
          <stop offset="0%" stop-color="${PLUM}" stop-opacity="0.35"/>
          <stop offset="60%" stop-color="${PLUM}" stop-opacity="0.08"/>
          <stop offset="100%" stop-color="${DARK}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="1200" height="630" fill="${DARK}"/>
      <rect width="1200" height="630" fill="url(#g)"/>
    </svg>`
  )

  // Use the full source lockup (mark + wordmark + tagline) at a comfortable
  // size for social previews. Cap height at 460px so there's breathing room.
  const fullLockup = await sharp(SRC)
    .resize(460, 460, { fit: 'inside' })
    .png()
    .toBuffer()
  const fullMeta = await sharp(fullLockup).metadata()
  const ogTop  = Math.round((630 - (fullMeta.height || 460)) / 2)
  const ogLeft = Math.round((1200 - (fullMeta.width || 460)) / 2)

  await sharp(ogBackdrop)
    .composite([{ input: fullLockup, top: ogTop, left: ogLeft }])
    .jpeg({ quality: 92 })
    .toFile(path.join(APP_DIR, 'opengraph-image.jpg'))

  // 5. Twitter card — mirror of OG. Twitter and Facebook spec the same
  //    1200×630 dimension for summary_large_image / og:image so we share
  //    the file content directly.
  console.log('• Writing app/twitter-image.jpg (mirror of OG)…')
  fs.copyFileSync(
    path.join(APP_DIR, 'opengraph-image.jpg'),
    path.join(APP_DIR, 'twitter-image.jpg')
  )

  // 6. Sweep the stale CuvAi orphan if it's still around.
  const cuvai = path.join(PUB_DIR, 'cuvai-logo.jpg')
  if (fs.existsSync(cuvai)) {
    fs.unlinkSync(cuvai)
    console.log('• Removed stale public/cuvai-logo.jpg')
  }

  console.log('Done.')
}

main().catch(err => { console.error(err); process.exit(1) })
