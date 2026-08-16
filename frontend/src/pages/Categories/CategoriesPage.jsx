import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { listCategories, createCategory, updateCategory, deleteCategory } from '@/services/categoryService'
import { Pencil, Trash2, Tags } from 'lucide-react'
import './CategoriesPage.css'

// ─── Category Modal ───────────────────────────────────────────────────────────
function CategoryModal({ category, onClose, onSaved }) {
  const { t } = useTranslation()
  const toast = useToast()
  const isEdit = !!category
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name:        category?.name        || '',
    description: category?.description || '',
    sort_order:  category?.sort_order  ?? 0,
    is_active:   category?.is_active   !== false,
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (isEdit) {
        await updateCategory(category.category_id, form)
        toast.success('Category updated')
      } else {
        await createCategory(form)
        toast.success('Category created')
      }
      onSaved()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save category')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? t('categories.edit', 'Edit Category') : t('categories.new', '+ New Category')}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label>{t('products.fields.name', 'Name')} *</label>
            <input
              className="input"
              required
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g. Beverages"
            />
          </div>

          <div className="form-group">
            <label>{t('products.fields.description', 'Description')}</label>
            <textarea
              className="input"
              rows={2}
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Short description of this category…"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>{t('categories.sort_order', 'Sort Order')}</label>
              <input
                className="input"
                type="number"
                min="0"
                step="1"
                value={form.sort_order}
                onChange={e => set('sort_order', Number(e.target.value))}
              />
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 24 }}>
              <input
                id="cat-active"
                type="checkbox"
                checked={form.is_active}
                onChange={e => set('is_active', e.target.checked)}
                style={{ width: 18, height: 18, accentColor: 'var(--primary)' }}
              />
              <label htmlFor="cat-active" style={{ margin: 0, cursor: 'pointer', fontWeight: 500 }}>{t('users.active', 'Active')}</label>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>{t('common.cancel', 'Cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? t('common.loading', 'Saving…') : (isEdit ? t('settings.save_changes', 'Save Changes') : t('categories.create', 'Create Category'))}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CategoriesPage() {
  const { t } = useTranslation()
  const { user: me } = useAuth()
  const toast = useToast()
  const isAdmin = me?.role === 'admin' || me?.role === 'manager'

  const [categories, setCategories] = useState([])
  const [meta, setMeta]             = useState({})
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [page, setPage]             = useState(1)
  const [modal, setModal]           = useState(null)

  const fetchCategories = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listCategories({ search, page, limit: 30 })
      setCategories(res.data.data)
      setMeta(res.data.meta)
    } catch {
      toast.error('Failed to load categories')
    } finally {
      setLoading(false)
    }
  }, [search, page, toast])

  useEffect(() => { fetchCategories() }, [fetchCategories])
  useEffect(() => { setPage(1) }, [search])

  const handleDelete = async (cat) => {
    if (!window.confirm(`Delete category "${cat.name}"? Products in this category will be unassigned.`)) return
    try {
      await deleteCategory(cat.category_id)
      toast.success('Category deleted')
      fetchCategories()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete category')
    }
  }

  const onSaved = () => { setModal(null); fetchCategories() }

  return (
    <div className="categories-page page-root">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title"><Tags size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />{t('categories.title', 'Product Categories')}</h1>
          <p className="page-subtitle">{meta.total || 0} {t('nav.categories', 'Categories').toLowerCase()}</p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setModal({ data: null })}>
            {t('categories.add', '+ Add Category')}
          </button>
        )}
      </div>

      {/* Search */}
      <div className="toolbar">
        <input
          className="input"
          placeholder={t('categories.search_placeholder', 'Search categories…')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 320 }}
        />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="table-loading"><div className="spinner" /></div>
      ) : categories.length === 0 ? (
        <div className="card">
          <div className="empty-state" style={{ padding: 48, textAlign: 'center', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🗂️</div>
            <div>{t('categories.no_data', 'No categories yet')}</div>
            {isAdmin && (
              <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => setModal({ data: null })}>
                {t('categories.add_first', '+ Add First Category')}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="categories-grid">
          {categories.map(cat => (
            <div key={cat.category_id} className={`category-card ${!cat.is_active ? 'category-inactive' : ''}`}>
              <div className="category-card-header">
                <div className="category-icon">
                  {cat.name.charAt(0).toUpperCase()}
                </div>
                <div className="category-info">
                  <div className="category-name">{cat.name}</div>
                  <div className="category-slug">/{cat.slug}</div>
                </div>
                {!cat.is_active && (
                  <span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>{t('users.inactive', 'Inactive')}</span>
                )}
              </div>
              {cat.description && (
                <div className="category-description">{cat.description}</div>
              )}
              <div className="category-card-footer">
                <span className="category-order">{t('categories.order', 'Order: ')}{cat.sort_order}</span>
                {isAdmin && (
                  <div className="action-btns">
                    <button className="btn-icon" title={t('common.edit', 'Edit')} onClick={() => setModal({ data: cat })}>
                      <Pencil size={14} />
                    </button>
                    <button className="btn-icon btn-icon-danger" title={t('common.delete', 'Delete')} onClick={() => handleDelete(cat)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

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
        <CategoryModal category={modal.data} onClose={() => setModal(null)} onSaved={onSaved} />
      )}
    </div>
  )
}
