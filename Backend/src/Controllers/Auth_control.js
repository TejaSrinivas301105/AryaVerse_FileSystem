import supabase from '../config/supabase.js'

// Register — role must be 'admin' or 'employee'
export const register = async (req, res) => {
    const email = req.body?.email?.trim()?.toLowerCase()
    const password = req.body?.password
    const role = req.body?.role || 'employee'

    if (!email || !password)
        return res.status(400).json({ error: 'email and password are required' })

    if (typeof password !== 'string' || password.length < 6)
        return res.status(400).json({ error: 'password must be at least 6 characters' })

    if (!['admin', 'employee'].includes(role))
        return res.status(400).json({ error: 'role must be admin or employee' })

    const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,        // skip email confirmation for testing
        app_metadata: { role }
    })

    if (error) {
        const message = String(error.message || '').toLowerCase()

        if (message.includes('already') || message.includes('registered') || message.includes('exists')) {
            return res.status(409).json({ error: 'User already exists. Please login instead.' })
        }

        return res.status(400).json({ error: error.message || 'Failed to register user' })
    }

    // Sync into public users table
    const { error: upsertError } = await supabase
        .from('users')
        .upsert({ id: data.user.id, email, role })

    if (upsertError) return res.status(500).json({ error: upsertError.message })

    res.status(201).json({ message: 'User registered', user_id: data.user.id })
}

// Login — returns access_token to use as Bearer token
export const login = async (req, res) => {
    const { email, password } = req.body

    if (!email || !password)
        return res.status(400).json({ error: 'email and password are required' })

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) return res.status(401).json({ error: error.message })

    const { data: userRow } = await supabase
        .from('users')
        .select('role')
        .eq('id', data.user.id)
        .single()

    const resolvedRole = userRow?.role || data.user.app_metadata?.role || 'employee'

    res.json({
        access_token: data.session.access_token,
        role: resolvedRole,
        user_id: data.user.id
    })
}
