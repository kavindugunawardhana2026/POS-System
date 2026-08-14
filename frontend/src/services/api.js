import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pos_access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auto-refresh on 401 ONLY — do NOT retry on 429 or other errors
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    const status = err.response?.status

    // Only attempt token refresh on 401, and only once per request
    if (status === 401 && !original._retry) {
      original._retry = true
      try {
        const refreshToken = localStorage.getItem('pos_refresh_token')
        if (!refreshToken) throw new Error('No refresh token')
        const { data } = await axios.post(
          `${import.meta.env.VITE_API_BASE_URL || '/api/v1'}/auth/refresh`,
          { refreshToken }
        )
        const newToken = data.data.accessToken
        localStorage.setItem('pos_access_token', newToken)
        original.headers.Authorization = `Bearer ${newToken}`
        return api(original)
      } catch (_) {
        // Refresh failed — clear tokens and redirect to login
        localStorage.clear()
        window.location.href = '/login'
      }
    }

    // For 429 Too Many Requests, attach a friendly message
    if (status === 429) {
      err.message = 'Too many requests. Please wait a moment and try again.'
    }

    return Promise.reject(err)
  }
)

export default api
