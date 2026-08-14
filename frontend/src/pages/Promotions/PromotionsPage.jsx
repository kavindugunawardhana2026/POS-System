import { useState, useEffect } from 'react'
import { listPromotions, createPromotion, updatePromotion, deletePromotion } from '@/services/promotionService'
import { useToast } from '@/context/ToastContext'

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingPromo, setEditingPromo] = useState(null)
  
  const [formData, setFormData] = useState({
    name: '',
    type: 'percentage',
    value: '',
    min_purchase_amount: '0',
    start_date: '',
    end_date: '',
    is_active: true
  })

  const toast = useToast()

  const fetchPromotions = async () => {
    try {
      setLoading(true)
      const res = await listPromotions()
      setPromotions(res.data.data)
    } catch (err) {
      toast.error('Failed to load promotions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPromotions()
  }, [])

  const handleOpenModal = (promo = null) => {
    if (promo) {
      setFormData({
        name: promo.name,
        type: promo.type,
        value: promo.value,
        min_purchase_amount: promo.min_purchase_amount,
        start_date: promo.start_date ? promo.start_date.split('T')[0] : '',
        end_date: promo.end_date ? promo.end_date.split('T')[0] : '',
        is_active: promo.is_active === 1
      })
      setEditingPromo(promo)
    } else {
      setFormData({
        name: '', type: 'percentage', value: '', min_purchase_amount: '0',
        start_date: '', end_date: '', is_active: true
      })
      setEditingPromo(null)
    }
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
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
      setShowModal(false)
      fetchPromotions()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save promotion')
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this promotion?')) return
    try {
      await deletePromotion(id)
      toast.success('Promotion deleted')
      fetchPromotions()
    } catch (err) {
      toast.error('Failed to delete promotion')
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Promotions & Discounts</h1>
        <button className="btn btn-primary" onClick={() => handleOpenModal()}>+ New Promotion</button>
      </div>

      <div className="card">
        {loading ? (
          <p>Loading...</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Type</th>
                <th>Value</th>
                <th>Min. Purchase</th>
                <th>Validity</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {promotions.length === 0 && (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '1rem' }}>No promotions found.</td>
                </tr>
              )}
              {promotions.map(p => (
                <tr key={p.promotion_id}>
                  <td>{p.promotion_id}</td>
                  <td>{p.name}</td>
                  <td style={{ textTransform: 'capitalize' }}>{p.type.replace('_', ' ')}</td>
                  <td>{p.type === 'percentage' ? `${p.value}%` : `Rs. ${p.value}`}</td>
                  <td>Rs. {p.min_purchase_amount}</td>
                  <td>
                    {p.start_date ? new Date(p.start_date).toLocaleDateString() : 'Always'} - 
                    {p.end_date ? new Date(p.end_date).toLocaleDateString() : ' Forever'}
                  </td>
                  <td>
                    <span className={`badge ${p.is_active ? 'badge-success' : 'badge-danger'}`}>
                      {p.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <button className="btn-icon" onClick={() => handleOpenModal(p)}>✏️</button>
                    <button className="btn-icon" style={{ color: 'red' }} onClick={() => handleDelete(p.promotion_id)}>🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingPromo ? 'Edit Promotion' : 'New Promotion'}</h2>
              <button className="close-btn" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label>Name</label>
                <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Type</label>
                  <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed_amount">Fixed Amount (Rs.)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Value</label>
                  <input type="number" required min="0" step="0.01" value={formData.value} onChange={e => setFormData({...formData, value: e.target.value})} />
                </div>
              </div>

              <div className="form-group">
                <label>Min. Purchase Amount (Rs.)</label>
                <input type="number" min="0" step="0.01" value={formData.min_purchase_amount} onChange={e => setFormData({...formData, min_purchase_amount: e.target.value})} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Start Date (Optional)</label>
                  <input type="date" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>End Date (Optional)</label>
                  <input type="date" value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} />
                </div>
              </div>

              <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
                <input type="checkbox" id="isActive" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} />
                <label htmlFor="isActive" style={{ margin: 0 }}>Active</label>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
