import api from './api'

export const listReturns    = (params)   => api.get('/returns', { params })
export const getReturn      = (id)       => api.get(`/returns/${id}`)
export const createReturn   = (data)     => api.post('/returns', data)
export const validateCredit = (rn)       => api.get(`/returns/credit/${encodeURIComponent(rn)}`)
