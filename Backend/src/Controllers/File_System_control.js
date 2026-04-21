import multer from 'multer'
import path from 'path'
import fs from 'fs'
import supabase from '../config/supabase.js'
import { sendAccessGrantedEmail, sendAccessRejectedEmail, sendAccessRequestEmail } from '../util/Email_notify.js'

const sanitizeFilename = (name) => {
    const ext = path.extname(name)
    const base = path.basename(name, ext).replace(/[^a-zA-Z0-9_\-]/g, '_')
    return `${base}${ext.toLowerCase()}`
}

const getStoragePath = () => path.resolve(process.env.LOCAL_STORAGE_PATH || './uploads')
const STORAGE_PATH = getStoragePath()
if (!fs.existsSync(STORAGE_PATH)) fs.mkdirSync(STORAGE_PATH, { recursive: true })

// multer — disk storage, up to 100 files, 100MB each
export const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, STORAGE_PATH),
        filename: (req, file, cb) => cb(null, `${Date.now()}_${sanitizeFilename(file.originalname)}`)
    }),
    limits: { fileSize: 100 * 1024 * 1024 },
})

export const File_upload = async (req, res) => {
    const { folder_id } = req.body
    const admin_id = req.user.id
    let relativePaths = []

    try {
        relativePaths = req.body.relative_paths ? JSON.parse(req.body.relative_paths) : []
    } catch { relativePaths = [] }

    if (!req.files || req.files.length === 0)
        return res.status(400).json({ error: 'No files provided' })

    const folderCache = {}

    const getOrCreateFolder = async (folderName) => {
        if (!folderName) return folder_id || null
        if (folderCache[folderName]) return folderCache[folderName]
        // Check if folder already exists
        const { data: existing } = await supabase
            .from('folders')
            .select('id')
            .eq('folder_name', folderName)
            .single()
        if (existing) {
            folderCache[folderName] = existing.id
            return existing.id
        }
        // Create new folder
        const { data: created } = await supabase
            .from('folders')
            .insert([{ folder_name: folderName, created_by: admin_id }])
            .select('id')
            .single()
        folderCache[folderName] = created.id
        return created.id
    }

    const results = []

    for (let i = 0; i < req.files.length; i++) {
        const { originalname } = req.files[i]
        const relativePath = relativePaths[i] || ''


        const safeName = sanitizeFilename(originalname)


        let resolvedFolderId = folder_id || null
        if (relativePath) {
            const parts = relativePath.split('/')
            if (parts.length > 1) {
                // Use top-level folder name only (e.g. "ProjectDocs")
                const topFolder = parts[0]
                resolvedFolderId = await getOrCreateFolder(topFolder)
            }
        }

        const diskFilename = req.files[i].filename
        const fileUrl = `${process.env.SERVER_BASE_URL || 'http://localhost:3000'}/files/${diskFilename}`

        const { data, error } = await supabase
            .from('files')
            .insert([{ file_name: safeName, file_url: fileUrl, uploaded_by: admin_id, folder_id: resolvedFolderId }])
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

export const get_all_files = async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.min(50, parseInt(req.query.limit) || 20)
    const offset = (page - 1) * limit
    const user_id = req.user.id

    const { data: userRecord } = await supabase.from('users').select('role').eq('id', user_id).single()
    const isAdmin = userRecord?.role === 'admin'

    const { data, error, count } = await supabase
        .from('files')
        .select('id, file_name, file_url, folder_id, folders(folder_name)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

    if (error) return res.status(500).json({ error: error.message })

    if (isAdmin) {
        return res.json({
            files: data,
            pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) }
        })
    }

    // For employees: hide file_url, attach access_status per file
    const fileIds = data.map(f => f.id)

    const { data: accessRows } = await supabase
        .from('file_access')
        .select('file_id, expires_at')
        .eq('user_id', user_id)
        .in('file_id', fileIds)

    const { data: requestRows } = await supabase
        .from('access_requests')
        .select('file_id, status')
        .eq('user_id', user_id)
        .in('file_id', fileIds)

    const accessMap = {}
    for (const a of accessRows || []) {
        accessMap[a.file_id] = new Date(a.expires_at) > new Date() ? 'granted' : 'expired'
    }

    const requestMap = {}
    for (const r of requestRows || []) {
        requestMap[r.file_id] = r.status  // 'pending', 'approved', 'rejected'
    }

    const files = data.map(({ file_url, ...rest }) => ({
        ...rest,
        access_status: accessMap[rest.id] || requestMap[rest.id] || 'none'
    }))

    res.json({
        files,
        pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) }
    })
}

export const delete_file = async (req, res) => {
    const { file_id } = req.body

    if (!file_id) return res.status(400).json({ error: 'file_id is required' })

    const { data: file, error: fileErr } = await supabase
        .from('files')
        .select('file_url')
        .eq('id', file_id)
        .single()

    if (fileErr || !file) return res.status(404).json({ error: 'File not found' })

    const filename = file.file_url.split('/files/').pop()
    const filePath = path.join(STORAGE_PATH, filename)
    if (filename && fs.existsSync(filePath)) fs.unlinkSync(filePath)

    const { error } = await supabase.from('files').delete().eq('id', file_id)
    if (error) return res.status(500).json({ error: error.message })

    res.json({ message: 'File deleted successfully' })
}

export const create_folder = async (req, res) => {
    const { folder_name } = req.body
    const admin_id = req.user.id

    if (!folder_name?.trim()) return res.status(400).json({ error: 'folder_name is required' })

    const { data, error } = await supabase
        .from('folders')
        .insert([{ folder_name: folder_name.trim(), created_by: admin_id }])
        .select()
        .single()

    if (error) return res.status(500).json({ error: error.message })
    res.status(201).json({ message: 'Folder created', folder: data })
}

// Admin: Get all folders
export const get_folders = async (req, res) => {
    const { data, error } = await supabase
        .from('folders')
        .select('id, folder_name, created_at')
        .order('created_at', { ascending: false })

    if (error) return res.status(500).json({ error: error.message })
    res.json({ folders: data })
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
