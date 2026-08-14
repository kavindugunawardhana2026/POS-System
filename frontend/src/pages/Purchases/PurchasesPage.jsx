import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { listPurchases, createPurchase, deletePurchase } from '@/services/purchaseService'
import { listSuppliers } from '@/services/supplierService'
import { listProducts } from '@/services/productService'

const fmt = (n) => Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100

// ─── New Purchase Modal ───────────────────────────────────────
function NewPurchaseModal({ onClose, onSaved }) {
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [suppliers, setSuppliers] = useState([])
  const [supplierId, setSupplierId] = useState('')
  const [refNo, setRefNo] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([{ product_id: '', product_name: '', quantity: 1, unit_cost: '' }])
  const [productSearch, setProductSearch] = useState('')
  const [productResults, setProductResults] = useState([])
  const [focusedRow, setFocusedRow] = useState(null)
  const searchTimeout = useRef(null)

  useEffect(() => {
    listSuppliers({ is_active: 'true', limit: 200 })
      .then(r => setSuppliers(r.data.data))
      .catch(() => {})
  }, [])

  const searchProducts = (q, rowIdx) => {
    setFocusedRow(rowIdx)
    setProductSearch(q)
    clearTimeout(searchTimeout.current)
    if (!q) { setProductResults([]); return }
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await listProducts({ search: q, limit: 8 })
        setProductResults(res.data.data)
      } catch { setProductResults([]) }
    }, 300)
  }

  const selectProduct = (rowIdx, product) => {
    setItems(its => its.map((it, i) =>
      i === rowIdx ? { ...it, product_id: product.product_id, product_name: product.name, unit_cost: product.cost_price || '' } : it
    ))
    setProductSearch('')
    setProductResults([])
    setFocusedRow(null)
  }

  const setItemField = (rowIdx, field, value) => {
    setItems(its => its.map((it, i) => i === rowIdx ? { ...it, [field]: value } : it))
  }

  const addRow = () => setItems(its => [...its, { product_id: '', product_name: '', quantity: 1, unit_cost: '' }])
  const removeRow = (idx) => setItems(its => its.filter((_, i) => i !== idx))

  const grandTotal = round2(items.reduce((s, it) => {
    const sub = round2(Number(it.quantity || 0) * Number(it.unit_cost || 0))
    return s + sub
  }, 0))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (items.some(it => !it.product_id)) {
      toast.error('Please select a product for all rows')
      return
    }
    setLoading(true)
    try {
      await createPurchase({
        supplier_id: supplierId || null,
        reference_no: refNo || null,
        purchase_date: purchaseDate,
        notes: notes || null,
        items: items.map(it => ({
          product_id: it.product_id,
          quantity: Number(it.quantity),
          unit_cost: Number(it.unit_cost),
        })),
      })
      toast.success('Purchase recorded successfully! Stock updated.')
      onSaved()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to create purchase')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 800, width: '95vw' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📥 New Purchase</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          {/* Header fields */}
          <div className="form-row">
            <div className="form-group">
              <label>Supplier</label>
              <select className="input" value={supplierId} onChange={e => setSupplierId(e.target.value)}>
                <option value="">— No Supplier —</option>
                {suppliers.map(s => <option key={s.supplier_id} value={s.supplier_id}>{s.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Reference / Invoice No.</label>
              <input className="input" value={refNo} onChange={e => setRefNo(e.target.value)} placeholder="Optional" />
            </div>
            <div className="form-group">
              <label>Purchase Date *</label>
              <input className="input" type="date" required value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
            </div>
          </div>

          {/* Items */}
          <div style={{ margin: '1rem 0 0.5rem', fontWeight: 600 }}>Items</div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: 'var(--bg-secondary)' }}>
                <tr>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>Product</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center', width: 100 }}>Qty</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center', width: 130 }}>Unit Cost (Rs.)</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', width: 120 }}>Subtotal</th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => (
                  <tr key={idx} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '6px 8px', position: 'relative' }}>
                      <input
                        className="input"
                        style={{ fontSize: '0.9rem' }}
                        placeholder="Search product…"
                        value={focusedRow === idx ? productSearch : it.product_name}
                        onChange={e => {
                          setItemField(idx, 'product_name', e.target.value)
                          searchProducts(e.target.value, idx)
                        }}
                        onFocus={() => { setFocusedRow(idx); setProductSearch(it.product_name) }}
                      />
                      {focusedRow === idx && productResults.length > 0 && (
                        <div style={{ position: 'absolute', top: '100%', left: 8, right: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, zIndex: 50, maxHeight: 180, overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}>
                          {productResults.map(p => (
                            <div key={p.product_id} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.9rem' }}
                              onMouseDown={() => selectProduct(idx, p)}>
                              <strong>{p.name}</strong>
                              <span style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>{p.sku} • Stock: {p.stock_quantity}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <input
                        className="input"
                        type="number" min="0.001" step="0.001"
                        style={{ textAlign: 'center', fontSize: '0.9rem' }}
                        value={it.quantity}
                        onChange={e => setItemField(idx, 'quantity', e.target.value)}
                      />
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <input
                        className="input"
                        type="number" min="0" step="0.01"
                        style={{ textAlign: 'right', fontSize: '0.9rem' }}
                        value={it.unit_cost}
                        onChange={e => setItemField(idx, 'unit_cost', e.target.value)}
                      />
                    </td>
                    <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600 }}>
                      {fmt(round2(Number(it.quantity || 0) * Number(it.unit_cost || 0)))}
                    </td>
                    <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                      {items.length > 1 && (
                        <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: '1rem' }}
                          onClick={() => removeRow(idx)}>✕</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={addRow}>+ Add Item</button>
            <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>Total: Rs. {fmt(grandTotal)}</div>
          </div>

          <div className="form-group" style={{ marginTop: '0.5rem' }}>
            <label>Notes</label>
            <textarea className="input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes about this purchase" />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Recording...' : `✅ Record Purchase (Rs. ${fmt(grandTotal)})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Purchase Detail Modal (Read-only) ───────────────────────
function PurchaseDetailModal({ purchaseId, onClose }) {
  const [purchase, setPurchase] = useState(null)

  useEffect(() => {
    import('@/services/purchaseService').then(({ getPurchase }) => {
      getPurchase(purchaseId).then(r => setPurchase(r.data.data)).catch(() => {})
    })
  }, [purchaseId])

  if (!purchase) return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="table-loading"><div className="spinner" /></div>
      </div>
    </div>
  )

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 700, width: '95vw' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Purchase #{purchase.purchase_id} {purchase.reference_no && `— ${purchase.reference_no}`}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 2rem', marginBottom: '1rem', fontSize: '0.9rem' }}>
            <div><span style={{ color: 'var(--text-secondary)' }}>Date: </span><strong>{new Date(purchase.purchase_date).toLocaleDateString()}</strong></div>
            <div><span style={{ color: 'var(--text-secondary)' }}>Supplier: </span><strong>{purchase.supplier_name || '—'}</strong></div>
            <div><span style={{ color: 'var(--text-secondary)' }}>Created By: </span><strong>{purchase.created_by}</strong></div>
            {purchase.notes && <div><span style={{ color: 'var(--text-secondary)' }}>Notes: </span><strong>{purchase.notes}</strong></div>}
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th style={{ textAlign: 'center' }}>Qty</th>
                <th style={{ textAlign: 'right' }}>Unit Cost</th>
                <th style={{ textAlign: 'right' }}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {(purchase.items || []).map((it, i) => (
                <tr key={i}>
                  <td>{it.product_name}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{it.sku}</td>
                  <td style={{ textAlign: 'center' }}>{it.quantity}</td>
                  <td style={{ textAlign: 'right' }}>Rs. {fmt(it.unit_cost)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>Rs. {fmt(it.subtotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} style={{ textAlign: 'right', fontWeight: 700, padding: '12px 16px' }}>Net Amount</td>
                <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '1.1rem', padding: '12px 16px' }}>Rs. {fmt(purchase.net_amount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────
export default function PurchasesPage() {
  const { user: me } = useAuth()
  const toast = useToast()
  const isAdmin = me?.role === 'admin' || me?.role === 'manager'

  const [purchases, setPurchases] = useState([])
  const [meta, setMeta]           = useState({})
  const [loading, setLoading]     = useState(true)
  const [page, setPage]           = useState(1)
  const [from, setFrom]           = useState('')
  const [to, setTo]               = useState('')
  const [showNew, setShowNew]     = useState(false)
  const [viewId, setViewId]       = useState(null)

  const fetchPurchases = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit: 25 }
      if (from) params.from = from
      if (to)   params.to   = to
      const res = await listPurchases(params)
      setPurchases(res.data.data)
      setMeta(res.data.meta)
    } catch {
      toast.error('Failed to load purchases')
    } finally {
      setLoading(false)
    }
  }, [page, from, to, toast])

  useEffect(() => { fetchPurchases() }, [fetchPurchases])
  useEffect(() => { setPage(1) }, [from, to])

  const handleDelete = async (p) => {
    if (!window.confirm(`Reverse purchase #${p.purchase_id}? This will deduct the stock that was added.`)) return
    try {
      await deletePurchase(p.purchase_id)
      toast.success('Purchase reversed and stock adjusted')
      fetchPurchases()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed')
    }
  }

  const onSaved = () => { setShowNew(false); fetchPurchases() }

  return (
    <div className="users-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Purchases</h1>
          <p className="page-subtitle">{meta.total || 0} records</p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setShowNew(true)}>
            + New Purchase
          </button>
        )}
      </div>

      <div className="users-toolbar">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>From:</label>
          <input className="input" type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ width: 145 }} />
          <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>To:</label>
          <input className="input" type="date" value={to} onChange={e => setTo(e.target.value)} style={{ width: 145 }} />
          {(from || to) && (
            <button className="btn btn-secondary" onClick={() => { setFrom(''); setTo('') }}>Clear</button>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="table-loading"><div className="spinner" /></div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Date</th>
                <th>Supplier</th>
                <th>Reference</th>
                <th style={{ textAlign: 'center' }}>Items</th>
                <th style={{ textAlign: 'right' }}>Net Amount</th>
                <th>Created By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {purchases.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 32 }}>No purchases found</td></tr>
              )}
              {purchases.map(p => (
                <tr key={p.purchase_id}>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>#{p.purchase_id}</td>
                  <td>{new Date(p.purchase_date).toLocaleDateString()}</td>
                  <td>{p.supplier_name || <span style={{ color: 'var(--text-secondary)' }}>—</span>}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{p.reference_no || '—'}</td>
                  <td style={{ textAlign: 'center' }}>{p.item_count}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>Rs. {fmt(p.net_amount)}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{p.created_by}</td>
                  <td>
                    <div className="action-btns">
                      <button className="btn-icon" title="View Details" onClick={() => setViewId(p.purchase_id)}>👁️</button>
                      {me?.role === 'admin' && (
                        <button className="btn-icon btn-icon-danger" title="Reverse Purchase" onClick={() => handleDelete(p)}>↩️</button>
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

      {showNew && <NewPurchaseModal onClose={() => setShowNew(false)} onSaved={onSaved} />}
      {viewId && <PurchaseDetailModal purchaseId={viewId} onClose={() => setViewId(null)} />}
    </div>
  )
}
