import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { listExpenses, createExpense, updateExpense, deleteExpense } from '@/services/expenseService'
import { Pencil, Trash2, TrendingDown } from 'lucide-react'
import './ExpensesPage.css'

const EXPENSE_CATEGORIES = [
  'Rent', 'Utilities', 'Salaries', 'Transport', 'Maintenance',
  'Supplies', 'Marketing', 'Insurance', 'Taxes', 'Food & Beverages', 'Other',
]

const PAYMENT_METHODS = ['cash', 'card', 'upi', 'bank_transfer']
const PM_LABELS = { cash: '💵 Cash', card: '💳 Card', upi: '📱 UPI', bank_transfer: '🏦 Bank Transfer' }

// ─── Expense Modal ────────────────────────────────────────────────────────────
function ExpenseModal({ expense, onClose, onSaved }) {
  const toast = useToast()
  const isEdit = !!expense
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    category:       expense?.category       || '',
    amount:         expense?.amount         || '',
    payment_method: expense?.payment_method || 'cash',
    notes:          expense?.notes          || '',
    expense_date:   expense?.expense_date?.slice(0, 10) || new Date().toISOString().slice(0, 10),
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (isEdit) {
        await updateExpense(expense.expense_id, form)
        toast.success('Expense updated')
      } else {
        await createExpense(form)
        toast.success('Expense recorded')
      }
      onSaved()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save expense')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? 'Edit Expense' : '+ New Expense'}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-row">
            <div className="form-group" style={{ flex: 2 }}>
              <label>Category *</label>
              <select
                className="input"
                required
                value={form.category}
                onChange={e => set('category', e.target.value)}
              >
                <option value="">Select category…</option>
                {EXPENSE_CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Amount (Rs.) *</label>
              <input
                className="input"
                type="number"
                min="0.01"
                step="0.01"
                required
                value={form.amount}
                onChange={e => set('amount', e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Date *</label>
              <input
                className="input"
                type="date"
                required
                value={form.expense_date}
                onChange={e => set('expense_date', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Payment Method</label>
              <select
                className="input"
                value={form.payment_method}
                onChange={e => set('payment_method', e.target.value)}
              >
                {PAYMENT_METHODS.map(m => (
                  <option key={m} value={m}>{PM_LABELS[m]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Notes</label>
            <textarea
              className="input"
              rows={2}
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Any additional details…"
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving…' : (isEdit ? 'Save Changes' : 'Record Expense')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ExpensesPage() {
  const { user: me } = useAuth()
  const toast = useToast()
  const { t } = useTranslation()
  const isAdmin = me?.role === 'admin' || me?.role === 'manager'

  const [expenses, setExpenses]     = useState([])
  const [meta, setMeta]             = useState({})
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [page, setPage]             = useState(1)
  const [filterCat, setFilterCat]   = useState('')
  const [filterPM, setFilterPM]     = useState('')
  const [dateFrom, setDateFrom]     = useState('')
  const [dateTo, setDateTo]         = useState('')
  const [modal, setModal]           = useState(null)

  const fetchExpenses = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listExpenses({
        search, page, limit: 25,
        category: filterCat || undefined,
        payment_method: filterPM || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      })
      setExpenses(res.data.data)
      setMeta(res.data.meta)
    } catch {
      toast.error('Failed to load expenses')
    } finally {
      setLoading(false)
    }
  }, [search, page, filterCat, filterPM, dateFrom, dateTo, toast])

  useEffect(() => { fetchExpenses() }, [fetchExpenses])
  useEffect(() => { setPage(1) }, [search, filterCat, filterPM, dateFrom, dateTo])

  const handleDelete = async (exp) => {
    if (!window.confirm(`Delete this "${exp.category}" expense of Rs. ${Number(exp.amount).toFixed(2)}? This cannot be undone.`)) return
    try {
      await deleteExpense(exp.expense_id)
      toast.success('Expense deleted')
      fetchExpenses()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete')
    }
  }

  const onSaved = () => { setModal(null); fetchExpenses() }

  const fmt = (n) => Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const pmBadgeClass = (pm) => {
    if (pm === 'cash') return 'badge badge-success'
    if (pm === 'card') return 'badge badge-info'
    if (pm === 'upi')  return 'badge badge-warning'
    return 'badge badge-secondary'
  }

  return (
    <div className="expenses-page page-root">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">💸 Expenses</h1>
          <p className="page-subtitle">
            {meta.total || 0} records · Total: <strong style={{ color: 'var(--danger)' }}>Rs. {fmt(meta.total_amount)}</strong>
          </p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setModal({ data: null })}>
            + Record Expense
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="expenses-summary">
        <div className="expense-stat-card">
          <TrendingDown size={20} style={{ color: 'var(--danger)' }} />
          <div>
            <div className="expense-stat-label">Total Expenses</div>
            <div className="expense-stat-value">Rs. {fmt(meta.total_amount)}</div>
          </div>
        </div>
        <div className="expense-stat-card">
          <span style={{ fontSize: '1.25rem' }}>📋</span>
          <div>
            <div className="expense-stat-label">Total Records</div>
            <div className="expense-stat-value">{meta.total || 0}</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="toolbar expenses-toolbar">
        <input
          className="input"
          placeholder="Search category, notes…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 240 }}
        />
        <select className="input" value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ maxWidth: 180 }}>
          <option value="">All Categories</option>
          {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="input" value={filterPM} onChange={e => setFilterPM(e.target.value)} style={{ maxWidth: 170 }}>
          <option value="">All Methods</option>
          {PAYMENT_METHODS.map(m => <option key={m} value={m}>{PM_LABELS[m]}</option>)}
        </select>
        <input
          className="input"
          type="date"
          value={dateFrom}
          onChange={e => setDateFrom(e.target.value)}
          style={{ maxWidth: 155 }}
          title="From date"
        />
        <input
          className="input"
          type="date"
          value={dateTo}
          onChange={e => setDateTo(e.target.value)}
          style={{ maxWidth: 155 }}
          title="To date"
        />
        {(filterCat || filterPM || dateFrom || dateTo || search) && (
          <button className="btn btn-secondary btn-sm" onClick={() => {
            setSearch(''); setFilterCat(''); setFilterPM(''); setDateFrom(''); setDateTo('')
          }}>Clear</button>
        )}
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="table-loading"><div className="spinner" /></div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Payment</th>
                <th>Recorded By</th>
                <th>Notes</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="empty-state-cell">
                    <div className="empty-state">
                      <div className="empty-state-icon">💸</div>
                      <div>No expenses found</div>
                      {isAdmin && <button className="btn btn-primary btn-sm" onClick={() => setModal({ data: null })}>+ Record First Expense</button>}
                    </div>
                  </td>
                </tr>
              )}
              {expenses.map(exp => (
                <tr key={exp.expense_id}>
                  <td>
                    <span className="date-cell">{new Date(exp.expense_date).toLocaleDateString('en-LK', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                  </td>
                  <td>
                    <span className="expense-category-badge">{exp.category}</span>
                  </td>
                  <td>
                    <span className="expense-amount">Rs. {fmt(exp.amount)}</span>
                  </td>
                  <td>
                    <span className={pmBadgeClass(exp.payment_method)}>
                      {PM_LABELS[exp.payment_method] || exp.payment_method}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    {exp.first_name ? `${exp.first_name} ${exp.last_name || ''}`.trim() : exp.username || '—'}
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', maxWidth: 200 }}>
                    <span className="notes-cell" title={exp.notes}>{exp.notes || '—'}</span>
                  </td>
                  {isAdmin && (
                    <td>
                      <div className="action-btns">
                        <button className="btn-icon" title="Edit" onClick={() => setModal({ data: exp })}>
                          <Pencil size={14} />
                        </button>
                        <button className="btn-icon btn-icon-danger" title="Delete" onClick={() => handleDelete(exp)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  )}
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
        <ExpenseModal expense={modal.data} onClose={() => setModal(null)} onSaved={onSaved} />
      )}
    </div>
  )
}
