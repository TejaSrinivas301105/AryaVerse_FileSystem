import { Router } from 'express'
import {
    File_upload,
    request_access,
    admin_approve,
    admin_reject,
    check_access,
    get_pending_requests,
    get_my_files,
    get_all_files,
    delete_file,
    create_folder,
    get_folders,
    upload
} from '../Controllers/File_System_control.js'
import { adminOnly, authenticate } from '../MiddleWares/File_Auth_middle.js'
import { register, login } from '../Controllers/Auth_control.js'

const router = Router()

// Auth routes (no token needed)
router.post('/register', register)
router.post('/login', login)

// Admin routes
router.post('/upload', authenticate, adminOnly, (req, res, next) => {
    upload.array('files', 100)(req, res, (err) => {
        if (err) return res.status(400).json({ error: err.message })
        next()
    })
}, File_upload)
router.get('/requests', authenticate, adminOnly, get_pending_requests)
router.post('/approve', authenticate, adminOnly, admin_approve)
router.post('/reject', authenticate, adminOnly, admin_reject)
router.delete('/file', authenticate, adminOnly, delete_file)
router.post('/folder', authenticate, adminOnly, create_folder)
router.get('/folders', authenticate, adminOnly, get_folders)

// Employee + Admin routes
router.post('/request-access', authenticate, request_access)
router.post('/access-file', authenticate, check_access)
router.get('/my-files', authenticate, get_my_files)
router.get('/all-files', authenticate, get_all_files)

export default router
