import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

/**
 * Convert a JavaScript value into a CSV-safe string.
 * - Wraps fields containing commas, quotes, or newlines in double quotes
 * - Escapes embedded double quotes by doubling them
 * - Returns an empty string for null/undefined
 */
function csvEscape(value) {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Convert an array of plain objects into a CSV string.
 *
 * @param {Array<object>} data          - Rows to export
 * @param {Array<{key: string, label: string}>} columns - Column descriptors (order matters)
 * @returns {string} CSV text
 */
export function toCSV(data, columns) {
  const header = columns.map(c => csvEscape(c.label)).join(',')
  const rows = data.map(row =>
    columns.map(c => csvEscape(row[c.key])).join(',')
  )
  return [header, ...rows].join('\r\n')
}

/**
 * Trigger a browser download for the given text content.
 */
function downloadFile(content, filename, mimeType) {
  // Prepend UTF-8 BOM so Excel detects the encoding correctly
  const blob = new Blob(['﻿', content], { type: `${mimeType};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Export an array of objects as a CSV file.
 *
 * @param {Array<object>} data
 * @param {string} filename - e.g. "sales-report.csv"
 * @param {Array<{key: string, label: string}>} columns
 */
export function exportToCSV(data, filename, columns) {
  const csv = toCSV(data, columns)
  downloadFile(csv, filename, 'text/csv')
}

/**
 * Default shop info used when none is supplied.
 */
const DEFAULT_SHOP = {
  name: 'POS System',
  address: '',
  phone: '',
  email: '',
}

/**
 * Export an array of objects as a branded PDF document.
 *
 * @param {Array<object>} data
 * @param {string} filename        - e.g. "sales-report.pdf"
 * @param {string} title           - Document title shown in the header
 * @param {Array<{key: string, label: string}>} columns
 * @param {object} [shopInfo]      - Optional shop metadata for the header
 */
export function exportToPDF(data, filename, title, columns, shopInfo = {}) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const shop = { ...DEFAULT_SHOP, ...shopInfo }
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 40

  // ─── Header ────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(33, 37, 41)
  doc.text(shop.name, margin, 50)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(108, 117, 125)
  let subY = 66
  if (shop.address) { doc.text(shop.address, margin, subY); subY += 12 }
  if (shop.phone)   { doc.text(`Phone: ${shop.phone}`, margin, subY); subY += 12 }
  if (shop.email)   { doc.text(`Email: ${shop.email}`, margin, subY); subY += 12 }

  // Title + generated-on date on the right
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(33, 37, 41)
  doc.text(title, pageWidth - margin, 50, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(108, 117, 125)
  const generatedAt = new Date().toLocaleString()
  doc.text(`Generated: ${generatedAt}`, pageWidth - margin, 66, { align: 'right' })

  // Divider
  doc.setDrawColor(222, 226, 230)
  doc.setLineWidth(0.5)
  doc.line(margin, subY + 4, pageWidth - margin, subY + 4)

  // ─── Table ─────────────────────────────────────────────────────────
  const head = [columns.map(c => c.label)]
  const body = data.map(row => columns.map(c => {
    const v = row[c.key]
    return v === null || v === undefined ? '' : String(v)
  }))

  autoTable(doc, {
    head,
    body,
    startY: subY + 18,
    margin: { left: margin, right: margin },
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: 6,
      textColor: [33, 37, 41],
      lineColor: [222, 226, 230],
      lineWidth: 0.5,
    },
    headStyles: {
      fillColor: [99, 102, 241],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
    },
    alternateRowStyles: { fillColor: [248, 249, 250] },
    columnStyles: columns.reduce((acc, c, i) => {
      // Right-align numeric columns
      if (c.numeric) acc[i] = { halign: 'right' }
      return acc
    }, {}),
    didDrawPage: (hookData) => {
      const pageH = doc.internal.pageSize.getHeight()
      const pageW = doc.internal.pageSize.getWidth()
      // Footer
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(108, 117, 125)
      const pageNum = doc.internal.getNumberOfPages()
      doc.text(
        `${shop.name}  •  Page ${hookData.pageNumber} of ${pageNum}`,
        pageW / 2,
        pageH - 16,
        { align: 'center' }
      )
    },
  })

  doc.save(filename)
}
