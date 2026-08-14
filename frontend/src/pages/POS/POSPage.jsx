import { useState, useEffect, useCallback, useRef } from 'react'
import { useToast } from '@/context/ToastContext'
import { useAuth } from '@/context/AuthContext'
import { listProducts } from '@/services/productService'
import { createInvoice } from '@/services/invoiceService'
import { validateCredit } from '@/services/returnService'
import ReceiptPreview from '@/components/Receipt/ReceiptPreview'
import api from '@/services/api'
import './POSPage.css'

// ─── Helpers ────────────────────────────────────────────────────────────────

const HOLD_KEY = 'pos_held_orders'
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100
const fmt = (n) =>
  Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function resolvePrice(product, qty, mode) {
  if (
    mode === 'wholesale' &&
    product.wholesale_price != null &&
    product.min_wholesale_quantity != null &&
    qty >= Number(product.min_wholesale_quantity)
  ) {
    return Number(product.wholesale_price)
  }
  return Number(product.retail_price)
}

function buildCartItem(product, qty, mode, weight = null) {
  const effectiveQty = weight !== null ? Number(weight) : Number(qty)
  const unit_price   = resolvePrice(product, effectiveQty, mode)
  const subtotal     = round2(unit_price * effectiveQty)
  return {
    key:        `${product.product_id}-${Date.now()}`,
    product_id: product.product_id,
    name:       product.name,
    sku:        product.sku,
    unit:       product.measurement_unit,
    unit_price,
    quantity:   effectiveQty,
    discount:   0,
    subtotal,
    isWeighted: weight !== null,
  }
}

function recalcItem(item) {
  return { ...item, subtotal: round2(item.unit_price * item.quantity - item.discount) }
}

// ─── Weight Entry Dialog ─────────────────────────────────────────────────────

function WeightDialog({ product, mode, onConfirm, onCancel }) {
  const [weight, setWeight] = useState('')
  const inputRef = useRef(null)
  useEffect(() => inputRef.current?.focus(), [])
  const price = resolvePrice(product, Number(weight) || 0, mode)
  const total = round2(price * (Number(weight) || 0))

  const handleConfirm = () => {
    const w = parseFloat(weight)
    if (!w || w <= 0) return
    onConfirm(w)
  }

  return (
    <div className="pos-dialog-backdrop" onClick={onCancel}>
      <div className="pos-dialog" onClick={e => e.stopPropagation()}>
        <div className="pos-dialog-header">
          <span>Enter Weight</span>
          <button className="pos-dialog-close" onClick={onCancel}>✕</button>
        </div>
        <div className="pos-dialog-body">
          <p className="pos-dialog-product">{product.name}</p>
          <p className="pos-dialog-hint">Price: Rs. {fmt(price)} / Kg</p>
          <input
            ref={inputRef}
            className="pos-weight-input"
            type="number"
            step="0.001"
            min="0"
            placeholder="e.g. 0.500 for 500g"
            value={weight}
            onChange={e => setWeight(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleConfirm()}
          />
          {weight > 0 && (
            <p className="pos-dialog-total">Total: <strong>Rs. {fmt(total)}</strong></p>
          )}
        </div>
        <div className="pos-dialog-footer">
          <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" onClick={handleConfirm} disabled={!weight || Number(weight) <= 0}>
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Hold Orders Panel ───────────────────────────────────────────────────────

function HeldOrdersPanel({ onRestore, onClose }) {
  const [held, setHeld] = useState(() => {
    try { return JSON.parse(localStorage.getItem(HOLD_KEY) || '[]') } catch { return [] }
  })

  const deleteHeld = (id) => {
    const next = held.filter(o => o.id !== id)
    localStorage.setItem(HOLD_KEY, JSON.stringify(next))
    setHeld(next)
  }

  return (
    <div className="pos-dialog-backdrop" onClick={onClose}>
      <div className="pos-dialog pos-hold-panel" onClick={e => e.stopPropagation()}>
        <div className="pos-dialog-header">
          <span>Held Orders ({held.length})</span>
          <button className="pos-dialog-close" onClick={onClose}>✕</button>
        </div>
        <div className="pos-dialog-body pos-hold-list">
          {held.length === 0 && <p className="pos-hold-empty">No held orders.</p>}
          {held.map(order => (
            <div key={order.id} className="pos-hold-item">
              <div>
                <div className="pos-hold-id">#{order.id.slice(-6)}</div>
                <div className="pos-hold-meta">
                  {order.items.length} item(s) · Rs. {fmt(order.total)} ·{' '}
                  {new Date(order.savedAt).toLocaleTimeString()}
                </div>
                <div className="pos-hold-items-list">
                  {order.items.map((it, i) => (
                    <span key={i} className="pos-hold-tag">{it.name}</span>
                  ))}
                </div>
              </div>
              <div className="pos-hold-actions">
                <button className="btn btn-primary btn-sm" onClick={() => { onRestore(order); onClose() }}>
                  Restore
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => deleteHeld(order.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Checkout Panel ──────────────────────────────────────────────────────────

function CheckoutPanel({ cart, saleMode, grandTotal, shopInfo, onSuccess, onClose }) {
  const toast  = useToast()
  const { user } = useAuth()
  const [invoiceDiscount, setInvoiceDiscount] = useState('')
  const [paymentMethod, setPaymentMethod]     = useState('cash')
  const [received, setReceived]               = useState('')
  const [saving, setSaving]                   = useState(false)
  const [completedInvoice, setCompletedInvoice] = useState(null)

  // Credit note
  const [creditInput, setCreditInput]   = useState('')
  const [creditNote, setCreditNote]     = useState(null)  // { return_number, credit_remaining }
  const [creditChecking, setCreditChecking] = useState(false)

  const discountAmt    = round2(Number(invoiceDiscount) || 0)
  const creditAmt      = creditNote ? round2(Math.min(creditNote.credit_remaining, grandTotal - discountAmt)) : 0
  const finalTotal     = round2(grandTotal - discountAmt - creditAmt)
  const receivedAmt    = Number(received) || 0
  const change         = round2(Math.max(0, receivedAmt - finalTotal))
  const balance        = round2(Math.max(0, finalTotal - receivedAmt))
  const canCharge      = receivedAmt >= finalTotal || paymentMethod !== 'cash' || finalTotal <= 0

  const handleApplyCredit = async () => {
    const rn = creditInput.trim().toUpperCase()
    if (!rn) return
    setCreditChecking(true)
    try {
      const res = await validateCredit(rn)
      setCreditNote({ ...res.data.data, return_number: rn })
      toast.success(`Credit note applied! Available: Rs. ${fmt(res.data.data.credit_remaining)}`)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Invalid credit note')
      setCreditNote(null)
    } finally {
      setCreditChecking(false)
    }
  }

  const handleCharge = async () => {
    setSaving(true)
    try {
      const payments = []
      if (finalTotal > 0) {
        payments.push({
          payment_method: paymentMethod,
          amount: paymentMethod === 'cash' ? receivedAmt : finalTotal,
        })
      }
      const payload = {
        sale_type: saleMode,
        discount:  discountAmt,
        credit_note_number: creditNote?.return_number || null,
        items: cart.map(it => ({
          product_id: it.product_id,
          quantity:   it.quantity,
          unit_price: it.unit_price,
          discount:   it.discount,
        })),
        payments,
      }
      const res = await createInvoice(payload)
      toast.success(`Invoice ${res.data.data.invoice_number} created!`)
      const inv = {
        ...res.data.data,
        cashier: user?.username,
        items: (res.data.data.items || []).map((it, i) => ({
          ...it,
          unit: cart[i]?.unit || 'units',
        })),
      }
      setCompletedInvoice(inv)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to create invoice')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="pos-dialog-backdrop" onClick={onClose}>
      <div className="pos-dialog pos-checkout-panel" onClick={e => e.stopPropagation()}>
        <div className="pos-dialog-header">
          <span>Checkout</span>
          <button className="pos-dialog-close" onClick={onClose}>✕</button>
        </div>
        <div className="pos-dialog-body">
          <div className="pos-checkout-summary">
            <div className="pos-summary-row">
              <span>Subtotal</span>
              <span>Rs. {fmt(grandTotal)}</span>
            </div>
            <div className="pos-summary-row">
              <label>Invoice Discount</label>
              <input
                className="pos-co-input"
                type="number" min="0" step="0.01"
                placeholder="0.00"
                value={invoiceDiscount}
                onChange={e => setInvoiceDiscount(e.target.value)}
              />
            </div>
            <div className="pos-summary-row" style={{ marginTop: 8 }}>
              <label>Credit Note</label>
              <div style={{ display: 'flex', gap: 6, flex: 1, marginLeft: 16, justifyContent: 'flex-end' }}>
                <input
                  className="pos-co-input"
                  style={{ width: '130px', textAlign: 'left', textTransform: 'uppercase', padding: '4px 8px' }}
                  placeholder="RET-..."
                  value={creditInput}
                  onChange={e => setCreditInput(e.target.value.toUpperCase())}
                  disabled={!!creditNote || creditChecking}
                  onKeyDown={e => e.key === 'Enter' && !creditNote && handleApplyCredit()}
                />
                {!creditNote ? (
                  <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={handleApplyCredit} disabled={creditChecking || !creditInput}>
                    Apply
                  </button>
                ) : (
                  <button className="btn btn-danger" style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => { setCreditNote(null); setCreditInput('') }}>
                    ✕
                  </button>
                )}
              </div>
            </div>
            {creditNote && (
              <div className="pos-summary-row" style={{ color: 'var(--success)', fontStyle: 'italic', fontSize: '0.85rem' }}>
                <span>Credit Applied</span>
                <span>- Rs. {fmt(creditAmt)}</span>
              </div>
            )}
            <div className="pos-summary-row pos-summary-total">
              <span>Total</span>
              <span>Rs. {fmt(finalTotal)}</span>
            </div>
          </div>

          <div className="pos-payment-methods">
            {['cash','card','transfer'].map(m => (
              <button
                key={m}
                className={`pos-pm-btn ${paymentMethod === m ? 'active' : ''}`}
                onClick={() => setPaymentMethod(m)}
              >
                {m === 'cash' ? '💵 Cash' : m === 'card' ? '💳 Card' : '🏦 Transfer'}
              </button>
            ))}
          </div>

          {paymentMethod === 'cash' && (
            <>
              <label className="pos-co-label">Amount Received</label>
              <input
                className="pos-weight-input"
                type="number" min="0" step="0.01"
                placeholder={`Min Rs. ${fmt(finalTotal)}`}
                value={received}
                onChange={e => setReceived(e.target.value)}
                autoFocus
                onKeyDown={e => e.key === 'Enter' && canCharge && handleCharge()}
              />
              <div className="pos-change-row">
                <div className={`pos-change-box ${change > 0 ? 'pos-change-green' : ''}`}>
                  <div className="pos-change-label">Change</div>
                  <div className="pos-change-val">Rs. {fmt(change)}</div>
                </div>
                {balance > 0 && (
                  <div className="pos-change-box pos-change-red">
                    <div className="pos-change-label">Balance Due</div>
                    <div className="pos-change-val">Rs. {fmt(balance)}</div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        <div className="pos-dialog-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-success pos-charge-btn"
            onClick={handleCharge}
            disabled={saving || (!canCharge && paymentMethod === 'cash')}
          >
            {saving ? 'Processing...' : `Charge Rs. ${fmt(finalTotal)}`}
          </button>
        </div>
      </div>

      {/* Receipt preview appears after successful charge */}
      {completedInvoice && (
        <ReceiptPreview
          invoice={completedInvoice}
          shopInfo={shopInfo}
          autoPrint={true}
          onClose={() => { setCompletedInvoice(null); onSuccess(completedInvoice) }}
        />
      )}
    </div>
  )
}

// ─── Main POS Page ───────────────────────────────────────────────────────────

export default function POSPage() {
  const toast = useToast()

  // Cart state
  const [cart, setCart]           = useState([])
  const [saleMode, setSaleMode]   = useState('retail')   // 'retail' | 'wholesale'

  // Search
  const [search, setSearch]       = useState('')
  const [results, setResults]     = useState([])
  const [searching, setSearching] = useState(false)
  const searchRef                 = useRef(null)

  // Shop settings (for receipt) — API returns a plain { store_name, address, … } object
  const [shopInfo, setShopInfo] = useState({})
  useEffect(() => {
    api.get('/settings').then(r => {
      const raw = r.data.data
      // Backend returns either a plain object or an array of {setting_key, setting_value}
      if (Array.isArray(raw)) {
        const map = {}
        raw.forEach(s => { map[s.setting_key] = s.setting_value })
        setShopInfo(map)
      } else if (raw && typeof raw === 'object') {
        setShopInfo(raw)
      }
    }).catch(() => {})
  }, [])

  // Dialogs
  const [weightProduct, setWeightProduct]   = useState(null)
  const [showHeld, setShowHeld]             = useState(false)
  const [showCheckout, setShowCheckout]     = useState(false)

  // Totals
  const itemCount  = cart.reduce((s, it) => s + Number(it.quantity), 0)
  const grandTotal = round2(cart.reduce((s, it) => s + it.subtotal, 0))

  // ── Search products ──────────────────────────────────────────
  const searchProducts = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); return }
    setSearching(true)
    try {
      const res = await listProducts({ search: q, limit: 8 })
      setResults(res.data.data || [])
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => searchProducts(search), 250)
    return () => clearTimeout(t)
  }, [search, searchProducts])

  // Auto-focus search on mount
  useEffect(() => { searchRef.current?.focus() }, [])

  // ── Recalculate prices when mode changes ─────────────────────
  useEffect(() => {
    setCart(prev => prev.map(it => {
      const newPrice = it.isWeighted
        ? it.unit_price  // weight items keep their locked price
        : it._product ? resolvePrice(it._product, it.quantity, saleMode) : it.unit_price
      return recalcItem({ ...it, unit_price: newPrice })
    }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saleMode])

  // ── Add product to cart ──────────────────────────────────────
  const addProduct = (product) => {
    if (product.measurement_unit === 'kg') {
      setWeightProduct(product)
      setSearch('')
      setResults([])
      return
    }
    setCart(prev => {
      const existing = prev.find(it => it.product_id === product.product_id && !it.isWeighted)
      if (existing) {
        return prev.map(it =>
          it === existing
            ? recalcItem({ ...it, quantity: it.quantity + 1 })
            : it
        )
      }
      return [...prev, buildCartItem(product, 1, saleMode)]
    })
    setSearch('')
    setResults([])
    searchRef.current?.focus()
  }

  const addWeighted = (weight) => {
    setCart(prev => [...prev, buildCartItem(weightProduct, 1, saleMode, weight)])
    setWeightProduct(null)
    searchRef.current?.focus()
  }

  // ── Cart item operations ─────────────────────────────────────
  const updateQty = (key, qty) => {
    if (qty <= 0) { removeItem(key); return }
    setCart(prev => prev.map(it => it.key === key ? recalcItem({ ...it, quantity: qty }) : it))
  }

  const updateDiscount = (key, discount) => {
    setCart(prev => prev.map(it => it.key === key
      ? recalcItem({ ...it, discount: round2(Number(discount) || 0) })
      : it
    ))
  }

  const removeItem = (key) => setCart(prev => prev.filter(it => it.key !== key))

  // ── Hold & restore ───────────────────────────────────────────
  const holdOrder = () => {
    if (cart.length === 0) { toast.warning('Cart is empty'); return }
    const held = JSON.parse(localStorage.getItem(HOLD_KEY) || '[]')
    const order = {
      id:      `hold-${Date.now()}`,
      savedAt: new Date().toISOString(),
      mode:    saleMode,
      items:   cart,
      total:   grandTotal,
    }
    localStorage.setItem(HOLD_KEY, JSON.stringify([...held, order]))
    setCart([])
    setSaleMode('retail')
    toast.success('Order held. Screen cleared for next customer.')
  }

  const restoreOrder = (order) => {
    setCart(order.items)
    setSaleMode(order.mode)
    // Remove from held storage
    const held = JSON.parse(localStorage.getItem(HOLD_KEY) || '[]')
    localStorage.setItem(HOLD_KEY, JSON.stringify(held.filter(o => o.id !== order.id)))
  }

  const clearCart = () => { setCart([]); setSaleMode('retail') }

  const handleInvoiceSuccess = () => {
    setShowCheckout(false)
    setCart([])
    setSaleMode('retail')
    searchRef.current?.focus()
  }

  const heldCount = (() => {
    try { return JSON.parse(localStorage.getItem(HOLD_KEY) || '[]').length } catch { return 0 }
  })()

  return (
    <div className="pos-root">

      {/* ── Left: Product Search ─────────────────────────────── */}
      <div className="pos-left">
        <div className="pos-search-bar">
          <div className="pos-search-wrap">
            <span className="pos-search-icon">🔍</span>
            <input
              ref={searchRef}
              className="pos-search-input"
              placeholder="Search product by name or barcode…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoComplete="off"
            />
            {search && (
              <button className="pos-search-clear" onClick={() => { setSearch(''); setResults([]) }}>✕</button>
            )}
          </div>

          {/* Search results dropdown */}
          {(results.length > 0 || searching) && (
            <div className="pos-search-results">
              {searching && <div className="pos-search-loading">Searching…</div>}
              {results.map(p => (
                <button
                  key={p.product_id}
                  className="pos-search-result-item"
                  onClick={() => addProduct(p)}
                >
                  <div className="pos-result-info">
                    <span className="pos-result-name">{p.name}</span>
                    {p.sku && <span className="pos-result-sku">{p.sku}</span>}
                    {p.barcode && <span className="pos-result-sku">{p.barcode}</span>}
                  </div>
                  <div className="pos-result-price">
                    <span className="pos-result-unit">{p.measurement_unit}</span>
                    <span className="pos-result-amt">
                      Rs.&nbsp;{fmt(saleMode === 'wholesale' && p.wholesale_price ? p.wholesale_price : p.retail_price)}
                    </span>
                    {p.stock_quantity != null && (
                      <span className={`pos-result-stock ${Number(p.stock_quantity) <= 0 ? 'out' : ''}`}>
                        Stock: {Number(p.stock_quantity)}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Mode Toggle + Action Buttons */}
        <div className="pos-toolbar">
          <div className="pos-mode-toggle">
            <button
              className={`pos-mode-btn ${saleMode === 'retail' ? 'active' : ''}`}
              onClick={() => setSaleMode('retail')}
            >Retail</button>
            <button
              className={`pos-mode-btn ${saleMode === 'wholesale' ? 'active' : ''}`}
              onClick={() => setSaleMode('wholesale')}
            >Wholesale</button>
          </div>

          <div className="pos-actions">
            <button className="pos-action-btn" onClick={() => setShowHeld(true)}>
              📋 Held {heldCount > 0 && <span className="pos-held-badge">{heldCount}</span>}
            </button>
            <button className="pos-action-btn pos-hold-btn" onClick={holdOrder} disabled={cart.length === 0}>
              ⏸ Hold
            </button>
            {cart.length > 0 && (
              <button className="pos-action-btn pos-clear-btn" onClick={clearCart}>
                🗑 Clear
              </button>
            )}
          </div>
        </div>

        {/* Cart */}
        <div className="pos-cart">
          {cart.length === 0 ? (
            <div className="pos-cart-empty">
              <div className="pos-cart-empty-icon">🛒</div>
              <p>Cart is empty</p>
              <p className="pos-cart-empty-sub">Search for a product above to get started</p>
            </div>
          ) : (
            <table className="pos-cart-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Unit Price</th>
                  <th>Qty</th>
                  <th>Discount</th>
                  <th className="text-right">Subtotal</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {cart.map(item => (
                  <tr key={item.key}>
                    <td>
                      <div className="pos-item-name">{item.name}</div>
                      <div className="pos-item-meta">
                        {item.sku}
                        {item.isWeighted && <span className="pos-kg-badge"> · {item.quantity}kg</span>}
                      </div>
                    </td>
                    <td className="pos-item-price">Rs. {fmt(item.unit_price)}</td>
                    <td>
                      {item.isWeighted ? (
                        <span className="pos-item-qty-label">{item.quantity} kg</span>
                      ) : (
                        <div className="pos-qty-ctrl">
                          <button className="pos-qty-btn" onClick={() => updateQty(item.key, item.quantity - 1)}>−</button>
                          <input
                            className="pos-qty-input"
                            type="number" min="1" step="1"
                            value={item.quantity}
                            onChange={e => updateQty(item.key, Number(e.target.value))}
                          />
                          <button className="pos-qty-btn" onClick={() => updateQty(item.key, item.quantity + 1)}>+</button>
                        </div>
                      )}
                    </td>
                    <td>
                      <input
                        className="pos-discount-input"
                        type="number" min="0" step="0.01"
                        placeholder="0"
                        value={item.discount || ''}
                        onChange={e => updateDiscount(item.key, e.target.value)}
                      />
                    </td>
                    <td className="text-right pos-item-subtotal">Rs. {fmt(item.subtotal)}</td>
                    <td>
                      <button className="pos-remove-btn" onClick={() => removeItem(item.key)}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Right: Summary & Charge ──────────────────────────── */}
      <div className="pos-right">
        <div className="pos-summary-card">
          <div className="pos-summary-title">
            Order Summary
            <span className={`pos-mode-badge ${saleMode}`}>
              {saleMode === 'retail' ? 'Retail' : 'Wholesale'}
            </span>
          </div>

          <div className="pos-summary-rows">
            <div className="pos-sum-row">
              <span>Items</span>
              <span>{itemCount}</span>
            </div>
            <div className="pos-sum-row">
              <span>Lines</span>
              <span>{cart.length}</span>
            </div>
            <div className="pos-sum-row">
              <span>Item Discounts</span>
              <span>− Rs. {fmt(cart.reduce((s, it) => s + it.discount, 0))}</span>
            </div>
            <div className="pos-sum-divider" />
            <div className="pos-sum-row pos-sum-total">
              <span>Grand Total</span>
              <span>Rs. {fmt(grandTotal)}</span>
            </div>
          </div>

          <button
            className="pos-charge-cta"
            onClick={() => setShowCheckout(true)}
            disabled={cart.length === 0}
          >
            Charge  Rs. {fmt(grandTotal)}
          </button>

          <div className="pos-quick-actions">
            <button className="pos-qa-btn" onClick={holdOrder} disabled={cart.length === 0}>
              ⏸ Hold Order
            </button>
            <button className="pos-qa-btn" onClick={() => setShowHeld(true)}>
              📋 View Held
            </button>
          </div>
        </div>
      </div>

      {/* ── Dialogs ──────────────────────────────────────────── */}
      {weightProduct && (
        <WeightDialog
          product={weightProduct}
          mode={saleMode}
          onConfirm={addWeighted}
          onCancel={() => setWeightProduct(null)}
        />
      )}

      {showHeld && (
        <HeldOrdersPanel
          onRestore={restoreOrder}
          onClose={() => setShowHeld(false)}
        />
      )}

      {showCheckout && (
        <CheckoutPanel
          cart={cart}
          saleMode={saleMode}
          grandTotal={grandTotal}
          shopInfo={shopInfo}
          onSuccess={handleInvoiceSuccess}
          onClose={() => setShowCheckout(false)}
        />
      )}
    </div>
  )
}
