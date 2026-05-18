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
      background: '#0a0603',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: 16,
      padding: 32,
      fontFamily: 'Georgia, serif',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 40, marginBottom: 8 }}>✦</div>
      <div style={{ color: '#C9A84C', fontSize: 11, letterSpacing: '.3em', textTransform: 'uppercase', marginBottom: 4 }}>
        Poursona
      </div>
      <div style={{ color: '#F5ECD7', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
        Something went wrong
      </div>
      <div style={{ color: '#6a5a3a', fontSize: 14, maxWidth: 360, lineHeight: 1.7, marginBottom: 24 }}>
        An unexpected error occurred. Our team has been notified.
      </div>
      <button
        onClick={reset}
        style={{
          padding: '12px 28px',
          background: 'linear-gradient(135deg,#C9A84C,#a07830)',
          border: 'none',
          borderRadius: 10,
          color: '#0a0603',
          fontFamily: 'Georgia, serif',
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
