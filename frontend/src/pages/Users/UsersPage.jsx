import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import api from '@/services/api'
import './UsersPage.css'


const ROLES = ['admin', 'manager', 'cashier']

const ROLE_BADGE = {
  admin: 'badge-danger',
  manager: 'badge-warning',
  cashier: 'badge-info',
}

// ─── User Form Modal ──────────────────────────────────────────
function UserModal({ user, onClose, onSaved }) {
  const { t } = useTranslation()
  const toast = useToast()
  const isEdit = !!user
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    username: user?.username || '',
    email: user?.email || '',
    phone: user?.phone || '',
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    display_name: user?.display_name || '',
    role: user?.role || 'cashier',
    password: '',
    is_active: user?.is_active ?? true,
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const payload = { ...form }
      if (isEdit && !payload.password) delete payload.password
      if (isEdit) {
        await api.put(`/users/${user.user_id}`, payload)
        toast.success(t('users.user_updated', 'User updated'))
      } else {
        await api.post('/users', payload)
        toast.success(t('users.user_created', 'User created'))
      }
      onSaved()
    } catch (err) {
      toast.error(err?.response?.data?.message || t('users.save_failed', 'Failed to save user'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? t('users.edit_user', 'Edit User') : t('users.create_user', 'Create User')}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-row">
            <div className="form-group">
              <label>{t('users.first_name', 'First Name')}</label>
              <input className="input" value={form.first_name} onChange={e => set('first_name', e.target.value)} placeholder="John" />
            </div>
            <div className="form-group">
              <label>{t('users.last_name', 'Last Name')}</label>
              <input className="input" value={form.last_name} onChange={e => set('last_name', e.target.value)} placeholder="Doe" />
            </div>
          </div>
          <div className="form-group">
            <label>{t('users.display_name', 'Display Name (shown on PIN screen)')}</label>
            <input className="input" value={form.display_name} onChange={e => set('display_name', e.target.value)} placeholder="John" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>{t('users.username', 'Username')} *</label>
              <input className="input" value={form.username} onChange={e => set('username', e.target.value)} required placeholder="johnd" />
            </div>
            <div className="form-group">
              <label>{t('users.role', 'Role')} *</label>
              <select className="input" value={form.role} onChange={e => set('role', e.target.value)}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>{t('users.email', 'Email')}</label>
              <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="john@shop.com" />
            </div>
            <div className="form-group">
              <label>{t('users.phone', 'Phone')}</label>
              <input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+94771234567" />
            </div>
          </div>
          <div className="form-group">
            <label>{isEdit ? t('users.new_password_hint', 'New Password (leave blank to keep)') : `${t('users.password', 'Password')} *`}</label>
            <input
              className="input"
              type="password"
              value={form.password}
              onChange={e => set('password', e.target.value)}
              placeholder="••••••••"
              required={!isEdit}
            />
          </div>
          <div className="form-check">
            <input id="um-active" type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} />
            <label htmlFor="um-active">{t('users.active_account', 'Active account')}</label>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>{t('common.cancel', 'Cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? t('common.saving', 'Saving...') : (isEdit ? t('common.save_changes', 'Save Changes') : t('users.create_user_btn', 'Create User'))}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── PIN Modal ────────────────────────────────────────────────
function PinModal({ user, onClose }) {
  const { t } = useTranslation()
  const toast = useToast()
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSet = async (e) => {
    e.preventDefault()
    if (!/^\d{6}$/.test(pin)) return toast.error(t('users.pin_digits_err', 'PIN must be exactly 6 digits'))
    if (pin !== confirm) return toast.error(t('users.pin_match_err', 'PINs do not match'))
    setLoading(true)
    try {
      await api.post(`/users/${user.user_id}/set-pin`, { pin })
      toast.success(t('users.pin_success', 'PIN set successfully'))
      onClose()
    } catch (err) {
      toast.error(err?.response?.data?.message || t('users.pin_failed', 'Failed to set PIN'))
    } finally { setLoading(false) }
  }

  const handleClear = async () => {
    setLoading(true)
    try {
      await api.delete(`/users/${user.user_id}/pin`)
      toast.success(t('users.pin_cleared', 'PIN cleared'))
      onClose()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed')
    } finally { setLoading(false) }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('users.manage_pin', 'Manage PIN')} — {user.display_name || user.username}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSet} className="modal-body">
          <p className="modal-hint">{t('users.pin_hint', 'Set a 6-digit PIN for quick cashier login.')}</p>
          <div className="form-group">
            <label>{t('users.new_pin', 'New PIN')}</label>
            <input className="input" type="password" inputMode="numeric" maxLength={6}
              value={pin} onChange={e => setPin(e.target.value.replace(/\D/g,''))} placeholder="123456" />
          </div>
          <div className="form-group">
            <label>{t('users.confirm_pin', 'Confirm PIN')}</label>
            <input className="input" type="password" inputMode="numeric" maxLength={6}
              value={confirm} onChange={e => setConfirm(e.target.value.replace(/\D/g,''))} placeholder="123456" />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-danger" onClick={handleClear} disabled={loading}>
              {t('users.clear_pin', 'Clear PIN')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? t('common.saving', 'Saving...') : t('users.set_pin', 'Set PIN')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────
export default function UsersPage() {
  const { t } = useTranslation()
  const { user: me } = useAuth()
  const toast = useToast()

  const [users, setUsers] = useState([])
  const [meta, setMeta] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)     // null | { type: 'user' | 'pin', data }

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params = { limit: 50, ...(search ? { search } : {}) }
      const res = await api.get('/users', { params })
      setUsers(res.data.data)
      setMeta(res.data.meta)
    } catch { toast.error(t('users.load_failed', 'Failed to load users')) }
    finally { setLoading(false) }
  }, [search, toast, t])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const handleUnlock = async (u) => {
    try {
      await api.post(`/users/${u.user_id}/unlock`)
      toast.success(`${u.username} ${t('users.unlocked', 'unlocked')}`)
      fetchUsers()
    } catch { toast.error(t('users.unlock_failed', 'Failed to unlock')) }
  }

  const handleDelete = async (u) => {
    if (!window.confirm(t('users.delete_confirm', 'Delete user "{{name}}"? This cannot be undone.', { name: u.username }))) return
    try {
      await api.delete(`/users/${u.user_id}`)
      toast.success(t('users.deleted', 'User deleted'))
      fetchUsers()
    } catch (err) { toast.error(err?.response?.data?.message || 'Failed') }
  }

  const onSaved = () => { setModal(null); fetchUsers() }

  return (
    <div className="users-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('users.title', 'User Management')}</h1>
          <p className="page-subtitle">{meta.total || 0} {t('users.users', 'users')}</p>
        </div>
        {me?.role === 'admin' && (
          <button className="btn btn-primary" onClick={() => setModal({ type: 'user', data: null })}>
            + {t('users.add_user', 'Add User')}
          </button>
        )}
      </div>

      {/* Search */}
      <div className="users-toolbar">
        <input
          className="input"
          placeholder={t('users.search_placeholder', 'Search by name, username, email…')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 320 }}
        />
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="table-loading"><div className="spinner" /></div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{t('users.user', 'User')}</th>
                <th>{t('users.role', 'Role')}</th>
                <th>{t('common.status', 'Status')}</th>
                <th>{t('users.pin', 'PIN')}</th>
                <th>{t('users.last_login', 'Last Login')}</th>
                <th>{t('common.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign:'center', color:'var(--text-secondary)', padding: 32 }}>{t('users.no_users', 'No users found')}</td></tr>
              )}
              {users.map(u => (
                <tr key={u.user_id} className={!u.is_active ? 'row-inactive' : ''}>
                  <td>
                    <div className="user-cell">
                      <div className="user-avatar-sm">
                        {(u.first_name?.[0] || u.username[0]).toUpperCase()}
                      </div>
                      <div>
                        <div className="user-cell-name">{u.display_name || [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username}</div>
                        <div className="user-cell-sub">@{u.username}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className={`badge ${ROLE_BADGE[u.role]}`}>{u.role}</span></td>
                  <td>
                    {u.locked_until && new Date(u.locked_until) > new Date()
                      ? <span className="badge badge-danger">{t('users.locked', 'Locked')}</span>
                      : u.is_active
                        ? <span className="badge badge-success">{t('users.active', 'Active')}</span>
                        : <span className="badge badge-warning">{t('users.inactive', 'Inactive')}</span>}
                  </td>
                  <td>
                    {u.role === 'cashier'
                      ? <span className={`badge ${u.has_pin ? 'badge-success' : 'badge-warning'}`}>
                          {u.has_pin ? t('users.pin_set', '● PIN set') : t('users.no_pin', '○ No PIN')}
                        </span>
                      : <span className="badge" style={{ color: 'var(--text-secondary)' }}>N/A</span>}
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                    {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : 'Never'}
                  </td>
                  <td>
                    <div className="action-btns">
                      {me?.role === 'admin' && (
                        <>
                          <button className="btn-icon" title="Edit" onClick={() => setModal({ type: 'user', data: u })}>✏️</button>
                          {u.role === 'cashier' && (
                            <button className="btn-icon" title="Manage PIN" onClick={() => setModal({ type: 'pin', data: u })}>🔢</button>
                          )}
                          {u.locked_until && new Date(u.locked_until) > new Date() && (
                            <button className="btn-icon" title="Unlock" onClick={() => handleUnlock(u)}>🔓</button>
                          )}
                          {u.user_id !== me.user_id && (
                            <button className="btn-icon btn-icon-danger" title="Delete" onClick={() => handleDelete(u)}>🗑️</button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      {modal?.type === 'user' && (
        <UserModal user={modal.data} onClose={() => setModal(null)} onSaved={onSaved} />
      )}
      {modal?.type === 'pin' && (
        <PinModal user={modal.data} onClose={() => setModal(null)} />
      )}
    </div>
  )
}
