const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://pour-sona.com'

export const storefrontUrl = (slug: string) => `${BASE}/r/${slug}`
export const adminUrl      = (path = '')     => `${BASE}/admin${path}`
export const billingUrl    = ()              => `${BASE}/admin/billing`
export const ordersUrl     = ()              => `${BASE}/admin/orders`
