import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { getMetrics, getSalesTrend, getLowStock, getRecentTransactions } from '@/services/dashboardService'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import { TrendingUp, ShoppingCart, RotateCcw, Users, AlertTriangle, Clock } from 'lucide-react'
import './DashboardPage.css'

function LiveClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="dash-clock">
      <div className="dash-clock-time">
        {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </div>
      <div className="dash-clock-date">
        {now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { t } = useTranslation()
  const [metrics, setMetrics] = useState({ todaySales: 0, todayOrders: 0, todayReturns: 0, totalCustomers: 0 })
  const [salesTrend, setSalesTrend] = useState([])
  const [lowStock, setLowStock] = useState([])
  const [recentTx, setRecentTx] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const [mRes, sRes, lRes, rRes] = await Promise.all([
          getMetrics(),
          getSalesTrend(7),
          getLowStock(10),
          getRecentTransactions(8)
        ])
        setMetrics(mRes.data.data)
        setSalesTrend(sRes.data.data)
        setLowStock(lRes.data.data)
        setRecentTx(rRes.data.data)
      } catch (err) {
        console.error('Failed to load dashboard data', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const fmt = (n) => Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  if (loading) {
    return (
      <div className="dash-loading">
        <div className="spinner" />
        <p>{t('dashboard.loading', 'Loading Dashboard...')}</p>
      </div>
    )
  }

  return (
    <div className="dashboard-root">
      {/* Header */}
      <div className="dash-header">
        <div className="dash-header-left">
          <h1>{t('dashboard.title', 'Dashboard Overview')}</h1>
          <p>{t('dashboard.subtitle', "Real-time updates on your store's performance today")}</p>
        </div>
        <LiveClock />
      </div>

      {/* ── Key Metrics ── */}
      <div className="dash-metrics-grid">
        <div className="dash-metric-card">
          <div className="dmc-icon bg-blue"><TrendingUp size={22} /></div>
          <div className="dmc-info">
            <span className="dmc-label">{t('dashboard.today_sales', "Today's Sales")}</span>
            <span className="dmc-val">Rs. {fmt(metrics.todaySales)}</span>
          </div>
        </div>
        <div className="dash-metric-card">
          <div className="dmc-icon bg-green"><ShoppingCart size={22} /></div>
          <div className="dmc-info">
            <span className="dmc-label">{t('dashboard.orders_today', 'Orders Today')}</span>
            <span className="dmc-val">{metrics.todayOrders}</span>
          </div>
        </div>
        <div className="dash-metric-card">
          <div className="dmc-icon bg-orange"><RotateCcw size={22} /></div>
          <div className="dmc-info">
            <span className="dmc-label">{t('dashboard.returns_today', 'Returns Today')}</span>
            <span className="dmc-val">{metrics.todayReturns}</span>
          </div>
        </div>
        <div className="dash-metric-card">
          <div className="dmc-icon bg-purple"><Users size={22} /></div>
          <div className="dmc-info">
            <span className="dmc-label">{t('dashboard.total_customers', 'Total Customers')}</span>
            <span className="dmc-val">{metrics.totalCustomers}</span>
          </div>
        </div>
      </div>

      {/* ── Main Grid ── */}
      <div className="dash-main-grid">
        {/* Sales Trend Chart */}
        <div className="dash-card dash-chart-card">
          <div className="dash-card-header">
            <h3><TrendingUp size={16} /> {t('dashboard.revenue_7_days', 'Revenue (Last 7 Days)')}</h3>
          </div>
          <div className="dash-chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesTrend} barSize={36}>
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={1} />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.7} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="date"
                  tickFormatter={tick => tick.substring(5)}
                  axisLine={false}
                  tickLine={false}
                  stroke="var(--text-secondary)"
                  fontSize={12}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  stroke="var(--text-secondary)"
                  fontSize={12}
                  dx={-10}
                  tickFormatter={tick => `Rs.${tick / 1000}k`}
                />
                <Tooltip
                  cursor={{ fill: 'var(--hover-bg)', radius: 6 }}
                  contentStyle={{
                    backgroundColor: 'var(--card-bg)',
                    borderColor: 'var(--border)',
                    borderRadius: 10,
                    backdropFilter: 'blur(12px)',
                    fontSize: 13,
                  }}
                  formatter={(val) => [`Rs. ${fmt(val)}`, t('dashboard.sales', 'Sales')]}
                />
                <Bar dataKey="sales" fill="url(#barGrad)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Side Widgets */}
        <div className="dash-side-widgets">
          {/* Low Stock */}
          <div className="dash-card">
            <div className="dash-card-header">
              <h3><AlertTriangle size={16} color="var(--warning)" /> {t('dashboard.low_stock', 'Low Stock Alerts')}</h3>
            </div>
            <div className="dash-widget-body">
              {lowStock.length === 0 ? (
                <div className="dash-empty">{t('dashboard.stock_healthy', 'Stock levels are healthy!')}</div>
              ) : (
                <ul className="dash-list">
                  {lowStock.map(item => (
                    <li key={item.product_id} className="dash-list-item">
                      <div className="dli-main">
                        <span className="dli-name">{item.name}</span>
                        <span className="dli-sku">{item.sku}</span>
                      </div>
                      <div className="dli-status">
                        <span className="badge badge-warning">
                          {Number(item.stock_quantity).toFixed(0)} {t('dashboard.left', 'left')}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="dash-card">
            <div className="dash-card-header">
              <h3><Clock size={16} color="var(--text-secondary)" /> {t('dashboard.recent_sales', 'Recent Sales')}</h3>
            </div>
            <div className="dash-widget-body">
              {recentTx.length === 0 ? (
                <div className="dash-empty">{t('dashboard.no_tx', 'No transactions yet')}</div>
              ) : (
                <ul className="dash-list">
                  {recentTx.map(tx => (
                    <li key={tx.invoice_id} className="dash-list-item">
                      <div className="dli-main">
                        <span className="dli-name">{tx.invoice_number}</span>
                        <span className="dli-sku">
                          {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="dli-status">
                        <strong style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--accent-light)', fontSize: '0.875rem' }}>
                          Rs. {fmt(tx.total_amount)}
                        </strong>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
