import api from './api'

/**
 * Friendly measurement-unit labels (UI) mapped to backend enum values (wire).
 * The backend accepts any of these spellings and normalizes internally.
 */
export const MEASUREMENT_UNITS = [
  { value: 'units',  label: 'Units' },
  { value: 'kg',     label: 'Kg' },
  { value: 'grams',  label: 'Grams' },
  { value: 'liters', label: 'Liters' },
  { value: 'ml',     label: 'ml' },
  { value: 'pack',   label: 'Pack' },
]

export function getProductById  (id)        { return api.get(`/products/${id}`) }
export function listProducts    (params)    { return api.get('/products', { params }) }
export function createProduct   (data)      { return api.post('/products', data) }
export function updateProduct   (id, data)  { return api.put(`/products/${id}`, data) }
export function deleteProduct   (id)        { return api.delete(`/products/${id}`) }
export function listLowStock    ()          { return api.get('/products/low-stock') }

/**
 * Bulk upload a spreadsheet (.xlsx, .xls, .csv).
 * @param {File} file
 * @param {(p:number)=>void} [onProgress]
 */
export function bulkUploadProducts(file, onProgress) {
  const form = new FormData()
  form.append('file', file)
  return api.post('/products/bulk-upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (evt) => {
      if (onProgress && evt.total) {
        onProgress(Math.round((evt.loaded * 100) / evt.total))
      }
    },
  })
}

/**
 * Build a CSV template the user can download to see the expected column layout.
 */
export function buildTemplateCsv() {
  const headers = [
    'SKU', 'Barcode', 'Name', 'Category', 'Brand', 'Description',
    'Cost Price', 'Retail Price', 'Wholesale Price', 'Min Wholesale Quantity',
    'Measurement Unit', 'Stock Quantity', 'Low Stock Threshold',
  ]
  const example = [
    'SKU-001', '4901234567890', 'Sample Product', 'Beverages', 'Acme', '1L bottle',
    '40.00', '60.00', '50.00', '12', 'Units', '100', '10',
  ]
  // CSV escaping for any field containing commas or quotes.
  const esc = (v) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [headers, example].map((row) => row.map(esc).join(','))
  return lines.join('\r\n')
}

export function downloadTemplate(filename = 'product-import-template.csv') {
  const csv = buildTemplateCsv()
  // Prepend UTF-8 BOM so Excel opens it with the right encoding.
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
