import api from './api'

export function createInvoice(data)     { return api.post('/invoices', data) }
export function listInvoices(params)    { return api.get('/invoices', { params }) }
export function getInvoice(id)          { return api.get(`/invoices/${id}`) }
export function cancelInvoice(id)       { return api.patch(`/invoices/${id}/cancel`) }
