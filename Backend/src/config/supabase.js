import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const hasSupabaseConfig = Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
)

const supabase = hasSupabaseConfig
    ? createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    : null

export const getMissingSupabaseEnvVars = () => {
    const missing = []
    if (!process.env.SUPABASE_URL) missing.push('SUPABASE_URL')
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY')
    return missing
}

export default supabase
