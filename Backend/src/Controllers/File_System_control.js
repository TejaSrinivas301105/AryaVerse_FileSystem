import supabase from '../config/supabase.js'
import { sendAccessRequestEmail, sendAccessGrantedEmail, sendAccessRejectedEmail } from '../util/Email_notify.js'
import multer from 'multer'

// multer — memory storage, up to 10 files, 100MB each
export const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 },
})

// Admin: Upload multiple files to Supabase Storage + save metadata
export const File_upload = async (req, res) => {
    const { folder_id } = req.body
    const admin_id = req.user.id

    if (!req.files || req.files.length === 0)
        return res.status(400).json({ error: 'No files provided' })

    const results = []

    for (const file of req.files) {
        const { originalname, buffer, mimetype } = file
        const storagePath = `uploads/${Date.now()}_${originalname}`

        const { error: storageErr } = await supabase.storage
            .from('files')
            .upload(storagePath, buffer, { contentType: mimetype, upsert: false })

        if (storageErr) {
            results.push({ file_name: originalname, error: storageErr.message })
            continue
        }

        const { data: urlData } = supabase.storage.from('files').getPublicUrl(storagePath)

        const { data, error } = await supabase
            .from('files')
            .insert([{ file_name: originalname, file_url: urlData.publicUrl, uploaded_by: admin_id, folder_id: folder_id || null }])
            .select()
            .single()

        results.push(error ? { file_name: originalname, error: error.message } : data)
    }

    res.status(201).json({ message: 'Upload complete', files: results })
}

// Employee: Request access to a file
export const request_access = async (req, res) => {
    const { file_id } = req.body
    const user_id = req.user.id

    if (!file_id) return res.status(400).json({ error: 'file_id is required' })

    const { data: file, error: fileErr } = await supabase
        .from('files')
        .select('file_name')
        .eq('id', file_id)
        .single()

    if (fileErr || !file) return res.status(404).json({ error: 'File not found' })

    const { data: existing } = await supabase
        .from('access_requests')
        .select('id')
        .eq('user_id', user_id)
        .eq('file_id', file_id)
        .eq('status', 'pending')
        .single()

    if (existing) return res.status(400).json({ error: 'Access request already pending' })

    const { error } = await supabase
        .from('access_requests')
        .insert([{ user_id, file_id }])

    if (error) return res.status(500).json({ error: error.message })

    const { data: employee } = await supabase.from('users').select('email').eq('id', user_id).single()
    const { data: admins } = await supabase.from('users').select('email').eq('role', 'admin')

    if (employee && admins?.length > 0) {
        for (const admin of admins) {
            await sendAccessRequestEmail(admin.email, employee.email, file.file_name).catch(() => {})
        }
    }

    res.status(201).json({ message: 'Access request submitted. Admin will be notified.' })
}

// Admin: Get all pending access requests
export const get_pending_requests = async (req, res) => {
    const { data, error } = await supabase
        .from('access_requests')
        .select('*, users(email), files(file_name)')
        .eq('status', 'pending')
        .order('requested_at', { ascending: false })

    if (error) return res.status(500).json({ error: error.message })
    res.json({ requests: data })
}

// Admin: Approve access request
export const admin_approve = async (req, res) => {
    const { request_id, duration_ms } = req.body

    if (!request_id || !duration_ms)
        return res.status(400).json({ error: 'request_id and duration_ms are required' })

    const { data: request, error: reqErr } = await supabase
        .from('access_requests')
        .select('user_id, file_id')
        .eq('id', request_id)
        .single()

    if (reqErr || !request) return res.status(404).json({ error: 'Request not found' })

    const expires_at = new Date(Date.now() + Number(duration_ms))

    const { error: updateErr } = await supabase
        .from('access_requests')
        .update({ status: 'approved' })
        .eq('id', request_id)

    if (updateErr) return res.status(500).json({ error: updateErr.message })

    // Remove old access entry if exists, then insert new
    await supabase.from('file_access').delete()
        .eq('user_id', request.user_id).eq('file_id', request.file_id)

    const { error: accessErr } = await supabase
        .from('file_access')
        .insert([{ user_id: request.user_id, file_id: request.file_id, expires_at }])

    if (accessErr) return res.status(500).json({ error: accessErr.message })

    const { data: employee } = await supabase.from('users').select('email').eq('id', request.user_id).single()
    const { data: file } = await supabase.from('files').select('file_name').eq('id', request.file_id).single()

    if (employee && file) {
        await sendAccessGrantedEmail(employee.email, file.file_name, expires_at).catch(() => {})
    }

    res.json({ message: 'Access granted', expires_at })
}

// Admin: Reject access request
export const admin_reject = async (req, res) => {
    const { request_id } = req.body

    if (!request_id) return res.status(400).json({ error: 'request_id is required' })

    const { data: request, error: reqErr } = await supabase
        .from('access_requests')
        .select('user_id, file_id')
        .eq('id', request_id)
        .single()

    if (reqErr || !request) return res.status(404).json({ error: 'Request not found' })

    const { error } = await supabase
        .from('access_requests')
        .update({ status: 'rejected' })
        .eq('id', request_id)

    if (error) return res.status(500).json({ error: error.message })

    const { data: employee } = await supabase.from('users').select('email').eq('id', request.user_id).single()
    const { data: file } = await supabase.from('files').select('file_name').eq('id', request.file_id).single()

    if (employee && file) {
        await sendAccessRejectedEmail(employee.email, file.file_name).catch(() => {})
    }

    res.json({ message: 'Access request rejected' })
}

// Employee/Admin: Access a file if permission is valid
export const check_access = async (req, res) => {
    const { file_id } = req.body
    const user_id = req.user.id

    if (!file_id) return res.status(400).json({ error: 'file_id is required' })

    // Admins always have access
    const { data: userRecord } = await supabase.from('users').select('role').eq('id', user_id).single()
    if (userRecord?.role === 'admin') {
        const { data: file } = await supabase.from('files').select('*').eq('id', file_id).single()
        return res.json({ access: true, file })
    }

    const { data } = await supabase
        .from('file_access')
        .select('expires_at')
        .eq('user_id', user_id)
        .eq('file_id', file_id)
        .gt('expires_at', new Date().toISOString())
        .single()

    if (!data) return res.status(403).json({ access: false, message: 'Access denied or expired' })

    const { data: file } = await supabase.from('files').select('*').eq('id', file_id).single()

    await supabase.from('audit_logs').insert([{ user_id, file_id, action: 'accessed' }])

    res.json({ access: true, file, expires_at: data.expires_at })
}

// Both: Get ALL files (with folder info) — employee sees all but access is checked per file
export const get_all_files = async (req, res) => {
    const { data, error } = await supabase
        .from('files')
        .select('id, file_name, file_url, folder_id, folders(folder_name)')
        .order('created_at', { ascending: false })

    if (error) return res.status(500).json({ error: error.message })
    res.json({ files: data })
}

// Employee: List all files with active access
export const get_my_files = async (req, res) => {
    const user_id = req.user.id

    const { data, error } = await supabase
        .from('file_access')
        .select('expires_at, files(id, file_name, file_url, folder_id)')
        .eq('user_id', user_id)
        .gt('expires_at', new Date().toISOString())

    if (error) return res.status(500).json({ error: error.message })
    res.json({ files: data })
}
