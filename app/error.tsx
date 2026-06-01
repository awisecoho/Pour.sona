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
      background: '#0A0E15',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: 16,
      padding: 32,
      fontFamily: "'Space Grotesk', sans-serif",
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 40, marginBottom: 8 }}>✦</div>
      <div style={{ color: '#3FC6D4', fontSize: 11, letterSpacing: '.3em', textTransform: 'uppercase', marginBottom: 4 }}>
        CuvAi
      </div>
      <div style={{ color: '#E8EDF2', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
        Something went wrong
      </div>
      <div style={{ color: '#6B7588', fontSize: 14, maxWidth: 360, lineHeight: 1.7, marginBottom: 24 }}>
        An unexpected error occurred. Our team has been notified.
      </div>
      <button
        onClick={reset}
        style={{
          padding: '12px 28px',
          background: 'linear-gradient(135deg,#3FC6D4,#2A9BA8)',
          border: 'none',
          borderRadius: 10,
          color: '#0A0E15',
          fontFamily: "'Space Grotesk', sans-serif",
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
