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
      background: 'linear-gradient(160deg,#12111A,#1A1530)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      padding: 32,
      fontFamily: "var(--font-inter), system-ui, sans-serif",
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 40, marginBottom: 8 }}>✦</div>
      <div style={{ color: '#D67A31', fontSize: 11, letterSpacing: '.3em', textTransform: 'uppercase', marginBottom: 4 }}>
        Poursona
      </div>
      <div style={{ color: '#F5F2E8', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
        Unable to load experience
      </div>
      <div style={{ color: '#6A6080', fontSize: 14, maxWidth: 300, lineHeight: 1.7, marginBottom: 24 }}>
        Something went wrong. Please scan the QR code again or ask a staff member for assistance.
      </div>
      <button
        onClick={reset}
        style={{
          padding: '14px 28px',
          background: 'linear-gradient(135deg,#D67A31,#612A86)',
          border: 'none',
          borderRadius: 12,
          color: '#12111A',
          fontFamily: "var(--font-inter), system-ui, sans-serif",
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
