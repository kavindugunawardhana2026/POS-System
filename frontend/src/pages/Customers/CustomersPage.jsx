import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { listCustomers, createCustomer, updateCustomer, deleteCustomer } from '@/services/customerService'
import { Pencil, Trash2 } from 'lucide-react'
import './CustomersPage.css'

// ─── Customer Modal ───────────────────────────────────────────
function CustomerModal({ customer, onClose, onSaved }) {
  const { t } = useTranslation()
  const toast = useToast()
  const isEdit = !!customer
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name:          customer?.name          || '',
    phone:         customer?.phone         || '',
    email:         customer?.email         || '',
    city:          customer?.city          || '',
    address_line1: customer?.address_line1 || '',
    address_line2: customer?.address_line2 || '',
    state:         customer?.state         || '',
    postal_code:   customer?.postal_code   || '',
    country:       customer?.country       || 'Sri Lanka',
    notes:         customer?.notes         || '',
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (isEdit) {
        await updateCustomer(customer.customer_id, form)
        toast.success('Customer updated')
      } else {
        await createCustomer(form)
        toast.success('Customer created')
      }
      onSaved()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save customer')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? 'Edit Customer' : 'New Customer'}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label>Name *</label>
            <input className="input" required value={form.name} onChange={e => set('name', e.target.value)} placeholder="John Silva" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Phone</label>
              <input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+94771234567" />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="john@email.com" />
            </div>
          </div>
          <div className="form-group">
            <label>Address Line 1</label>
            <input className="input" value={form.address_line1} onChange={e => set('address_line1', e.target.value)} placeholder="123 Main Street" />
          </div>
          <div className="form-group">
            <label>Address Line 2</label>
            <input className="input" value={form.address_line2} onChange={e => set('address_line2', e.target.value)} placeholder="Apartment, suite, etc." />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>City</label>
              <input className="input" value={form.city} onChange={e => set('city', e.target.value)} placeholder="Colombo" />
            </div>
            <div className="form-group">
              <label>Postal Code</label>
              <input className="input" value={form.postal_code} onChange={e => set('postal_code', e.target.value)} placeholder="00100" />
            </div>
          </div>
          <div className="form-group">
            <label>Notes</label>
            <textarea className="input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any notes about this customer..." />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : (isEdit ? 'Save Changes' : 'Create Customer')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────
export default function CustomersPage() {
  const { user: me } = useAuth()
  const toast = useToast()
  const isAdmin = me?.role === 'admin' || me?.role === 'manager'

  const [customers, setCustomers] = useState([])
  const [meta, setMeta]           = useState({})
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [page, setPage]           = useState(1)
  const [modal, setModal]         = useState(null) // null | { data: null|customer }

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listCustomers({ search, page, limit: 25 })
      setCustomers(res.data.data)
      setMeta(res.data.meta)
    } catch {
      toast.error('Failed to load customers')
    } finally {
      setLoading(false)
    }
  }, [search, page, toast])

  useEffect(() => { fetchCustomers() }, [fetchCustomers])

  // Reset to page 1 when search changes
  useEffect(() => { setPage(1) }, [search])

  const handleDelete = async (c) => {
    if (!window.confirm(`Delete customer "${c.name}"? This cannot be undone.`)) return
    try {
      await deleteCustomer(c.customer_id)
      toast.success('Customer deleted')
      fetchCustomers()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete customer')
    }
  }

  const onSaved = () => { setModal(null); fetchCustomers() }

  const fmt = (n) => Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div className="customers-page page-root">
      <div className="page-header">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">{meta.total || 0} customers</p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setModal({ data: null })}>
            + Add Customer
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <input
          className="input"
          placeholder="Search by name, phone, email…"
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
                <th>Customer</th>
                <th>Phone</th>
                <th>Email</th>
                <th>City</th>
                <th>Points</th>
                <th>Invoices</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 32 }}>No customers found</td></tr>
              )}
              {customers.map(c => (
                <tr key={c.customer_id}>
                  <td>
                    <div className="user-cell">
                      <div className="user-avatar-sm">{c.name[0].toUpperCase()}</div>
                      <div>
                        <div className="user-cell-name">{c.name}</div>
                        {c.city && <div className="user-cell-sub">{c.city}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{c.phone || '—'}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{c.email || '—'}</td>
                  <td>{c.city || '—'}</td>
                  <td>
                    {c.loyalty_points > 0
                      ? <span className="badge badge-info">⭐ {c.loyalty_points}</span>
                      : <span style={{ color: 'var(--text-secondary)' }}>0</span>
                    }
                  </td>
                  <td>{c.invoice_count}</td>
                  <td><span className="join-date">{new Date(c.created_at).toLocaleDateString()}</span></td>
                  <td>
                    <div className="action-btns">
                      {isAdmin && (
                        <>
                          <button className="btn-icon" title="Edit" onClick={() => setModal({ data: c })}><Pencil size={14} /></button>
                          <button className="btn-icon btn-icon-danger" title="Delete" onClick={() => handleDelete(c)}><Trash2 size={14} /></button>
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

      {/* Pagination */}
      {meta.pages > 1 && (
        <div className="pagination" style={{ borderTop: 'none', paddingTop: 0 }}>
          <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <span className="pagination-info">Page {page} of {meta.pages}</span>
          <button className="btn btn-secondary btn-sm" disabled={page >= meta.pages} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <CustomerModal customer={modal.data} onClose={() => setModal(null)} onSaved={onSaved} />
      )}
    </div>
  )
}
