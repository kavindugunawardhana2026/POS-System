import { useState, useEffect, useCallback } from 'react'
import { listShifts, openShift, closeShift, getCurrentShift } from '@/services/shiftService'
import { useToast } from '@/context/ToastContext'
import { useAuth } from '@/context/AuthContext'
import './ShiftsPage.css'

function formatMoney(n) {
  if (n === null || n === undefined || n === '') return '—'
  const num = Number(n)
  if (!Number.isFinite(num)) return '—'
  return `Rs. ${num.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-LK', {
    dateStyle: 'medium', timeStyle: 'short'
  })
}

export default function ShiftsPage() {
  const { user } = useAuth()
  const toast = useToast()

  const [shifts, setShifts] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentShift, setCurrentShift] = useState(null)
  const [statusFilter, setStatusFilter] = useState('')

  // ─── Open Shift Modal ────────────────────────────────────────
  const [showOpenModal, setShowOpenModal] = useState(false)
  const [openForm, setOpenForm] = useState({ opening_cash: '', notes: '' })
  const [openSaving, setOpenSaving] = useState(false)

  // ─── Close Shift Modal ───────────────────────────────────────
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [closingShift, setClosingShift] = useState(null)
  const [closeForm, setCloseForm] = useState({ closing_cash: '', notes: '' })
  const [closeSaving, setCloseSaving] = useState(false)

  const canManage = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'cashier'

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [shiftsRes, currentRes] = await Promise.all([
        listShifts({ status: statusFilter || undefined }),
        getCurrentShift()
      ])
      setShifts(shiftsRes.data.data || [])
      setCurrentShift(currentRes.data.data || null)
    } catch {
      toast.error('Failed to load shifts')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, toast])

  useEffect(() => { fetchData() }, [fetchData])

  // ─── Open Shift ──────────────────────────────────────────────
  const handleOpenShift = async (e) => {
    e.preventDefault()
    setOpenSaving(true)
    try {
      await openShift({
        opening_cash: Number(openForm.opening_cash || 0),
        notes: openForm.notes || null
      })
      toast.success('Shift opened successfully')
      setShowOpenModal(false)
      setOpenForm({ opening_cash: '', notes: '' })
      fetchData()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to open shift')
    } finally {
      setOpenSaving(false)
    }
  }

  // ─── Close Shift ─────────────────────────────────────────────
  const initiateClose = (shift) => {
    setClosingShift(shift)
    setCloseForm({ closing_cash: '', notes: shift.notes || '' })
    setShowCloseModal(true)
  }

  const handleCloseShift = async (e) => {
    e.preventDefault()
    if (!closingShift) return
    setCloseSaving(true)
    try {
      await closeShift(closingShift.shift_id, {
        closing_cash: Number(closeForm.closing_cash || 0),
        notes: closeForm.notes || null
      })
      toast.success('Shift closed successfully')
      setShowCloseModal(false)
      setClosingShift(null)
      fetchData()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to close shift')
    } finally {
      setCloseSaving(false)
    }
  }

  const elapsed = (openedAt) => {
    if (!openedAt) return ''
    const mins = Math.floor((Date.now() - new Date(openedAt)) / 60000)
    if (mins < 60) return `${mins}m`
    return `${Math.floor(mins / 60)}h ${mins % 60}m`
  }

  return (
    <div className="shifts-page">
      {/* ─── Header ─── */}
      <div className="shifts-header-wrap">
        <div>
          <h1 className="shifts-title">Shift Management</h1>
          <p className="shifts-subtitle">Track cashier sessions and cash reconciliation</p>
        </div>
        <div className="shifts-header-actions">
          {canManage && !currentShift && (
            <button className="btn btn-primary" onClick={() => setShowOpenModal(true)}>
              🟢 Open Shift
            </button>
          )}
        </div>
      </div>

      {/* ─── Active Shift Banner ─── */}
      {currentShift && (
        <div className="active-shift-banner">
          <div className="asb-left">
            <div className="asb-dot" />
            <div className="asb-info">
              <span className="asb-label">Active Shift</span>
              <span className="asb-cashier">{currentShift.cashier_name}</span>
              <span className="asb-meta">Opened {formatDateTime(currentShift.opened_at)} · {elapsed(currentShift.opened_at)} ago</span>
            </div>
          </div>
          <div className="asb-stats">
            <div className="asb-stat">
              <span className="asb-stat-label">Opening Cash</span>
              <span className="asb-stat-value">{formatMoney(currentShift.opening_cash)}</span>
            </div>
            {canManage && (
              <button className="btn btn-danger" onClick={() => initiateClose(currentShift)}>
                🔴 End Shift
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── Shifts Table ─── */}
      <div className="card shifts-table-card">
        <div className="shifts-table-header">
          <span className="shifts-table-title">Shift History</span>
          <div className="shifts-filter-group">
            <select
              className="shifts-filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Shifts</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>

        <div className="shifts-table-wrap">
          {loading ? (
            <div className="shifts-loading"><div className="spinner" /></div>
          ) : shifts.length === 0 ? (
            <div className="shifts-empty">
              <div className="shifts-empty-icon">🗓️</div>
              <p className="shifts-empty-text">No shifts found.</p>
              {canManage && !currentShift && (
                <button className="btn btn-primary" onClick={() => setShowOpenModal(true)}>
                  Open First Shift
                </button>
              )}
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Cashier</th>
                  <th>Opened At</th>
                  <th>Closed At</th>
                  <th>Opening Cash</th>
                  <th>Expected Cash</th>
                  <th>Closing Cash</th>
                  <th>Variance</th>
                  <th>Status</th>
                  {canManage && <th style={{ textAlign: 'right' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {shifts.map(s => {
                  const variance = s.variance !== null && s.variance !== undefined ? Number(s.variance) : null
                  return (
                    <tr key={s.shift_id}>
                      <td><code style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>#{s.shift_id}</code></td>
                      <td><strong>{s.cashier_name || '—'}</strong></td>
                      <td>{formatDateTime(s.opened_at)}</td>
                      <td>{formatDateTime(s.closed_at)}</td>
                      <td>{formatMoney(s.opening_cash)}</td>
                      <td>{s.expected_cash !== null ? formatMoney(s.expected_cash) : '—'}</td>
                      <td>{s.closing_cash !== null ? formatMoney(s.closing_cash) : '—'}</td>
                      <td>
                        {variance === null ? '—' : (
                          <span className={
                            variance > 0 ? 'variance-positive' :
                            variance < 0 ? 'variance-negative' : 'variance-zero'
                          }>
                            {variance > 0 ? '+' : ''}{formatMoney(variance)}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${s.status === 'open' ? 'badge-success' : 'badge-neutral'}`}>
                          {s.status === 'open' ? 'OPEN' : 'CLOSED'}
                        </span>
                      </td>
                      {canManage && (
                        <td style={{ textAlign: 'right' }}>
                          {s.status === 'open' && (
                            <button className="btn-icon-sm btn-end-shift" onClick={() => initiateClose(s)}>
                              End Shift
                            </button>
                          )}
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

      {/* ─── Open Shift Modal ─── */}
      {showOpenModal && (
        <div className="modal-backdrop" onClick={() => setShowOpenModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🟢 Open New Shift</h2>
              <button className="modal-close" onClick={() => setShowOpenModal(false)}>✕</button>
            </div>
            <form onSubmit={handleOpenShift}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Opening Cash Amount (Rs.)</label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={openForm.opening_cash}
                    onChange={e => setOpenForm(f => ({ ...f, opening_cash: e.target.value }))}
                  />
                  <span className="form-hint">Count your cash drawer before starting.</span>
                </div>
                <div className="form-group">
                  <label className="form-label">Notes (Optional)</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    placeholder="Any notes for this shift..."
                    value={openForm.notes}
                    onChange={e => setOpenForm(f => ({ ...f, notes: e.target.value }))}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowOpenModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={openSaving}>
                  {openSaving ? 'Opening...' : 'Open Shift'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Close Shift Modal ─── */}
      {showCloseModal && closingShift && (
        <div className="modal-backdrop" onClick={() => setShowCloseModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🔴 End Shift</h2>
              <button className="modal-close" onClick={() => setShowCloseModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCloseShift}>
              <div className="modal-body">
                <div className="close-shift-summary">
                  <div className="css-row">
                    <span>Cashier</span>
                    <span>{closingShift.cashier_name}</span>
                  </div>
                  <div className="css-row">
                    <span>Opened At</span>
                    <span>{formatDateTime(closingShift.opened_at)}</span>
                  </div>
                  <div className="css-row">
                    <span>Duration</span>
                    <span>{elapsed(closingShift.opened_at)}</span>
                  </div>
                  <hr className="css-divider" />
                  <div className="css-row">
                    <span>Opening Cash</span>
                    <span>{formatMoney(closingShift.opening_cash)}</span>
                  </div>
                  {closingShift.expected_cash !== null && (
                    <div className="css-row">
                      <span>Expected Cash</span>
                      <span>{formatMoney(closingShift.expected_cash)}</span>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Actual Closing Cash (Rs.) *</label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    required
                    value={closeForm.closing_cash}
                    onChange={e => setCloseForm(f => ({ ...f, closing_cash: e.target.value }))}
                  />
                  <span className="form-hint">Count your cash drawer physically before entering.</span>
                </div>
                <div className="form-group">
                  <label className="form-label">Notes (Optional)</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    value={closeForm.notes}
                    onChange={e => setCloseForm(f => ({ ...f, notes: e.target.value }))}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCloseModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-danger" disabled={closeSaving}>
                  {closeSaving ? 'Closing...' : 'End Shift'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
