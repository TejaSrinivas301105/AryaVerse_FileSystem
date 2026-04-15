import supabase from '../config/supabase.js'

// Middleware: verify Supabase JWT and attach user to req
export const authenticate = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) return res.status(401).json({ error: 'No token provided' })

    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return res.status(401).json({ error: 'Invalid or expired token' })

    req.user = user
    next()
}

// Middleware: restrict to admin role only
export const adminOnly = async (req, res, next) => {
    const { data } = await supabase.from('users').select('role').eq('id', req.user.id).single()
    if (data?.role !== 'admin') return res.status(403).json({ error: 'Admins only' })
    next()
}