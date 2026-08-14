import { Outlet, NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import './Layout.css'

const ALL_NAV = [
  { to: '/',          module: null,       label: 'nav.dashboard',  icon: '📊' },
  { to: '/pos',       module: 'pos',      label: 'nav.pos',        icon: '🛒' },
  { to: '/products',  module: 'products', label: 'nav.products',   icon: '📦' },
  { to: '/invoices',  module: 'invoices', label: 'nav.invoices',   icon: '🧾' },
  { to: '/returns',   module: 'returns',  label: 'nav.returns',    icon: '↩️' },
  { to: '/customers', module: 'customers',label: 'nav.customers',  icon: '👥' },
  { to: '/suppliers', module: 'suppliers',label: 'nav.suppliers',  icon: '🏭' },
  { to: '/purchases', module: 'purchases',label: 'nav.purchases',  icon: '📥' },
  { to: '/reports',   module: 'reports',  label: 'nav.reports',    icon: '📈' },
  { to: '/shifts',    module: 'reports',  label: 'Shifts',         icon: '🕒', adminOnly: true },
  { to: '/promotions',module: 'settings', label: 'Promotions',     icon: '🏷️', adminOnly: true },
  { to: '/users',     module: 'users',    label: 'nav.users',      icon: '🧑‍💼', adminOnly: true },
  { to: '/settings',  module: 'settings', label: 'nav.settings',   icon: '⚙️', adminOnly: true },
]

export default function Layout() {
  const { t, i18n } = useTranslation()
  const { user, logout, canAccess } = useAuth()
  const { theme, toggle } = useTheme()

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng)
    localStorage.setItem('pos_locale', lng)
  }

  const visibleNav = ALL_NAV.filter(item => {
    if (item.adminOnly) return user?.role === 'admin' || user?.role === 'manager'
    if (!item.module) return true
    return canAccess(item.module)
  })

  const displayName = user?.display_name
    || [user?.first_name, user?.last_name].filter(Boolean).join(' ')
    || user?.username
    || ''

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span className="logo-icon">🏪</span>
          <span className="logo-text">POS System</span>
        </div>

        <nav className="sidebar-nav">
          {visibleNav.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{t(item.label)}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">
              {(user?.first_name?.[0] || user?.username?.[0] || '?').toUpperCase()}
            </div>
            <div className="sidebar-user-info">
              <span className="user-name">{displayName}</span>
              <span className="user-role">{user?.role}</span>
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              <select 
                className="lang-switcher" 
                value={i18n.language} 
                onChange={e => changeLanguage(e.target.value)}
                title="Change Language"
              >
                <option value="en">EN</option>
                <option value="si">SI</option>
              </select>
              <button className="theme-toggle" onClick={toggle} title="Toggle theme">
                {theme === 'dark' ? '☀️' : '🌙'}
              </button>
            </div>
          </div>
          <button className="logout-btn" onClick={logout}>
            🚪 {t('nav.logout')}
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}
