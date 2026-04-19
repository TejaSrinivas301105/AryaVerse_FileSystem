import express from 'express'
import dotenv from 'dotenv'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import fileRoutes from './src/Routes/File_upload.js'
import supabase, { getMissingSupabaseEnvVars } from './src/config/supabase.js'

dotenv.config()

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

/*
  Rate Limiting — Why?
  Without this, anyone can spam your API:
  - Brute force login attempts (try 1000 passwords)
  - Flood upload endpoint and fill your storage
  - Spam access requests to overload email/DB

  How it works:
  - Each IP is tracked separately
  - If they exceed the limit in the window, they get 429 Too Many Requests
  - Window resets after the time period
*/

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
