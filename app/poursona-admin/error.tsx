'use client'

export default function PoursonaAdminError({
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
      fontFamily: 'Georgia, serif',
      textAlign: 'center',
    }}>
      <div style={{ color: '#C9A84C', fontSize: 28, marginBottom: 4 }}>✦</div>
      <div style={{ color: '#F5ECD7', fontSize: 18, fontWeight: 700 }}>
        Command center error
      </div>
      <div style={{ color: '#6a5a3a', fontSize: 13, maxWidth: 340, lineHeight: 1.7, marginBottom: 16 }}>
        An unexpected error occurred in the admin panel. No data was lost — try reloading.
      </div>
      <button
        onClick={reset}
        style={{
          padding: '10px 24px',
          background: 'linear-gradient(135deg,#C9A84C,#a07830)',
          border: 'none',
          borderRadius: 8,
          color: '#0a0603',
          fontFamily: 'Georgia, serif',
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
