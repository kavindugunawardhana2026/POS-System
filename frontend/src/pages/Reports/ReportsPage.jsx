import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/context/ToastContext'
import api from '@/services/api'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts'

const fmt    = (n) => Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtInt = (n) => Number(n || 0).toLocaleString('en-LK')

// Default to last 30 days
function defaultFrom() {
  const d = new Date()
  d.setDate(d.getDate() - 29)
  return d.toISOString().slice(0, 10)
}
function defaultTo() {
  return new Date().toISOString().slice(0, 10)
}

function KpiCard({ icon, label, value, sub, color }) {
  return (
    <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ fontSize: '2rem', lineHeight: 1 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: '1.4rem', fontWeight: 700, color: color || 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
        {sub && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{sub}</div>}
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
        api.get('/reports/sales-summary',  { params }),
        api.get('/reports/top-products',   { params: { ...params, limit: 10 } }),
        api.get('/reports/sales-by-period',{ params: { ...params, group_by: groupBy } }),
        api.get('/reports/payment-methods',{ params }),
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

  return (
    <div className="users-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">📊 Reports</h1>
          <p className="page-subtitle">Sales analytics and insights</p>
        </div>
      </div>

      {/* Date controls */}
      <div className="users-toolbar" style={{ flexWrap: 'wrap', gap: 8 }}>
        {QUICK.map(q => (
          <button key={q.label} className="btn btn-secondary"
            style={{ padding: '4px 12px', fontSize: '0.85rem', background: from === q.from && to === q.to ? 'var(--primary)' : undefined, color: from === q.from && to === q.to ? '#fff' : undefined }}
            onClick={() => { setFrom(q.from); setTo(q.to) }}>
            {q.label}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>From:</label>
          <input className="input" type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ width: 145 }} />
          <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>To:</label>
          <input className="input" type="date" value={to} onChange={e => setTo(e.target.value)} style={{ width: 145 }} />
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div className="spinner" /></div>
      ) : (
        <>
          {/* KPI Cards */}
          {summary && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
              <KpiCard icon="💰" label="Total Revenue"     value={`Rs. ${fmt(summary.total_revenue)}`}   sub={`${fmtInt(summary.invoice_count)} invoices`} />
              <KpiCard icon="📈" label="Avg Order Value"   value={`Rs. ${fmt(summary.avg_order_value)}`} sub="per invoice" />
              <KpiCard icon="🏷️" label="Total Discounts"  value={`Rs. ${fmt(summary.total_discount)}`}  sub="given to customers" color="var(--danger)" />
              <KpiCard icon="✅" label="Paid Invoices"     value={fmtInt(summary.paid_count)}            sub={`${fmtInt(summary.unpaid_count)} unpaid`} color="var(--success)" />
            </div>
          )}

          {/* Sales Trend Chart */}
          <div className="card" style={{ padding: '16px 20px', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Sales Trend</h2>
              <div style={{ display: 'flex', gap: 6 }}>
                {['day', 'month'].map(g => (
                  <button key={g} className={`btn ${groupBy === g ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '4px 10px', fontSize: '0.8rem', textTransform: 'capitalize' }}
                    onClick={() => setGroupBy(g)}>
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
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="period" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                  <YAxis yAxisId="rev" orientation="left"  tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                  <YAxis yAxisId="cnt" orientation="right" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                  <Tooltip
                    formatter={(v, name) => name === 'Revenue' ? [`Rs. ${fmt(v)}`, name] : [v, name]}
                    contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}
                  />
                  <Legend />
                  <Line yAxisId="rev" type="monotone" dataKey="Revenue" stroke="var(--primary)" strokeWidth={2} dot={false} />
                  <Line yAxisId="cnt" type="monotone" dataKey="Invoices" stroke="var(--accent)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Bottom Row: Top Products + Payment Methods */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>
            {/* Top Products */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>🏆 Top Products</div>
              {topProducts.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 20 }}>No sales data</p>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Product</th>
                      <th>SKU</th>
                      <th style={{ textAlign: 'right' }}>Qty Sold</th>
                      <th style={{ textAlign: 'right' }}>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProducts.map((p, i) => (
                      <tr key={i}>
                        <td style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>#{i + 1}</td>
                        <td><strong>{p.name}</strong></td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{p.sku}</td>
                        <td style={{ textAlign: 'right' }}>{fmtInt(p.qty_sold)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>Rs. {fmt(p.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Payment Methods */}
            <div className="card" style={{ padding: '16px 20px' }}>
              <h2 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 700 }}>💳 Payment Methods</h2>
              {paymentData.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>No payment data</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={paymentData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} />
                    <YAxis type="category" dataKey="payment_method" width={70} tick={{ fontSize: 11, fill: 'var(--text-secondary)', textTransform: 'capitalize' }} />
                    <Tooltip
                      formatter={(v) => [`Rs. ${fmt(v)}`, 'Total']}
                      contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}
                    />
                    <Bar dataKey="total" fill="var(--primary)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
              <div style={{ marginTop: 12 }}>
                {paymentData.map((p, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderTop: i > 0 ? '1px solid var(--border)' : 'none', fontSize: '0.9rem' }}>
                    <span style={{ textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{p.payment_method}</span>
                    <strong>Rs. {fmt(p.total)}</strong>
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
