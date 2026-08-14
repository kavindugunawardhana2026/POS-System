import { useState, useEffect } from 'react'
import { listShifts } from '@/services/shiftService'
import { useToast } from '@/context/ToastContext'

export default function ShiftsPage() {
  const [shifts, setShifts] = useState([])
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  const fetchShifts = async () => {
    try {
      setLoading(true)
      const res = await listShifts()
      setShifts(res.data.data)
    } catch (err) {
      toast.error('Failed to load shifts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchShifts()
  }, [])

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Shift Management</h1>
      </div>

      <div className="card">
        {loading ? (
          <p>Loading...</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Cashier</th>
                <th>Opened At</th>
                <th>Closed At</th>
                <th>Opening Cash</th>
                <th>Expected Cash</th>
                <th>Closing Cash</th>
                <th>Variance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {shifts.length === 0 && (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '1rem' }}>No shifts found.</td>
                </tr>
              )}
              {shifts.map(s => (
                <tr key={s.shift_id}>
                  <td>{s.shift_id}</td>
                  <td>{s.cashier_name}</td>
                  <td>{new Date(s.opened_at).toLocaleString()}</td>
                  <td>{s.closed_at ? new Date(s.closed_at).toLocaleString() : '-'}</td>
                  <td>Rs. {s.opening_cash}</td>
                  <td>{s.expected_cash ? `Rs. ${s.expected_cash}` : '-'}</td>
                  <td>{s.closing_cash ? `Rs. ${s.closing_cash}` : '-'}</td>
                  <td style={{ color: s.variance < 0 ? 'red' : 'inherit' }}>
                    {s.variance !== null ? `Rs. ${s.variance}` : '-'}
                  </td>
                  <td>
                    <span className={`badge ${s.status === 'open' ? 'badge-success' : 'badge-neutral'}`}>
                      {s.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
