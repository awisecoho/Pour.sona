'use client'

let inFlight: Promise<any> | null = null
let lastLoadedAt = 0
let lastValue: any = null

export async function loadAdminAccess() {
  const now = Date.now()
  if (lastValue && now - lastLoadedAt < 5000) {
    return lastValue
  }

  if (!inFlight) {
    inFlight = fetch('/api/admin/access', { cache: 'no-store' })
      .then(async (res) => {
        const json = await res.json()
        lastValue = json
        lastLoadedAt = Date.now()
        return json
      })
      .finally(() => {
        inFlight = null
      })
  }

  return inFlight
}
