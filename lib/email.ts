import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM = 'Poursona <hello@pour-sona.com>'

// ── Order confirmation to the guest ──────────────────────────────────────────

export async function sendOrderConfirmation(opts: {
  to: string
  retailerName: string
  blendName: string
  items: Array<{ name: string; price?: number; qty?: number }>
  subtotal: number
}) {
  const { to, retailerName, blendName, items, subtotal } = opts
  const itemRows = items
    .map(i => `<tr><td style="padding:6px 0;color:#1a1108">${i.name}</td><td style="padding:6px 0;text-align:right;color:#1a1108">${i.qty && i.qty > 1 ? `×${i.qty} ` : ''}${i.price != null ? `$${(i.price * (i.qty || 1)).toFixed(2)}` : ''}</td></tr>`)
    .join('')

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Your order at ${retailerName} — ${blendName}`,
    html: `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f9f5ec;font-family:Georgia,serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 20px">
<table width="540" cellpadding="0" cellspacing="0" style="background:#0a0603;border-radius:16px;overflow:hidden">
  <tr><td style="padding:32px 40px;border-bottom:1px solid rgba(201,168,76,.15)">
    <div style="color:#C9A84C;font-size:11px;letter-spacing:.25em;text-transform:uppercase;margin-bottom:8px">Order Confirmed</div>
    <div style="color:#F5ECD7;font-size:24px;font-weight:700">${retailerName}</div>
  </td></tr>
  <tr><td style="padding:32px 40px">
    <div style="color:#C9A84C;font-size:11px;letter-spacing:.2em;text-transform:uppercase;margin-bottom:6px">Your Selection</div>
    <div style="color:#F5ECD7;font-size:20px;font-weight:700;margin-bottom:24px">${blendName}</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid rgba(201,168,76,.15);margin-bottom:16px">
      ${itemRows}
      <tr style="border-top:1px solid rgba(201,168,76,.15)">
        <td style="padding:10px 0;color:#C9A84C;font-weight:700">Total</td>
        <td style="padding:10px 0;text-align:right;color:#C9A84C;font-weight:700">$${subtotal.toFixed(2)}</td>
      </tr>
    </table>
    <div style="color:#4a3a1a;font-size:13px;line-height:1.6">Show this email at the counter when picking up your order.</div>
  </td></tr>
  <tr><td style="padding:24px 40px;border-top:1px solid rgba(201,168,76,.08)">
    <div style="color:#3a2a0a;font-size:11px;text-align:center">Powered by <a href="https://pour-sona.com" style="color:#C9A84C;text-decoration:none">Poursona</a></div>
  </td></tr>
</table>
</td></tr></table>
</body></html>`,
  }).catch(err => console.error('[email] sendOrderConfirmation failed:', err?.message))
}

// ── Trial expiration warning to vendor ───────────────────────────────────────

export async function sendTrialExpiredNotice(opts: {
  to: string
  retailerName: string
  upgradeUrl: string
}) {
  const { to, retailerName, upgradeUrl } = opts

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Your Poursona trial for ${retailerName} has ended`,
    html: `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f9f5ec;font-family:Georgia,serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 20px">
<table width="540" cellpadding="0" cellspacing="0" style="background:#0a0603;border-radius:16px;overflow:hidden">
  <tr><td style="padding:32px 40px;border-bottom:1px solid rgba(201,168,76,.15)">
    <div style="color:#C9A84C;font-size:11px;letter-spacing:.25em;text-transform:uppercase;margin-bottom:8px">Trial Ended</div>
    <div style="color:#F5ECD7;font-size:24px;font-weight:700">Keep your AI guide live</div>
  </td></tr>
  <tr><td style="padding:32px 40px">
    <div style="color:#F5ECD7;font-size:15px;line-height:1.7;margin-bottom:24px">
      Your Poursona trial for <strong style="color:#C9A84C">${retailerName}</strong> has ended and your guest experience is now paused.
    </div>
    <div style="color:#4a3a1a;font-size:13px;line-height:1.7;margin-bottom:28px">
      Upgrade to keep your QR guide live, continue collecting guest sessions, and access your full analytics dashboard.
    </div>
    <a href="${upgradeUrl}" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#C9A84C,#a07830);border-radius:8px;color:#060403;font-weight:700;text-decoration:none;font-size:14px">Upgrade Now →</a>
  </td></tr>
  <tr><td style="padding:24px 40px;border-top:1px solid rgba(201,168,76,.08)">
    <div style="color:#3a2a0a;font-size:11px;text-align:center">Questions? Reply to this email — we're here to help.</div>
  </td></tr>
</table>
</td></tr></table>
</body></html>`,
  }).catch(err => console.error('[email] sendTrialExpiredNotice failed:', err?.message))
}

// ── Vendor invite ────────────────────────────────────────────────────────────

export async function sendVendorInvite(opts: {
  to: string
  name: string | null
  retailerName: string
  adminUrl: string
}) {
  const { to, name, retailerName, adminUrl } = opts
  const greeting = name ? `Hi ${name},` : 'Hi there,'

  await resend.emails.send({
    from: FROM,
    to,
    subject: `You've been added to ${retailerName} on Poursona`,
    html: `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f9f5ec;font-family:Georgia,serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 20px">
<table width="540" cellpadding="0" cellspacing="0" style="background:#0a0603;border-radius:16px;overflow:hidden">
  <tr><td style="padding:32px 40px;border-bottom:1px solid rgba(201,168,76,.15)">
    <div style="color:#C9A84C;font-size:11px;letter-spacing:.25em;text-transform:uppercase;margin-bottom:8px">You're invited</div>
    <div style="color:#F5ECD7;font-size:24px;font-weight:700">${retailerName}</div>
  </td></tr>
  <tr><td style="padding:32px 40px">
    <div style="color:#F5ECD7;font-size:15px;line-height:1.7;margin-bottom:24px">
      ${greeting}<br><br>
      You've been added as an owner of <strong style="color:#C9A84C">${retailerName}</strong> on Poursona.
      Log in with your email to access the vendor portal.
    </div>
    <a href="${adminUrl}" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#C9A84C,#a07830);border-radius:8px;color:#060403;font-weight:700;text-decoration:none;font-size:14px">Go to Vendor Portal →</a>
  </td></tr>
  <tr><td style="padding:24px 40px;border-top:1px solid rgba(201,168,76,.08)">
    <div style="color:#3a2a0a;font-size:11px;text-align:center">Powered by <a href="https://pour-sona.com" style="color:#C9A84C;text-decoration:none">Poursona</a></div>
  </td></tr>
</table>
</td></tr></table>
</body></html>`,
  }).catch(err => console.error('[email] sendVendorInvite failed:', err?.message))
}

// ── New order alert to venue staff ───────────────────────────────────────────

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
}) {
  const { to, retailerName, blendName, customerName, customerEmail, items, subtotal, orderId, dashboardUrl } = opts
  const itemRows = items
    .map(i => `<tr><td style="padding:6px 0;color:#F5ECD7">${i.name}</td><td style="padding:6px 0;text-align:right;color:#F5ECD7">${i.qty && i.qty > 1 ? `×${i.qty} ` : ''}${i.price != null ? `$${(i.price * (i.qty || 1)).toFixed(2)}` : ''}</td></tr>`)
    .join('')
  const guestLine = customerName || customerEmail
    ? `<div style="color:#4a3a1a;font-size:13px;margin-top:16px">Guest: <strong style="color:#C9A84C">${customerName || customerEmail}</strong></div>`
    : ''

  await resend.emails.send({
    from: FROM,
    to,
    subject: `New order at ${retailerName} — ${blendName}`,
    html: `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f9f5ec;font-family:Georgia,serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 20px">
<table width="540" cellpadding="0" cellspacing="0" style="background:#0a0603;border-radius:16px;overflow:hidden">
  <tr><td style="padding:32px 40px;border-bottom:1px solid rgba(201,168,76,.15)">
    <div style="color:#5ecf8a;font-size:11px;letter-spacing:.25em;text-transform:uppercase;margin-bottom:8px">New Order</div>
    <div style="color:#F5ECD7;font-size:24px;font-weight:700">${retailerName}</div>
  </td></tr>
  <tr><td style="padding:32px 40px">
    <div style="color:#C9A84C;font-size:11px;letter-spacing:.2em;text-transform:uppercase;margin-bottom:6px">Selection</div>
    <div style="color:#F5ECD7;font-size:20px;font-weight:700;margin-bottom:20px">${blendName}</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid rgba(201,168,76,.15);margin-bottom:8px">
      ${itemRows}
      <tr style="border-top:1px solid rgba(201,168,76,.15)">
        <td style="padding:10px 0;color:#C9A84C;font-weight:700">Total</td>
        <td style="padding:10px 0;text-align:right;color:#C9A84C;font-weight:700">$${subtotal.toFixed(2)}</td>
      </tr>
    </table>
    ${guestLine}
    <div style="margin-top:28px">
      <a href="${dashboardUrl}" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#C9A84C,#a07830);border-radius:8px;color:#060403;font-weight:700;text-decoration:none;font-size:14px">View in Dashboard →</a>
    </div>
    <div style="color:#3a2a0a;font-size:11px;margin-top:16px">Order ID: ${orderId}</div>
  </td></tr>
</table>
</td></tr></table>
</body></html>`,
  }).catch(err => console.error('[email] sendOrderAlert failed:', err?.message))
}

// ── Trial expiring soon warning ───────────────────────────────────────────────

export async function sendTrialExpiringWarning(opts: {
  to: string
  retailerName: string
  daysLeft: number
  upgradeUrl: string
}) {
  const { to, retailerName, daysLeft, upgradeUrl } = opts

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Your Poursona trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
    html: `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f9f5ec;font-family:Georgia,serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 20px">
<table width="540" cellpadding="0" cellspacing="0" style="background:#0a0603;border-radius:16px;overflow:hidden">
  <tr><td style="padding:32px 40px;border-bottom:1px solid rgba(201,168,76,.15)">
    <div style="color:#e07070;font-size:11px;letter-spacing:.25em;text-transform:uppercase;margin-bottom:8px">${daysLeft} Day${daysLeft === 1 ? '' : 's'} Remaining</div>
    <div style="color:#F5ECD7;font-size:24px;font-weight:700">Your trial is ending soon</div>
  </td></tr>
  <tr><td style="padding:32px 40px">
    <div style="color:#F5ECD7;font-size:15px;line-height:1.7;margin-bottom:24px">
      <strong style="color:#C9A84C">${retailerName}</strong>'s Poursona trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. After that, your guest experience will pause until you upgrade.
    </div>
    <a href="${upgradeUrl}" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#C9A84C,#a07830);border-radius:8px;color:#060403;font-weight:700;text-decoration:none;font-size:14px">Upgrade Now →</a>
  </td></tr>
  <tr><td style="padding:24px 40px;border-top:1px solid rgba(201,168,76,.08)">
    <div style="color:#3a2a0a;font-size:11px;text-align:center">Powered by <a href="https://pour-sona.com" style="color:#C9A84C;text-decoration:none">Poursona</a></div>
  </td></tr>
</table>
</td></tr></table>
</body></html>`,
  }).catch(err => console.error('[email] sendTrialExpiringWarning failed:', err?.message))
}
