import './src/config/env.js'  // MUST be first — loads .env before all other imports
import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import path from 'path'
import { fileURLToPath } from 'url'
import fileRoutes from './src/Routes/File_upload.js'
import supabase, { getMissingSupabaseEnvVars } from './src/config/supabase.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()

const defaultAllowedOrigins = [
    'http://localhost:5173',
    'https://beingcosmic.com',
    'https://www.beingcosmic.com'
]

const envAllowedOrigins = (process.env.FRONTEND_URLS || process.env.FRONTEND_URL || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean)

const allowedOrigins = [...new Set([...defaultAllowedOrigins, ...envAllowedOrigins])]

app.use(cors({
    origin: (origin, callback) => {
        // Allow non-browser clients and same-origin requests without an Origin header.
        if (!origin) return callback(null, true)
        if (allowedOrigins.includes(origin)) return callback(null, true)
        return callback(new Error('Not allowed by CORS'))
    },
    credentials: true
}))
app.use(express.json())

// Serve uploaded files from local disk
const uploadsDir = process.env.LOCAL_STORAGE_PATH
    ? path.resolve(process.env.LOCAL_STORAGE_PATH)
    : path.join(__dirname, 'uploads')
app.use('/files', express.static(uploadsDir))


// Auth routes — strict: 10 attempts per 15 min per IP
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Too many attempts. Please try again after 15 minutes.' }
})

// Upload — 20 uploads per 10 min per IP
const uploadLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 20,
    message: { error: 'Upload limit reached. Please wait before uploading more files.' }
})

// General API — 100 requests per minute per IP
const generalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    message: { error: 'Too many requests. Please slow down.' }
})

app.use('/api/login', authLimiter)
app.use('/api/register', authLimiter)
app.use('/api/upload', uploadLimiter)
app.use('/api', generalLimiter)

app.use('/api', (req, res, next) => {
    const missingVars = getMissingSupabaseEnvVars()
    if (missingVars.length > 0) {
        return res.status(500).json({
            error: 'Server configuration missing required environment variables.',
            missing: missingVars
        })
    }
    next()
})

app.use('/api', fileRoutes)

async function testSupabaseConnection() {
    if (!supabase) {
        console.error('Supabase connection skipped: missing required environment variables')
        return
    }
    const { error } = await supabase.from('users').select('id').limit(1)
    if (error) {
        console.error('Supabase connection failed:', error.message)
    } else {
        console.log('Supabase connected successfully')
    }
}

app.listen(3000, () => {
    console.log('Server running on port 3000')
    testSupabaseConnection()
})
