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

export const syncProfileWithBackend = async (token: string) => {
  const backendUrl = import.meta.env.VITE_STRIPE_BACKEND_URL

  if (!backendUrl) {
    throw new Error('Backend URL is missing.')
  }

  const response = await fetch(`${backendUrl}/api/auth/sync-profile`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.error || 'Could not sync profile')
  }
}
