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
      <div style={{ color: '#D67A31', fontSize: 28, marginBottom: 4 }}>✦</div>
      <div style={{ color: '#E8EDF2', fontSize: 18, fontWeight: 700 }}>
        Dashboard error
      </div>
      <div style={{ color: '#6B7588', fontSize: 13, maxWidth: 340, lineHeight: 1.7, marginBottom: 16 }}>
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
