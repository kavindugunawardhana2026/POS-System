import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'
import Barcode from 'react-barcode'
import './ReceiptA4.css'

const ReceiptA4 = forwardRef(function ReceiptA4({ invoice, shopInfo }, ref) {
  const { t } = useTranslation()
  if (!invoice) return null

  const shop    = shopInfo || {}
  const items   = invoice.items   || []
  const payments= invoice.payments|| []
  const isQuote = invoice.status === 'draft'

  const fmt = (n) => Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const formatQty = (item) => {
    const qty = Number(item.quantity)
    if (item.unit === 'kg' || String(item.measurement_unit) === 'kg') {
      if (qty < 1) return `${(qty * 1000).toFixed(0)}g`
      return `${qty.toFixed(3).replace(/\.?0+$/, '')}kg`
    }
    return qty % 1 === 0 ? String(qty) : qty.toFixed(3).replace(/\.?0+$/, '')
  }

  const dt = new Date(invoice.created_at || Date.now())
  const dateStr = dt.toLocaleDateString('en-LK', { day:'2-digit', month:'short', year:'numeric' })

  return (
    <div ref={ref} className="a4-receipt">
      {/* Header */}
      <div className="a4-header">
        <div className="a4-shop-info">
          <h2>{shop.store_name || 'POS Store'}</h2>
          {shop.address && <p>{shop.address}</p>}
          {shop.phone && <p>Tel: {shop.phone}</p>}
          {shop.receipt_header && <p className="a4-tagline">{shop.receipt_header}</p>}
        </div>
        <div className="a4-doc-type">
          <h1>{isQuote ? 'QUOTATION' : 'INVOICE'}</h1>
          <div className="a4-invoice-meta">
            <div><strong>No:</strong> {invoice.invoice_number}</div>
            <div><strong>Date:</strong> {dateStr}</div>
            <div><strong>Type:</strong> {invoice.sale_type.toUpperCase()}</div>
          </div>
        </div>
      </div>

      {/* Customer Info */}
      <div className="a4-customer-info">
        <strong>Bill To:</strong>
        <p>{invoice.customer_name || 'Walk-in Customer'}</p>
      </div>

      {/* Items Table */}
      <table className="a4-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Item Description</th>
            <th>Qty</th>
            <th>Unit Price</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td>
                <div className="a4-item-name">{it.product_name}</div>
                {it.product_sku && <div className="a4-item-sku">{it.product_sku}</div>}
              </td>
              <td>{formatQty(it)}</td>
              <td>Rs. {fmt(it.unit_price)}</td>
              <td className="a4-col-total">Rs. {fmt(it.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals & Payments */}
      <div className="a4-footer">
        <div className="a4-footer-left">
          <Barcode 
            value={invoice.invoice_number} 
            width={1.5} 
            height={40} 
            fontSize={12} 
            displayValue={true} 
            margin={0} 
          />
          {shop.receipt_footer && <p className="a4-footer-note">{shop.receipt_footer}</p>}
        </div>
        
        <div className="a4-totals">
          <div className="a4-total-row">
            <span>Subtotal</span>
            <span>Rs. {fmt(invoice.subtotal)}</span>
          </div>
          {Number(invoice.discount) > 0 && (
            <div className="a4-total-row">
              <span>Discount</span>
              <span>- Rs. {fmt(invoice.discount)}</span>
            </div>
          )}
          <div className="a4-total-row a4-grand-total">
            <span>Grand Total</span>
            <span>Rs. {fmt(invoice.total_amount)}</span>
          </div>

          {!isQuote && (
            <div className="a4-payments">
              {payments.map((p, i) => (
                <div key={i} className="a4-total-row a4-payment-row">
                  <span>Paid ({p.payment_method})</span>
                  <span>Rs. {fmt(p.amount)}</span>
                </div>
              ))}
              {Number(invoice.change_due) > 0 && (
                <div className="a4-total-row a4-payment-row">
                  <span>Change Due</span>
                  <span>Rs. {fmt(invoice.change_due)}</span>
                </div>
              )}
              {Number(invoice.balance_due) > 0 && (
                <div className="a4-total-row a4-payment-row a4-balance">
                  <span>Balance Due</span>
                  <span>Rs. {fmt(invoice.balance_due)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

export default ReceiptA4
