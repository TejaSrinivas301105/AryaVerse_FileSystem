import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { register } from '../api'

export default function Register() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [role, setRole] = useState('employee')
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [loading, setLoading] = useState(false)
    const navigate = useNavigate()

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError('')
        const data = await register(email, password, role)
        setLoading(false)
        if (data.error) return setError(data.error)
        setSuccess('Registered successfully! Redirecting to login...')
        setTimeout(() => navigate('/'), 1500)
    }

    return (
        <div className="auth-container">
            <div className="auth-card">
                <h2>Register</h2>
                <form onSubmit={handleSubmit}>
                    <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
                    <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
                    <select value={role} onChange={e => setRole(e.target.value)}>
                        <option value="employee">Employee</option>
                    </select>
                    {error && <p className="error">{error}</p>}
                    {success && <p className="success">{success}</p>}
                    <button type="submit" disabled={loading}>{loading ? 'Registering...' : 'Register'}</button>
                </form>
                <p>Already have an account? <Link to="/">Login</Link></p>
            </div>
        </div>
    )
}
