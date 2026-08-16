import api from './api'

export const listExpenses   = (params) => api.get('/expenses', { params })
export const getExpense     = (id)     => api.get(`/expenses/${id}`)
export const createExpense  = (data)   => api.post('/expenses', data)
export const updateExpense  = (id, data) => api.put(`/expenses/${id}`, data)
export const deleteExpense  = (id)     => api.delete(`/expenses/${id}`)
