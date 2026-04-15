import supabase from '../config/supabase.js'

// Register — role must be 'admin' or 'employee'
export const register = async (req, res) => {
    const { email, password, role } = req.body

    if (!email || !password || !role) 
        return res.status(400).json({ error: 'email, password and role are required' })

    if (!['admin', 'employee'].includes(role))
        return res.status(400).json({ error: 'role must be admin or employee' })

    const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,        // skip email confirmation for testing
        user_metadata: { role }
    })

    if (error) return res.status(400).json({ error: error.message })

    // Sync into public users table
    await supabase.from('users').upsert({ id: data.user.id, email, role })

    res.status(201).json({ message: 'User registered', user_id: data.user.id })
}

// Login — returns access_token to use as Bearer token
export const login = async (req, res) => {
    const { email, password } = req.body

    if (!email || !password)
        return res.status(400).json({ error: 'email and password are required' })

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) return res.status(401).json({ error: error.message })

    res.json({
        access_token: data.session.access_token,
        role: data.user.user_metadata.role,
        user_id: data.user.id
    })
}
