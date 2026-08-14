import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '@/services/api'

const AuthContext = createContext(null)

// Default: all modules enabled (fallback when user is not cashier or settings not loaded)
const DEFAULT_PERMISSIONS = {
  pos: true, products: true, invoices: true, returns: true,
  customers: true, suppliers: true, purchases: true,
  inventory: true, reports: true, expenses: true,
  users: true, settings: true,
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [modulePermissions, setModulePermissions] = useState(DEFAULT_PERMISSIONS)
  const [loading, setLoading] = useState(true)

  const fetchPermissions = useCallback(async () => {
    try {
      const res = await api.get('/settings/module-permissions')
      setModulePermissions({ ...DEFAULT_PERMISSIONS, ...res.data.data })
    } catch {
      // Silently fall back to defaults
    }
  }, [])

  useEffect(() => {
    const stored = localStorage.getItem('pos_user')
    const token = localStorage.getItem('pos_access_token')
    if (stored && token) {
      const u = JSON.parse(stored)
      setUser(u)
      fetchPermissions()
    }
    setLoading(false)
  }, [fetchPermissions])

  const login = async (username, password) => {
    const res = await api.post('/auth/login', { username, password })
    const { accessToken, refreshToken, user: userData } = res.data.data
    localStorage.setItem('pos_access_token', accessToken)
    localStorage.setItem('pos_refresh_token', refreshToken)
    localStorage.setItem('pos_user', JSON.stringify(userData))
    setUser(userData)
    await fetchPermissions()
    return userData
  }

  const loginWithPin = async (user_id, pin) => {
    const res = await api.post('/auth/login-pin', { user_id, pin })
    const { accessToken, refreshToken, user: userData } = res.data.data
    localStorage.setItem('pos_access_token', accessToken)
    localStorage.setItem('pos_refresh_token', refreshToken)
    localStorage.setItem('pos_user', JSON.stringify(userData))
    setUser(userData)
    await fetchPermissions()
    return userData
  }

  const logout = async () => {
    try {
      const refreshToken = localStorage.getItem('pos_refresh_token')
      await api.post('/auth/logout', { refreshToken })
    } catch {}
    localStorage.removeItem('pos_access_token')
    localStorage.removeItem('pos_refresh_token')
    localStorage.removeItem('pos_user')
    setUser(null)
    setModulePermissions(DEFAULT_PERMISSIONS)
  }

  /** Check if a module is visible for the current user's role. */
  const canAccess = useCallback((module) => {
    // Admins and managers always have full access
    if (user?.role === 'admin' || user?.role === 'manager') return true
    // Cashiers are governed by module permissions
    return modulePermissions[module] !== false
  }, [user, modulePermissions])

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      isAuthenticated: !!user,
      modulePermissions,
      setModulePermissions,
      fetchPermissions,
      login,
      loginWithPin,
      logout,
      canAccess,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
