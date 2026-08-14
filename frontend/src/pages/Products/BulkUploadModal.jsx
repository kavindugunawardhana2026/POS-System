import { useRef, useState } from 'react'
import { useToast } from '@/context/ToastContext'
import { bulkUploadProducts, downloadTemplate } from '@/services/productService'
import './ProductsPage.css'

const ACCEPTED = '.xlsx,.xls,.csv'
const MAX_BYTES = 5 * 1024 * 1024 // 5 MB (matches backend)

export default function BulkUploadModal({ onClose, onComplete }) {
  const toast = useToast()
  const inputRef = useRef(null)

  const [file, setFile] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [progress, setProgress] = useState(0)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null) // { inserted, failed, errors }

  const pickFile = () => inputRef.current?.click()

  const handleSelect = (picked) => {
    if (!picked) return
    if (picked.size > MAX_BYTES) {
      toast.error(`File is too large (${(picked.size / 1024 / 1024).toFixed(2)} MB). Max is 5 MB.`)
      return
    }
    const ext = (picked.name.split('.').pop() || '').toLowerCase()
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      toast.error('Unsupported file type. Use .xlsx, .xls, or .csv')
      return
    }
    setFile(picked)
    setResult(null)
    setProgress(0)
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    handleSelect(e.dataTransfer.files?.[0])
  }

  const upload = async () => {
    if (!file) return
    setBusy(true)
    setProgress(0)
    try {
      const res = await bulkUploadProducts(file, (p) => setProgress(p))
      const payload = res.data?.data || { inserted: [], failed: 0, errors: [] }
      setResult(payload)
      if (res.data?.success) {
        toast.success(res.data.message || 'Products imported successfully')
        // Close after a brief delay so the user sees the success message.
        setTimeout(() => onComplete?.(), 800)
      } else {
        toast.warning(res.data?.message || 'Import completed with errors')
      }
    } catch (err) {
      const data = err?.response?.data
      toast.error(data?.message || 'Upload failed')
    } finally {
      setBusy(false)
      setProgress(100)
    }
  }

  const reset = () => {
    setFile(null)
    setResult(null)
    setProgress(0)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="modal-backdrop" onClick={busy ? undefined : onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📥 Bulk Upload Products</h2>
          <button className="modal-close" disabled={busy} onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <p className="text-secondary" style={{ marginBottom: 12 }}>
            Upload an Excel (.xlsx / .xls) or CSV file. Each row creates one product.
            SKU is generated automatically if left blank.
          </p>

          {!file && (
            <div
              className={`bulk-zone ${dragging ? 'dragging' : ''}`}
              onClick={pickFile}
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <div className="upload-icon">📂</div>
              <div className="upload-title">Drop a file here or click to browse</div>
              <div className="upload-hint">.xlsx, .xls, or .csv — up to 5 MB</div>
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPTED}
                onChange={(e) => handleSelect(e.target.files?.[0])}
              />
            </div>
          )}

          {file && (
            <>
              <div className="bulk-info-row">
                <span className="file-name">📄 {file.name}</span>
                <div>
                  <span className="text-secondary" style={{ marginRight: 10 }}>
                    {(file.size / 1024).toFixed(1)} KB
                  </span>
                  {!busy && (
                    <button className="btn btn-secondary btn-sm" onClick={reset}>
                      Choose different file
                    </button>
                  )}
                </div>
              </div>

              {busy && (
                <>
                  <div className="bulk-progress">
                    <div className="bulk-progress-bar" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="text-secondary" style={{ textAlign: 'center' }}>
                    Uploading... {progress}%
                  </div>
                </>
              )}

              {result && (
                <>
                  {result.inserted?.length > 0 && (
                    <div className="bulk-success">
                      ✅ Imported {result.inserted.length} product(s)
                    </div>
                  )}
                  {result.errors?.length > 0 && (
                    <div className="bulk-errors">
                      <h4>⚠ {result.errors.length} row(s) failed:</h4>
                      <ul>
                        {result.errors.slice(0, 50).map((e, i) => (
                          <li key={i}>Row {e.row}: {e.message}</li>
                        ))}
                        {result.errors.length > 50 && (
                          <li>... and {result.errors.length - 50} more</li>
                        )}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* ─── Required columns hint ─── */}
          <div style={{
            marginTop: 16,
            padding: 12,
            background: 'var(--hover-bg)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.8rem',
          }}>
            <strong>Expected columns:</strong>
            <div style={{ marginTop: 6, color: 'var(--text-secondary)' }}>
              SKU, Barcode, <span style={{ color: 'var(--danger)' }}>Name</span>,
              Category (slug or name), Brand, Description,
              Cost Price, <span style={{ color: 'var(--danger)' }}>Retail Price</span>,
              Wholesale Price, Min Wholesale Quantity,
              Measurement Unit (Units / Kg / Grams / Liters / ml / Pack),
              Stock Quantity, Low Stock Threshold
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => downloadTemplate()}>
            ⬇ Download Template
          </button>
          <button className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Close
          </button>
          <button
            className="btn btn-primary"
            onClick={upload}
            disabled={!file || busy}
          >
            {busy ? 'Uploading...' : 'Upload & Import'}
          </button>
        </div>
      </div>
    </div>
  )
}
