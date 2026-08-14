import api from './api'

export const listSuppliers   = (params) => api.get('/suppliers', { params })
export const getSupplier     = (id)     => api.get(`/suppliers/${id}`)
export const createSupplier  = (data)   => api.post('/suppliers', data)
export const updateSupplier  = (id, d)  => api.put(`/suppliers/${id}`, d)
export const deleteSupplier  = (id)     => api.delete(`/suppliers/${id}`)
