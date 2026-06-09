'use client'

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#12111A',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: 16,
      padding: 32,
      fontFamily: "var(--font-inter), system-ui, sans-serif",
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 40, marginBottom: 8 }}>✦</div>
      <div style={{ color: '#D67A31', fontSize: 11, letterSpacing: '.3em', textTransform: 'uppercase', marginBottom: 4 }}>
        Poursona
      </div>
      <div style={{ color: '#F5F2E8', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
        Something went wrong
      </div>
      <div style={{ color: '#6A6080', fontSize: 14, maxWidth: 360, lineHeight: 1.7, marginBottom: 24 }}>
        An unexpected error occurred. Our team has been notified.
      </div>
      <button
        onClick={reset}
        style={{
          padding: '12px 28px',
          background: 'linear-gradient(135deg,#D67A31,#612A86)',
          border: 'none',
          borderRadius: 10,
          color: '#12111A',
          fontFamily: "var(--font-inter), system-ui, sans-serif",
          fontSize: 13,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        Try Again
      </button>
    </div>
  )
}
