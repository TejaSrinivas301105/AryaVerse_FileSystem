import express from 'express'
import dotenv from 'dotenv'
import cors from 'cors'
import fileRoutes from './src/Routes/File_upload.js'
import supabase from './src/config/supabase.js'

dotenv.config()

const app = express()
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
}))
app.use(express.json())

app.use('/api', fileRoutes)

async function testSupabaseConnection() {
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
