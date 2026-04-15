import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './AuthContext'
import Login from './pages/Login'
import Register from './pages/Register'
import AdminDashboard from './pages/AdminDashboard'
import EmployeeDashboard from './pages/EmployeeDashboard'

const ProtectedRoute = ({ children, allowedRole }) => {
    const { token, role } = useAuth()
    if (!token) return <Navigate to="/" />
    if (allowedRole && role !== allowedRole) return <Navigate to="/" />
    return children
}

export default function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/admin" element={
                        <ProtectedRoute allowedRole="admin"><AdminDashboard /></ProtectedRoute>
                    } />
                    <Route path="/employee" element={
                        <ProtectedRoute allowedRole="employee"><EmployeeDashboard /></ProtectedRoute>
                    } />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    )
}
