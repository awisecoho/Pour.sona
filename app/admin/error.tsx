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
      fontFamily: "'Space Grotesk', sans-serif",
      textAlign: 'center',
    }}>
      <div style={{ color: '#3FC6D4', fontSize: 28, marginBottom: 4 }}>✦</div>
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
          background: 'linear-gradient(135deg,#3FC6D4,#2A9BA8)',
          border: 'none',
          borderRadius: 8,
          color: '#0A0E15',
          fontFamily: "'Space Grotesk', sans-serif",
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
