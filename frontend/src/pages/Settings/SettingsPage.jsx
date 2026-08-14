import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import api from '@/services/api'
import './SettingsPage.css'

const MODULES = [
  { key: 'pos',       label: 'Point of Sale',  icon: '🛒', desc: 'Access the POS screen to process sales' },
  { key: 'products',  label: 'Products',        icon: '📦', desc: 'View and manage products and inventory' },
  { key: 'invoices',  label: 'Invoices',        icon: '🧾', desc: 'View past sales and invoices' },
  { key: 'returns',   label: 'Returns',         icon: '↩️', desc: 'Process customer returns and refunds' },
  { key: 'customers', label: 'Customers',       icon: '👥', desc: 'Manage customer profiles' },
  { key: 'suppliers', label: 'Suppliers',       icon: '🏭', desc: 'Manage supplier information' },
  { key: 'purchases', label: 'Purchases',       icon: '📥', desc: 'Record stock purchases from suppliers' },
  { key: 'inventory', label: 'Inventory',       icon: '📊', desc: 'Stock movements and adjustments' },
  { key: 'reports',   label: 'Reports',         icon: '📈', desc: 'Sales and financial reports' },
  { key: 'expenses',  label: 'Expenses',        icon: '💸', desc: 'Record and track shop expenses' },
]

// These are always restricted to Admin/Manager regardless of toggle
const ADMIN_ONLY = ['users', 'settings']

function ToggleSwitch({ checked, onChange, disabled }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      className={`toggle-switch ${checked ? 'on' : 'off'} ${disabled ? 'disabled' : ''}`}
    >
      <span className="toggle-thumb" />
    </button>
  )
}

export default function SettingsPage() {
  const { t } = useTranslation()
  const { user, fetchPermissions } = useAuth()
  const toast = useToast()
  const isAdmin = user?.role === 'admin'

  const [permissions, setPermissions] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    api.get('/settings/module-permissions')
      .then(res => { setPermissions(res.data.data); setLoading(false) })
      .catch(() => { toast.error('Failed to load settings'); setLoading(false) })
  }, [toast])

  const toggle = (key) => {
    if (!isAdmin) return
    setPermissions(p => ({ ...p, [key]: !p[key] }))
    setDirty(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.put('/settings/module-permissions', permissions)
      await fetchPermissions() // refresh global context
      toast.success('Module permissions saved')
      setDirty(false)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const enableAll = () => {
    const all = {}
    MODULES.forEach(m => { all[m.key] = true })
    setPermissions(p => ({ ...p, ...all }))
    setDirty(true)
  }

  const disableAll = () => {
    const none = {}
    MODULES.forEach(m => { none[m.key] = false })
    setPermissions(p => ({ ...p, ...none }))
    setDirty(true)
  }

  return (
    <div className="settings-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('settings.title', 'Settings')}</h1>
          <p className="page-subtitle">{t('settings.subtitle', 'Control which modules are visible to cashiers')}</p>
        </div>
        {isAdmin && dirty && (
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? t('settings.saving', 'Saving...') : `💾 ${t('settings.save_changes', 'Save Changes')}`}
          </button>
        )}
      </div>

      {/* Module Permissions Panel */}
      <div className="settings-section">
        <div className="settings-section-header">
          <div>
            <h2>🔒 {t('settings.cashier_access_title', 'Cashier Module Access')}</h2>
            <p>{t('settings.cashier_access_desc', 'Toggle which modules are visible in the cashier\'s sidebar. Admins and managers always have full access.')}</p>
          </div>
          {isAdmin && (
            <div className="bulk-actions">
              <button className="btn btn-secondary" onClick={enableAll}>{t('settings.enable_all', 'Enable All')}</button>
              <button className="btn btn-secondary" onClick={disableAll}>{t('settings.disable_all', 'Disable All')}</button>
            </div>
          )}
        </div>

        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding: 48 }}><div className="spinner" /></div>
        ) : (
          <div className="module-grid">
            {MODULES.map(mod => (
              <div key={mod.key} className={`module-card ${permissions[mod.key] ? 'enabled' : 'disabled'}`}>
                <div className="module-icon">{mod.icon}</div>
                <div className="module-info">
                  <div className="module-name">{mod.label}</div>
                  <div className="module-desc">{mod.desc}</div>
                </div>
                <ToggleSwitch
                  checked={!!permissions[mod.key]}
                  onChange={() => toggle(mod.key)}
                  disabled={!isAdmin}
                />
              </div>
            ))}

            {/* Admin-only modules (always shown as locked) */}
            {ADMIN_ONLY.map(key => (
              <div key={key} className="module-card module-admin-only">
                <div className="module-icon">🔐</div>
                <div className="module-info">
                  <div className="module-name">{key === 'users' ? t('settings.user_management', 'User Management') : t('settings.settings', 'Settings')}</div>
                  <div className="module-desc">{t('settings.admin_only_desc', 'Admin & Manager only — cannot be granted to cashiers')}</div>
                </div>
                <span className="module-locked-badge">{t('settings.admin_only', 'Admin only')}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info card */}
      <div className="settings-info-card">
        <span>ℹ️</span>
        <p>{t('settings.info_card', 'Changes take effect immediately for all cashiers on their next page load or re-login. Existing sessions see the change on next navigation.')}</p>
      </div>
    </div>
  )
}
