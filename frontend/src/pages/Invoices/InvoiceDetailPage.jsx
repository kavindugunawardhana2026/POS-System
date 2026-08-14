import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { getInvoice, cancelInvoice } from '@/services/invoiceService'
import api from '@/services/api'
import ReceiptPreview from '@/components/Receipt/ReceiptPreview'

const fmt = (n) => Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const STATUS_BADGE = {
  paid:               'badge-success',
  partial:            'badge-warning',
  unpaid:             'badge-danger',
  draft:              'badge-neutral',
  cancelled:          'badge-neutral',
  void:               'badge-neutral',
  refunded:           'badge-info',
  partially_refunded: 'badge-info',
}

export default function InvoiceDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user: me } = useAuth()
  const toast = useToast()

  const [invoice, setInvoice] = useState(null)
  const [shopInfo, setShopInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showReceipt, setShowReceipt] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    const loadAll = async () => {
      try {
        const [invRes, settingsRes] = await Promise.all([
          getInvoice(id),
          api.get('/settings'),
        ])
        setInvoice(invRes.data.data)
        setShopInfo(settingsRes.data.data)
      } catch {
        toast.error('Failed to load invoice')
      } finally {
        setLoading(false)
      }
    }
    loadAll()
  }, [id, toast])

  const handleCancel = async () => {
    if (!window.confirm(`Cancel invoice ${invoice.invoice_number}? This cannot be undone.`)) return
    setCancelling(true)
    try {
      await cancelInvoice(invoice.invoice_id)
      toast.success('Invoice cancelled')
      setInvoice(prev => ({ ...prev, status: 'cancelled' }))
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to cancel invoice')
    } finally {
      setCancelling(false)
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div className="spinner" /></div>
  )

  if (!invoice) return (
    <div className="page-container">
      <div className="page-header"><h1>Invoice not found</h1></div>
      <button className="btn btn-secondary" onClick={() => navigate('/invoices')}>← Back</button>
    </div>
  )

  const items    = invoice.items    || []
  const payments = invoice.payments || []

  return (
    <div className="page-container" style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-secondary" onClick={() => navigate('/invoices')} style={{ padding: '6px 12px' }}>← Back</button>
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>{invoice.invoice_number}</h1>
            <p className="page-subtitle" style={{ margin: 0 }}>
              {new Date(invoice.created_at).toLocaleString()} &bull; {invoice.cashier}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => setShowReceipt(true)}>🖨️ Print</button>
          {me?.role === 'admin' && !['cancelled', 'void', 'refunded'].includes(invoice.status) && (
            <button className="btn btn-danger" onClick={handleCancel} disabled={cancelling}>
              {cancelling ? 'Cancelling...' : '❌ Cancel Invoice'}
            </button>
          )}
        </div>
      </div>

      {/* Meta Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Status',    value: <span className={`badge ${STATUS_BADGE[invoice.status] || 'badge-neutral'}`} style={{ textTransform: 'capitalize' }}>{invoice.status.replace('_',' ')}</span> },
          { label: 'Customer',  value: invoice.customer_name || 'Walk-in' },
          { label: 'Sale Type', value: invoice.sale_type },
          { label: 'Balance Due', value: invoice.balance_due > 0 ? <span style={{ color: 'var(--danger)', fontWeight: 700 }}>Rs. {fmt(invoice.balance_due)}</span> : <span style={{ color: 'var(--success)' }}>Fully Paid</span> },
        ].map(card => (
          <div key={card.label} className="card" style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>{card.label}</div>
            <div style={{ fontWeight: 600 }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Items */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>📦 Items</div>
        <table className="table">
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th style={{ textAlign: 'center' }}>Qty</th>
              <th style={{ textAlign: 'right' }}>Unit Price</th>
              <th style={{ textAlign: 'right' }}>Discount</th>
              <th style={{ textAlign: 'right' }}>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i}>
                <td>{it.product_name}</td>
                <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{it.product_sku || '—'}</td>
                <td style={{ textAlign: 'center' }}>{Number(it.quantity)}</td>
                <td style={{ textAlign: 'right' }}>Rs. {fmt(it.unit_price)}</td>
                <td style={{ textAlign: 'right', color: it.discount > 0 ? 'var(--danger)' : 'inherit' }}>
                  {it.discount > 0 ? `− Rs. ${fmt(it.discount)}` : '—'}
                </td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>Rs. {fmt(it.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals + Payments */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Payments */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>💳 Payments</div>
          <div style={{ padding: '12px 16px' }}>
            {payments.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>No payments recorded</p>}
            {payments.map((p, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < payments.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <span style={{ textTransform: 'capitalize' }}>
                  {p.payment_method === 'wallet' && String(p.reference_no).includes('Points') ? 'Loyalty Redeemed' : p.payment_method}
                  {p.reference_no && !String(p.reference_no).includes('Points') && <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: 6 }}>({p.reference_no})</span>}
                </span>
                <strong>Rs. {fmt(p.amount)}</strong>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="card" style={{ padding: '16px' }}>
          {[
            { label: 'Subtotal',    value: `Rs. ${fmt(invoice.subtotal)}` },
            { label: 'Discount',    value: invoice.discount > 0 ? `− Rs. ${fmt(invoice.discount)}` : '—', color: invoice.discount > 0 ? 'var(--danger)' : undefined },
            { label: 'Tax',         value: invoice.tax_amount > 0 ? `Rs. ${fmt(invoice.tax_amount)}` : '—' },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>{row.label}</span>
              <span style={{ color: row.color }}>{row.value}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 0', fontWeight: 700, fontSize: '1.1rem' }}>
            <span>Total</span>
            <span>Rs. {fmt(invoice.total_amount)}</span>
          </div>
          {invoice.change_due > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: 'var(--success)', fontSize: '0.9rem' }}>
              <span>Change Given</span>
              <span>Rs. {fmt(invoice.change_due)}</span>
            </div>
          )}
          {invoice.balance_due > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: 'var(--danger)', fontWeight: 600 }}>
              <span>Balance Due</span>
              <span>Rs. {fmt(invoice.balance_due)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Receipt Preview */}
      {showReceipt && (
        <ReceiptPreview
          invoice={{ ...invoice, cashier: invoice.cashier }}
          shopInfo={shopInfo}
          onClose={() => setShowReceipt(false)}
        />
      )}
    </div>
  )
}
