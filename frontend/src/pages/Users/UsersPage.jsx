import { useState, useEffect, useCallback } from 'react'
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
        toast.success('User updated')
      } else {
        await api.post('/users', payload)
        toast.success('User created')
      }
      onSaved()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save user')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? 'Edit User' : 'Create User'}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-row">
            <div className="form-group">
              <label>First Name</label>
              <input className="input" value={form.first_name} onChange={e => set('first_name', e.target.value)} placeholder="John" />
            </div>
            <div className="form-group">
              <label>Last Name</label>
              <input className="input" value={form.last_name} onChange={e => set('last_name', e.target.value)} placeholder="Doe" />
            </div>
          </div>
          <div className="form-group">
            <label>Display Name (shown on PIN screen)</label>
            <input className="input" value={form.display_name} onChange={e => set('display_name', e.target.value)} placeholder="John" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Username *</label>
              <input className="input" value={form.username} onChange={e => set('username', e.target.value)} required placeholder="johnd" />
            </div>
            <div className="form-group">
              <label>Role *</label>
              <select className="input" value={form.role} onChange={e => set('role', e.target.value)}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Email</label>
              <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="john@shop.com" />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+94771234567" />
            </div>
          </div>
          <div className="form-group">
            <label>{isEdit ? 'New Password (leave blank to keep)' : 'Password *'}</label>
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
            <label htmlFor="um-active">Active account</label>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : (isEdit ? 'Save Changes' : 'Create User')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── PIN Modal ────────────────────────────────────────────────
function PinModal({ user, onClose }) {
  const toast = useToast()
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSet = async (e) => {
    e.preventDefault()
    if (!/^\d{6}$/.test(pin)) return toast.error('PIN must be exactly 6 digits')
    if (pin !== confirm) return toast.error('PINs do not match')
    setLoading(true)
    try {
      await api.post(`/users/${user.user_id}/set-pin`, { pin })
      toast.success('PIN set successfully')
      onClose()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to set PIN')
    } finally { setLoading(false) }
  }

  const handleClear = async () => {
    if (!confirm) return toast.error('Type CLEAR to confirm')
    setLoading(true)
    try {
      await api.delete(`/users/${user.user_id}/pin`)
      toast.success('PIN cleared')
      onClose()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed')
    } finally { setLoading(false) }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Manage PIN — {user.display_name || user.username}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSet} className="modal-body">
          <p className="modal-hint">Set a 6-digit PIN for quick cashier login.</p>
          <div className="form-group">
            <label>New PIN</label>
            <input className="input" type="password" inputMode="numeric" maxLength={6}
              value={pin} onChange={e => setPin(e.target.value.replace(/\D/g,''))} placeholder="123456" />
          </div>
          <div className="form-group">
            <label>Confirm PIN</label>
            <input className="input" type="password" inputMode="numeric" maxLength={6}
              value={confirm} onChange={e => setConfirm(e.target.value.replace(/\D/g,''))} placeholder="123456" />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-danger" onClick={handleClear} disabled={loading}>
              Clear PIN
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Set PIN'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────
export default function UsersPage() {
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
    } catch { toast.error('Failed to load users') }
    finally { setLoading(false) }
  }, [search, toast])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const handleUnlock = async (u) => {
    try {
      await api.post(`/users/${u.user_id}/unlock`)
      toast.success(`${u.username} unlocked`)
      fetchUsers()
    } catch { toast.error('Failed to unlock') }
  }

  const handleDelete = async (u) => {
    if (!window.confirm(`Delete user "${u.username}"? This cannot be undone.`)) return
    try {
      await api.delete(`/users/${u.user_id}`)
      toast.success('User deleted')
      fetchUsers()
    } catch (err) { toast.error(err?.response?.data?.message || 'Failed') }
  }

  const onSaved = () => { setModal(null); fetchUsers() }

  return (
    <div className="users-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="page-subtitle">{meta.total || 0} users</p>
        </div>
        {me?.role === 'admin' && (
          <button className="btn btn-primary" onClick={() => setModal({ type: 'user', data: null })}>
            + Add User
          </button>
        )}
      </div>

      {/* Search */}
      <div className="users-toolbar">
        <input
          className="input"
          placeholder="Search by name, username, email…"
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
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>PIN</th>
                <th>Last Login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign:'center', color:'var(--text-secondary)', padding: 32 }}>No users found</td></tr>
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
                      ? <span className="badge badge-danger">Locked</span>
                      : u.is_active
                        ? <span className="badge badge-success">Active</span>
                        : <span className="badge badge-warning">Inactive</span>}
                  </td>
                  <td>
                    {u.role === 'cashier'
                      ? <span className={`badge ${u.has_pin ? 'badge-success' : 'badge-warning'}`}>
                          {u.has_pin ? '● PIN set' : '○ No PIN'}
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
