import { Outlet, NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import {
  LayoutDashboard, ShoppingCart, Package, Receipt,
  Undo2, Users, Truck, ShoppingBag, BarChart3,
  Clock, Tag, Tags, UserCog, Settings, Store,
  Sun, Moon, LogOut, DollarSign
} from 'lucide-react'
import './Layout.css'

const NAV_SECTIONS = [
  {
    label: 'Operations',
    items: [
      { to: '/',         module: null,       label: 'nav.dashboard', icon: LayoutDashboard },
      { to: '/pos',      module: 'pos',      label: 'nav.pos',       icon: ShoppingCart },
      { to: '/invoices', module: 'invoices', label: 'nav.invoices',  icon: Receipt },
      { to: '/returns',  module: 'returns',  label: 'nav.returns',   icon: Undo2 },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { to: '/products',   module: 'products',  label: 'nav.products',    icon: Package },
      { to: '/categories', module: 'products',  label: 'nav.categories',  icon: Tags },
      { to: '/suppliers',  module: 'suppliers', label: 'nav.suppliers',   icon: Truck },
      { to: '/purchases',  module: 'purchases', label: 'nav.purchases',   icon: ShoppingBag },
    ],
  },
  {
    label: 'Management',
    items: [
      { to: '/customers', module: 'customers', label: 'nav.customers', icon: Users },
      { to: '/expenses',  module: 'expenses',  label: 'nav.expenses',  icon: DollarSign },
      { to: '/reports',   module: 'reports',   label: 'nav.reports',   icon: BarChart3 },
    ],
  },
  {
    label: 'Admin',
    adminOnly: true,
    items: [
      { to: '/shifts',     module: 'reports',   label: 'nav.shifts',     icon: Clock,    adminOnly: true },
      { to: '/promotions', module: 'settings',  label: 'nav.promotions', icon: Tag,      adminOnly: true },
      { to: '/users',      module: 'users',     label: 'nav.users',      icon: UserCog,  adminOnly: true },
      { to: '/settings',   module: 'settings',  label: 'nav.settings',   icon: Settings, adminOnly: true },
    ],
  },
]

export default function Layout() {
  const { t, i18n } = useTranslation()
  const { user, logout, canAccess } = useAuth()
  const { theme, toggle } = useTheme()

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng)
    localStorage.setItem('pos_locale', lng)
  }

  const isAdmin = user?.role === 'admin' || user?.role === 'manager'

  const displayName = user?.display_name
    || [user?.first_name, user?.last_name].filter(Boolean).join(' ')
    || user?.username
    || ''

  const isItemVisible = (item) => {
    if (item.adminOnly && !isAdmin) return false
    if (!item.module) return true
    return canAccess(item.module)
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="logo-icon-wrap">
            <Store size={20} />
          </div>
          <div>
            <span className="logo-text">ROVTAD POS</span>
            <span className="logo-sub">Point of Sale</span>
          </div>
        </div>

        {/* Nav Sections */}
        <nav className="sidebar-nav">
          {NAV_SECTIONS.map((section) => {
            if (section.adminOnly && !isAdmin) return null
            const visibleItems = section.items.filter(isItemVisible)
            if (visibleItems.length === 0) return null

            return (
              <div key={section.label}>
                <div className="nav-section-label">{section.label}</div>
                {visibleItems.map((item) => {
                  const Icon = item.icon
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === '/'}
                      title={t(item.label, item.label)}
                      className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    >
                      <span className="nav-icon"><Icon size={17} strokeWidth={2} /></span>
                      <span className="nav-label">{t(item.label, item.label)}</span>
                    </NavLink>
                  )
                })}
              </div>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">
              {(user?.first_name?.[0] || user?.username?.[0] || '?').toUpperCase()}
              <span className="avatar-status-dot" />
            </div>
            <div className="sidebar-user-info">
              <span className="user-name">{displayName}</span>
              <span className="user-role">{user?.role}</span>
            </div>
          </div>

          <div className="sidebar-controls">
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
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>

          <button className="logout-btn" onClick={logout}>
            <LogOut size={14} />
            {t('nav.logout', 'Logout')}
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}
