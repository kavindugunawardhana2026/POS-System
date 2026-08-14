import api from './api'

export function listPromotions(params) { return api.get('/promotions', { params }) }
export function getPromotion(id)       { return api.get(`/promotions/${id}`) }
export function createPromotion(data)  { return api.post('/promotions', data) }
export function updatePromotion(id, data) { return api.put(`/promotions/${id}`, data) }
export function deletePromotion(id)    { return api.delete(`/promotions/${id}`) }
export function getActivePromotions()  { return api.get('/promotions/active') }
