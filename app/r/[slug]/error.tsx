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
      background: 'linear-gradient(160deg,#0A0E15,#0F1B26)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      padding: 32,
      fontFamily: "'Space Grotesk', sans-serif",
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 40, marginBottom: 8 }}>✦</div>
      <div style={{ color: '#3FC6D4', fontSize: 11, letterSpacing: '.3em', textTransform: 'uppercase', marginBottom: 4 }}>
        CuvAi
      </div>
      <div style={{ color: '#E8EDF2', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
        Unable to load experience
      </div>
      <div style={{ color: '#6B7588', fontSize: 14, maxWidth: 300, lineHeight: 1.7, marginBottom: 24 }}>
        Something went wrong. Please scan the QR code again or ask a staff member for assistance.
      </div>
      <button
        onClick={reset}
        style={{
          padding: '14px 28px',
          background: 'linear-gradient(135deg,#3FC6D4,#2A9BA8)',
          border: 'none',
          borderRadius: 12,
          color: '#0A0E15',
          fontFamily: "'Space Grotesk', sans-serif",
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
