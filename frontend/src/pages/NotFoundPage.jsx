import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Home, AlertTriangle } from 'lucide-react'

export default function NotFoundPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '70vh',
      textAlign: 'center',
      gap: 24,
      padding: 40,
      animation: 'fade-up 0.4s ease both',
    }}>
      {/* Icon */}
      <div style={{
        width: 96, height: 96,
        borderRadius: 24,
        background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.08))',
        border: '1px solid rgba(99,102,241,0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'pulse-glow 3s ease infinite',
      }}>
        <AlertTriangle size={44} color="var(--accent-light)" strokeWidth={1.5} />
      </div>

      {/* 404 text */}
      <div>
        <div style={{
          fontSize: '6rem',
          fontWeight: 900,
          letterSpacing: '-0.05em',
          lineHeight: 1,
          background: 'linear-gradient(135deg, var(--text-primary) 40%, var(--accent-light))',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>404</div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: 12, marginBottom: 8 }}>
          {t('common.not_found', 'Page Not Found')}
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: 360, margin: '0 auto' }}>
          The page you're looking for doesn't exist or has been moved.
        </p>
      </div>

      <button
        className="btn btn-primary btn-lg"
        onClick={() => navigate('/')}
      >
        <Home size={17} />
        Go to Dashboard
      </button>
    </div>
  )
}
