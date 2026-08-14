import { useRef, useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import Receipt from './Receipt'
import ReceiptA4 from './ReceiptA4'
import './Receipt.css'

/**
 * ReceiptPreview
 * – Shows a screen preview of the thermal receipt
 * – On print: renders the receipt into a hidden <div class="receipt-print-portal">
 *   and calls window.print(). The @media print CSS hides everything else.
 * – paperWidth: '80mm' (default) | '58mm'
 */
export default function ReceiptPreview({ invoice, shopInfo, onClose, autoPrint = false }) {
  const { t } = useTranslation()
  const [paperWidth, setPaperWidth] = useState(
    shopInfo?.thermal_printer || '80mm'
  )
  const [loyaltySettings, setLoyaltySettings] = useState(null)
  
  useEffect(() => {
    import('@/services/api').then(module => {
      module.default.get('/settings').then(res => setLoyaltySettings(res.data.data)).catch(() => {})
    })
  }, [])
  const receiptPrintRef = useRef(null)
  const printPortalRef  = useRef(null)

  // Create a hidden div at body root for the print portal
  useEffect(() => {
    const div = document.createElement('div')
    div.className = 'receipt-print-portal'
    div.style.display = 'none'
    document.body.appendChild(div)
    printPortalRef.current = div
    return () => { document.body.removeChild(div) }
  }, [])

  const handlePrint = useCallback(() => {
    if (!printPortalRef.current) return

    // Render receipt into the hidden portal div
    // We synchronously inject the HTML via innerHTML clone approach
    const receiptEl = receiptPrintRef.current
    if (!receiptEl) return

    // Make the portal visible (only for print)
    printPortalRef.current.innerHTML = receiptEl.outerHTML

    // Trigger browser print
    window.print()

    // Clean up after print dialog closes
    setTimeout(() => {
      if (printPortalRef.current) printPortalRef.current.innerHTML = ''
    }, 500)
  }, [])

  // Auto-print on mount if requested
  useEffect(() => {
    if (autoPrint) {
      // Small delay lets the modal render first
      const t = setTimeout(() => handlePrint(), 300)
      return () => clearTimeout(t)
    }
  }, [autoPrint, handlePrint])

  return (
    <div className="receipt-preview-backdrop" onClick={onClose}>
      <div className="receipt-preview-shell" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="receipt-preview-header">
          <span>🧾 {t('receipt.preview', 'Receipt Preview')}</span>
          <div className="receipt-preview-header-actions">
            {/* Paper width toggle */}
            <div className="receipt-preview-size">
              {['80mm', '58mm', 'A4'].map(w => (
                <button
                  key={w}
                  className={`receipt-size-btn ${paperWidth === w ? 'active' : ''}`}
                  onClick={() => setPaperWidth(w)}
                >
                  {w}
                </button>
              ))}
            </div>
            <button className="receipt-preview-close" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Preview body */}
        <div className="receipt-preview-body">
          {paperWidth === 'A4' ? (
            <ReceiptA4
              ref={receiptPrintRef}
              invoice={invoice}
              shopInfo={shopInfo}
            />
          ) : (
            <Receipt
              ref={receiptPrintRef}
              invoice={invoice}
              shopInfo={shopInfo}
              paperWidth={paperWidth}
              loyaltySettings={loyaltySettings}
            />
          )}
        </div>

        {/* Footer actions */}
        <div className="receipt-preview-footer">
          <button className="btn btn-secondary" onClick={onClose}>{t('pos.cancel', 'Close')}</button>
          <button className="btn btn-primary" onClick={handlePrint}>
            🖨️ {t('pos.print', 'Print Receipt')}
          </button>
        </div>
      </div>

      {/* Hidden print portal (always in DOM, invisible on screen) */}
      {printPortalRef.current &&
        createPortal(
          paperWidth === 'A4' ? (
            <ReceiptA4
              invoice={invoice}
              shopInfo={shopInfo}
            />
          ) : (
            <Receipt
              invoice={invoice}
              shopInfo={shopInfo}
              paperWidth={paperWidth}
              loyaltySettings={loyaltySettings}
            />
          ),
          printPortalRef.current
        )
      }
    </div>
  )
}
