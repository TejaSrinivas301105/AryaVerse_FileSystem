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

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true)
        const allowed = [
            'http://localhost:5173',
            'https://beingcosmic.com',
            'https://www.beingcosmic.com',
            'https://api.beingcosmic.com',
            ...(process.env.FRONTEND_URLS || '')
                .split(',').map(o => o.trim()).filter(Boolean)
        ]
        if (allowed.includes(origin)) return callback(null, true)
        return callback(new Error('Not allowed by CORS'))
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning']
}))
app.use(express.json())
app.set('trust proxy', 1)

// Skip ngrok browser warning
app.use((req, res, next) => {
    req.headers['ngrok-skip-browser-warning'] = 'true'
    next()
})

// Serve uploaded files from local disk
const uploadsDir = process.env.LOCAL_STORAGE_PATH
    ? path.resolve(process.env.LOCAL_STORAGE_PATH)
    : path.resolve(__dirname, '../../uploads')
app.use('/files', (req, res, next) => {
    if (req.path.match(/\.html?$/i)) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.setHeader('Content-Disposition', 'inline')
    }
    next()
}, express.static(uploadsDir))


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

app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'beingcosmic API is running' })
})

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() })
})

const port = Number(process.env.PORT || 3000)

app.listen(port, () => {
    console.log(`Server running on port ${port}`)
    if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
        testSupabaseConnection()
    }
})
