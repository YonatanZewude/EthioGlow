import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase env vars. Check .env.local')
}

export const createSupabaseClient = (token?: string) => {
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers,
    },
  })
}
