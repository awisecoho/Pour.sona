import { Resend } from 'resend'
import * as Sentry from '@sentry/nextjs'

let _resend: Resend | null = null
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

const FROM = 'Poursona <hello@pour-sona.com>'

// ── Shared result type ────────────────────────────────────────────────────────

export type EmailResult = {
  ok: boolean
  /** Human-readable error message when ok === false */
  error?: string
  /** Resend message ID when ok === true */
  providerId?: string
}

// ── Internal send wrapper ─────────────────────────────────────────────────────
// Handles Resend API/network errors and surfaces them as structured results
// instead of throwing. Logs all failures to console and Sentry so they are
// observable without crashing the caller.

async function sendEmail(
  params: Parameters<Resend['emails']['send']>[0]
): Promise<EmailResult> {
  try {
    const { data, error } = await getResend().emails.send(params)
    if (error) {
      const msg = (error as any).message || JSON.stringify(error)
      console.error('[email] send failed:', params.subject, msg)
      Sentry.captureException(new Error(msg), {
        extra: { subject: params.subject, to: params.to },
      })
      return { ok: false, error: msg }
    }
    return { ok: true, providerId: data?.id }
  } catch (err: any) {
    const msg = err?.message || 'Unknown email error'
    console.error('[email] send threw:', params.subject, msg)
    Sentry.captureException(err, {
      extra: { subject: params.subject, to: params.to },
    })
    return { ok: false, error: msg }
  }
}

// ── Order confirmation to the guest ──────────────────────────────────────────

export async function sendOrderConfirmation(opts: {
  to: string
  retailerName: string
  blendName: string
  items: Array<{ name: string; price?: number; qty?: number }>
  subtotal: number
}): Promise<EmailResult> {
  const { to, retailerName, blendName, items, subtotal } = opts
  const itemRows = items
    .map(
      i =>
        `<tr><td style="padding:6px 0;color:#F5F2E8">${i.name}</td>` +
        `<td style="padding:6px 0;text-align:right;color:#F5F2E8">` +
        `${i.qty && i.qty > 1 ? `×${i.qty} ` : ''}` +
        `${i.price != null ? `$${(i.price * (i.qty || 1)).toFixed(2)}` : ''}</td></tr>`
    )
    .join('')

  return sendEmail({
    from: FROM,
    to,
    subject: `Your order at ${retailerName} — ${blendName}`,
    html: `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F5F2E8;font-family:Inter, 'Helvetica Neue', Arial, sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 20px">
<table width="540" cellpadding="0" cellspacing="0" style="background:#12111A;border-radius:16px;overflow:hidden">
  <tr><td style="padding:32px 40px;border-bottom:1px solid rgba(97,42,134,.15)">
    <div style="color:#D67A31;font-size:11px;letter-spacing:.25em;text-transform:uppercase;margin-bottom:8px">Order Confirmed</div>
    <div style="color:#F5F2E8;font-size:24px;font-weight:700">${retailerName}</div>
  </td></tr>
  <tr><td style="padding:32px 40px">
    <div style="color:#D67A31;font-size:11px;letter-spacing:.2em;text-transform:uppercase;margin-bottom:6px">Your Selection</div>
    <div style="color:#F5F2E8;font-size:20px;font-weight:700;margin-bottom:24px">${blendName}</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid rgba(97,42,134,.15);margin-bottom:16px">
      ${itemRows}
      <tr style="border-top:1px solid rgba(97,42,134,.15)">
        <td style="padding:10px 0;color:#D67A31;font-weight:700">Total</td>
        <td style="padding:10px 0;text-align:right;color:#D67A31;font-weight:700">$${subtotal.toFixed(2)}</td>
      </tr>
    </table>
    <div style="color:#3A3450;font-size:13px;line-height:1.6">Show this email at the counter when picking up your order.</div>
  </td></tr>
  <tr><td style="padding:24px 40px;border-top:1px solid rgba(97,42,134,.08)">
    <div style="color:#3A3450;font-size:11px;text-align:center">Powered by <a href="https://pour-sona.com" style="color:#D67A31;text-decoration:none">Poursona</a></div>
  </td></tr>
</table>
</td></tr></table>
</body></html>`,
  })
}

// ── Trial expired notice to vendor ────────────────────────────────────────────

export async function sendTrialExpiredNotice(opts: {
  to: string
  retailerName: string
  upgradeUrl: string
}): Promise<EmailResult> {
  const { to, retailerName, upgradeUrl } = opts

  return sendEmail({
    from: FROM,
    to,
    subject: `Your Poursona trial for ${retailerName} has ended`,
    html: `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F5F2E8;font-family:Inter, 'Helvetica Neue', Arial, sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 20px">
<table width="540" cellpadding="0" cellspacing="0" style="background:#12111A;border-radius:16px;overflow:hidden">
  <tr><td style="padding:32px 40px;border-bottom:1px solid rgba(97,42,134,.15)">
    <div style="color:#D67A31;font-size:11px;letter-spacing:.25em;text-transform:uppercase;margin-bottom:8px">Trial Ended</div>
    <div style="color:#F5F2E8;font-size:24px;font-weight:700">Keep your AI guide live</div>
  </td></tr>
  <tr><td style="padding:32px 40px">
    <div style="color:#F5F2E8;font-size:15px;line-height:1.7;margin-bottom:24px">
      Your Poursona trial for <strong style="color:#D67A31">${retailerName}</strong> has ended and your guest experience is now paused.
    </div>
    <div style="color:#3A3450;font-size:13px;line-height:1.7;margin-bottom:28px">
      Upgrade to keep your QR guide live, continue collecting guest sessions, and access your full analytics dashboard.
    </div>
    <a href="${upgradeUrl}" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#D67A31,#612A86);border-radius:8px;color:#12111A;font-weight:700;text-decoration:none;font-size:14px">Upgrade Now →</a>
  </td></tr>
  <tr><td style="padding:24px 40px;border-top:1px solid rgba(97,42,134,.08)">
    <div style="color:#3A3450;font-size:11px;text-align:center">Questions? Reply to this email — we're here to help.</div>
  </td></tr>
</table>
</td></tr></table>
</body></html>`,
  })
}

// ── Vendor invite ─────────────────────────────────────────────────────────────

export async function sendVendorInvite(opts: {
  to: string
  name: string | null
  retailerName: string
  adminUrl: string
}): Promise<EmailResult> {
  const { to, name, retailerName, adminUrl } = opts
  const greeting = name ? `Hi ${name},` : 'Hi there,'

  return sendEmail({
    from: FROM,
    to,
    subject: `You've been added to ${retailerName} on Poursona`,
    html: `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F5F2E8;font-family:Inter, 'Helvetica Neue', Arial, sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 20px">
<table width="540" cellpadding="0" cellspacing="0" style="background:#12111A;border-radius:16px;overflow:hidden">
  <tr><td style="padding:32px 40px;border-bottom:1px solid rgba(97,42,134,.15)">
    <div style="color:#D67A31;font-size:11px;letter-spacing:.25em;text-transform:uppercase;margin-bottom:8px">You're invited</div>
    <div style="color:#F5F2E8;font-size:24px;font-weight:700">${retailerName}</div>
  </td></tr>
  <tr><td style="padding:32px 40px">
    <div style="color:#F5F2E8;font-size:15px;line-height:1.7;margin-bottom:24px">
      ${greeting}<br><br>
      You've been added as an owner of <strong style="color:#D67A31">${retailerName}</strong> on Poursona.
      Log in with your email to access the vendor portal.
    </div>
    <a href="${adminUrl}" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#D67A31,#612A86);border-radius:8px;color:#12111A;font-weight:700;text-decoration:none;font-size:14px">Go to Vendor Portal →</a>
  </td></tr>
  <tr><td style="padding:24px 40px;border-top:1px solid rgba(97,42,134,.08)">
    <div style="color:#3A3450;font-size:11px;text-align:center">Powered by <a href="https://pour-sona.com" style="color:#D67A31;text-decoration:none">Poursona</a></div>
  </td></tr>
</table>
</td></tr></table>
</body></html>`,
  })
}

// ── New order alert to venue staff ────────────────────────────────────────────

export async function sendOrderAlert(opts: {
  to: string
  retailerName: string
  blendName: string
  customerName: string | null
  customerEmail: string | null
  items: Array<{ name: string; price?: number; qty?: number }>
  subtotal: number
  orderId: string
  dashboardUrl: string
}): Promise<EmailResult> {
  const { to, retailerName, blendName, customerName, customerEmail, items, subtotal, orderId, dashboardUrl } = opts
  const itemRows = items
    .map(
      i =>
        `<tr><td style="padding:6px 0;color:#F5F2E8">${i.name}</td>` +
        `<td style="padding:6px 0;text-align:right;color:#F5F2E8">` +
        `${i.qty && i.qty > 1 ? `×${i.qty} ` : ''}` +
        `${i.price != null ? `$${(i.price * (i.qty || 1)).toFixed(2)}` : ''}</td></tr>`
    )
    .join('')
  const guestLine =
    customerName || customerEmail
      ? `<div style="color:#3A3450;font-size:13px;margin-top:16px">Guest: <strong style="color:#D67A31">${customerName || customerEmail}</strong></div>`
      : ''

  return sendEmail({
    from: FROM,
    to,
    subject: `New order at ${retailerName} — ${blendName}`,
    html: `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F5F2E8;font-family:Inter, 'Helvetica Neue', Arial, sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 20px">
<table width="540" cellpadding="0" cellspacing="0" style="background:#12111A;border-radius:16px;overflow:hidden">
  <tr><td style="padding:32px 40px;border-bottom:1px solid rgba(97,42,134,.15)">
    <div style="color:#5ecf8a;font-size:11px;letter-spacing:.25em;text-transform:uppercase;margin-bottom:8px">New Order</div>
    <div style="color:#F5F2E8;font-size:24px;font-weight:700">${retailerName}</div>
  </td></tr>
  <tr><td style="padding:32px 40px">
    <div style="color:#D67A31;font-size:11px;letter-spacing:.2em;text-transform:uppercase;margin-bottom:6px">Selection</div>
    <div style="color:#F5F2E8;font-size:20px;font-weight:700;margin-bottom:20px">${blendName}</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid rgba(97,42,134,.15);margin-bottom:8px">
      ${itemRows}
      <tr style="border-top:1px solid rgba(97,42,134,.15)">
        <td style="padding:10px 0;color:#D67A31;font-weight:700">Total</td>
        <td style="padding:10px 0;text-align:right;color:#D67A31;font-weight:700">$${subtotal.toFixed(2)}</td>
      </tr>
    </table>
    ${guestLine}
    <div style="margin-top:28px">
      <a href="${dashboardUrl}" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#D67A31,#612A86);border-radius:8px;color:#12111A;font-weight:700;text-decoration:none;font-size:14px">View in Dashboard →</a>
    </div>
    <div style="color:#3A3450;font-size:11px;margin-top:16px">Order ID: ${orderId}</div>
  </td></tr>
</table>
</td></tr></table>
</body></html>`,
  })
}

// ── Onboarding concierge note to the venue (sparse catalog) ───────────────────
// Sent at publish time when the auto-scrape produced a thin catalog. Reassures
// the venue that our team is finishing setup (self-serve should still feel premium).

export async function sendOnboardingConcierge(opts: {
  to: string
  retailerName: string
  productCount: number
  adminUrl: string
}): Promise<EmailResult> {
  const { to, retailerName, productCount, adminUrl } = opts
  return sendEmail({
    from: FROM,
    to,
    subject: `We're putting the finishing touches on ${retailerName}`,
    html: `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F5F2E8;font-family:Inter, 'Helvetica Neue', Arial, sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 20px">
<table width="540" cellpadding="0" cellspacing="0" style="background:#12111A;border-radius:16px;overflow:hidden">
  <tr><td style="padding:32px 40px;border-bottom:1px solid rgba(97,42,134,.15)">
    <div style="color:#D67A31;font-size:11px;letter-spacing:.25em;text-transform:uppercase;margin-bottom:8px">Almost ready</div>
    <div style="color:#F5F2E8;font-size:22px;font-weight:700">${retailerName} is set up</div>
  </td></tr>
  <tr><td style="padding:32px 40px">
    <div style="color:#F5F2E8;font-size:15px;line-height:1.7;margin-bottom:16px">
      Your Poursona guide is live! Our automatic setup pulled in ${productCount} item${productCount === 1 ? '' : 's'} from your website — if your full menu is larger, our team is reviewing it now and will fill in the rest within a few hours.
    </div>
    <div style="color:#3A3450;font-size:13px;line-height:1.7;margin-bottom:24px">
      You can add, edit, or remove items anytime from your dashboard — no need to wait on us.
    </div>
    <a href="${adminUrl}" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#D67A31,#612A86);border-radius:8px;color:#12111A;font-weight:700;text-decoration:none;font-size:14px">Open your dashboard →</a>
  </td></tr>
  <tr><td style="padding:24px 40px;border-top:1px solid rgba(97,42,134,.08)">
    <div style="color:#3A3450;font-size:11px;text-align:center">Questions? Reply to this email — a real person will help.</div>
  </td></tr>
</table>
</td></tr></table>
</body></html>`,
  })
}

// ── AI monthly budget reached (upsell + transparency to venue) ────────────────

export async function sendAiCapNotice(opts: {
  to: string
  retailerName: string
  upgradeUrl: string
}): Promise<EmailResult> {
  const { to, retailerName, upgradeUrl } = opts
  return sendEmail({
    from: FROM,
    to,
    subject: `Your Poursona AI guide is having a busy month — ${retailerName}`,
    html: `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F5F2E8;font-family:Inter, 'Helvetica Neue', Arial, sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 20px">
<table width="540" cellpadding="0" cellspacing="0" style="background:#12111A;border-radius:16px;overflow:hidden">
  <tr><td style="padding:32px 40px;border-bottom:1px solid rgba(97,42,134,.15)">
    <div style="color:#D67A31;font-size:11px;letter-spacing:.25em;text-transform:uppercase;margin-bottom:8px">Great Month!</div>
    <div style="color:#F5F2E8;font-size:22px;font-weight:700">${retailerName} hit its AI usage cap</div>
  </td></tr>
  <tr><td style="padding:32px 40px">
    <div style="color:#F5F2E8;font-size:15px;line-height:1.7;margin-bottom:16px">
      Your guests have been loving the Poursona guide — you've reached this month's included AI usage. To keep the full AI experience running for the rest of the month, upgrade your plan.
    </div>
    <div style="color:#3A3450;font-size:13px;line-height:1.7;margin-bottom:24px">
      In the meantime, guests still see a curated recommendation so the experience never goes dark. Usage resets at the start of next month.
    </div>
    <a href="${upgradeUrl}" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#D67A31,#612A86);border-radius:8px;color:#12111A;font-weight:700;text-decoration:none;font-size:14px">Upgrade to keep AI active →</a>
  </td></tr>
  <tr><td style="padding:24px 40px;border-top:1px solid rgba(97,42,134,.08)">
    <div style="color:#3A3450;font-size:11px;text-align:center">Questions? Reply to this email — we're here to help.</div>
  </td></tr>
</table>
</td></tr></table>
</body></html>`,
  })
}

export async function sendAiBudgetWarning(opts: {
  to: string
  retailerName: string
  pct: number
  upgradeUrl: string
}): Promise<EmailResult> {
  const { to, retailerName, pct, upgradeUrl } = opts
  return sendEmail({
    from: FROM,
    to,
    subject: `${retailerName} is at ${pct}% of this month's AI usage`,
    html: `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F5F2E8;font-family:Inter, 'Helvetica Neue', Arial, sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 20px">
<table width="540" cellpadding="0" cellspacing="0" style="background:#12111A;border-radius:16px;overflow:hidden">
  <tr><td style="padding:32px 40px;border-bottom:1px solid rgba(97,42,134,.15)">
    <div style="color:#D67A31;font-size:11px;letter-spacing:.25em;text-transform:uppercase;margin-bottom:8px">Heads Up</div>
    <div style="color:#F5F2E8;font-size:22px;font-weight:700">${retailerName} is at ${pct}% of AI usage</div>
  </td></tr>
  <tr><td style="padding:32px 40px">
    <div style="color:#F5F2E8;font-size:15px;line-height:1.7;margin-bottom:16px">
      Your guests are loving the Poursona guide — you've used ${pct}% of this month's included AI. If you cross 100%, guests will still get a curated recommendation, but the live AI conversation pauses until next month.
    </div>
    <a href="${upgradeUrl}" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#D67A31,#612A86);border-radius:8px;color:#12111A;font-weight:700;text-decoration:none;font-size:14px">View plans →</a>
  </td></tr>
  <tr><td style="padding:24px 40px;border-top:1px solid rgba(97,42,134,.08)">
    <div style="color:#3A3450;font-size:11px;text-align:center">Usage resets at the start of next month.</div>
  </td></tr>
</table>
</td></tr></table>
</body></html>`,
  })
}

// ── Failed / sparse scrape alert to Poursona admin ────────────────────────────
// Self-serve onboarding has no human in the loop, so when the catalog scrape
// comes back empty or thin we notify the admin team to finish setup (concierge).

export async function sendScrapeAlert(opts: {
  to: string | string[]
  url: string
  status: 'failed' | 'sparse'
  productCount: number
  issues: string[]
  draftId?: string | null
  venueName?: string | null
  reviewUrl?: string
}): Promise<EmailResult> {
  const { to, url, status, productCount, issues, draftId, venueName, reviewUrl } = opts
  const headline = status === 'failed' ? 'Scrape failed — manual setup needed' : 'Thin scrape — review recommended'
  const accent = status === 'failed' ? '#e07070' : '#D67A31'
  const issueRows = issues.length
    ? issues.map(i => `<li style="margin:4px 0">${i}</li>`).join('')
    : '<li style="margin:4px 0">No specific issues flagged</li>'

  return sendEmail({
    from: FROM,
    to,
    subject: `[Poursona] ${status === 'failed' ? 'Scrape FAILED' : 'Thin scrape'} — ${venueName || url}`,
    html: `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F5F2E8;font-family:Inter, 'Helvetica Neue', Arial, sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 20px">
<table width="540" cellpadding="0" cellspacing="0" style="background:#12111A;border-radius:16px;overflow:hidden">
  <tr><td style="padding:32px 40px;border-bottom:1px solid rgba(97,42,134,.15)">
    <div style="color:${accent};font-size:11px;letter-spacing:.25em;text-transform:uppercase;margin-bottom:8px">Onboarding Alert</div>
    <div style="color:#F5F2E8;font-size:22px;font-weight:700">${headline}</div>
  </td></tr>
  <tr><td style="padding:32px 40px">
    <div style="color:#F5F2E8;font-size:14px;line-height:1.7;margin-bottom:16px">
      A self-serve onboarding for <strong style="color:#D67A31">${venueName || url}</strong> needs attention.
    </div>
    <div style="color:#3A3450;font-size:13px;line-height:1.8">
      URL: <a href="${url}" style="color:#D67A31">${url}</a><br>
      Products extracted: <strong style="color:#F5F2E8">${productCount}</strong><br>
      ${draftId ? `Draft ID: ${draftId}<br>` : ''}
    </div>
    <div style="color:#D67A31;font-size:11px;letter-spacing:.2em;text-transform:uppercase;margin:20px 0 6px">Issues</div>
    <ul style="color:#A89FB8;font-size:13px;line-height:1.6;margin:0;padding-left:18px">${issueRows}</ul>
    ${reviewUrl ? `<div style="margin-top:24px"><a href="${reviewUrl}" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#D67A31,#612A86);border-radius:8px;color:#12111A;font-weight:700;text-decoration:none;font-size:13px">Review in Admin →</a></div>` : ''}
  </td></tr>
</table>
</td></tr></table>
</body></html>`,
  })
}

// ── Trial expiring soon warning ───────────────────────────────────────────────

export async function sendTrialExpiringWarning(opts: {
  to: string
  retailerName: string
  daysLeft: number
  upgradeUrl: string
}): Promise<EmailResult> {
  const { to, retailerName, daysLeft, upgradeUrl } = opts

  return sendEmail({
    from: FROM,
    to,
    subject: `Your Poursona trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
    html: `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F5F2E8;font-family:Inter, 'Helvetica Neue', Arial, sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 20px">
<table width="540" cellpadding="0" cellspacing="0" style="background:#12111A;border-radius:16px;overflow:hidden">
  <tr><td style="padding:32px 40px;border-bottom:1px solid rgba(97,42,134,.15)">
    <div style="color:#e07070;font-size:11px;letter-spacing:.25em;text-transform:uppercase;margin-bottom:8px">${daysLeft} Day${daysLeft === 1 ? '' : 's'} Remaining</div>
    <div style="color:#F5F2E8;font-size:24px;font-weight:700">Your trial is ending soon</div>
  </td></tr>
  <tr><td style="padding:32px 40px">
    <div style="color:#F5F2E8;font-size:15px;line-height:1.7;margin-bottom:24px">
      <strong style="color:#D67A31">${retailerName}</strong>'s Poursona trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. After that, your guest experience will pause until you upgrade.
    </div>
    <a href="${upgradeUrl}" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#D67A31,#612A86);border-radius:8px;color:#12111A;font-weight:700;text-decoration:none;font-size:14px">Upgrade Now →</a>
  </td></tr>
  <tr><td style="padding:24px 40px;border-top:1px solid rgba(97,42,134,.08)">
    <div style="color:#3A3450;font-size:11px;text-align:center">Powered by <a href="https://pour-sona.com" style="color:#D67A31;text-decoration:none">Poursona</a></div>
  </td></tr>
</table>
</td></tr></table>
</body></html>`,
  })
}
