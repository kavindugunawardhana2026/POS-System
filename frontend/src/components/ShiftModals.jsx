import { useState } from 'react'

export function OpenShiftModal({ onOpenShift }) {
  const [openingCash, setOpeningCash] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!openingCash) return
    setLoading(true)
    await onOpenShift({ opening_cash: Number(openingCash), notes })
    setLoading(false)
  }

  return (
    <div className="pos-dialog-backdrop">
      <div className="pos-dialog">
        <div className="pos-dialog-header">
          <span>Open Shift</span>
        </div>
        <div className="pos-dialog-body">
          <p style={{ marginBottom: '16px' }}>You must open a shift to use the POS system.</p>
          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label>Opening Cash (Rs.)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="pos-co-input"
                style={{ width: '100%', padding: '8px', fontSize: '1.1rem' }}
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label>Notes (Optional)</label>
              <textarea
                className="pos-co-input"
                style={{ width: '100%', padding: '8px' }}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px' }} disabled={loading}>
              {loading ? 'Opening...' : 'Start Shift'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export function CloseShiftModal({ currentShift, onCloseShift, onCancel }) {
  const [closingCash, setClosingCash] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!closingCash) return
    setLoading(true)
    await onCloseShift({ closing_cash: Number(closingCash), notes })
    setLoading(false)
  }

  return (
    <div className="pos-dialog-backdrop" onClick={onCancel}>
      <div className="pos-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="pos-dialog-header">
          <span>Close Shift</span>
          <button className="pos-dialog-close" onClick={onCancel} disabled={loading}>✕</button>
        </div>
        <div className="pos-dialog-body">
          <p style={{ marginBottom: '16px' }}>Declare your closing cash below.</p>
          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label>Closing Cash (Rs.)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="pos-co-input"
                style={{ width: '100%', padding: '8px', fontSize: '1.1rem' }}
                value={closingCash}
                onChange={(e) => setClosingCash(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label>Notes (Optional)</label>
              <textarea
                className="pos-co-input"
                style={{ width: '100%', padding: '8px' }}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
            <button type="submit" className="btn btn-danger" style={{ width: '100%', padding: '12px' }} disabled={loading}>
              {loading ? 'Closing...' : 'Close Shift'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
