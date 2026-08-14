import { useState, useEffect, useCallback } from 'react'
import { listPromotions, createPromotion, updatePromotion, deletePromotion } from '@/services/promotionService'
import { useToast } from '@/context/ToastContext'
import { useAuth } from '@/context/AuthContext'
import './PromotionsPage.css'

const EMPTY_FORM = {
  name: '',
  type: 'percentage',
  value: '',
  min_purchase_amount: '0',
  start_date: '',
  end_date: '',
  is_active: true
}

function formatMoney(n) {
  const num = Number(n)
  return `Rs. ${num.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-LK', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function PromotionsPage() {
  const { user } = useAuth()
  const toast = useToast()

  const [promotions, setPromotions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingPromo, setEditingPromo] = useState(null)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const canManage = user?.role === 'admin' || user?.role === 'manager'

  const fetchPromotions = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listPromotions()
      setPromotions(res.data.data || [])
    } catch {
      toast.error('Failed to load promotions')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { fetchPromotions() }, [fetchPromotions])

  // ─── Stats ────────────────────────────────────────────────────
  const activeCount   = promotions.filter(p => p.is_active).length
  const inactiveCount = promotions.filter(p => !p.is_active).length

  // ─── Modal helpers ───────────────────────────────────────────
  const handleOpenModal = (promo = null) => {
    if (promo) {
      setFormData({
        name: promo.name,
        type: promo.type,
        value: promo.value,
        min_purchase_amount: promo.min_purchase_amount,
        start_date: promo.start_date ? promo.start_date.split('T')[0] : '',
        end_date: promo.end_date ? promo.end_date.split('T')[0] : '',
        is_active: promo.is_active === 1 || promo.is_active === true
      })
      setEditingPromo(promo)
    } else {
      setFormData(EMPTY_FORM)
      setEditingPromo(null)
    }
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingPromo(null)
    setFormData(EMPTY_FORM)
  }

  const setField = (key) => (e) => {
    setFormData(f => ({ ...f, [key]: e.target.value }))
  }

  // ─── Submit ───────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        ...formData,
        value: Number(formData.value),
        min_purchase_amount: Number(formData.min_purchase_amount),
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        is_active: formData.is_active ? 1 : 0
      }
      if (editingPromo) {
        await updatePromotion(editingPromo.promotion_id, payload)
        toast.success('Promotion updated')
      } else {
        await createPromotion(payload)
        toast.success('Promotion created')
      }
      closeModal()
      fetchPromotions()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save promotion')
    } finally {
      setSaving(false)
    }
  }

  // ─── Delete ───────────────────────────────────────────────────
  const handleDelete = async (promo) => {
    if (!window.confirm(`Delete promotion "${promo.name}"? This cannot be undone.`)) return
    try {
      await deletePromotion(promo.promotion_id)
      toast.success('Promotion deleted')
      fetchPromotions()
    } catch {
      toast.error('Failed to delete promotion')
    }
  }

  return (
    <div className="promotions-page">
      {/* ─── Header ─── */}
      <div className="promotions-header-wrap">
        <div>
          <h1 className="promotions-title">Promotions & Discounts</h1>
          <p className="promotions-subtitle">Manage percentage and fixed-amount discounts for customers</p>
        </div>
        {canManage && (
          <button className="btn btn-primary" onClick={() => handleOpenModal()}>
            + New Promotion
          </button>
        )}
      </div>

      {/* ─── Stats ─── */}
      <div className="promotions-stats">
        <div className="promo-stat-card">
          <span className="promo-stat-label">Total Promotions</span>
          <span className="promo-stat-value total-color">{promotions.length}</span>
        </div>
        <div className="promo-stat-card">
          <span className="promo-stat-label">Active</span>
          <span className="promo-stat-value active-color">{activeCount}</span>
        </div>
        <div className="promo-stat-card">
          <span className="promo-stat-label">Inactive</span>
          <span className="promo-stat-value inactive-color">{inactiveCount}</span>
        </div>
      </div>

      {/* ─── Table ─── */}
      <div className="card promotions-table-card">
        <div className="promotions-table-header">
          <span className="promotions-table-title">All Promotions</span>
        </div>
        <div className="promotions-table-wrap">
          {loading ? (
            <div className="promotions-loading"><div className="spinner" /></div>
          ) : promotions.length === 0 ? (
            <div className="promotions-empty">
              <div className="promotions-empty-icon">🏷️</div>
              <p className="promotions-empty-text">No promotions yet. Create your first one!</p>
              {canManage && (
                <button className="btn btn-primary" onClick={() => handleOpenModal()}>
                  + New Promotion
                </button>
              )}
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Value</th>
                  <th>Min. Purchase</th>
                  <th>Validity</th>
                  <th>Status</th>
                  {canManage && <th style={{ textAlign: 'right' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {promotions.map(p => {
                  const startDate = formatDate(p.start_date)
                  const endDate = formatDate(p.end_date)
                  return (
                    <tr key={p.promotion_id}>
                      <td><code style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>#{p.promotion_id}</code></td>
                      <td><strong>{p.name}</strong></td>
                      <td>
                        <span className={`promo-type-pill ${p.type}`}>
                          {p.type === 'percentage' ? '% Percentage' : '💰 Fixed Amount'}
                        </span>
                      </td>
                      <td>
                        <span className="promo-value">
                          {p.type === 'percentage' ? `${p.value}%` : formatMoney(p.value)}
                        </span>
                      </td>
                      <td>{Number(p.min_purchase_amount) > 0 ? formatMoney(p.min_purchase_amount) : <span style={{ color: 'var(--text-secondary)' }}>None</span>}</td>
                      <td>
                        <div className="promo-validity">
                          {startDate || endDate ? (
                            <>
                              <strong>{startDate || 'Always'}</strong>
                              <span> → </span>
                              <strong>{endDate || 'Forever'}</strong>
                            </>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)' }}>Always Active</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${p.is_active ? 'badge-success' : 'badge-danger'}`}>
                          {p.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      {canManage && (
                        <td>
                          <div className="table-actions-cell">
                            <button className="btn btn-secondary btn-sm" onClick={() => handleOpenModal(p)}>
                              ✏️ Edit
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p)}>
                              🗑️
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ─── Create / Edit Modal ─── */}
      {showModal && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingPromo ? '✏️ Edit Promotion' : '🏷️ New Promotion'}</h2>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Promotion Name *</label>
                  <input
                    className="form-input"
                    required
                    placeholder="e.g. Summer Sale 10%"
                    value={formData.name}
                    onChange={setField('name')}
                  />
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Type *</label>
                    <select className="form-input" value={formData.type} onChange={setField('type')}>
                      <option value="percentage">% Percentage</option>
                      <option value="fixed_amount">💰 Fixed Amount</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      {formData.type === 'percentage' ? 'Discount (%)' : 'Discount (Rs.)'} *
                    </label>
                    <input
                      className="form-input"
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      placeholder={formData.type === 'percentage' ? '10' : '500.00'}
                      value={formData.value}
                      onChange={setField('value')}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Minimum Purchase Amount (Rs.)</label>
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00 (no minimum)"
                    value={formData.min_purchase_amount}
                    onChange={setField('min_purchase_amount')}
                  />
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Start Date (Optional)</label>
                    <input
                      className="form-input"
                      type="date"
                      value={formData.start_date}
                      onChange={setField('start_date')}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">End Date (Optional)</label>
                    <input
                      className="form-input"
                      type="date"
                      value={formData.end_date}
                      onChange={setField('end_date')}
                    />
                  </div>
                </div>

                <div className="toggle-row">
                  <input
                    type="checkbox"
                    id="isActive"
                    className="toggle-checkbox"
                    checked={formData.is_active}
                    onChange={e => setFormData(f => ({ ...f, is_active: e.target.checked }))}
                  />
                  <label htmlFor="isActive" className="toggle-label">
                    Active — promotion will be available at the POS
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : (editingPromo ? 'Update' : 'Create Promotion')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
