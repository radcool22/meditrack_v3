import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const savedToken = localStorage.getItem('mt_token')
    const savedUser = localStorage.getItem('mt_user')
    if (savedToken && savedUser) {
      setToken(savedToken)
      setUser(JSON.parse(savedUser))
    }
    setLoading(false)
  }, [])

  function login(token, user) {
    localStorage.setItem('mt_token', token)
    localStorage.setItem('mt_user', JSON.stringify(user))
    setToken(token)
    setUser(user)
  }

  function updateUser(updatedUser) {
    localStorage.setItem('mt_user', JSON.stringify(updatedUser))
    setUser(updatedUser)
  }

  function logout() {
    localStorage.removeItem('mt_token')
    localStorage.removeItem('mt_user')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, updateUser, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
