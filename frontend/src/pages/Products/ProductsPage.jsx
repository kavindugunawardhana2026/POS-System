import { useEffect, useMemo, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '@/context/ToastContext'
import { useAuth } from '@/context/AuthContext'
import {
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  MEASUREMENT_UNITS,
} from '@/services/productService'
import { listCategories } from '@/services/categoryService'
import BulkUploadModal from './BulkUploadModal'
import './ProductsPage.css'

const EMPTY_FORM = {
  name: '',
  barcode: '',
  category_id: '',
  description: '',
  brand: '',
  cost_price: 0,
  retail_price: '',
  wholesale_price: '',
  min_wholesale_quantity: '',
  measurement_unit: 'units',
  stock_quantity: 0,
  low_stock_threshold: 0,
  is_active: true,
}

function formatMoney(n) {
  if (n === null || n === undefined || n === '') return '-'
  const num = Number(n)
  if (!Number.isFinite(num)) return '-'
  return num.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function ProductsPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const { user } = useAuth()

  const canManage =
    user?.role === 'admin' || user?.role === 'manager'

  const [items, setItems] = useState([])
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, pages: 1 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [page, setPage] = useState(1)

  const [categories, setCategories] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null) // null = closed, {} = create, {product_id,...} = edit
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [bulkOpen, setBulkOpen] = useState(false)

  // ─── Data loading ────────────────────────────────────────────
  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listProducts({
        page,
        limit: 20,
        search: search || undefined,
        category_id: categoryFilter || undefined,
      })
      setItems(res.data.data || [])
      setMeta(res.data.meta || { total: 0, page: 1, limit: 20, pages: 1 })
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to load products')
    } finally {
      setLoading(false)
    }
  }, [page, search, categoryFilter, toast])

  useEffect(() => { fetchProducts() }, [fetchProducts])
  useEffect(() => { setPage(1) }, [search, categoryFilter])

  useEffect(() => {
    listCategories({ limit: 500 })
      .then((r) => setCategories(r.data.data || []))
      .catch(() => setCategories([]))
  }, [])

  // ─── Form helpers ────────────────────────────────────────────
  const openCreate = () => {
    setEditing({})
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  const openEdit = (product) => {
    setEditing(product)
    setForm({
      name: product.name || '',
      barcode: product.barcode || '',
      category_id: product.category_id ?? '',
      description: product.description || '',
      brand: product.brand || '',
      cost_price: product.cost_price ?? 0,
      retail_price: product.retail_price ?? '',
      wholesale_price: product.wholesale_price ?? '',
      min_wholesale_quantity: product.min_wholesale_quantity ?? '',
      measurement_unit: product.measurement_unit || 'units',
      stock_quantity: product.stock_quantity ?? 0,
      low_stock_threshold: product.low_stock_threshold ?? 0,
      is_active: product.is_active !== false,
    })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditing(null)
    setForm(EMPTY_FORM)
  }

  const onFormChange = (key) => (e) => {
    const { value, type, checked } = e.target
    let v = value
    if (type === 'checkbox') v = checked
    else if (type === 'number') v = value === '' ? '' : Number(value)
    setForm((prev) => ({ ...prev, [key]: v }))
  }

  const submitForm = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Name is required'); return }
    if (form.retail_price === '' || Number(form.retail_price) <= 0) {
      toast.error('Retail price must be greater than 0')
      return
    }

    const payload = {
      ...form,
      category_id: form.category_id ? Number(form.category_id) : null,
      cost_price: Number(form.cost_price || 0),
      retail_price: Number(form.retail_price),
      wholesale_price: form.wholesale_price === '' ? null : Number(form.wholesale_price),
      min_wholesale_quantity:
        form.min_wholesale_quantity === '' ? null : Number(form.min_wholesale_quantity),
      stock_quantity: Number(form.stock_quantity || 0),
      low_stock_threshold: Number(form.low_stock_threshold || 0),
    }
    // Drop empty strings before submit so backend validators accept them.
    Object.keys(payload).forEach((k) => {
      if (payload[k] === '') delete payload[k]
    })

    setSaving(true)
    try {
      if (editing && editing.product_id) {
        await updateProduct(editing.product_id, payload)
        toast.success('Product updated successfully')
      } else {
        await createProduct(payload)
        toast.success('Product created successfully')
      }
      closeModal()
      fetchProducts()
    } catch (err) {
      const data = err?.response?.data
      const msg = data?.details
        ? data.details.map((d) => `${d.field}: ${d.message}`).join('\n')
        : data?.message || 'Save failed'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    try {
      await deleteProduct(confirmDelete.product_id)
      toast.success('Product deleted')
      setConfirmDelete(null)
      fetchProducts()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Delete failed')
    }
  }

  const unitLabel = (val) =>
    MEASUREMENT_UNITS.find((u) => u.value === val)?.label || val

  const categoryNameById = useMemo(() => {
    const map = new Map()
    for (const c of categories) map.set(c.category_id, c.name)
    return map
  }, [categories])

  return (
    <div className="products-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Products</h1>
          <p className="page-sub">{meta.total} product(s) in your catalogue</p>
        </div>
        <div className="page-actions">
          {canManage && (
            <>
              <button
                className="btn btn-secondary"
                onClick={() => setBulkOpen(true)}
              >
                📥 Bulk Upload
              </button>
              <button className="btn btn-primary" onClick={openCreate}>
                ➕ Add Product
              </button>
            </>
          )}
        </div>
      </div>

      {/* ─── Filters ─── */}
      <div className="card filters-card">
        <div className="filters-row">
          <input
            className="input"
            type="text"
            placeholder="Search by name, SKU, or barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="input"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.category_id} value={c.category_id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ─── Table ─── */}
      <div className="card table-card">
        {loading ? (
          <div className="table-loading"><div className="spinner" /></div>
        ) : items.length === 0 ? (
          <div className="table-empty">
            <div className="empty-icon">📦</div>
            <p>No products found</p>
            {canManage && (
              <button className="btn btn-primary" onClick={openCreate}>
                Add your first product
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Barcode</th>
                    <th>Name</th>
                    <th>Category</th>
                    <th className="num">Cost</th>
                    <th className="num">Retail</th>
                    <th className="num">Wholesale</th>
                    <th>Unit</th>
                    <th className="num">Stock</th>
                    <th>Status</th>
                    {canManage && <th style={{ textAlign: 'right' }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {items.map((p) => (
                    <tr key={p.product_id}>
                      <td><code className="sku-cell">{p.sku || '—'}</code></td>
                      <td>{p.barcode || '—'}</td>
                      <td>
                        <div className="product-name-cell">
                          <span className="product-name">{p.name}</span>
                          {p.brand && <span className="product-brand">{p.brand}</span>}
                        </div>
                      </td>
                      <td>{p.category_name || categoryNameById.get(p.category_id) || '—'}</td>
                      <td className="num">{formatMoney(p.cost_price)}</td>
                      <td className="num"><strong>{formatMoney(p.retail_price)}</strong></td>
                      <td className="num">{p.wholesale_price != null ? formatMoney(p.wholesale_price) : '—'}</td>
                      <td>{unitLabel(p.measurement_unit)}</td>
                      <td className="num">
                        <span className={
                          Number(p.stock_quantity) <= Number(p.low_stock_threshold)
                            ? 'stock-low' : 'stock-ok'
                        }>
                          {Number(p.stock_quantity).toLocaleString()}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${p.is_active ? 'badge-success' : 'badge-danger'}`}>
                          {p.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      {canManage && (
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => openEdit(p)}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            style={{ marginLeft: 6 }}
                            onClick={() => setConfirmDelete(p)}
                          >
                            🗑️
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {meta.pages > 1 && (
              <div className="pagination">
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  ← Prev
                </button>
                <span className="pagination-info">
                  Page {meta.page} of {meta.pages}
                </span>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={page >= meta.pages}
                  onClick={() => setPage((p) => Math.min(meta.pages, p + 1))}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ─── Edit / Create Modal ─── */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editing?.product_id ? 'Edit Product' : 'Add Product'}</h2>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <form onSubmit={submitForm} className="modal-body">
              <div className="form-grid">
                <div className="form-group span-2">
                  <label>Name *</label>
                  <input className="input" value={form.name} onChange={onFormChange('name')} required />
                </div>

                <div className="form-group">
                  <label>Barcode</label>
                  <input className="input" value={form.barcode} onChange={onFormChange('barcode')} />
                </div>

                <div className="form-group">
                  <label>Category</label>
                  <select
                    className="input"
                    value={form.category_id}
                    onChange={onFormChange('category_id')}
                  >
                    <option value="">— None —</option>
                    {categories.map((c) => (
                      <option key={c.category_id} value={c.category_id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Brand</label>
                  <input className="input" value={form.brand} onChange={onFormChange('brand')} />
                </div>

                <div className="form-group">
                  <label>Measurement Unit *</label>
                  <select
                    className="input"
                    value={form.measurement_unit}
                    onChange={onFormChange('measurement_unit')}
                  >
                    {MEASUREMENT_UNITS.map((u) => (
                      <option key={u.value} value={u.value}>{u.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Cost Price</label>
                  <input className="input" type="number" step="0.01" min="0"
                    value={form.cost_price} onChange={onFormChange('cost_price')} />
                </div>

                <div className="form-group">
                  <label>Retail Price *</label>
                  <input className="input" type="number" step="0.01" min="0"
                    value={form.retail_price} onChange={onFormChange('retail_price')} required />
                </div>

                <div className="form-group">
                  <label>Wholesale Price</label>
                  <input className="input" type="number" step="0.01" min="0"
                    value={form.wholesale_price} onChange={onFormChange('wholesale_price')} />
                </div>

                <div className="form-group">
                  <label>Min Wholesale Qty</label>
                  <input className="input" type="number" step="0.001" min="0"
                    value={form.min_wholesale_quantity}
                    onChange={onFormChange('min_wholesale_quantity')} />
                </div>

                <div className="form-group">
                  <label>Stock Quantity</label>
                  <input className="input" type="number" step="0.001" min="0"
                    value={form.stock_quantity} onChange={onFormChange('stock_quantity')} />
                </div>

                <div className="form-group">
                  <label>Low-Stock Threshold</label>
                  <input className="input" type="number" step="0.001" min="0"
                    value={form.low_stock_threshold}
                    onChange={onFormChange('low_stock_threshold')} />
                </div>

                <div className="form-group span-2">
                  <label>Description</label>
                  <textarea className="input" rows="2"
                    value={form.description} onChange={onFormChange('description')} />
                </div>

                <div className="form-group span-2 checkbox-row">
                  <label>
                    <input type="checkbox" checked={form.is_active}
                      onChange={onFormChange('is_active')} />
                    <span> Active (visible to POS)</span>
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : (editing?.product_id ? 'Update' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Delete Confirmation ─── */}
      {confirmDelete && (
        <div className="modal-backdrop" onClick={() => setConfirmDelete(null)}>
          <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Delete Product</h2>
              <button className="modal-close" onClick={() => setConfirmDelete(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete <strong>{confirmDelete.name}</strong>?</p>
              <p className="text-secondary">This action can be reversed by an administrator.</p>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>
                  Cancel
                </button>
                <button className="btn btn-danger" onClick={handleDelete}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Bulk Upload Modal ─── */}
      {bulkOpen && (
        <BulkUploadModal
          onClose={() => setBulkOpen(false)}
          onComplete={() => { setBulkOpen(false); fetchProducts() }}
        />
      )}
    </div>
  )
}
