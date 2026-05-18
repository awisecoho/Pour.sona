'use client'

export default function GuestError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg,#0a0603,#0d1a0f)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      padding: 32,
      fontFamily: 'Georgia, serif',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 40, marginBottom: 8 }}>✦</div>
      <div style={{ color: '#C9A84C', fontSize: 11, letterSpacing: '.3em', textTransform: 'uppercase', marginBottom: 4 }}>
        Poursona
      </div>
      <div style={{ color: '#F5ECD7', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
        Unable to load experience
      </div>
      <div style={{ color: '#6a5a3a', fontSize: 14, maxWidth: 300, lineHeight: 1.7, marginBottom: 24 }}>
        Something went wrong. Please scan the QR code again or ask a staff member for assistance.
      </div>
      <button
        onClick={reset}
        style={{
          padding: '14px 28px',
          background: 'linear-gradient(135deg,#C9A84C,#a07830)',
          border: 'none',
          borderRadius: 12,
          color: '#0a0603',
          fontFamily: 'Georgia, serif',
          fontSize: 13,
          fontWeight: 700,
          cursor: 'pointer',
          letterSpacing: '.05em',
        }}
      >
        Try Again
      </button>
    </div>
  )
}
