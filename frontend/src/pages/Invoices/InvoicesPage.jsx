import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { listInvoices, cancelInvoice } from '@/services/invoiceService'

const fmt = (n) => Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const STATUS_BADGE = {
  paid:                'badge-success',
  partial:             'badge-warning',
  unpaid:              'badge-danger',
  draft:               'badge-neutral',
  cancelled:           'badge-neutral',
  void:                'badge-neutral',
  refunded:            'badge-info',
  partially_refunded:  'badge-info',
}

const STATUSES = ['all', 'paid', 'partial', 'unpaid', 'cancelled', 'void']

export default function InvoicesPage() {
  const navigate = useNavigate()
  const { user: me } = useAuth()
  const toast = useToast()

  const [invoices, setInvoices] = useState([])
  const [meta, setMeta]         = useState({})
  const [loading, setLoading]   = useState(true)
  const [page, setPage]         = useState(1)
  const [status, setStatus]     = useState('all')
  const [from, setFrom]         = useState('')
  const [to, setTo]             = useState('')

  const fetchInvoices = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit: 25 }
      if (status !== 'all') params.status = status
      if (from) params.from = from
      if (to)   params.to   = to
      const res = await listInvoices(params)
      setInvoices(res.data.data)
      setMeta(res.data.meta)
    } catch {
      toast.error('Failed to load invoices')
    } finally {
      setLoading(false)
    }
  }, [page, status, from, to, toast])

  useEffect(() => { fetchInvoices() }, [fetchInvoices])
  useEffect(() => { setPage(1) }, [status, from, to])

  const handleCancel = async (e, inv) => {
    e.stopPropagation()
    if (!window.confirm(`Cancel invoice ${inv.invoice_number}? This cannot be undone.`)) return
    try {
      await cancelInvoice(inv.invoice_id)
      toast.success('Invoice cancelled')
      fetchInvoices()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to cancel invoice')
    }
  }

  return (
    <div className="users-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Invoices</h1>
          <p className="page-subtitle">{meta.total || 0} invoices</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="users-toolbar" style={{ flexWrap: 'wrap', gap: 8 }}>
        {STATUSES.map(s => (
          <button
            key={s}
            className={`btn ${status === s ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '4px 12px', fontSize: '0.85rem', textTransform: 'capitalize' }}
            onClick={() => setStatus(s)}
          >
            {s}
          </button>
        ))}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto' }}>
          <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>From:</label>
          <input className="input" type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ width: 145 }} />
          <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>To:</label>
          <input className="input" type="date" value={to} onChange={e => setTo(e.target.value)} style={{ width: 145 }} />
          {(from || to) && <button className="btn btn-secondary" onClick={() => { setFrom(''); setTo('') }}>Clear</button>}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="table-loading"><div className="spinner" /></div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Cashier</th>
                <th>Type</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th style={{ textAlign: 'right' }}>Paid</th>
                <th style={{ textAlign: 'right' }}>Balance</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 && (
                <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 32 }}>No invoices found</td></tr>
              )}
              {invoices.map(inv => (
                <tr
                  key={inv.invoice_id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/invoices/${inv.invoice_id}`)}
                  className="table-row-hover"
                >
                  <td><strong style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{inv.invoice_number}</strong></td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {new Date(inv.created_at).toLocaleDateString()}
                    <br />
                    <span style={{ fontSize: '0.75rem' }}>{new Date(inv.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </td>
                  <td>{inv.customer_name || <span style={{ color: 'var(--text-secondary)' }}>Walk-in</span>}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{inv.cashier}</td>
                  <td>
                    <span className={`badge ${inv.sale_type === 'wholesale' ? 'badge-info' : 'badge-neutral'}`} style={{ fontSize: '0.75rem' }}>
                      {inv.sale_type}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>Rs. {fmt(inv.total_amount)}</td>
                  <td style={{ textAlign: 'right' }}>Rs. {fmt(inv.paid_amount)}</td>
                  <td style={{ textAlign: 'right', color: inv.balance_due > 0 ? 'var(--danger)' : 'inherit' }}>
                    {inv.balance_due > 0 ? `Rs. ${fmt(inv.balance_due)}` : '—'}
                  </td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[inv.status] || 'badge-neutral'}`} style={{ textTransform: 'capitalize' }}>
                      {inv.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <div className="action-btns">
                      <button className="btn-icon" title="View" onClick={() => navigate(`/invoices/${inv.invoice_id}`)}>👁️</button>
                      {me?.role === 'admin' && !['cancelled', 'void', 'refunded'].includes(inv.status) && (
                        <button className="btn-icon btn-icon-danger" title="Cancel" onClick={e => handleCancel(e, inv)}>❌</button>
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
    </div>
  )
}
