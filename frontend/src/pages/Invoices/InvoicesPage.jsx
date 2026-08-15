import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { listInvoices, cancelInvoice } from '@/services/invoiceService'
import { Eye, XCircle } from 'lucide-react'
import './InvoicesPage.css'

const fmt = (n) => Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const STATUS_BADGE = {
  paid:               'badge-success',
  partial:            'badge-warning',
  unpaid:             'badge-danger',
  draft:              'badge-neutral',
  cancelled:          'badge-neutral',
  void:               'badge-neutral',
  refunded:           'badge-accent',
  partially_refunded: 'badge-accent',
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
    <div className="invoices-page page-root">
      <div className="page-header">
        <div>
          <h1 className="page-title">Invoices</h1>
          <p className="page-subtitle">{meta.total || 0} invoices total</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="invoices-toolbar">
        {STATUSES.map(s => (
          <button
            key={s}
            className={`btn ${status === s ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setStatus(s)}
          >
            {s}
          </button>
        ))}
        <div className="invoices-date-range">
          <span className="invoices-date-label">From:</span>
          <input className="invoices-date-input" type="date" value={from} onChange={e => setFrom(e.target.value)} />
          <span className="invoices-date-label">To:</span>
          <input className="invoices-date-input" type="date" value={to} onChange={e => setTo(e.target.value)} />
          {(from || to) && (
            <button className="btn btn-secondary btn-sm" onClick={() => { setFrom(''); setTo('') }}>Clear</button>
          )}
        </div>
      </div>

      <div className="card table-card">
        {loading ? (
          <div className="table-loading"><div className="spinner" /></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Cashier</th>
                  <th>Type</th>
                  <th className="num">Total</th>
                  <th className="num">Paid</th>
                  <th className="num">Balance</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 && (
                  <tr><td colSpan={10} className="table-empty" style={{ padding: 32 }}>No invoices found</td></tr>
                )}
                {invoices.map(inv => (
                  <tr
                    key={inv.invoice_id}
                    className="invoice-row table-row-hover"
                    onClick={() => navigate(`/invoices/${inv.invoice_id}`)}
                  >
                    <td><span className="invoice-number">{inv.invoice_number}</span></td>
                    <td>
                      <div className="invoice-date-primary">{new Date(inv.created_at).toLocaleDateString()}</div>
                      <div className="invoice-date-secondary">{new Date(inv.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </td>
                    <td>{inv.customer_name || <span className="walk-in-text">Walk-in</span>}</td>
                    <td><span className="cashier-cell">{inv.cashier}</span></td>
                    <td>
                      <span className={`badge ${inv.sale_type === 'wholesale' ? 'badge-accent' : 'badge-neutral'}`}>
                        {inv.sale_type}
                      </span>
                    </td>
                    <td className="num amount-total">Rs. {fmt(inv.total_amount)}</td>
                    <td className="num">Rs. {fmt(inv.paid_amount)}</td>
                    <td className="num">
                      {inv.balance_due > 0
                        ? <span className="balance-due">Rs. {fmt(inv.balance_due)}</span>
                        : <span className="balance-none">—</span>}
                    </td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[inv.status] || 'badge-neutral'}`}>
                        {inv.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <div className="action-btns">
                        <button className="btn-icon" title="View" onClick={() => navigate(`/invoices/${inv.invoice_id}`)}>
                          <Eye size={15} />
                        </button>
                        {me?.role === 'admin' && !['cancelled', 'void', 'refunded'].includes(inv.status) && (
                          <button className="btn-icon btn-icon-danger" title="Cancel" onClick={e => handleCancel(e, inv)}>
                            <XCircle size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {meta.pages > 1 && (
          <div className="pagination">
            <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <span className="pagination-info">Page {page} of {meta.pages}</span>
            <button className="btn btn-secondary btn-sm" disabled={page >= meta.pages} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        )}
      </div>
    </div>
  )
}
