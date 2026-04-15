import { createContext, useContext, useState } from 'react'

const AuthContext = createContext()

export const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(localStorage.getItem('token') || '')
    const [role, setRole] = useState(localStorage.getItem('role') || '')
    const [userId, setUserId] = useState(localStorage.getItem('userId') || '')

    const saveAuth = (token, role, userId) => {
        localStorage.setItem('token', token)
        localStorage.setItem('role', role)
        localStorage.setItem('userId', userId)
        setToken(token)
        setRole(role)
        setUserId(userId)
    }

    const logout = () => {
        localStorage.clear()
        setToken('')
        setRole('')
        setUserId('')
    }

    return (
        <AuthContext.Provider value={{ token, role, userId, saveAuth, logout }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => useContext(AuthContext)
