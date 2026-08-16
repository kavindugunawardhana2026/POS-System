import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/context/ToastContext'
import { DollarSign, TrendingUp, Tag, CheckCircle, Trophy, CreditCard, FileDown, FileText } from 'lucide-react'
import api from '@/services/api'
import { exportToCSV, exportToPDF } from '@/utils/exportUtils'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts'
import './ReportsPage.css'

const fmt    = (n) => Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtInt = (n) => Number(n || 0).toLocaleString('en-LK')

function defaultFrom() {
  const d = new Date()
  d.setDate(d.getDate() - 29)
  return d.toISOString().slice(0, 10)
}
function defaultTo() { return new Date().toISOString().slice(0, 10) }

function KpiCard({ icon: Icon, iconClass, label, value, sub, valueClass }) {
  return (
    <div className="kpi-card">
      <div className={`kpi-icon ${iconClass}`}><Icon size={20} strokeWidth={2} /></div>
      <div className="kpi-info">
        <div className="kpi-label">{label}</div>
        <div className={`kpi-value ${valueClass || ''}`}>{value}</div>
        {sub && <div className="kpi-sub">{sub}</div>}
      </div>
    </div>
  )
}

export default function ReportsPage() {
  const toast = useToast()

  const [from, setFrom]           = useState(defaultFrom)
  const [to, setTo]               = useState(defaultTo)
  const [groupBy, setGroupBy]     = useState('day')
  const [loading, setLoading]     = useState(true)
  const [summary, setSummary]     = useState(null)
  const [topProducts, setTopProducts] = useState([])
  const [periodData, setPeriodData]   = useState([])
  const [paymentData, setPaymentData] = useState([])
  const [shopInfo, setShopInfo]       = useState({})

  const QUICK = [
    { label: 'Today',      from: defaultTo(),          to: defaultTo() },
    { label: 'This Week',  from: (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().slice(0,10) })(), to: defaultTo() },
    { label: 'This Month', from: new Date().toISOString().slice(0,7) + '-01', to: defaultTo() },
    { label: 'Last 30d',   from: defaultFrom(), to: defaultTo() },
  ]

  const loadAll = useCallback(async () => {
    setLoading(true)
    const params = { from, to }
    try {
      const [summRes, topRes, periodRes, pmRes] = await Promise.all([
        api.get('/reports/sales-summary',   { params }),
        api.get('/reports/top-products',    { params: { ...params, limit: 10 } }),
        api.get('/reports/sales-by-period', { params: { ...params, group_by: groupBy } }),
        api.get('/reports/payment-methods', { params }),
      ])
      setSummary(summRes.data.data)
      setTopProducts(topRes.data.data)
      setPeriodData(periodRes.data.data.map(r => ({
        period: r.period,
        Revenue: Number(r.revenue),
        Invoices: Number(r.invoice_count),
      })))
      setPaymentData(pmRes.data.data)
    } catch {
      toast.error('Failed to load reports')
    } finally {
      setLoading(false)
    }
  }, [from, to, groupBy, toast])

  useEffect(() => { loadAll() }, [loadAll])

  // Fetch shop settings once for branding exports
  useEffect(() => {
    api.get('/settings')
      .then(r => setShopInfo(r.data?.data || {}))
      .catch(() => { /* non-fatal */ })
  }, [])

  // ─── Export handlers ───────────────────────────────────────────────
  const dateTag = `${from}_to_${to}`

  const handleExportCSV = () => {
    try {
      const rows = [
        { Section: 'Sales Summary', Metric: 'Total Revenue',        Value: summary?.total_revenue ?? '' },
        { Section: 'Sales Summary', Metric: 'Invoice Count',        Value: summary?.invoice_count  ?? '' },
        { Section: 'Sales Summary', Metric: 'Average Order Value',  Value: summary?.avg_order_value ?? '' },
        { Section: 'Sales Summary', Metric: 'Total Discount',       Value: summary?.total_discount  ?? '' },
        { Section: 'Sales Summary', Metric: 'Paid Invoices',        Value: summary?.paid_count      ?? '' },
        { Section: 'Sales Summary', Metric: 'Unpaid Invoices',      Value: summary?.unpaid_count    ?? '' },
        ...periodData.map(p => ({
          Section: 'Sales Trend',
          Metric: p.period,
          'Revenue (Rs.)': p.Revenue,
          Invoices: p.Invoices,
        })),
        ...topProducts.map((p, i) => ({
          Section: 'Top Products',
          Rank: i + 1,
          Product: p.name,
          SKU: p.sku,
          'Qty Sold': p.qty_sold,
          'Revenue (Rs.)': p.revenue,
        })),
        ...paymentData.map(p => ({
          Section: 'Payment Methods',
          'Payment Method': p.payment_method,
          'Total (Rs.)': p.total,
        })),
      ]
      const cols = [
        { key: 'Section',         label: 'Section' },
        { key: 'Metric',          label: 'Metric' },
        { key: 'Rank',            label: 'Rank' },
        { key: 'Product',         label: 'Product' },
        { key: 'SKU',             label: 'SKU' },
        { key: 'Qty Sold',        label: 'Qty Sold' },
        { key: 'Revenue (Rs.)',   label: 'Revenue (Rs.)' },
        { key: 'Total (Rs.)',     label: 'Total (Rs.)' },
        { key: 'Payment Method',  label: 'Payment Method' },
        { key: 'Invoices',        label: 'Invoices' },
        { key: 'Value',           label: 'Value' },
      ]
      exportToCSV(rows, `sales-report_${dateTag}.csv`, cols)
      toast.success('CSV downloaded')
    } catch {
      toast.error('CSV export failed')
    }
  }

  const handleExportPDF = () => {
    try {
      const title = `Sales Report (${from} → ${to})`
      const cols = [
        { key: 'Section',        label: 'Section',        numeric: false },
        { key: 'Metric',         label: 'Metric / Period',numeric: false },
        { key: 'Product',        label: 'Product',        numeric: false },
        { key: 'Revenue (Rs.)',  label: 'Revenue (Rs.)',  numeric: true  },
        { key: 'Qty Sold',       label: 'Qty Sold',       numeric: true  },
        { key: 'Total (Rs.)',    label: 'Total (Rs.)',    numeric: true  },
      ]
      const rows = [
        { Section: 'Sales Summary', Metric: 'Total Revenue',       'Revenue (Rs.)': summary?.total_revenue ?? '' },
        { Section: 'Sales Summary', Metric: 'Invoice Count',       'Qty Sold':      summary?.invoice_count  ?? '' },
        { Section: 'Sales Summary', Metric: 'Avg Order Value',     'Revenue (Rs.)': summary?.avg_order_value ?? '' },
        { Section: 'Sales Summary', Metric: 'Total Discount',      'Revenue (Rs.)': summary?.total_discount  ?? '' },
        { Section: 'Sales Summary', Metric: 'Paid Invoices',       'Qty Sold':      summary?.paid_count      ?? '' },
        { Section: 'Sales Summary', Metric: 'Unpaid Invoices',     'Qty Sold':      summary?.unpaid_count    ?? '' },
        ...periodData.map(p => ({
          Section: 'Sales Trend',
          Metric: p.period,
          'Revenue (Rs.)': p.Revenue,
          'Qty Sold': p.Invoices,
        })),
        ...topProducts.map(p => ({
          Section: 'Top Products',
          Product: `${p.name} (${p.sku})`,
          'Revenue (Rs.)': p.revenue,
          'Qty Sold': p.qty_sold,
        })),
        ...paymentData.map(p => ({
          Section: 'Payment Methods',
          Metric: p.payment_method,
          'Total (Rs.)': p.total,
        })),
      ]
      exportToPDF(rows, `sales-report_${dateTag}.pdf`, title, cols, {
        name:    shopInfo.store_name,
        address: shopInfo.address,
        phone:   shopInfo.phone,
        email:   shopInfo.email,
      })
      toast.success('PDF downloaded')
    } catch {
      toast.error('PDF export failed')
    }
  }

  const tooltipStyle = {
    backgroundColor: 'var(--card-bg)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    fontSize: 13,
  }

  return (
    <div className="reports-page page-root">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Sales analytics and insights</p>
        </div>
        <div className="page-actions">
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleExportCSV}
            disabled={loading}
            title="Export current report as CSV"
          >
            <FileText size={14} /> Export CSV
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleExportPDF}
            disabled={loading}
            title="Export current report as PDF"
          >
            <FileDown size={14} /> Export PDF
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="reports-toolbar">
        {QUICK.map(q => (
          <button
            key={q.label}
            className={`btn ${from === q.from && to === q.to ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => { setFrom(q.from); setTo(q.to) }}
          >
            {q.label}
          </button>
        ))}
        <div className="reports-date-range">
          <span className="reports-date-label">From:</span>
          <input className="reports-date-input" type="date" value={from} onChange={e => setFrom(e.target.value)} />
          <span className="reports-date-label">To:</span>
          <input className="reports-date-input" type="date" value={to} onChange={e => setTo(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="table-loading"><div className="spinner" /></div>
      ) : (
        <>
          {/* KPI Cards */}
          {summary && (
            <div className="reports-kpi-grid">
              <KpiCard icon={DollarSign} iconClass="kpi-icon-blue"  label="Total Revenue"   value={`Rs. ${fmt(summary.total_revenue)}`}   sub={`${fmtInt(summary.invoice_count)} invoices`} />
              <KpiCard icon={TrendingUp} iconClass="kpi-icon-green"  label="Avg Order Value" value={`Rs. ${fmt(summary.avg_order_value)}`} sub="per invoice" />
              <KpiCard icon={Tag}        iconClass="kpi-icon-red"    label="Total Discounts" value={`Rs. ${fmt(summary.total_discount)}`}  sub="given to customers" valueClass="kpi-value-danger" />
              <KpiCard icon={CheckCircle}iconClass="kpi-icon-teal"   label="Paid Invoices"   value={fmtInt(summary.paid_count)}            sub={`${fmtInt(summary.unpaid_count)} unpaid`} valueClass="kpi-value-success" />
            </div>
          )}

          {/* Sales Trend Chart */}
          <div className="card reports-chart-card">
            <div className="reports-chart-header">
              <h2 className="reports-chart-title">Sales Trend</h2>
              <div className="reports-chart-controls">
                {['day', 'month'].map(g => (
                  <button
                    key={g}
                    className={`btn ${groupBy === g ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                    onClick={() => setGroupBy(g)}
                  >
                    {g === 'day' ? 'Daily' : 'Monthly'}
                  </button>
                ))}
              </div>
            </div>
            {periodData.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 20 }}>No data in selected range</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={periodData}>
                  <defs>
                    <linearGradient id="lineGrad1" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#6366f1" /><stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                    <linearGradient id="lineGrad2" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#22c55e" /><stop offset="100%" stopColor="#4ade80" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="period" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="rev" orientation="left"  tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="cnt" orientation="right" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v, name) => name === 'Revenue' ? [`Rs. ${fmt(v)}`, name] : [v, name]} contentStyle={tooltipStyle} />
                  <Legend />
                  <Line yAxisId="rev" type="monotone" dataKey="Revenue" stroke="url(#lineGrad1)" strokeWidth={2.5} dot={false} />
                  <Line yAxisId="cnt" type="monotone" dataKey="Invoices" stroke="url(#lineGrad2)" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Bottom Row */}
          <div className="reports-bottom-grid">
            {/* Top Products */}
            <div className="card reports-products-card">
              <div className="reports-table-header"><Trophy size={16} color="var(--warning)" /> Top Products</div>
              {topProducts.length === 0 ? (
                <p className="table-empty">No sales data</p>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Product</th>
                        <th>SKU</th>
                        <th className="num">Qty Sold</th>
                        <th className="num">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topProducts.map((p, i) => (
                        <tr key={i}>
                          <td><span className="product-rank">#{i + 1}</span></td>
                          <td><strong>{p.name}</strong></td>
                          <td><span className="sku-cell">{p.sku}</span></td>
                          <td className="num">{fmtInt(p.qty_sold)}</td>
                          <td className="num" style={{ fontWeight: 600 }}>Rs. {fmt(p.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Payment Methods */}
            <div className="card reports-payment-card">
              <h2 className="reports-payment-title"><CreditCard size={18} /> Payment Methods</h2>
              {paymentData.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>No payment data</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={paymentData} layout="vertical">
                    <defs>
                      <linearGradient id="pmBarGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#6366f1" /><stop offset="100%" stopColor="#8b5cf6" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="payment_method" width={70} tick={{ fontSize: 11, fill: 'var(--text-secondary)', textTransform: 'capitalize' }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v) => [`Rs. ${fmt(v)}`, 'Total']} contentStyle={tooltipStyle} />
                    <Bar dataKey="total" fill="url(#pmBarGrad)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
              <div className="reports-payment-breakdown">
                {paymentData.map((p, i) => (
                  <div key={i} className="reports-payment-row">
                    <span className="reports-payment-method">{p.payment_method}</span>
                    <strong className="reports-payment-amount">Rs. {fmt(p.total)}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
