'use client'

export default function AdminError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div style={{
      padding: '60px 32px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 16,
      fontFamily: "var(--font-inter), system-ui, sans-serif",
      textAlign: 'center',
    }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/logo-source.png" alt="Poursona" style={{ height: 48, width: 'auto', display: 'block', marginBottom: 4 }} />
      <div style={{ color: '#F5F2E8', fontSize: 18, fontWeight: 700 }}>
        Dashboard error
      </div>
      <div style={{ color: '#6A6080', fontSize: 13, maxWidth: 340, lineHeight: 1.7, marginBottom: 16 }}>
        This section could not be loaded. Your data is safe — try reloading.
      </div>
      <button
        onClick={reset}
        style={{
          padding: '10px 24px',
          background: 'linear-gradient(135deg,#D67A31,#612A86)',
          border: 'none',
          borderRadius: 8,
          color: '#12111A',
          fontFamily: "var(--font-inter), system-ui, sans-serif",
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        Reload
      </button>
    </div>
  )
}
