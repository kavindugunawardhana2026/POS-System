import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { listSuppliers, createSupplier, updateSupplier, deleteSupplier } from '@/services/supplierService'

// ─── Supplier Modal ───────────────────────────────────────────
function SupplierModal({ supplier, onClose, onSaved }) {
  const toast = useToast()
  const isEdit = !!supplier
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name:           supplier?.name           || '',
    contact_person: supplier?.contact_person || '',
    phone:          supplier?.phone          || '',
    email:          supplier?.email          || '',
    gstin:          supplier?.gstin          || '',
    address:        supplier?.address        || '',
    is_active:      supplier?.is_active      !== undefined ? !!supplier.is_active : true,
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (isEdit) {
        await updateSupplier(supplier.supplier_id, form)
        toast.success('Supplier updated')
      } else {
        await createSupplier(form)
        toast.success('Supplier created')
      }
      onSaved()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save supplier')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? 'Edit Supplier' : 'New Supplier'}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label>Company Name *</label>
            <input className="input" required value={form.name} onChange={e => set('name', e.target.value)} placeholder="ABC Wholesale Ltd." />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Contact Person</label>
              <input className="input" value={form.contact_person} onChange={e => set('contact_person', e.target.value)} placeholder="Kamal Perera" />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+94112345678" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Email</label>
              <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="supplier@example.com" />
            </div>
            <div className="form-group">
              <label>GSTIN / VAT No.</label>
              <input className="input" value={form.gstin} onChange={e => set('gstin', e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <div className="form-group">
            <label>Address</label>
            <textarea className="input" rows={2} value={form.address} onChange={e => set('address', e.target.value)} placeholder="Full business address" />
          </div>
          <div className="form-check">
            <input id="sup-active" type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} />
            <label htmlFor="sup-active">Active supplier</label>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : (isEdit ? 'Save Changes' : 'Create Supplier')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────
export default function SuppliersPage() {
  const { user: me } = useAuth()
  const toast = useToast()
  const isAdmin = me?.role === 'admin' || me?.role === 'manager'

  const [suppliers, setSuppliers] = useState([])
  const [meta, setMeta]           = useState({})
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [filterActive, setFilterActive] = useState('')
  const [page, setPage]           = useState(1)
  const [modal, setModal]         = useState(null)

  const fetchSuppliers = useCallback(async () => {
    setLoading(true)
    try {
      const params = { search, page, limit: 25 }
      if (filterActive !== '') params.is_active = filterActive
      const res = await listSuppliers(params)
      setSuppliers(res.data.data)
      setMeta(res.data.meta)
    } catch {
      toast.error('Failed to load suppliers')
    } finally {
      setLoading(false)
    }
  }, [search, page, filterActive, toast])

  useEffect(() => { fetchSuppliers() }, [fetchSuppliers])
  useEffect(() => { setPage(1) }, [search, filterActive])

  const handleToggleActive = async (s) => {
    try {
      await updateSupplier(s.supplier_id, { is_active: !s.is_active })
      toast.success(s.is_active ? 'Supplier deactivated' : 'Supplier activated')
      fetchSuppliers()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed')
    }
  }

  const handleDelete = async (s) => {
    if (!window.confirm(`Permanently delete "${s.name}"? This cannot be undone.`)) return
    try {
      await deleteSupplier(s.supplier_id)
      toast.success('Supplier deleted')
      fetchSuppliers()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete supplier')
    }
  }

  const onSaved = () => { setModal(null); fetchSuppliers() }

  return (
    <div className="users-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Suppliers</h1>
          <p className="page-subtitle">{meta.total || 0} suppliers</p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setModal({ data: null })}>
            + Add Supplier
          </button>
        )}
      </div>

      <div className="users-toolbar">
        <input
          className="input"
          placeholder="Search by name, contact, phone, email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 300 }}
        />
        <select className="input" value={filterActive} onChange={e => setFilterActive(e.target.value)} style={{ width: 140 }}>
          <option value="">All Suppliers</option>
          <option value="true">Active Only</option>
          <option value="false">Inactive Only</option>
        </select>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="table-loading"><div className="spinner" /></div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Contact</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Purchases</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 32 }}>No suppliers found</td></tr>
              )}
              {suppliers.map(s => (
                <tr key={s.supplier_id} className={!s.is_active ? 'row-inactive' : ''}>
                  <td>
                    <div className="user-cell">
                      <div className="user-avatar-sm" style={{ background: 'var(--accent)' }}>🏭</div>
                      <div className="user-cell-name">{s.name}</div>
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{s.contact_person || '—'}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{s.phone || '—'}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{s.email || '—'}</td>
                  <td>{s.purchase_count}</td>
                  <td>
                    <span className={`badge ${s.is_active ? 'badge-success' : 'badge-warning'}`}>
                      {s.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="action-btns">
                      {isAdmin && (
                        <>
                          <button className="btn-icon" title="Edit" onClick={() => setModal({ data: s })}>✏️</button>
                          <button
                            className="btn-icon"
                            title={s.is_active ? 'Deactivate' : 'Activate'}
                            onClick={() => handleToggleActive(s)}
                          >{s.is_active ? '🔴' : '🟢'}</button>
                          {s.purchase_count === 0 && (
                            <button className="btn-icon btn-icon-danger" title="Delete" onClick={() => handleDelete(s)}>🗑️</button>
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

      {meta.pages > 1 && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
          <button className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <span style={{ lineHeight: '2rem' }}>Page {page} of {meta.pages}</span>
          <button className="btn btn-secondary" disabled={page >= meta.pages} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      )}

      {modal && (
        <SupplierModal supplier={modal.data} onClose={() => setModal(null)} onSaved={onSaved} />
      )}
    </div>
  )
}
