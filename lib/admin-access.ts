'use client'

export async function loadAdminAccess() {
  const res = await fetch('/api/admin/access', { cache: 'no-store' })
  return res.json()
}
