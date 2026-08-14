import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import api from '@/services/api'
import './LoginPage.css'

// ─── PIN Pad ──────────────────────────────────────────────────
function PinPad({ onComplete, disabled }) {
  const [pin, setPin] = useState('')

  const press = (digit) => {
    if (disabled) return
    const next = pin + digit
    if (next.length <= 6) {
      setPin(next)
      if (next.length === 6) {
        setTimeout(() => onComplete(next), 120) // slight delay for UX
      }
    }
  }

  const backspace = () => !disabled && setPin(p => p.slice(0, -1))
  const clear = () => !disabled && setPin('')

  useEffect(() => {
    if (!disabled) setPin('')
  }, [disabled])

  return (
    <div className="pin-pad-wrapper">
      {/* PIN dots */}
      <div className="pin-dots">
        {[0,1,2,3,4,5].map(i => (
          <div key={i} className={`pin-dot ${pin.length > i ? 'filled' : ''}`} />
        ))}
      </div>

      {/* Digit grid */}
      <div className="pin-grid">
        {[1,2,3,4,5,6,7,8,9].map(n => (
          <button key={n} className="pin-btn" onClick={() => press(String(n))} disabled={disabled}>
            {n}
          </button>
        ))}
        <button className="pin-btn pin-btn-clear" onClick={clear} disabled={disabled}>C</button>
        <button className="pin-btn" onClick={() => press('0')} disabled={disabled}>0</button>
        <button className="pin-btn pin-btn-back" onClick={backspace} disabled={disabled}>⌫</button>
      </div>
    </div>
  )
}

// ─── Cashier card ─────────────────────────────────────────────
function CashierCard({ cashier, selected, onClick }) {
  const initials = [cashier.first_name, cashier.last_name]
    .filter(Boolean).map(s => s[0].toUpperCase()).join('') || cashier.username[0].toUpperCase()

  return (
    <button
      className={`cashier-card ${selected ? 'selected' : ''}`}
      onClick={onClick}
    >
      <div className="cashier-avatar">
        {cashier.avatar_url
          ? <img src={cashier.avatar_url} alt={initials} />
          : <span>{initials}</span>}
      </div>
      <span className="cashier-name">
        {cashier.display_name || cashier.first_name || cashier.username}
      </span>
    </button>
  )
}

// ─── Main Login Page ──────────────────────────────────────────
export default function LoginPage() {
  const { t } = useTranslation()
  const { login, loginWithPin, isAuthenticated } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated) navigate('/')
  }, [isAuthenticated, navigate])

  const [mode, setMode] = useState('pin')          // 'pin' | 'password'
  const [cashiers, setCashiers] = useState([])
  const [selectedCashier, setSelectedCashier] = useState(null)
  const [loading, setLoading] = useState(false)
  const [pinError, setPinError] = useState('')

  // Password form
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    if (mode === 'pin') {
      api.get('/auth/cashiers').then(r => setCashiers(r.data.data)).catch(() => setCashiers([]))
    }
  }, [mode])

  const handlePinComplete = async (pin) => {
    if (!selectedCashier) { setPinError(t('auth.select_cashier_first', 'Please select a cashier first')); return }
    setPinError('')
    setLoading(true)
    try {
      await loginWithPin(selectedCashier.user_id, pin)
      toast.success(t('auth.welcome_back_name', 'Welcome back, {{name}}!', { name: selectedCashier.display_name || selectedCashier.first_name || selectedCashier.username }))
      navigate('/')
    } catch (err) {
      setPinError(err?.response?.data?.message || t('auth.incorrect_pin', 'Incorrect PIN'))
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordLogin = async (e) => {
    e.preventDefault()
    if (!username || !password) return
    setLoading(true)
    try {
      const u = await login(username, password)
      toast.success(t('auth.welcome_back_name', 'Welcome back, {{name}}!', { name: u.first_name || u.username }))
      navigate('/')
    } catch (err) {
      toast.error(err?.response?.data?.message || t('auth.login_failed', 'Login failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      {/* Animated background blobs */}
      <div className="login-bg">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
      </div>

      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-icon">🏪</div>
          <h1 className="login-logo-title">POS System</h1>
          <p className="login-logo-sub">{t('auth.welcome_back', 'Welcome back')}</p>
        </div>

        {/* Mode tabs */}
        <div className="login-tabs">
          <button
            className={`login-tab ${mode === 'pin' ? 'active' : ''}`}
            onClick={() => setMode('pin')}
          >
            🔢 {t('auth.cashier_pin', 'Cashier PIN')}
          </button>
          <button
            className={`login-tab ${mode === 'password' ? 'active' : ''}`}
            onClick={() => setMode('password')}
          >
            🔐 {t('auth.admin_login', 'Admin Login')}
          </button>
        </div>

        {/* ── PIN Mode ── */}
        {mode === 'pin' && (
          <div className="pin-mode">
            {cashiers.length === 0 ? (
              <div className="no-cashiers">
                <span>👤</span>
                <p>{t('auth.no_cashiers', 'No cashiers with PIN configured.')}</p>
                <button className="btn btn-secondary" onClick={() => setMode('password')}>
                  {t('auth.use_admin_login', 'Use Admin Login')}
                </button>
              </div>
            ) : (
              <>
                <p className="pin-prompt">{t('auth.select_profile', 'Select your profile')}</p>
                <div className="cashier-grid">
                  {cashiers.map(c => (
                    <CashierCard
                      key={c.user_id}
                      cashier={c}
                      selected={selectedCashier?.user_id === c.user_id}
                      onClick={() => { setSelectedCashier(c); setPinError('') }}
                    />
                  ))}
                </div>

                {selectedCashier && (
                  <div className="pin-section">
                    <p className="pin-selected-label">
                      {t('auth.enter_pin_for', 'Enter PIN for')} <strong>{selectedCashier.display_name || selectedCashier.first_name || selectedCashier.username}</strong>
                    </p>
                    <PinPad onComplete={handlePinComplete} disabled={loading} />
                    {pinError && <p className="pin-error">{pinError}</p>}
                    {loading && <p className="pin-verifying">{t('auth.verifying', 'Verifying...')}</p>}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Password Mode ── */}
        {mode === 'password' && (
          <form className="password-form" onSubmit={handlePasswordLogin}>
            <div className="form-group">
              <label htmlFor="lp-username">{t('auth.username', 'Username or Email')}</label>
              <input
                id="lp-username"
                className="input"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="admin"
                autoFocus
                autoComplete="username"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="lp-password">{t('auth.password', 'Password')}</label>
              <input
                id="lp-password"
                className="input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>
            <button
              type="submit"
              id="lp-submit"
              className="btn btn-primary btn-lg"
              style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
              disabled={loading}
            >
              {loading ? t('auth.signing_in', 'Signing in...') : t('auth.sign_in', 'Sign In')}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
