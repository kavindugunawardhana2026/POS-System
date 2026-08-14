import api from './api'

export const listPurchases   = (params) => api.get('/purchases', { params })
export const getPurchase     = (id)     => api.get(`/purchases/${id}`)
export const createPurchase  = (data)   => api.post('/purchases', data)
export const deletePurchase  = (id)     => api.delete(`/purchases/${id}`)
