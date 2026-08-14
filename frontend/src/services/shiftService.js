import api from './api'

export function listShifts(params) { return api.get('/shifts', { params }) }
export function getCurrentShift()  { return api.get('/shifts/current') }
export function openShift(data)    { return api.post('/shifts', data) }
export function closeShift(id, data) { return api.put(`/shifts/${id}`, data) }
export function getShiftStats(id)  { return api.get(`/shifts/${id}`) }
