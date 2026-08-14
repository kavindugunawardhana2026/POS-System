import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '@/context/ToastContext'
import { getInvoice } from '@/services/invoiceService'
import { createReturn } from '@/services/returnService'
import ReceiptPreview from '@/components/Receipt/ReceiptPreview'
import './ReturnsPage.css'

const RETURN_REASONS = [
  { value: 'damaged',           label: 'Damaged / Defective' },
  { value: 'wrong_item',        label: 'Wrong Item Delivered' },
  { value: 'customer_change',   label: 'Customer Changed Mind' },
  { value: 'unsatisfied',       label: 'Customer Unsatisfied' },
  { value: 'expired',           label: 'Expired Product' },
  { value: 'overcharged',       label: 'Overcharged' },
  { value: 'other',             label: 'Other' },
]

const REFUND_METHODS = [
  { value: 'credit_note', label: '📄 Credit Note (use on next purchase)' },
  { value: 'cash',        label: '💵 Cash Refund' },
  { value: 'card',        label: '💳 Card Refund' },
]

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100
const fmt    = (n) => Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function ReturnsPage() {
  const { t } = useTranslation()
  const toast = useToast()

  // Step 1 — lookup
  const [invoiceInput, setInvoiceInput] = useState('')
  const [invoice, setInvoice]           = useState(null)
  const [lookupLoading, setLookupLoading] = useState(false)

  // Step 2 — select items
  const [selected, setSelected] = useState({})   // { invoice_item_id: { checked, qty, refund_amount } }
  const [reason, setReason]     = useState('')
  const [refundMethod, setRefundMethod] = useState('credit_note')
  const [notes, setNotes]       = useState('')

  // Step 3 — result
  const [submitting, setSubmitting]   = useState(false)
  const [completed, setCompleted]     = useState(null)    // return object
  const [showReceipt, setShowReceipt] = useState(false)

  const inputRef = useRef(null)

  // ── Step 1: Fetch Invoice ──────────────────────────────────────
  const handleLookup = async () => {
    const q = invoiceInput.trim()
    if (!q) return
    setLookupLoading(true)
    setInvoice(null)
    setSelected({})
    try {
      // Try numeric ID first, then search by invoice_number via query
      let res
      if (/^\d+$/.test(q)) {
        res = await getInvoice(q)
      } else {
        // Search by invoice_number — call list with a filter
        const { default: api } = await import('@/services/api')
        const listRes = await api.get('/invoices', { params: { invoice_number: q, limit: 1 } })
        const rows = listRes.data.data
        if (!rows?.length) throw new Error('Invoice not found')
        res = await getInvoice(rows[0].invoice_id)
      }
      const inv = res.data.data
      if (['cancelled','void'].includes(inv.status)) {
        toast.error(`Invoice is ${inv.status} — cannot process return`)
        return
      }
      setInvoice(inv)
      // Pre-populate selection with all items unchecked
      const sel = {}
      for (const it of (inv.items || [])) {
        sel[it.invoice_item_id] = {
          checked: false,
          qty: Number(it.quantity),
          refund_amount: round2(Number(it.subtotal)),
        }
      }
      setSelected(sel)
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || 'Invoice not found')
    } finally {
      setLookupLoading(false)
    }
  }

  const toggleItem = (id) => {
    setSelected(prev => ({
      ...prev,
      [id]: { ...prev[id], checked: !prev[id].checked },
    }))
  }

  const updateField = (id, field, val) => {
    setSelected(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: val },
    }))
  }

  const selectedItems = invoice
    ? (invoice.items || []).filter(it => selected[it.invoice_item_id]?.checked)
    : []

  const totalRefund = round2(
    selectedItems.reduce((s, it) => s + Number(selected[it.invoice_item_id]?.refund_amount || 0), 0)
  )

  // ── Step 2: Submit Return ──────────────────────────────────────
  const handleSubmit = async () => {
    if (!selectedItems.length) { toast.warning('Select at least one item to return'); return }
    if (!reason)               { toast.warning('Please select a return reason'); return }

    setSubmitting(true)
    try {
      const payload = {
        invoice_id:    invoice.invoice_id,
        reason,
        refund_method: refundMethod,
        notes:         notes || null,
        items: selectedItems.map(it => ({
          invoice_item_id:  it.invoice_item_id,
          product_id:       it.product_id,
          quantity_returned: Number(selected[it.invoice_item_id].qty),
          refund_amount:    round2(Number(selected[it.invoice_item_id].refund_amount)),
          restock:          true,
        })),
      }
      const res = await createReturn(payload)
      toast.success(`Return ${res.data.data.return_number} created!`)
      setCompleted(res.data.data)
      setShowReceipt(true)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to create return')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReset = () => {
    setInvoice(null); setSelected({}); setInvoiceInput('')
    setReason(''); setNotes(''); setRefundMethod('credit_note')
    setCompleted(null); setShowReceipt(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  // ── Build credit note receipt invoice shape ────────────────────
  const creditNoteInvoice = completed ? {
    invoice_number: completed.return_number,
    created_at:     completed.created_at,
    cashier:        completed.cashier,
    customer_name:  completed.customer_name,
    sale_type:      'return',
    items: (completed.items || []).map(it => ({
      product_name: it.product_name,
      quantity:     it.quantity_returned,
      unit_price:   round2(it.refund_amount / it.quantity_returned),
      discount:     0,
      subtotal:     it.refund_amount,
    })),
    payments: [],
    subtotal:     completed.total_refund,
    discount:     0,
    tax_amount:   0,
    total_amount: completed.total_refund,
    paid_amount:  completed.total_refund,
    change_due:   0,
    balance_due:  0,
    _credit_note: completed.refund_method === 'credit_note',
    _credit_remaining: completed.credit_remaining,
  } : null

  const formatQty = (it) => {
    const qty = Number(it.quantity)
    if (['kg'].includes(it.measurement_unit)) {
      return qty < 1 ? `${(qty*1000).toFixed(0)}g` : `${qty}kg`
    }
    return qty % 1 === 0 ? String(qty) : qty.toFixed(3)
  }

  return (
    <div className="returns-root">
      <div className="returns-header">
        <div>
          <h1 className="returns-title">{t('returns.title', 'Return Orders')}</h1>
          <p className="returns-sub">{t('returns.subtitle', 'Process customer returns and generate credit notes')}</p>
        </div>
      </div>

      {!completed ? (
        <div className="returns-layout">

          {/* ── Step 1: Invoice Lookup ── */}
          <div className="returns-card">
            <div className="returns-card-title">
              <span className="returns-step-badge">1</span>
              {t('returns.step_1', 'Find Original Invoice')}
            </div>
            <div className="returns-lookup-row">
              <input
                ref={inputRef}
                className="returns-input"
                placeholder={t('returns.search_placeholder', 'Enter Invoice # (e.g. INV-20260814-0001) or ID…')}
                value={invoiceInput}
                onChange={e => setInvoiceInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLookup()}
                autoFocus
              />
              <button
                className="btn btn-primary"
                onClick={handleLookup}
                disabled={lookupLoading || !invoiceInput.trim()}
              >
                {lookupLoading ? t('common.searching', 'Searching…') : t('returns.find_invoice', 'Find Invoice')}
              </button>
            </div>

            {invoice && (
              <div className="returns-invoice-meta">
                <div className="rim-row"><span>{t('invoices.invoice', 'Invoice')}</span><strong>{invoice.invoice_number}</strong></div>
                <div className="rim-row"><span>{t('common.date', 'Date')}</span><strong>{new Date(invoice.created_at).toLocaleString()}</strong></div>
                <div className="rim-row"><span>{t('pos.cashier', 'Cashier')}</span><strong>{invoice.cashier || '—'}</strong></div>
                <div className="rim-row"><span>{t('pos.customer', 'Customer')}</span><strong>{invoice.customer_name || t('pos.walk_in', 'Walk-in')}</strong></div>
                <div className="rim-row">
                  <span>{t('common.status', 'Status')}</span>
                  <span className={`returns-status-badge status-${invoice.status}`}>{invoice.status}</span>
                </div>
                <div className="rim-row"><span>{t('pos.total', 'Total')}</span><strong>Rs. {fmt(invoice.total_amount)}</strong></div>
              </div>
            )}
          </div>

          {/* ── Step 2: Select Items ── */}
          {invoice && (
            <div className="returns-card">
              <div className="returns-card-title">
                <span className="returns-step-badge">2</span>
                {t('returns.step_2', 'Select Items to Return')}
              </div>
              <div className="returns-items-table-wrap">
                <table className="returns-items-table">
                  <thead>
                    <tr>
                      <th></th>
                      <th>{t('products.name', 'Product')}</th>
                      <th>{t('returns.orig_qty', 'Orig. Qty')}</th>
                      <th>{t('returns.return_qty', 'Return Qty')}</th>
                      <th>{t('returns.unit_price', 'Unit Price')}</th>
                      <th>{t('returns.refund_amount', 'Refund Amount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(invoice.items || []).map(it => {
                      const sel = selected[it.invoice_item_id] || {}
                      return (
                        <tr key={it.invoice_item_id} className={sel.checked ? 'selected-row' : ''}>
                          <td>
                            <input
                              type="checkbox"
                              className="returns-checkbox"
                              checked={!!sel.checked}
                              onChange={() => toggleItem(it.invoice_item_id)}
                            />
                          </td>
                          <td>
                            <div className="returns-item-name">{it.product_name}</div>
                            <div className="returns-item-sku">{it.product_sku}</div>
                          </td>
                          <td>{formatQty(it)}</td>
                          <td>
                            {sel.checked ? (
                              <input
                                className="returns-qty-input"
                                type="number"
                                min="0.001"
                                max={it.quantity}
                                step={it.measurement_unit === 'kg' ? '0.001' : '1'}
                                value={sel.qty}
                                onChange={e => {
                                  const q = parseFloat(e.target.value) || 0
                                  const maxQ = Number(it.quantity)
                                  const safeQ = Math.min(q, maxQ)
                                  const ratio = maxQ > 0 ? safeQ / maxQ : 0
                                  updateField(it.invoice_item_id, 'qty', safeQ)
                                  updateField(it.invoice_item_id, 'refund_amount', round2(Number(it.subtotal) * ratio))
                                }}
                              />
                            ) : (
                              <span className="returns-dim">—</span>
                            )}
                          </td>
                          <td>Rs. {fmt(it.unit_price)}</td>
                          <td>
                            {sel.checked ? (
                              <input
                                className="returns-qty-input"
                                type="number"
                                min="0"
                                step="0.01"
                                value={sel.refund_amount}
                                onChange={e => updateField(it.invoice_item_id, 'refund_amount', parseFloat(e.target.value) || 0)}
                              />
                            ) : (
                              <span className="returns-dim">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Return reason & method */}
              <div className="returns-meta-grid">
                <div className="returns-field">
                  <label className="returns-label">{t('returns.return_reason', 'Return Reason')} *</label>
                  <select
                    className="returns-select"
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                  >
                    <option value="">— {t('returns.select_reason', 'Select reason')} —</option>
                    {RETURN_REASONS.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <div className="returns-field">
                  <label className="returns-label">{t('returns.refund_method', 'Refund Method')} *</label>
                  <div className="returns-method-group">
                    {REFUND_METHODS.map(m => (
                      <button
                        key={m.value}
                        className={`returns-method-btn ${refundMethod === m.value ? 'active' : ''}`}
                        onClick={() => setRefundMethod(m.value)}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="returns-field returns-field-full">
                  <label className="returns-label">{t('returns.notes', 'Notes (optional)')}</label>
                  <textarea
                    className="returns-textarea"
                    rows={2}
                    placeholder={t('returns.notes_placeholder', 'Additional notes…')}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                  />
                </div>
              </div>

              {/* Summary bar */}
              {selectedItems.length > 0 && (
                <div className="returns-summary-bar">
                  <div className="rsb-info">
                    <span>{t('returns.items_selected', '{{count}} item(s) selected', { count: selectedItems.length })}</span>
                    <span className="rsb-total">{t('returns.total_refund', 'Total Refund:')} <strong>Rs. {fmt(totalRefund)}</strong></span>
                    {refundMethod === 'credit_note' && (
                      <span className="rsb-credit">📄 {t('returns.credit_note_generated', 'A Credit Note will be generated')}</span>
                    )}
                  </div>
                  <button
                    className="btn btn-danger btn-lg"
                    onClick={handleSubmit}
                    disabled={submitting || !reason}
                  >
                    {submitting ? t('returns.processing', 'Processing…') : t('returns.process_return', 'Process Return')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

      ) : (
        /* ── Step 3: Success screen ── */
        <div className="returns-success">
          <div className="returns-success-icon">✅</div>
          <h2 className="returns-success-title">{t('returns.success_title', 'Return Processed Successfully')}</h2>
          <div className="returns-success-card">
            <div className="rim-row"><span>{t('returns.return_num', 'Return #')}</span><strong className="returns-rn">{completed.return_number}</strong></div>
            <div className="rim-row"><span>{t('returns.refund_method', 'Refund Method')}</span><strong>{completed.refund_method.replace('_', ' ')}</strong></div>
            <div className="rim-row"><span>{t('returns.total_refund', 'Total Refund')}</span><strong>Rs. {fmt(completed.total_refund)}</strong></div>
            {completed.refund_method === 'credit_note' && (
              <>
                <div className="returns-credit-highlight">
                  <div className="rch-label">{t('returns.credit_note_id', 'Credit Note ID')}</div>
                  <div className="rch-value">{completed.return_number}</div>
                  <div className="rch-hint">
                    {t('returns.credit_note_hint_pre', 'Customer can use this at the POS to deduct')} <strong>Rs. {fmt(completed.credit_remaining)}</strong> {t('returns.credit_note_hint_post', 'from their next purchase.')}
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="returns-success-actions">
            <button className="btn btn-secondary btn-lg" onClick={handleReset}>
              ↩ {t('returns.new_return', 'New Return')}
            </button>
            <button className="btn btn-primary btn-lg" onClick={() => setShowReceipt(true)}>
              🖨️ {t('returns.print_credit_note', 'Print Credit Note')}
            </button>
          </div>
        </div>
      )}

      {showReceipt && creditNoteInvoice && (
        <ReceiptPreview
          invoice={creditNoteInvoice}
          shopInfo={{}}
          autoPrint={!completed?.refund_method || completed.refund_method === 'credit_note'}
          onClose={() => setShowReceipt(false)}
        />
      )}
    </div>
  )
}
