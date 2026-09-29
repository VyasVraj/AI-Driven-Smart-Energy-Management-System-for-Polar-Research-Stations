export default function LoadingSpinner({ size = 'md', color = '#06B6D4' }) {
  const dim = { sm: 20, md: 32, lg: 48 }[size] || 32
  const bw  = { sm: 2, md: 3, lg: 4 }[size] || 3

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
      <div
        style={{
          width: dim, height: dim,
          border: `${bw}px solid rgba(6,182,212,0.15)`,
          borderTopColor: color,
          borderRadius: '50%',
          animation: 'spin 0.75s linear infinite',
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
