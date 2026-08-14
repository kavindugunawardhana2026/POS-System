import { forwardRef } from 'react'
import './Receipt.css'

/**
 * Thermal receipt template — optimized for 80mm and 58mm printers.
 * Pass the `paperWidth` prop: '80mm' (default) or '58mm'.
 *
 * Expected `invoice` shape:
 *  {
 *    invoice_number, created_at, cashier, customer_name?,
 *    sale_type,
 *    items: [{ product_name, product_sku, quantity, unit_price, discount, subtotal }],
 *    payments: [{ payment_method, amount }],
 *    subtotal, discount, tax_amount, total_amount, paid_amount, change_due, balance_due
 *  }
 *
 * Expected `shopInfo` shape:
 *  { store_name, address, phone, receipt_header, receipt_footer, thermal_printer }
 */
const Receipt = forwardRef(function Receipt({ invoice, shopInfo, paperWidth }, ref) {
  if (!invoice) return null

  const shop    = shopInfo || {}
  const width   = paperWidth || shop.thermal_printer || '80mm'
  const items   = invoice.items   || []
  const payments= invoice.payments|| []

  const fmt = (n) =>
    Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

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
  const timeStr = dt.toLocaleTimeString('en-LK', { hour:'2-digit', minute:'2-digit', hour12: true })

  return (
    <div ref={ref} className={`receipt receipt-${width === '58mm' ? '58' : '80'}`}>

      {/* ── Header ── */}
      <div className="rct-header">
        <div className="rct-shop-name">{shop.store_name || 'POS Store'}</div>
        {shop.address && <div className="rct-shop-address">{shop.address}</div>}
        {shop.phone   && <div className="rct-shop-phone">Tel: {shop.phone}</div>}
        {shop.receipt_header && (
          <div className="rct-shop-tagline">{shop.receipt_header}</div>
        )}
      </div>

      <div className="rct-divider rct-dashes" />

      {/* ── Meta ── */}
      <div className="rct-meta">
        <div className="rct-meta-row">
          <span>Invoice#</span>
          <span>{invoice.invoice_number}</span>
        </div>
        <div className="rct-meta-row">
          <span>Date</span>
          <span>{dateStr}</span>
        </div>
        <div className="rct-meta-row">
          <span>Time</span>
          <span>{timeStr}</span>
        </div>
        <div className="rct-meta-row">
          <span>Cashier</span>
          <span>{invoice.cashier || '—'}</span>
        </div>
        {invoice.customer_name && (
          <div className="rct-meta-row">
            <span>Customer</span>
            <span>{invoice.customer_name}</span>
          </div>
        )}
        <div className="rct-meta-row">
          <span>Mode</span>
          <span className="rct-mode">{invoice.sale_type === 'wholesale' ? 'Wholesale' : 'Retail'}</span>
        </div>
      </div>

      <div className="rct-divider rct-dashes" />

      {/* ── Items ── */}
      <table className="rct-items">
        <thead>
          <tr>
            <th className="rct-col-name">Item</th>
            <th className="rct-col-qty">Qty</th>
            <th className="rct-col-price">Price</th>
            <th className="rct-col-total">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <>
              <tr key={i}>
                <td className="rct-col-name">{it.product_name}</td>
                <td className="rct-col-qty">{formatQty(it)}</td>
                <td className="rct-col-price">{fmt(it.unit_price)}</td>
                <td className="rct-col-total">{fmt(it.subtotal)}</td>
              </tr>
              {Number(it.discount) > 0 && (
                <tr key={`${i}-disc`} className="rct-item-discount">
                  <td colSpan={3} className="rct-col-name">  ↳ Discount</td>
                  <td className="rct-col-total">-{fmt(it.discount)}</td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>

      <div className="rct-divider rct-dashes" />

      {/* ── Totals ── */}
      <div className="rct-totals">
        <div className="rct-total-row">
          <span>Subtotal</span>
          <span>{fmt(invoice.subtotal)}</span>
        </div>
        {Number(invoice.discount) > 0 && (
          <div className="rct-total-row">
            <span>Discount</span>
            <span>- {fmt(invoice.discount)}</span>
          </div>
        )}
        {Number(invoice.tax_amount) > 0 && (
          <div className="rct-total-row">
            <span>Tax</span>
            <span>{fmt(invoice.tax_amount)}</span>
          </div>
        )}
        <div className="rct-divider rct-solid" />
        <div className="rct-total-row rct-grand-total">
          <span>TOTAL</span>
          <span>Rs. {fmt(invoice.total_amount)}</span>
        </div>
      </div>

      <div className="rct-divider rct-dashes" />

      {/* ── Payments ── */}
      <div className="rct-payments">
        {payments.map((p, i) => (
          <div key={i} className="rct-total-row">
            <span>{p.payment_method.charAt(0).toUpperCase() + p.payment_method.slice(1)}</span>
            <span>{fmt(p.amount)}</span>
          </div>
        ))}
        {Number(invoice.change_due) > 0 && (
          <div className="rct-total-row">
            <span>Change</span>
            <span>{fmt(invoice.change_due)}</span>
          </div>
        )}
        {Number(invoice.balance_due) > 0 && (
          <div className="rct-total-row rct-balance-due">
            <span>Balance Due</span>
            <span>{fmt(invoice.balance_due)}</span>
          </div>
        )}
      </div>

      <div className="rct-divider rct-dashes" />

      {/* ── Footer ── */}
      <div className="rct-footer">
        {shop.receipt_footer || 'Thank you! Visit again.'}
      </div>

      <div className="rct-barcode">
        ||||  {invoice.invoice_number}  ||||
      </div>

      {/* Extra feed space for cutter */}
      <div className="rct-feed" />
    </div>
  )
})

export default Receipt
