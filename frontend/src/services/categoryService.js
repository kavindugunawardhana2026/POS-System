import api from './api'

export function listCategories(params) {
  return api.get('/categories', { params })
}
