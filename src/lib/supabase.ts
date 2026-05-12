import { createClient } from '@supabase/supabase-js'

type SyncedProfile = {
  id: string
  email: string | null
  role: 'admin' | 'paying_user'
  subscription_status: string
  subscription_active: boolean
}

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

  return data.profile as SyncedProfile
}

export const createCheckoutSession = async (token: string) => {
  const backendUrl = import.meta.env.VITE_STRIPE_BACKEND_URL

  if (!backendUrl) {
    throw new Error('Backend URL is missing.')
  }

  const response = await fetch(`${backendUrl}/api/stripe/create-checkout-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok || !data.url) {
    throw new Error(data.error || 'Checkout failed')
  }

  return data.url as string
}

export const syncCheckoutSessionWithBackend = async (token: string, sessionId: string) => {
  const backendUrl = import.meta.env.VITE_STRIPE_BACKEND_URL

  if (!backendUrl) {
    throw new Error('Backend URL is missing.')
  }

  const response = await fetch(`${backendUrl}/api/stripe/sync-checkout-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ sessionId }),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.error || 'Could not sync checkout session')
  }

  return data.profile as SyncedProfile
}
